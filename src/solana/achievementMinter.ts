import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import bs58 from 'bs58';

declare global {
  interface String {
    toBase58(): string;
  }
}

if (typeof String.prototype.toBase58 !== 'function') {
  Object.defineProperty(String.prototype, 'toBase58', {
    value: function (this: string): string {
      return String(this);
    },
    writable: true,
    configurable: true,
  });
}
import * as anchor from '@coral-xyz/anchor';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  Umi,
  PublicKey,
  Signer,
  Keypair as UmiKeypair,
  publicKey,
  keypairIdentity,
  transactionBuilder,
  WrappedInstruction,
} from '@metaplex-foundation/umi';
import {
  mplBubblegum,
  findTreeConfigPda,
  findLeafAssetIdPda,
  fetchTreeConfigFromSeeds,
  MPL_BUBBLEGUM_PROGRAM_ID,
} from '@metaplex-foundation/mpl-bubblegum';
import {
  mplTokenMetadata,
  findMetadataPda,
  findMasterEditionPda,
  findCollectionAuthorityRecordPda,
  MPL_TOKEN_METADATA_PROGRAM_ID,
} from '@metaplex-foundation/mpl-token-metadata';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';

function resolvePinnAchievementsProgramId(): PublicKey {
  if (typeof process !== 'undefined' && process.env?.PINN_ACHIEVEMENTS_PROGRAM_ID) {
    return publicKey(process.env.PINN_ACHIEVEMENTS_PROGRAM_ID);
  }
  try {
    const idlPath = path.resolve(process.cwd(), 'target/idl/pinn_achievements.json');
    if (fs.existsSync(idlPath)) {
      const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
      const addr = idl.address || idl.metadata?.address;
      if (addr && addr !== 'PinnAchv11111111111111111111111111111111111') {
        return publicKey(addr);
      }
    }
    const libRsPath = path.resolve(process.cwd(), 'programs/pinn_achievements/src/lib.rs');
    if (fs.existsSync(libRsPath)) {
      const libRs = fs.readFileSync(libRsPath, 'utf8');
      const match = libRs.match(/declare_id!\(\s*"([1-9A-HJ-NP-Za-km-z]{32,44})"\s*\)/);
      if (match?.[1]) {
        return publicKey(match[1]);
      }
    }
  } catch {
    // Fallback to default program ID
  }
  return publicKey('PinnAchv11111111111111111111111111111111111');
}

export const PINN_ACHIEVEMENTS_PROGRAM_ID: PublicKey = resolvePinnAchievementsProgramId();

export const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID: PublicKey = publicKey(
  'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK'
);

export const SPL_NOOP_PROGRAM_ID: PublicKey = publicKey(
  'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV'
);

export const SYSTEM_PROGRAM_ID: PublicKey = publicKey(
  '11111111111111111111111111111111'
);

export type AchievementTrigger =
  | 'first_win'
  | 'coin_rush_master'
  | 'treasure_hunter'
  | 'puzzle_grandmaster'
  | 'speed_demon'
  | 'tournament_champion';

export interface AchievementMetadataSpec {
  bitIndex: number;
  name: string;
  uri: string;
  metadataUri: string;
}

export const ACHIEVEMENT_TRIGGERS: Record<AchievementTrigger, AchievementMetadataSpec> = {
  first_win: {
    bitIndex: 0,
    name: 'First Victory',
    uri: 'https://arweave.net/pinn44-achv-first-win.json',
    metadataUri: 'https://arweave.net/pinn44-achv-first-win.json',
  },
  coin_rush_master: {
    bitIndex: 1,
    name: 'Coin Rush Master',
    uri: 'https://arweave.net/pinn44-achv-coin-rush.json',
    metadataUri: 'https://arweave.net/pinn44-achv-coin-rush.json',
  },
  treasure_hunter: {
    bitIndex: 2,
    name: 'Mobay Treasure Hunter',
    uri: 'https://arweave.net/pinn44-achv-treasure-hunter.json',
    metadataUri: 'https://arweave.net/pinn44-achv-treasure-hunter.json',
  },
  puzzle_grandmaster: {
    bitIndex: 3,
    name: 'Puzzle Grandmaster',
    uri: 'https://arweave.net/pinn44-achv-puzzle-master.json',
    metadataUri: 'https://arweave.net/pinn44-achv-puzzle-master.json',
  },
  speed_demon: {
    bitIndex: 4,
    name: 'Speed Tap Reflex',
    uri: 'https://arweave.net/pinn44-achv-speed-tap.json',
    metadataUri: 'https://arweave.net/pinn44-achv-speed-tap.json',
  },
  tournament_champion: {
    bitIndex: 5,
    name: 'PINN Tournament Champion',
    uri: 'https://arweave.net/pinn44-achv-champion.json',
    metadataUri: 'https://arweave.net/pinn44-achv-champion.json',
  },
};

/**
 * Anchor error code mapping from programs/pinn_achievements/src/lib.rs
 */
export const ACHIEVEMENT_ERROR_MAP: Record<number, string> = {
  6000: 'UnauthorizedOracle',
  6001: 'InvalidBitIndex',
  6002: 'AchievementAlreadyUnlocked',
  6003: 'NameTooLong',
  6004: 'UriTooLong',
  6005: 'InvalidMerkleTree',
  6006: 'InvalidCollectionMint',
  6007: 'InvalidBubblegumProgram',
  6008: 'InvalidCompressionProgram',
  6009: 'InvalidTokenMetadataProgram',
  6010: 'InvalidLogWrapper',
};

/**
 * Normalizes a secret key (Uint8Array, JSON array of numbers, or base58 string) into Uint8Array
 */
export function parseSecretKeyBytes(secret: Uint8Array | number[] | string): Uint8Array {
  if (secret instanceof Uint8Array) {
    return secret;
  }
  if (Array.isArray(secret)) {
    return Uint8Array.from(secret);
  }
  const trimmed = secret.trim();
  if (trimmed.startsWith('[')) {
    return Uint8Array.from(JSON.parse(trimmed));
  }
  const decoder = typeof bs58.decode === 'function' ? bs58.decode : (bs58 as any).default.decode;
  return decoder(trimmed);
}

/**
 * Creates a backend Umi instance configured with Bubblegum, Token Metadata, DAS API, and the Oracle signer identity.
 */
export function createBackendAchievementUmi(
  rpcUrl: string,
  oracleSecret: Uint8Array | number[] | string
): Umi {
  const umi = createUmi(rpcUrl)
    .use(mplBubblegum())
    .use(mplTokenMetadata())
    .use(dasApi());

  const secretBytes = parseSecretKeyBytes(oracleSecret);
  const umiKeypair: UmiKeypair = umi.eddsa.createKeypairFromSecretKey(secretBytes);
  umi.use(keypairIdentity(umiKeypair));
  return umi;
}

/**
 * Derives the `achv_authority` PDA (`seeds = [b"achv_authority"]`)
 */
export function findAchvAuthorityPda(
  umi: Umi,
  programId: PublicKey = PINN_ACHIEVEMENTS_PROGRAM_ID
): [PublicKey, number] {
  return umi.eddsa.findPda(programId, [Buffer.from('achv_authority')]);
}

/**
 * Derives the `config` PDA (`seeds = [b"config"]`)
 */
export function findPinnConfigPda(
  umi: Umi,
  programId: PublicKey = PINN_ACHIEVEMENTS_PROGRAM_ID
): [PublicKey, number] {
  return umi.eddsa.findPda(programId, [Buffer.from('config')]);
}

/**
 * Derives the `player_achievement_registry` PDA (`seeds = [b"achv_registry", player.as_ref()]`)
 */
export function findPlayerAchievementRegistryPda(
  umi: Umi,
  playerWallet: PublicKey,
  programId: PublicKey = PINN_ACHIEVEMENTS_PROGRAM_ID
): [PublicKey, number] {
  return umi.eddsa.findPda(programId, [
    Buffer.from('achv_registry'),
    Buffer.from(bs58Decode(playerWallet.toString())),
  ]);
}

function bs58Decode(input: string): Uint8Array {
  const decoder = typeof bs58.decode === 'function' ? bs58.decode : (bs58 as any).default.decode;
  return decoder(input);
}

function bs58Encode(input: Uint8Array): string {
  const encoder = typeof bs58.encode === 'function' ? bs58.encode : (bs58 as any).default.encode;
  return encoder(input);
}

/**
 * Computes the 8-byte Anchor instruction discriminator: sha256("global:<ix_name>")[0..8]
 */
export function anchorInstructionDiscriminator(ixName: string): Buffer {
  return crypto.createHash('sha256').update(`global:${ixName}`).digest().subarray(0, 8);
}

/**
 * Serializes `initialize_config(collection_mint: Pubkey, merkle_tree: Pubkey)` instruction data
 */
export function serializeInitializeConfigData(
  collectionMint: PublicKey,
  merkleTree: PublicKey
): Uint8Array {
  const disc = anchorInstructionDiscriminator('initialize_config');
  const collectionBytes = Buffer.from(bs58Decode(collectionMint.toString()));
  const treeBytes = Buffer.from(bs58Decode(merkleTree.toString()));
  return new Uint8Array(Buffer.concat([disc, collectionBytes, treeBytes]));
}

/**
 * Serializes `unlock_achievement(args: UnlockAchievementArgs)` instruction data (Borsh)
 */
export function serializeUnlockAchievementData(args: {
  bitIndex?: number;
  achievementBitIndex?: number;
  name: string;
  uri: string;
}): Uint8Array {
  const disc = anchorInstructionDiscriminator('unlock_achievement');
  const resolvedBitIndex = args.bitIndex ?? args.achievementBitIndex ?? 0;
  const bitIndexBuf = Buffer.from([resolvedBitIndex & 0xff]);

  const nameBytes = Buffer.from(args.name, 'utf8');
  const nameLenBuf = Buffer.alloc(4);
  nameLenBuf.writeUInt32LE(nameBytes.length, 0);

  const uriBytes = Buffer.from(args.uri, 'utf8');
  const uriLenBuf = Buffer.alloc(4);
  uriLenBuf.writeUInt32LE(uriBytes.length, 0);

  return new Uint8Array(
    Buffer.concat([disc, bitIndexBuf, nameLenBuf, nameBytes, uriLenBuf, uriBytes])
  );
}

export interface UnlockAchievementAccountsMap {
  achievementOracle: PublicKey;
  config: PublicKey;
  player: PublicKey;
  playerAchievementRegistry: PublicKey;
  achvAuthority: PublicKey;
  treeConfig: PublicKey;
  merkleTree: PublicKey;
  collectionMint: PublicKey;
  collectionMetadata: PublicKey;
  collectionMasterEdition: PublicKey;
  collectionAuthorityRecord: PublicKey;
  bubblegumSigner: PublicKey;
  bubblegumProgram: PublicKey;
  compressionProgram: PublicKey;
  tokenMetadataProgram: PublicKey;
  logWrapper: PublicKey;
  systemProgram: PublicKey;
}

/**
 * Builds a raw Umi WrappedInstruction for `unlock_achievement`
 */
export function buildUnlockAchievementInstruction(params: {
  umi: Umi;
  oracleSigner: Signer;
  playerSigner?: Signer;
  merkleTree: PublicKey;
  collectionMint: PublicKey;
  playerWallet: PublicKey;
  bitIndex?: number;
  achievementBitIndex?: number;
  name: string;
  uri: string;
  programId?: PublicKey;
}): WrappedInstruction {
  const {
    umi,
    oracleSigner,
    playerSigner,
    merkleTree,
    collectionMint,
    playerWallet,
    bitIndex,
    achievementBitIndex,
    name,
    uri,
    programId = PINN_ACHIEVEMENTS_PROGRAM_ID,
  } = params;

  const [configPda] = findPinnConfigPda(umi, programId);
  const [achvAuthorityPda] = findAchvAuthorityPda(umi, programId);
  const [playerRegistryPda] = findPlayerAchievementRegistryPda(umi, playerWallet, programId);
  const [bubblegumSignerPda] = umi.eddsa.findPda(MPL_BUBBLEGUM_PROGRAM_ID, [
    Buffer.from('collection_cpi'),
  ]);
  const [treeConfigPda] = findTreeConfigPda(umi, { merkleTree });
  const [collectionMetadataPda] = findMetadataPda(umi, { mint: collectionMint });
  const [collectionMasterEditionPda] = findMasterEditionPda(umi, { mint: collectionMint });
  const [collectionAuthorityRecordPda] = findCollectionAuthorityRecordPda(umi, {
    mint: collectionMint,
    collectionAuthority: achvAuthorityPda,
  });

  const data = serializeUnlockAchievementData({
    bitIndex: bitIndex ?? achievementBitIndex,
    name,
    uri,
  });

  const signers: Signer[] = [oracleSigner];
  if (playerSigner && playerSigner.publicKey.toString() !== oracleSigner.publicKey.toString()) {
    signers.push(playerSigner);
  }

  return {
    instruction: {
      programId,
      keys: [
        { pubkey: oracleSigner.publicKey, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: playerWallet, isSigner: Boolean(playerSigner), isWritable: true },
        { pubkey: playerRegistryPda, isSigner: false, isWritable: true },
        { pubkey: achvAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: treeConfigPda, isSigner: false, isWritable: true },
        { pubkey: merkleTree, isSigner: false, isWritable: true },
        { pubkey: collectionMint, isSigner: false, isWritable: false },
        { pubkey: collectionMetadataPda, isSigner: false, isWritable: true },
        { pubkey: collectionMasterEditionPda, isSigner: false, isWritable: false },
        { pubkey: collectionAuthorityRecordPda, isSigner: false, isWritable: false },
        { pubkey: bubblegumSignerPda, isSigner: false, isWritable: false },
        { pubkey: MPL_BUBBLEGUM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MPL_TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SPL_NOOP_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    },
    signers,
    bytesCreatedOnChain: 0,
  };
}

/**
 * Translates Anchor custom program error codes (6000..6010 / 0x1770..0x177a) in RPC errors
 * into human-readable Anchor error names so tests can match `/AchievementAlreadyUnlocked/` or `/UnauthorizedOracle/`.
 */
export function normalizeAnchorProgramError(err: unknown): Error {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const logs: string[] = (err as any)?.logs || (err as any)?.transactionLogs || [];
  const combined = `${rawMessage}\n${logs.join('\n')}`;

  for (const [codeStr, errorName] of Object.entries(ACHIEVEMENT_ERROR_MAP)) {
    const codeNum = Number(codeStr);
    const hexCode = `0x${codeNum.toString(16)}`;
    if (
      combined.includes(errorName) ||
      combined.includes(`custom program error: ${hexCode}`) ||
      combined.includes(`Custom: ${codeNum}`) ||
      combined.includes(`Error Number: ${codeNum}`)
    ) {
      return new Error(`${errorName} (code ${codeNum}): ${rawMessage}`);
    }
  }

  return err instanceof Error ? err : new Error(rawMessage);
}

export interface PinnAchievementsProgramClient {
  programId: { toString(): string };
  methods: {
    unlockAchievement(args: { bitIndex: number; name: string; uri: string }): {
      accounts(accounts: Record<string, any>): {
        signers(signers: anchor.web3.Keypair[]): {
          rpc(): Promise<string>;
        };
      };
    };
  };
}

export interface MintAchievementCnftParams {
  program: PinnAchievementsProgramClient | any;
  oracleSigner: anchor.web3.Keypair;
  playerSigner: anchor.web3.Keypair;
  merkleTreeAddress: anchor.web3.PublicKey | PublicKey | string;
  collectionMintAddress: anchor.web3.PublicKey | PublicKey | string;
  trigger: AchievementTrigger;
}

export interface MintAchievementCnftResult {
  signature: string;
  bitIndex: number;
}

/**
 * Mints an achievement cNFT to the player via the on-chain `pinn_achievements::unlock_achievement` CPI instruction.
 */
export async function mintAchievementCnftToPlayer(
  params: MintAchievementCnftParams
): Promise<MintAchievementCnftResult> {
  const {
    program,
    oracleSigner,
    playerSigner,
    merkleTreeAddress,
    collectionMintAddress,
    trigger,
  } = params;

  const achievement = ACHIEVEMENT_TRIGGERS[trigger];
  if (!achievement) {
    throw new Error(`Unknown achievement trigger: ${trigger}`);
  }

  const programId = new anchor.web3.PublicKey(program.programId.toString());
  const merkleTree = new anchor.web3.PublicKey(merkleTreeAddress.toString());
  const collectionMint = new anchor.web3.PublicKey(collectionMintAddress.toString());
  const bubblegumProgram = new anchor.web3.PublicKey(MPL_BUBBLEGUM_PROGRAM_ID.toString());
  const compressionProgram = new anchor.web3.PublicKey(
    SPL_ACCOUNT_COMPRESSION_PROGRAM_ID.toString()
  );
  const tokenMetadataProgram = new anchor.web3.PublicKey(
    MPL_TOKEN_METADATA_PROGRAM_ID.toString()
  );
  const logWrapper = new anchor.web3.PublicKey(SPL_NOOP_PROGRAM_ID.toString());

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    programId
  );
  const [achvAuthority] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('achv_authority')],
    programId
  );
  const [playerAchievementRegistry] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('achv_registry'), playerSigner.publicKey.toBuffer()],
    programId
  );
  const [treeConfig] = anchor.web3.PublicKey.findProgramAddressSync(
    [merkleTree.toBuffer()],
    bubblegumProgram
  );
  const [collectionMetadata] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), tokenMetadataProgram.toBuffer(), collectionMint.toBuffer()],
    tokenMetadataProgram
  );
  const [collectionMasterEdition] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      tokenMetadataProgram.toBuffer(),
      collectionMint.toBuffer(),
      Buffer.from('edition'),
    ],
    tokenMetadataProgram
  );
  const [collectionAuthorityRecord] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      tokenMetadataProgram.toBuffer(),
      collectionMint.toBuffer(),
      Buffer.from('collection_authority'),
      achvAuthority.toBuffer(),
    ],
    tokenMetadataProgram
  );
  const [bubblegumSigner] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('collection_cpi')],
    bubblegumProgram
  );

  try {
    if (program.account?.pinnConfig?.fetch) {
      const cfg = await program.account.pinnConfig.fetch(configPda);
      if (
        cfg?.oracleAuthority &&
        cfg.oracleAuthority.toBase58() !== oracleSigner.publicKey.toBase58()
      ) {
        throw new Error(
          `UnauthorizedOracle (code 6000): signer ${oracleSigner.publicKey.toBase58()} does not match cfg.oracleAuthority ${cfg.oracleAuthority.toBase58()}`
        );
      }
    }

    const signature = await program.methods
      .unlockAchievement({
        bitIndex: achievement.bitIndex,
        name: achievement.name,
        uri: achievement.metadataUri,
      })
      .accounts({
        achievementOracle: oracleSigner.publicKey,
        config: configPda,
        player: playerSigner.publicKey,
        playerAchievementRegistry,
        achvAuthority,
        treeConfig,
        merkleTree,
        collectionMint,
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
      .signers([oracleSigner, playerSigner])
      .rpc();

    return {
      signature,
      bitIndex: achievement.bitIndex,
    };
  } catch (err) {
    throw normalizeAnchorProgramError(err);
  }
}
