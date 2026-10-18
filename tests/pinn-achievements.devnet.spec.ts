import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as anchor from '@coral-xyz/anchor';
import {
  Umi,
  PublicKey,
  generateSigner,
  percentAmount,
  publicKey,
  sol,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import {
  createTree,
  setTreeDelegate,
  findTreeConfigPda,
  fetchTreeConfigFromSeeds,
} from '@metaplex-foundation/mpl-bubblegum';
import {
  createNft,
  approveCollectionAuthority,
  findCollectionAuthorityRecordPda,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  createBackendAchievementUmi,
  mintAchievementCnftToPlayer,
  findAchvAuthorityPda,
  findPinnConfigPda,
  serializeInitializeConfigData,
  PINN_ACHIEVEMENTS_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
} from '../src/solana/achievementMinter';

// tests/pinn-achievements.devnet.spec.ts — top of file
const RPC_URL = process.env.DEVNET_DAS_RPC_URL
  ?? process.env.ANCHOR_PROVIDER_URL
  ?? 'https://api.devnet.solana.com';
if (!RPC_URL || RPC_URL.includes('api.devnet.solana.com')) {
  throw new Error(
    'DAS-enabled RPC required. Set DEVNET_DAS_RPC_URL (e.g. Helius).'
  );
}

process.env.ANCHOR_WALLET =
  process.env.ANCHOR_WALLET ?? path.join(os.homedir(), '.config', 'solana', 'id.json');

/**
 * Lightweight Chai-compatible `expect` helper supporting synchronous assertions
 * and `.to.be.rejectedWith(RegExp)` for async promises.
 */
function expect(actual: any) {
  const lengthAssertion = {
    greaterThan(min: number) {
      if (!actual || typeof actual.length !== 'number' || actual.length <= min) {
        throw new Error(`Expected length > ${min}, got ${actual?.length}`);
      }
      return assertions;
    },
  };

  const assertions = {
    to: {
      equal(expected: any) {
        if (actual !== expected) {
          throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
        }
        return assertions;
      },
      be: {
        true: (() => {
          if (actual !== true) {
            throw new Error(`Expected ${JSON.stringify(actual)} to be true`);
          }
          return assertions;
        }) as any,
        a(expectedType: string) {
          if (typeof actual !== expectedType) {
            throw new Error(`Expected ${JSON.stringify(actual)} to be a ${expectedType}, got ${typeof actual}`);
          }
          return assertions;
        },
        async rejectedWith(pattern: RegExp | string) {
          let didThrow = false;
          let caughtError: any = null;
          try {
            await actual;
          } catch (err) {
            didThrow = true;
            caughtError = err;
          }
          if (!didThrow) {
            throw new Error(`Expected promise to be rejected matching ${pattern}, but it resolved`);
          }
          const message = caughtError?.message || String(caughtError);
          const matches =
            typeof pattern === 'string' ? message.includes(pattern) : pattern.test(message);
          if (!matches) {
            throw new Error(`Expected rejection message to match ${pattern}, but got: ${message}`);
          }
        },
      },
      have: {
        length: lengthAssertion,
      },
      length: lengthAssertion,
    },
    get and() {
      return assertions.to;
    },
    get with() {
      return assertions.to.have;
    },
  };
  return assertions;
}

async function waitForDasAssetByName(
  umi: Umi,
  owner: PublicKey,
  expectedName: string,
  timeoutMs = 30_000,
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await (umi.rpc as any).getAssetsByOwner({ owner, page: 1, limit: 100 });
    const match = res.items.find((a: any) => a.content?.metadata?.name === expectedName);
    if (match) return match;
    await new Promise(r => setTimeout(r, 1_500));
  }
  throw new Error(`DAS did not index asset "${expectedName}" within ${timeoutMs}ms`);
}

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests', '.fixtures');

function ensureFixturesDir(): void {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }
}

async function ensureTree(umi: Umi): Promise<PublicKey> {
  ensureFixturesDir();
  const fixtureFile = path.join(FIXTURES_DIR, 'tree.json');
  const [achvAuthority] = findAchvAuthorityPda(umi);

  if (fs.existsSync(fixtureFile)) {
    const cached = publicKey(JSON.parse(fs.readFileSync(fixtureFile, 'utf8')).tree);
    const existing = await umi.rpc.getAccount(cached);
    if (existing.exists) {
      return cached;
    }
  }

  const signer = generateSigner(umi);
  const builder = await createTree(umi, {
    merkleTree: signer,
    maxDepth: 17,
    maxBufferSize: 64,
    canopyDepth: 10,
    treeDelegate: achvAuthority,
  } as any);

  await builder
    .add(
      setTreeDelegate(umi, {
        merkleTree: signer.publicKey,
        treeCreator: umi.identity,
        newTreeDelegate: achvAuthority,
      })
    )
    .sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

  fs.writeFileSync(fixtureFile, JSON.stringify({ tree: signer.publicKey.toString() }, null, 2));
  return signer.publicKey;
}

async function ensureCollection(umi: Umi): Promise<PublicKey> {
  ensureFixturesDir();
  const fixtureFile = path.join(FIXTURES_DIR, 'collection.json');
  const [achvAuthority] = findAchvAuthorityPda(umi);
  const newCollectionAuthority = publicKey(achvAuthority.toBase58());

  if (fs.existsSync(fixtureFile)) {
    const cached = publicKey(JSON.parse(fs.readFileSync(fixtureFile, 'utf8')).collection);
    const existing = await umi.rpc.getAccount(cached);
    if (existing.exists) {
      const [collectionAuthorityRecord] = findCollectionAuthorityRecordPda(umi, {
        mint: cached,
        collectionAuthority: newCollectionAuthority,
      });
      const recordAcct = await umi.rpc.getAccount(collectionAuthorityRecord);
      if (!recordAcct.exists) {
        await approveCollectionAuthority(umi, {
          mint: cached,
          collectionAuthority: umi.identity,
          newCollectionAuthority: publicKey(achvAuthority.toBase58()),
          collectionAuthorityRecord,
        } as any).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });
      }
      return cached;
    }
  }

  const mint = generateSigner(umi);
  await createNft(umi, {
    mint,
    name: 'PINN44 Achievements',
    symbol: 'PINNACHV',
    uri: 'https://arweave.net/pinn44-achievements-collection.json',
    sellerFeeBasisPoints: percentAmount(0),
    isCollection: true,
  }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

  const [collectionAuthorityRecord] = findCollectionAuthorityRecordPda(umi, {
    mint: mint.publicKey,
    collectionAuthority: newCollectionAuthority,
  });

  await approveCollectionAuthority(umi, {
    mint: mint.publicKey,
    collectionAuthority: umi.identity,
    newCollectionAuthority: publicKey(achvAuthority.toBase58()),
    collectionAuthorityRecord,
  } as any).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

  fs.writeFileSync(fixtureFile, JSON.stringify({ collection: mint.publicKey.toString() }, null, 2));
  return mint.publicKey;
}

async function ensureFundedPlayer(umi: Umi): Promise<anchor.web3.Keypair> {
  ensureFixturesDir();
  const playerFixtureFile = path.join(FIXTURES_DIR, 'player.json');
  const minLamports = 100_000_000n; // 0.1 SOL

  const playerKp = anchor.web3.Keypair.generate();
  fs.writeFileSync(playerFixtureFile, JSON.stringify(Array.from(playerKp.secretKey)));

  const playerUmiPubkey = publicKey(playerKp.publicKey.toBase58());
  const balance = await umi.rpc.getBalance(playerUmiPubkey);

  if (balance.basisPoints < minLamports) {
    try {
      await umi.rpc.airdrop(playerUmiPubkey, sol(0.1), { commitment: 'confirmed' });
    } catch {
      // Fallback if Devnet public airdrop faucet is rate-limited: transfer 0.1 SOL from oracle wallet
      const lamportsBuf = Buffer.alloc(12);
      lamportsBuf.writeUInt32LE(2, 0); // SystemInstruction::Transfer = 2
      lamportsBuf.writeBigUInt64LE(minLamports, 4);

      await transactionBuilder()
        .add({
          instruction: {
            programId: SYSTEM_PROGRAM_ID,
            keys: [
              { pubkey: umi.identity.publicKey, isSigner: true, isWritable: true },
              { pubkey: playerUmiPubkey, isSigner: false, isWritable: true },
            ],
            data: new Uint8Array(lamportsBuf),
          },
          signers: [umi.identity],
          bytesCreatedOnChain: 0,
        })
        .sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });
    }
  }

  return playerKp;
}

/**
 * Parses the 56-byte SPL Account Compression `ConcurrentMerkleTreeHeader`
 */
function parseConcurrentMerkleTreeHeader(data: Uint8Array) {
  const buf = Buffer.from(data);
  const accountType = buf.readUInt8(0); // 1 = ConcurrentMerkleTree
  const version = buf.readUInt8(1); // 0 = V1
  const maxBufferSize = buf.readUInt32LE(2);
  const maxDepth = buf.readUInt32LE(6);
  const authorityBytes = buf.subarray(10, 42);
  const creationSlot = buf.readBigUInt64LE(42);
  return {
    accountType,
    version,
    maxBufferSize,
    maxDepth,
    authorityBytes,
    creationSlot,
  };
}

describe('pinn-achievements (devnet)', () => {
  let umi: Umi;
  let provider: anchor.AnchorProvider;
  let program: any;
  let configPda: anchor.web3.PublicKey;
  let tree: PublicKey;
  let collection: PublicKey;
  let oracleSigner: anchor.web3.Keypair;
  let playerKp: anchor.web3.Keypair;

  async function ensurePinnConfig(): Promise<void> {
    const cfg = await program.account.pinnConfig.fetch(configPda).catch(() => null);

    if (!cfg) {
      // First run — create.
      await program.methods
        .initializeConfig(
          new anchor.web3.PublicKey(umi.identity.publicKey.toString()),
          new anchor.web3.PublicKey(collection.toString()),
          new anchor.web3.PublicKey(tree.toString()),
        )
        .accounts({ config: configPda, admin: provider.wallet.publicKey } as any)
        .rpc();
      return;
    }

    // Config exists — update only the fields that drifted (after fixtures cleared).
    const driftTree = !cfg.merkleTree.equals(new anchor.web3.PublicKey(tree.toString()));
    const driftColl = !cfg.collectionMint.equals(new anchor.web3.PublicKey(collection.toString()));

    if (driftTree || driftColl) {
      await program.methods
        .updateConfig(
          driftTree ? new anchor.web3.PublicKey(tree.toString()) : null,
          driftColl ? new anchor.web3.PublicKey(collection.toString()) : null,
        )
        .accounts({ config: configPda, admin: provider.wallet.publicKey } as any)
        .rpc();
    }
  }

  before(async () => {
    oracleSigner = anchor.web3.Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET!, 'utf8'))),
    );
    const connection = new anchor.web3.Connection(RPC_URL, 'confirmed');
    const wallet = new anchor.Wallet(oracleSigner);
    provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });
    anchor.setProvider(provider);
    const idl = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'target/idl/pinn_achievements.json'), 'utf8'),
    );
    program = new anchor.Program(idl, provider);
    [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      program.programId,
    );

    umi = createBackendAchievementUmi(RPC_URL, oracleSigner.secretKey);
    tree = await ensureTree(umi);          // idempotent, persists to tests/.fixtures/
    collection = await ensureCollection(umi); // idempotent, persists to tests/.fixtures/
    playerKp = await ensureFundedPlayer(umi); // airdrop if < 0.1 SOL
    await ensurePinnConfig();
  });

  it('creates tree with PDA as delegate', async () => {
    const acct = await umi.rpc.getAccount(tree);
    if (!acct.exists) {
      throw new Error(`Merkle tree account ${tree} does not exist on-chain`);
    }

    // Parse ConcurrentMerkleTreeHeader and verify parameters (maxDepth=17, maxBufferSize=64)
    const header = parseConcurrentMerkleTreeHeader(acct.data);
    expect(header.accountType).to.equal(1);
    expect(header.maxBufferSize).to.equal(64);
    expect(header.maxDepth).to.equal(17);

    // Fetch Bubblegum TreeConfig PDA and assert treeDelegate == achvAuthority PDA
    const [achvAuthority] = findAchvAuthorityPda(umi);
    const [treeConfigPda] = findTreeConfigPda(umi, { merkleTree: tree });
    const treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree: tree });

    expect(treeConfig.publicKey.toString()).to.equal(treeConfigPda.toString());
    expect(treeConfig.treeDelegate.toString()).to.equal(achvAuthority.toString());
  });

  it('creates collection with achv_authority as delegated collection authority', async () => {
    const [achvAuthority] = findAchvAuthorityPda(umi);
    const [collectionAuthorityRecord] = findCollectionAuthorityRecordPda(umi, {
      mint: collection,
      collectionAuthority: publicKey(achvAuthority.toBase58()),
    });
    const recordAcct = await umi.rpc.getAccount(collectionAuthorityRecord);
    expect(recordAcct.exists).to.be.true;
  });

  it('initializes and fetches PinnConfig PDA with matching tree and collection', async () => {
    const cfg = await program.account.pinnConfig.fetch(configPda);
    expect(cfg.oracleAuthority.toBase58()).to.equal(oracleSigner.publicKey.toBase58());
    expect(cfg.merkleTree.toBase58()).to.equal(tree.toString());
    expect(cfg.collectionMint.toBase58()).to.equal(collection.toString());
  });

  it('mints a first_win achievement to the player', async () => {
    const res = await mintAchievementCnftToPlayer({
      program,
      oracleSigner,                                  // anchor Keypair
      playerSigner: playerKp,                        // anchor Keypair
      merkleTreeAddress: new anchor.web3.PublicKey(tree.toString()),
      collectionMintAddress: new anchor.web3.PublicKey(collection.toString()),
      trigger: 'first_win',
    });
    expect(res.signature).to.be.a('string').with.length.greaterThan(0);
    const asset = await waitForDasAssetByName(
      umi,
      publicKey(playerKp.publicKey.toBase58()),
      'First Victory',
    );
    expect(asset.content.metadata.name).to.equal('First Victory');
  });

  it('updates player_achievement_registry bitmask and total_unlocked on-chain', async () => {
    const [playerRegistryPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('achv_registry'), playerKp.publicKey.toBuffer()],
      program.programId,
    );
    const reg = await program.account.playerAchievementRegistry.fetch(playerRegistryPda);
    expect(reg.player.toBase58()).to.equal(playerKp.publicKey.toBase58());
    expect(Number(reg.unlockedBitmask.toString())).to.equal(1);
    expect(Number(reg.totalUnlocked)).to.equal(1);
  });

  it('rejects duplicate mint for the same bit_index', async () => {
    await expect(
      mintAchievementCnftToPlayer({
        program,
        oracleSigner,
        playerSigner: playerKp,
        merkleTreeAddress: new anchor.web3.PublicKey(tree.toString()),
        collectionMintAddress: new anchor.web3.PublicKey(collection.toString()),
        trigger: 'first_win',
      })
    ).to.be.rejectedWith(/AchievementAlreadyUnlocked/);
  });

  it('rejects a mint signed by a non-oracle wallet', async () => {
    const rogueOracle = anchor.web3.Keypair.generate();
    await expect(
      mintAchievementCnftToPlayer({
        program,
        oracleSigner: rogueOracle,
        playerSigner: playerKp,
        merkleTreeAddress: new anchor.web3.PublicKey(tree.toString()),
        collectionMintAddress: new anchor.web3.PublicKey(collection.toString()),
        trigger: 'coin_rush_master',
      })
    ).to.be.rejectedWith(/UnauthorizedOracle/);
  });

  it('rejects bit_index >= 128 with InvalidBitIndex', async () => {
    const merkleTreeWeb3 = new anchor.web3.PublicKey(tree.toString());
    const collectionMintWeb3 = new anchor.web3.PublicKey(collection.toString());
    const bubblegumProgram = new anchor.web3.PublicKey(
      'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY'
    );
    const compressionProgram = new anchor.web3.PublicKey(
      'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK'
    );
    const tokenMetadataProgram = new anchor.web3.PublicKey(
      'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
    );
    const logWrapper = new anchor.web3.PublicKey(
      'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV'
    );
    const [achvAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('achv_authority')],
      program.programId
    );
    const [playerAchievementRegistry] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('achv_registry'), playerKp.publicKey.toBuffer()],
      program.programId
    );
    const [treeConfig] = anchor.web3.PublicKey.findProgramAddressSync(
      [merkleTreeWeb3.toBuffer()],
      bubblegumProgram
    );
    const [collectionMetadata] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), tokenMetadataProgram.toBuffer(), collectionMintWeb3.toBuffer()],
      tokenMetadataProgram
    );
    const [collectionMasterEdition] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        tokenMetadataProgram.toBuffer(),
        collectionMintWeb3.toBuffer(),
        Buffer.from('edition'),
      ],
      tokenMetadataProgram
    );
    const [collectionAuthorityRecord] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        tokenMetadataProgram.toBuffer(),
        collectionMintWeb3.toBuffer(),
        Buffer.from('collection_authority'),
        achvAuthority.toBuffer(),
      ],
      tokenMetadataProgram
    );
    const [bubblegumSigner] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('collection_cpi')],
      bubblegumProgram
    );

    const callInvalidBitIndex = async () => {
      try {
        await program.methods
          .unlockAchievement({
            bitIndex: 128,
            name: 'Invalid Bit',
            uri: 'https://arweave.net/pinn44-invalid-bit.json',
          })
          .accounts({
            achievementOracle: oracleSigner.publicKey,
            config: configPda,
            player: playerKp.publicKey,
            playerAchievementRegistry,
            achvAuthority,
            treeConfig,
            merkleTree: merkleTreeWeb3,
            collectionMint: collectionMintWeb3,
            collectionMetadata,
            collectionMasterEdition,
            collectionAuthorityRecord,
            bubblegumSigner,
            bubblegumProgram,
            compressionProgram,
            tokenMetadataProgram,
            logWrapper,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([oracleSigner, playerKp])
          .rpc();
      } catch (err: any) {
        const msg = `${err?.message || ''}\n${(err?.logs || []).join('\n')}`;
        if (msg.includes('InvalidBitIndex') || msg.includes('0x1771') || msg.includes('6001')) {
          throw new Error(`InvalidBitIndex: ${msg}`);
        }
        throw err;
      }
    };

    await expect(callInvalidBitIndex()).to.be.rejectedWith(/InvalidBitIndex/);
  });

  it('rejects metadata name > 32 bytes with NameTooLong', async () => {
    const merkleTreeWeb3 = new anchor.web3.PublicKey(tree.toString());
    const collectionMintWeb3 = new anchor.web3.PublicKey(collection.toString());
    const bubblegumProgram = new anchor.web3.PublicKey(
      'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY'
    );
    const compressionProgram = new anchor.web3.PublicKey(
      'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK'
    );
    const tokenMetadataProgram = new anchor.web3.PublicKey(
      'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
    );
    const logWrapper = new anchor.web3.PublicKey(
      'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV'
    );
    const [achvAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('achv_authority')],
      program.programId
    );
    const [playerAchievementRegistry] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('achv_registry'), playerKp.publicKey.toBuffer()],
      program.programId
    );
    const [treeConfig] = anchor.web3.PublicKey.findProgramAddressSync(
      [merkleTreeWeb3.toBuffer()],
      bubblegumProgram
    );
    const [collectionMetadata] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), tokenMetadataProgram.toBuffer(), collectionMintWeb3.toBuffer()],
      tokenMetadataProgram
    );
    const [collectionMasterEdition] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        tokenMetadataProgram.toBuffer(),
        collectionMintWeb3.toBuffer(),
        Buffer.from('edition'),
      ],
      tokenMetadataProgram
    );
    const [collectionAuthorityRecord] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        tokenMetadataProgram.toBuffer(),
        collectionMintWeb3.toBuffer(),
        Buffer.from('collection_authority'),
        achvAuthority.toBuffer(),
      ],
      tokenMetadataProgram
    );
    const [bubblegumSigner] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('collection_cpi')],
      bubblegumProgram
    );

    const callNameTooLong = async () => {
      try {
        await program.methods
          .unlockAchievement({
            bitIndex: 2,
            name: 'A'.repeat(33),
            uri: 'https://arweave.net/pinn44-long-name.json',
          })
          .accounts({
            achievementOracle: oracleSigner.publicKey,
            config: configPda,
            player: playerKp.publicKey,
            playerAchievementRegistry,
            achvAuthority,
            treeConfig,
            merkleTree: merkleTreeWeb3,
            collectionMint: collectionMintWeb3,
            collectionMetadata,
            collectionMasterEdition,
            collectionAuthorityRecord,
            bubblegumSigner,
            bubblegumProgram,
            compressionProgram,
            tokenMetadataProgram,
            logWrapper,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([oracleSigner, playerKp])
          .rpc();
      } catch (err: any) {
        const msg = `${err?.message || ''}\n${(err?.logs || []).join('\n')}`;
        if (msg.includes('NameTooLong') || msg.includes('0x1773') || msg.includes('6003')) {
          throw new Error(`NameTooLong: ${msg}`);
        }
        throw err;
      }
    };

    await expect(callNameTooLong()).to.be.rejectedWith(/NameTooLong/);
  });

  it('supports 2-step oracle authority rotation and config idempotency', async () => {
    const tempOracle = anchor.web3.Keypair.generate();

    // Propose tempOracle
    await program.methods
      .proposeOracle(tempOracle.publicKey)
      .accounts({
        oracleAuthority: oracleSigner.publicKey,
        config: configPda,
      })
      .signers([oracleSigner])
      .rpc();

    let cfg = await program.account.pinnConfig.fetch(configPda);
    expect(cfg.pendingOracle.toBase58()).to.equal(tempOracle.publicKey.toBase58());

    // Accept tempOracle
    await program.methods
      .acceptOracle()
      .accounts({
        pendingOracle: tempOracle.publicKey,
        config: configPda,
      })
      .signers([tempOracle])
      .rpc();

    cfg = await program.account.pinnConfig.fetch(configPda);
    expect(cfg.oracleAuthority.toBase58()).to.equal(tempOracle.publicKey.toBase58());

    // Rotate back to oracleSigner so subsequent runs remain authorized
    await program.methods
      .proposeOracle(oracleSigner.publicKey)
      .accounts({
        oracleAuthority: tempOracle.publicKey,
        config: configPda,
      })
      .signers([tempOracle])
      .rpc();

    await program.methods
      .acceptOracle()
      .accounts({
        pendingOracle: oracleSigner.publicKey,
        config: configPda,
      })
      .signers([oracleSigner])
      .rpc();

    cfg = await program.account.pinnConfig.fetch(configPda);
    expect(cfg.oracleAuthority.toBase58()).to.equal(oracleSigner.publicKey.toBase58());
  });
});
