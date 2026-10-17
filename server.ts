/**
 * Server-Side Entry Point for PINN Arcade
 * Mounts Express API routes for server-side Solana transaction verification
 * and proxies Vite development middlewares on port 3000.
 */

import http from 'http';
import express from 'express';
import crypto from 'crypto';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateThemedUsername } from './src/services/usernameGenerator';

function safeBs58Decode(input: string): Uint8Array {
  const decoder = typeof bs58.decode === 'function' ? bs58.decode : (bs58 as any).default?.decode;
  return decoder(input);
}

function safeBs58Encode(input: Uint8Array): string {
  const encoder = typeof bs58.encode === 'function' ? bs58.encode : (bs58 as any).default?.encode;
  return encoder(input);
}

dotenv.config();
process.env.DISABLE_HMR = 'true';

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const OFFICIAL_PINN_MINT = '6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump';

// Solana Public JSON-RPC Endpoints (queried server-side)
const SOLANA_RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
  'https://rpc.ankr.com/solana',
];

// In-memory replay set of recorded transaction signatures
const RECORDED_SERVER_SIGNATURES = new Set<string>();

// Supabase client for server-side verification and persistence
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qkckwsxhejnktuccbeaw.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Server client: Uses service role key if available server-side, else anon key
const serverSupabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

// Known administrator emails allowlist fallback
const ADMIN_EMAIL_ALLOWLIST = new Set([
  'admin@pinnarcade.io',
  'admin@pinn.io',
  'security@pinn.io',
  'montegobay@pinnarcade.com',
  'thomassean538@gmail.com',
]);

export const PINN_DECIMALS = 6;

// In-memory mutex to prevent concurrent settlements of the same reward request in-process
const ACTIVE_SETTLING_REWARDS = new Set<string>();

// Helper to convert human/decimal token amount to exact integer raw base units (BigInt)
export function toRawBaseUnits(amountStr: string | number, decimals: number = PINN_DECIMALS): bigint {
  if (typeof amountStr === 'number') {
    amountStr = amountStr.toFixed(decimals);
  }
  const cleaned = String(amountStr).replace(/[^0-9.]/g, '');
  if (!cleaned) return 0n;
  const parts = cleaned.split('.');
  const wholePart = parts[0] || '0';
  let fractionPart = (parts[1] || '').slice(0, decimals);
  fractionPart = fractionPart.padEnd(decimals, '0');
  try {
    return BigInt(wholePart) * (10n ** BigInt(decimals)) + BigInt(fractionPart);
  } catch {
    return 0n;
  }
}

// Helper to parse numeric token amounts
function parsePinnAmount(amountStr: string | number): number {
  if (typeof amountStr === 'number') return amountStr;
  const cleaned = String(amountStr).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Server-side on-chain Solana verification logic
 * Strict integer base-units comparison with exact token decimals (BigInt)
 */
async function verifySolanaTransactionOnChain(params: {
  signature: string;
  expectedRecipientWallet: string;
  expectedAmount: number | string;
}) {
  const cleanSig = params.signature.trim();
  const expectedWallet = params.expectedRecipientWallet.trim().toLowerCase();
  const expectedRawAmount = toRawBaseUnits(params.expectedAmount, PINN_DECIMALS);

  // 1. Signature format check
  if (!cleanSig || cleanSig.length < 30) {
    return {
      verified: false,
      error: 'Invalid Solana transaction signature format (minimum 30 base58 characters required).',
    };
  }

  // 2. Query Solana JSON-RPC
  let rpcResponse: any = null;
  let rpcError: string | null = null;

  for (const endpoint of SOLANA_RPC_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `pinn-srv-${Date.now()}`,
          method: 'getTransaction',
          params: [
            cleanSig,
            {
              commitment: 'confirmed',
              encoding: 'jsonParsed',
              maxSupportedTransactionVersion: 0,
            },
          ],
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.error) {
          rpcError = json.error.message || 'Solana RPC returned error';
          continue;
        }
        if (json.result) {
          rpcResponse = json.result;
          break;
        }
      }
    } catch (err: any) {
      rpcError = err.message || 'Network error querying Solana RPC';
    }
  }

  // Check (2) & (7): Unconfirmed or non-existent transaction check
  if (!rpcResponse) {
    return {
      verified: false,
      error: rpcError
        ? `Solana RPC error: ${rpcError}`
        : 'Transaction not found on Solana blockchain. Ensure transaction has reached confirmed or finalized commitment.',
    };
  }

  // Check (2) & (7): Failed transaction check (meta.err must be null)
  if (rpcResponse.meta?.err !== null && rpcResponse.meta?.err !== undefined) {
    return {
      verified: false,
      error: `TRANSACTION FAILED ON-CHAIN: Transaction resulted in error: ${JSON.stringify(
        rpcResponse.meta.err
      )}. Failed transactions cannot be marked paid.`,
    };
  }

  // Check (1), (3), (4), (5): Inspect token balances to verify mint, recipient owner, and raw integer amount
  const postTokenBalances = rpcResponse.meta?.postTokenBalances || [];
  const preTokenBalances = rpcResponse.meta?.preTokenBalances || [];

  let matchedMint = false;
  let recipientMatched = false;
  let rawAmountFound = 0n;
  let observedDecimals: number | null = null;

  for (const post of postTokenBalances) {
    // Check (1) & (4): Exact $PINN mint address check
    if (post.mint === OFFICIAL_PINN_MINT) {
      matchedMint = true;
      if (typeof post.uiTokenAmount?.decimals === 'number') {
        observedDecimals = post.uiTokenAmount.decimals;
      }

      // Check (3): Actual recipient wallet OWNER check (NOT merely token account address)
      const postOwner = post.owner ? post.owner.trim().toLowerCase() : '';
      if (postOwner === expectedWallet) {
        recipientMatched = true;

        const pre = preTokenBalances.find(
          (p: any) => p.accountIndex === post.accountIndex && p.mint === post.mint
        );
        const postRaw = BigInt(post.uiTokenAmount?.amount || '0');
        const preRaw = BigInt(pre?.uiTokenAmount?.amount || '0');
        const delta = postRaw - preRaw;
        if (delta > 0n) {
          rawAmountFound += delta;
        }
      }
    }
  }

  if (!matchedMint) {
    return {
      verified: false,
      error: `INVALID TOKEN MINT: Transaction does not transfer official $PINN tokens (${OFFICIAL_PINN_MINT}).`,
    };
  }

  // Exact Decimals check (must match official $PINN token decimals)
  if (observedDecimals !== null && observedDecimals !== PINN_DECIMALS) {
    return {
      verified: false,
      error: `DECIMALS MISMATCH: Token mint reported ${observedDecimals} decimals, expected ${PINN_DECIMALS}.`,
    };
  }

  if (!recipientMatched) {
    return {
      verified: false,
      error: `DESTINATION MISMATCH: Transferred token account owner does not match approved reward winner wallet (${params.expectedRecipientWallet}). Merely targeting an arbitrary token account is not accepted.`,
    };
  }

  // Check (5): Transferred amount in raw integer units must meet or exceed approved reward amount
  if (expectedRawAmount > 0n && (rawAmountFound <= 0n || rawAmountFound < expectedRawAmount)) {
    const foundUi = Number(rawAmountFound) / (10 ** PINN_DECIMALS);
    const expectedUi = Number(expectedRawAmount) / (10 ** PINN_DECIMALS);
    return {
      verified: false,
      amountTransferred: foundUi,
      rawAmountTransferred: rawAmountFound.toString(),
      error: `INSUFFICIENT AMOUNT: Transferred ${foundUi.toLocaleString()} $PINN (${rawAmountFound.toString()} raw base units), which is less than approved reward (${expectedUi.toLocaleString()} $PINN / ${expectedRawAmount.toString()} raw base units).`,
    };
  }

  const finalUi = Number(rawAmountFound) / (10 ** PINN_DECIMALS);

  return {
    verified: true,
    signature: cleanSig,
    slot: rpcResponse.slot,
    blockTime: rpcResponse.blockTime,
    tokenMint: OFFICIAL_PINN_MINT,
    destinationWallet: params.expectedRecipientWallet,
    rawAmountTransferred: rawAmountFound.toString(),
    amountTransferred: finalUi,
    decimals: PINN_DECIMALS,
    statusText: 'CONFIRMED ON SOLANA MAINNET',
  };
}

/**
 * API Route: Server-Side Solana Transaction Verification & Audit Persistence
 * POST /api/payments/verify-and-record
 */
app.post('/api/payments/verify-and-record', async (req, res) => {
  try {
    const {
      rewardRequestId,
      txSignature,
      note,
      isSimulationDemo,
      simulateFailedTx,
      simulateWrongMint,
      simulateWrongRecipient,
      simulateInsufficientAmount,
    } = req.body;

    const cleanSig = typeof txSignature === 'string' ? txSignature.trim() : '';

    if (!rewardRequestId || !cleanSig) {
      return res.status(400).json({
        success: false,
        error: 'Missing rewardRequestId or txSignature.',
      });
    }

    // In-memory mutex: block concurrent settlement requests for the exact same reward request ID
    if (ACTIVE_SETTLING_REWARDS.has(rewardRequestId)) {
      return res.status(409).json({
        success: false,
        error: `CONCURRENT SETTLEMENT REJECTED: Payout settlement is already in progress for reward request ${rewardRequestId}.`,
      });
    }
    ACTIVE_SETTLING_REWARDS.add(rewardRequestId);

    try {
      // Server-Side Authorization Check: Strictly require a valid Supabase token
      // x-admin-role CANNOT grant access without a valid Supabase token.
      const authHeader = req.headers.authorization;
      let isAdmin = false;
      let callingUserId: string | null = null;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(403).json({
          success: false,
          error: 'UNAUTHORIZED: Valid Supabase Bearer token required. Unauthenticated requests and header overrides are strictly forbidden.',
        });
      }

      const token = authHeader.replace('Bearer ', '').trim();
      const { data: userData, error: userError } = await serverSupabase.auth.getUser(token);

      if (userError || !userData?.user) {
        return res.status(403).json({
          success: false,
          error: 'UNAUTHORIZED: Invalid or expired Supabase authentication token.',
        });
      }

      callingUserId = userData.user.id;
      const userEmail = userData.user.email?.toLowerCase();

      // Verify administrator role in Supabase database or verified admin allowlist
      const { data: adminRole } = await serverSupabase
        .from('admin_roles')
        .select('role')
        .eq('user_id', userData.user.id)
        .single();

      if (adminRole && (adminRole.role === 'admin' || adminRole.role === 'superadmin')) {
        isAdmin = true;
      } else if (userEmail && ADMIN_EMAIL_ALLOWLIST.has(userEmail)) {
        isAdmin = true;
      } else if (
        userData.user.app_metadata?.role === 'admin' ||
        userData.user.app_metadata?.role === 'superadmin' ||
        userData.user.user_metadata?.role === 'admin' ||
        userData.user.user_metadata?.role === 'superadmin'
      ) {
        isAdmin = true;
      }

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN: Authenticated player does not possess administrator privileges.',
        });
      }

      // Check (6): Duplicate transaction signature check in-memory cache and Supabase payment_records
      if (RECORDED_SERVER_SIGNATURES.has(cleanSig)) {
        return res.status(409).json({
          success: false,
          error: `DUPLICATE REJECTED: Transaction signature ${cleanSig.slice(0, 14)}... has already been used for another payout.`,
        });
      }

      const { data: existingPayment } = await serverSupabase
        .from('payment_records')
        .select('id, tx_signature, status')
        .eq('tx_signature', cleanSig)
        .maybeSingle();

      if (existingPayment) {
        RECORDED_SERVER_SIGNATURES.add(cleanSig);
        return res.status(409).json({
          success: false,
          error: `DUPLICATE REJECTED: Transaction signature ${cleanSig.slice(0, 14)}... has already been used for payment ${existingPayment.id}.`,
        });
      }

      // Check if simulation flags are provided in production
      const hasSimulationFlags = Boolean(
        isSimulationDemo ||
        simulateFailedTx ||
        simulateWrongMint ||
        simulateWrongRecipient ||
        simulateInsufficientAmount
      );

      if (hasSimulationFlags && process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          error: 'SIMULATION FORBIDDEN: Simulation mode and mock verification flags are strictly prohibited in production.',
        });
      }

      // Retrieve the authoritative reward request from database
      const { data: rewardData } = await serverSupabase
        .from('reward_requests')
        .select('*')
        .eq('id', rewardRequestId)
        .maybeSingle();

      if (!rewardData) {
        if (process.env.NODE_ENV === 'production' || !req.body.expectedWallet) {
          return res.status(404).json({
            success: false,
            error: `Reward request ${rewardRequestId} not found in database.`,
          });
        }
      }

      // Check (9): Ensure reward has not already been marked completed/paid
      if (rewardData && rewardData.status === 'completed') {
        return res.status(409).json({
          success: false,
          error: `ALREADY COMPLETED: Reward request ${rewardRequestId} has already been marked as paid and completed.`,
        });
      }

      // Check (9): Ensure no existing confirmed or verified payment record exists for this reward
      const { data: existingPaymentForReward } = await serverSupabase
        .from('payment_records')
        .select('id, tx_signature, status')
        .eq('reward_request_id', rewardRequestId)
        .in('status', ['confirmed', 'verified_paid'])
        .maybeSingle();

      if (existingPaymentForReward) {
        return res.status(409).json({
          success: false,
          error: `ALREADY PAID: Reward request ${rewardRequestId} already has a confirmed payout (${existingPaymentForReward.tx_signature}).`,
        });
      }

      // Authoritative expected recipient wallet and reward amount from database (never trust client overrides)
      const expectedWallet = rewardData ? rewardData.wallet_address : req.body.expectedWallet;
      const expectedAmountStr = rewardData ? rewardData.reward_amount : req.body.expectedAmount;

      if (!expectedWallet) {
        return res.status(400).json({
          success: false,
          error: `Invalid reward data: Missing recipient wallet address.`,
        });
      }

      const expectedAmount = parsePinnAmount(expectedAmountStr || 0);

      // Run Server-Side Solana On-Chain Verification
      let verificationResult: any;

      if (isSimulationDemo) {
        // Deterministic test harness simulation (non-production only)
        if (simulateFailedTx) {
          return res.status(422).json({
            success: false,
            error: 'PAYMENT REJECTED: TRANSACTION FAILED ON-CHAIN: Transaction resulted in InstructionError (0, Custom: 1). Failed transactions cannot be accepted.',
          });
        } else if (simulateWrongMint) {
          return res.status(422).json({
            success: false,
            error: `PAYMENT REJECTED: INVALID TOKEN MINT: Transaction does not transfer official $PINN tokens (${OFFICIAL_PINN_MINT}).`,
          });
        } else if (simulateWrongRecipient) {
          return res.status(422).json({
            success: false,
            error: `PAYMENT REJECTED: DESTINATION MISMATCH: Transferred recipient does not match reward winner wallet (${expectedWallet}).`,
          });
        } else if (simulateInsufficientAmount) {
          return res.status(422).json({
            success: false,
            error: `PAYMENT REJECTED: INSUFFICIENT AMOUNT: Transferred 5,000 $PINN, which is less than approved reward (${expectedAmount.toLocaleString()} $PINN).`,
          });
        }

        // Simulation mode in development returns simulation feedback without mutating production database
        return res.status(200).json({
          success: true,
          isSimulation: true,
          verification: {
            verified: true,
            signature: cleanSig,
            slot: 315482901,
            blockTime: Math.floor(Date.now() / 1000),
            tokenMint: OFFICIAL_PINN_MINT,
            destinationWallet: expectedWallet,
            rawAmountTransferred: toRawBaseUnits(expectedAmountStr || 0, PINN_DECIMALS).toString(),
            amountTransferred: expectedAmount,
            decimals: PINN_DECIMALS,
            statusText: 'VERIFIED SOLANA SETTLEMENT (SIMULATED - NO DB MUTATION)',
          },
          message: 'Simulation completed. No database records modified.',
        });
      }

      // Real live Solana JSON-RPC verification with exact BigInt base units
      verificationResult = await verifySolanaTransactionOnChain({
        signature: cleanSig,
        expectedRecipientWallet: expectedWallet,
        expectedAmount: expectedAmountStr || expectedAmount,
      });

      // Check (7): Failed or unconfirmed transactions cannot be marked paid
      if (!verificationResult.verified) {
        return res.status(422).json({
          success: false,
          error: `PAYMENT REJECTED: ${verificationResult.error}`,
        });
      }

      // Register signature in server replay protection cache
      RECORDED_SERVER_SIGNATURES.add(cleanSig);

      // Atomically persist verified payment record and update reward status in Supabase
      // 1. Conditional atomic update on reward_requests ensures at most one concurrent settlement succeeds
      const { data: updatedReward, error: updateError } = await serverSupabase
        .from('reward_requests')
        .update({
          status: 'completed',
          admin_notes: `Paid & Verified: ${cleanSig.slice(0, 8)}... (${new Date().toLocaleDateString()})`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rewardRequestId)
        .neq('status', 'completed')
        .select()
        .maybeSingle();

      if (updateError || !updatedReward) {
        return res.status(409).json({
          success: false,
          error: `CONCURRENT SETTLEMENT REJECTED: Reward request ${rewardRequestId} was already marked completed by another transaction.`,
        });
      }

      // 2. Insert payment record into payment_records ledger
      const paymentRecordPayload = {
        reward_request_id: rewardRequestId,
        tournament_id: rewardData?.tournament_id || null,
        user_id: rewardData?.user_id || callingUserId || null,
        player_name: rewardData?.player_name || 'Verified Winner',
        wallet_address: expectedWallet,
        amount: expectedAmountStr || `${expectedAmount.toLocaleString()} $PINN`,
        token_mint: OFFICIAL_PINN_MINT,
        tx_signature: cleanSig,
        status: 'verified_paid',
        is_verified_on_chain: true,
        verified_at: new Date().toISOString(),
        note: note || 'Verified Solana on-chain settlement for official $PINN distribution.',
        updated_at: new Date().toISOString(),
      };

      const { data: insertedPayment, error: insertError } = await serverSupabase
        .from('payment_records')
        .insert(paymentRecordPayload)
        .select()
        .single();

      if (insertError) {
        return res.status(409).json({
          success: false,
          error: `PAYMENT SETTLEMENT CONFLICT: ${insertError.message}`,
        });
      }

      return res.status(200).json({
        success: true,
        verification: verificationResult,
        payment: insertedPayment || paymentRecordPayload,
      });
    } finally {
      ACTIVE_SETTLING_REWARDS.delete(rewardRequestId);
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// SOLANA WALLET AUTOMATIC AUTHENTICATION & PLAYER PROFILE SYNCHRONIZATION
// =========================================================================

interface ActiveNonceRecord {
  nonce: string;
  walletAddress: string;
  domain: string;
  issuedAt: string;
  expiresAt: string;
  consumed: boolean;
}

const ACTIVE_NONCES = new Map<string, ActiveNonceRecord>();

// Helper to sweep expired nonces
function sweepExpiredNonces() {
  const now = Date.now();
  for (const [nonce, record] of ACTIVE_NONCES.entries()) {
    if (new Date(record.expiresAt).getTime() < now || record.consumed) {
      ACTIVE_NONCES.delete(nonce);
    }
  }
}
setInterval(sweepExpiredNonces, 60000);

export interface ServerPlayerProfile {
  id: string; // Stable internal UUID
  walletAddress: string; // Verified normalized Solana wallet address
  displayName: string; // Themed Caribbean/PINN Arcade username
  authUserId?: string | null;
  coinsBalance: number;
  coinsWithdrawn: number;
  totalGamesPlayed: number;
  totalPlayTimeMs: number;
  lastRunDurationMs: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

// In-memory persistent cache for server-side fast retrieval and resilience
const SERVER_PROFILES_STORE = new Map<string, ServerPlayerProfile>();

export interface ServerCoinLedgerEntry {
  id: string;
  playerId: string;
  walletAddress: string;
  amount: number;
  balanceAfter: number;
  entryType: 'game_reward' | 'tournament_prize' | 'withdrawal' | 'adjustment';
  referenceId?: string;
  description?: string;
  createdAt: string;
}

const SERVER_COIN_LEDGER: ServerCoinLedgerEntry[] = [];

// Helper to create canonical sign-in challenge message
function createCanonicalChallengeMessage(params: {
  domain: string;
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}): string {
  return [
    'PINN Arcade Authentication',
    `Domain: ${params.domain}`,
    `Wallet: ${params.walletAddress}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    `Expiration Time: ${params.expiresAt}`,
    'Statement: Sign this message to authenticate your Solana wallet and link your PINN Arcade player account.',
  ].join('\n');
}

/**
 * 1. Generate unique short-lived server nonce and canonical sign-in challenge
 */
app.post('/api/auth/solana-nonce', (req, res) => {
  try {
    const { walletAddress, domain: clientDomain } = req.body;

    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.trim().length < 24) {
      return res.status(400).json({
        success: false,
        error: 'Valid Solana wallet address required to generate authentication challenge.',
      });
    }

    const cleanWallet = walletAddress.trim();
    const domain = clientDomain || req.headers.host || 'pinnarcade.io';
    const nonce = `pinn_nonce_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minute TTL

    const record: ActiveNonceRecord = {
      nonce,
      walletAddress: cleanWallet,
      domain,
      issuedAt,
      expiresAt,
      consumed: false,
    };

    ACTIVE_NONCES.set(nonce, record);

    const message = createCanonicalChallengeMessage({
      domain,
      walletAddress: cleanWallet,
      nonce,
      issuedAt,
      expiresAt,
    });

    return res.status(200).json({
      success: true,
      nonce,
      domain,
      issuedAt,
      expiresAt,
      walletAddress: cleanWallet,
      message,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Failed to generate authentication challenge: ${err.message}`,
    });
  }
});

/**
 * 2. Verify signature server-side, consume nonce, establish session & synchronize player profile
 */
app.post('/api/auth/solana-verify', async (req, res) => {
  try {
    const { walletAddress, signature, nonce, domain, isDemo } = req.body;

    if (!walletAddress || !nonce || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: walletAddress, nonce, and signature are required.',
      });
    }

    const cleanWallet = String(walletAddress).trim();

    // 1. Look up nonce in server records
    const nonceRecord = ACTIVE_NONCES.get(nonce);
    if (!nonceRecord) {
      return res.status(400).json({
        success: false,
        error: 'Authentication challenge expired or invalid. Please reconnect your wallet to receive a fresh nonce.',
      });
    }

    // 2. Prevent replay attacks: check if already consumed
    if (nonceRecord.consumed) {
      return res.status(400).json({
        success: false,
        error: 'Authentication challenge already consumed. Replay attack prevented.',
      });
    }

    // 3. Expiration check (5 minutes max)
    if (Date.now() > new Date(nonceRecord.expiresAt).getTime()) {
      ACTIVE_NONCES.delete(nonce);
      return res.status(400).json({
        success: false,
        error: 'Authentication challenge expired. Challenges are valid for 5 minutes.',
      });
    }

    // 4. Wallet address match check
    if (nonceRecord.walletAddress.toLowerCase() !== cleanWallet.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address does not match authentication challenge.',
      });
    }

    // Immediately consume nonce once to prevent reuse
    nonceRecord.consumed = true;
    ACTIVE_NONCES.delete(nonce);

    // 5. Reconstruct canonical message
    const expectedMessage = createCanonicalChallengeMessage({
      domain: nonceRecord.domain,
      walletAddress: nonceRecord.walletAddress,
      nonce: nonceRecord.nonce,
      issuedAt: nonceRecord.issuedAt,
      expiresAt: nonceRecord.expiresAt,
    });

    // 6. Mandatory Cryptographic signature verification
    try {
      const messageBytes = new TextEncoder().encode(expectedMessage);

        let signatureBytes: Uint8Array;
        if (typeof signature === 'string') {
          try {
            signatureBytes = safeBs58Decode(signature);
          } catch {
            signatureBytes = Buffer.from(signature, 'hex');
          }
        } else if (Array.isArray(signature)) {
          signatureBytes = new Uint8Array(signature);
        } else {
          signatureBytes = new Uint8Array(Buffer.from(signature));
        }

        const publicKeyBytes = safeBs58Decode(cleanWallet);

        if (signatureBytes.length !== 64) {
          return res.status(401).json({
            success: false,
            error: 'Invalid signature length. Expected 64-byte Ed25519 signature.',
          });
        }

        if (publicKeyBytes.length !== 32) {
          return res.status(401).json({
            success: false,
            error: 'Invalid Solana public key length. Expected 32 bytes.',
          });
        }

        const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
        if (!isValid) {
          return res.status(401).json({
            success: false,
            error: 'Cryptographic signature verification failed. The provided signature is not valid for this wallet and challenge.',
          });
        }
      } catch (err: any) {
        return res.status(401).json({
          success: false,
          error: `Signature verification error: ${err.message}`,
        });
      }

    // 7. Atomic Player Profile Synchronization
    const normalizedKey = cleanWallet.toLowerCase();
    let profile = SERVER_PROFILES_STORE.get(normalizedKey);
    let isFirstTime = false;

    // Check Supabase if configured
    if (!profile) {
      try {
        // Attempt query from public.player_profiles
        const { data: dbProfile, error: dbErr } = await serverSupabase
          .from('player_profiles')
          .select('*')
          .ilike('wallet_address', cleanWallet)
          .maybeSingle();

        if (!dbErr && dbProfile) {
          profile = {
            id: dbProfile.id,
            walletAddress: dbProfile.wallet_address,
            displayName: dbProfile.display_name,
            authUserId: dbProfile.auth_user_id,
            coinsBalance: dbProfile.coins_balance || 0,
            coinsWithdrawn: dbProfile.coins_withdrawn || 0,
            totalGamesPlayed: dbProfile.total_games_played || 0,
            totalPlayTimeMs: Number(dbProfile.total_play_time_ms) || 0,
            lastRunDurationMs: dbProfile.last_run_duration_ms || 0,
            isVerified: true,
            createdAt: dbProfile.created_at,
            updatedAt: dbProfile.updated_at,
          };
          SERVER_PROFILES_STORE.set(normalizedKey, profile);
        }
      } catch {
        // Ignore and fallback to creation
      }
    }

    // If profile does not exist, create first-time player profile with themed username
    if (!profile) {
      isFirstTime = true;

      // Calculate initial coins and games count from existing records in public.scores & game_scores
      let initialCoins = 0;
      let initialGames = 0;
      let initialTime = 0;

      try {
        const { data: scoreRows } = await serverSupabase
          .from('scores')
          .select('coins, duration_ms')
          .ilike('wallet_address', cleanWallet);

        if (scoreRows && scoreRows.length > 0) {
          initialGames = scoreRows.length;
          initialCoins = scoreRows.reduce((acc, r) => acc + (r.coins || 0), 0);
          initialTime = scoreRows.reduce((acc, r) => acc + (r.duration_ms || 0), 0);
        } else {
          const { data: gsRows } = await serverSupabase
            .from('game_scores')
            .select('coins')
            .ilike('wallet_address', cleanWallet);

          if (gsRows && gsRows.length > 0) {
            initialGames = gsRows.length;
            initialCoins = gsRows.reduce((acc, r) => acc + (r.coins || 0), 0);
          }
        }
      } catch {
        // Safe fallback
      }

      // Generate unique Caribbean / PINN Arcade themed username with collision retry
      let generatedName = generateThemedUsername(cleanWallet, 0);
      let attempts = 0;
      while (
        Array.from(SERVER_PROFILES_STORE.values()).some(
          (p) => p.displayName.toLowerCase() === generatedName.toLowerCase()
        ) &&
        attempts < 10
      ) {
        attempts++;
        generatedName = generateThemedUsername(cleanWallet, attempts);
      }

      const stablePlayerId = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      profile = {
        id: stablePlayerId,
        walletAddress: cleanWallet,
        displayName: generatedName,
        authUserId: null,
        coinsBalance: initialCoins,
        coinsWithdrawn: 0,
        totalGamesPlayed: initialGames,
        totalPlayTimeMs: initialTime,
        lastRunDurationMs: 0,
        isVerified: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // Attempt to save to Supabase player_profiles
      try {
        const { data: createdDb, error: createErr } = await serverSupabase
          .from('player_profiles')
          .insert([
            {
              id: stablePlayerId,
              wallet_address: cleanWallet,
              display_name: generatedName,
              coins_balance: initialCoins,
              total_games_played: initialGames,
              total_play_time_ms: initialTime,
              is_verified: true,
            },
          ])
          .select()
          .maybeSingle();

        if (!createErr && createdDb) {
          profile.id = createdDb.id;
          profile.displayName = createdDb.display_name;
        }
      } catch {
        // In-memory resilience continues
      }

      SERVER_PROFILES_STORE.set(normalizedKey, profile);

      // Add initial ledger entry if coins existed
      if (initialCoins > 0) {
        SERVER_COIN_LEDGER.push({
          id: crypto.randomUUID(),
          playerId: profile.id,
          walletAddress: cleanWallet,
          amount: initialCoins,
          balanceAfter: initialCoins,
          entryType: 'game_reward',
          description: 'Initial reconciled game-coin balance from prior gameplay runs.',
          createdAt: nowIso,
        });
      }
    }

    // Generate secure session token
    const sessionToken = `pinn_auth_${cleanWallet.slice(0, 8)}_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;

    return res.status(200).json({
      success: true,
      token: sessionToken,
      player: profile,
      isFirstTime,
      message: isFirstTime
        ? `Welcome to PINN Arcade! Player account created as ${profile.displayName}.`
        : `Welcome back, ${profile.displayName}! Player account synchronized.`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Authentication failed: ${err.message}`,
    });
  }
});

/**
 * 3. Get player profile and verified coin balance
 */
app.get('/api/player/profile', async (req, res) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'walletAddress query parameter is required.' });
    }

    const cleanWallet = walletAddress.trim();
    const normalizedKey = cleanWallet.toLowerCase();
    let profile = SERVER_PROFILES_STORE.get(normalizedKey);

    if (!profile) {
      try {
        const { data: dbProfile } = await serverSupabase
          .from('player_profiles')
          .select('*')
          .ilike('wallet_address', cleanWallet)
          .maybeSingle();

        if (dbProfile) {
          profile = {
            id: dbProfile.id,
            walletAddress: dbProfile.wallet_address,
            displayName: dbProfile.display_name,
            authUserId: dbProfile.auth_user_id,
            coinsBalance: dbProfile.coins_balance || 0,
            coinsWithdrawn: dbProfile.coins_withdrawn || 0,
            totalGamesPlayed: dbProfile.total_games_played || 0,
            totalPlayTimeMs: Number(dbProfile.total_play_time_ms) || 0,
            lastRunDurationMs: dbProfile.last_run_duration_ms || 0,
            isVerified: true,
            createdAt: dbProfile.created_at,
            updatedAt: dbProfile.updated_at,
          };
          SERVER_PROFILES_STORE.set(normalizedKey, profile);
        }
      } catch {
        // Fallback
      }
    }

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Player profile not found. Please connect your wallet to authenticate and create your account.',
      });
    }

    return res.status(200).json({ success: true, player: profile });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. Update player username (persisted, uniqueness checked)
 */
app.post('/api/player/update-username', async (req, res) => {
  try {
    const { walletAddress, displayName } = req.body;
    if (!walletAddress || !displayName) {
      return res.status(400).json({ success: false, error: 'walletAddress and displayName are required.' });
    }

    const cleanWallet = String(walletAddress).trim();
    const cleanName = String(displayName).trim().slice(0, 24);

    if (cleanName.length < 3) {
      return res.status(400).json({ success: false, error: 'Username must be at least 3 characters.' });
    }

    const normalizedKey = cleanWallet.toLowerCase();
    const profile = SERVER_PROFILES_STORE.get(normalizedKey);

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Player profile not found.' });
    }

    // Check collision across existing profiles
    const isTaken = Array.from(SERVER_PROFILES_STORE.values()).some(
      (p) => p.walletAddress.toLowerCase() !== normalizedKey && p.displayName.toLowerCase() === cleanName.toLowerCase()
    );

    if (isTaken) {
      return res.status(409).json({ success: false, error: 'That username is already taken by another player.' });
    }

    profile.displayName = cleanName;
    profile.updatedAt = new Date().toISOString();
    SERVER_PROFILES_STORE.set(normalizedKey, profile);

    // Update in Supabase
    try {
      await serverSupabase
        .from('player_profiles')
        .update({ display_name: cleanName, updated_at: profile.updatedAt })
        .ilike('wallet_address', cleanWallet);
    } catch {
      // ignore
    }

    return res.status(200).json({ success: true, player: profile });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5. Player coin ledger & activity
 */
app.get('/api/player/ledger', (req, res) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'walletAddress is required.' });
    }

    const cleanWallet = walletAddress.trim().toLowerCase();
    const entries = SERVER_COIN_LEDGER.filter((e) => e.walletAddress.toLowerCase() === cleanWallet);

    return res.status(200).json({
      success: true,
      entries,
      totalEntries: entries.length,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6. Authoritative coin recording from game runs
 */
app.post('/api/player/record-coins', async (req, res) => {
  try {
    const { walletAddress, coinsEarned, durationMs, gameId } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'walletAddress is required.' });
    }

    const cleanWallet = String(walletAddress).trim();
    const normalizedKey = cleanWallet.toLowerCase();
    let profile = SERVER_PROFILES_STORE.get(normalizedKey);

    if (!profile) {
      try {
        const { data: dbProfile } = await serverSupabase
          .from('player_profiles')
          .select('*')
          .ilike('wallet_address', cleanWallet)
          .maybeSingle();

        if (dbProfile) {
          profile = {
            id: dbProfile.id,
            walletAddress: dbProfile.wallet_address,
            displayName: dbProfile.display_name,
            authUserId: dbProfile.auth_user_id,
            coinsBalance: dbProfile.coins_balance || 0,
            coinsWithdrawn: dbProfile.coins_withdrawn || 0,
            totalGamesPlayed: dbProfile.total_games_played || 0,
            totalPlayTimeMs: Number(dbProfile.total_play_time_ms) || 0,
            lastRunDurationMs: dbProfile.last_run_duration_ms || 0,
            isVerified: true,
            createdAt: dbProfile.created_at,
            updatedAt: dbProfile.updated_at,
          };
          SERVER_PROFILES_STORE.set(normalizedKey, profile);
        }
      } catch {
        // fallback
      }
    }

    const coinsToAdd = Math.max(0, parseInt(String(coinsEarned || 0), 10));
    const runDuration = Math.max(0, parseInt(String(durationMs || 0), 10));

    if (profile) {
      profile.coinsBalance += coinsToAdd;
      profile.totalGamesPlayed += 1;
      profile.totalPlayTimeMs += runDuration;
      profile.lastRunDurationMs = runDuration;
      profile.updatedAt = new Date().toISOString();
      SERVER_PROFILES_STORE.set(normalizedKey, profile);

      if (coinsToAdd > 0) {
        SERVER_COIN_LEDGER.push({
          id: crypto.randomUUID(),
          playerId: profile.id,
          walletAddress: cleanWallet,
          amount: coinsToAdd,
          balanceAfter: profile.coinsBalance,
          entryType: 'game_reward',
          description: `Coins earned in ${gameId || 'PINN Coin Rush'} run.`,
          createdAt: new Date().toISOString(),
        });
      }

      // Sync to Supabase
      try {
        await serverSupabase
          .from('player_profiles')
          .update({
            coins_balance: profile.coinsBalance,
            total_games_played: profile.totalGamesPlayed,
            total_play_time_ms: profile.totalPlayTimeMs,
            last_run_duration_ms: runDuration,
            updated_at: profile.updatedAt,
          })
          .ilike('wallet_address', cleanWallet);
      } catch {
        // ignore
      }
    }

    return res.status(200).json({
      success: true,
      coinsBalance: profile?.coinsBalance || coinsToAdd,
      player: profile,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
// =========================================================================
// AUTHORITATIVE PLAYER COIN SYSTEM & WITHDRAWAL MANAGEMENT
// =========================================================================

interface ServerWithdrawalRequest {
  id: string;
  userId?: string | null;
  playerId?: string | null;
  playerName: string;
  walletAddress: string;
  amountCoins: number;
  amountRaw: string;
  tokenMint: string;
  status: 'pending' | 'approved' | 'processing' | 'rejected' | 'completed' | 'paid' | 'cancelled';
  adminNotes?: string;
  rejectionReason?: string;
  txSignature?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const SERVER_WITHDRAWALS: ServerWithdrawalRequest[] = [];

async function computePlayerCoinSummary(walletAddress?: string | null, userId?: string | null) {
  const cleanWallet = (walletAddress || '').trim().toLowerCase();
  const cleanUid = (userId || '').trim();

  let coinRushCoins = 0;
  let treasureHuntCoins = 0;
  let puzzleMasterCoins = 0;
  let speedTapCoins = 0;

  // 1. Try Supabase security definer RPC
  try {
    const { data: rpcData, error: rpcErr } = await serverSupabase.rpc('get_player_coin_summary', {
      p_user_id: cleanUid || null,
      p_wallet_address: cleanWallet || null,
    });
    if (!rpcErr && rpcData) {
      return {
        coinRushCoins: Number(rpcData.coinRushCoins) || 0,
        treasureHuntCoins: Number(rpcData.treasureHuntCoins) || 0,
        puzzleMasterCoins: Number(rpcData.puzzleMasterCoins) || 0,
        speedTapCoins: Number(rpcData.speedTapCoins) || 0,
        totalCoinsCollected: Number(rpcData.totalCoinsCollected) || 0,
        eligibleEarnings: Number(rpcData.eligibleEarnings) || 0,
        paidTotal: Number(rpcData.paidTotal) || 0,
        reservedAmount: Number(rpcData.reservedAmount) || 0,
        availableBalance: Number(rpcData.availableBalance) || 0,
      };
    }
  } catch {
    // continue to direct query
  }

  // 2. Direct query on scores table (excluding rejected)
  try {
    let q = serverSupabase.from('scores').select('game_id, coins, status').neq('status', 'rejected');
    if (cleanWallet && cleanUid) {
      q = q.or(`wallet_address.ilike.${cleanWallet},user_id.eq.${cleanUid}`);
    } else if (cleanWallet) {
      q = q.ilike('wallet_address', cleanWallet);
    } else if (cleanUid) {
      q = q.eq('user_id', cleanUid);
    }
    const { data: scoreRows } = await q;
    if (scoreRows && scoreRows.length > 0) {
      for (const r of scoreRows) {
        const c = Number(r.coins) || 0;
        if (r.game_id === 'coin-rush') coinRushCoins += c;
        else if (r.game_id === 'treasure-hunt') treasureHuntCoins += c;
        else if (r.game_id === 'puzzle-master') puzzleMasterCoins += c;
        else if (r.game_id === 'speed-tap') speedTapCoins += c;
      }
    }

    if (cleanWallet && coinRushCoins === 0 && treasureHuntCoins === 0) {
      const { data: gsRows } = await serverSupabase
        .from('game_scores')
        .select('game_id, coins')
        .ilike('wallet_address', cleanWallet);
      if (gsRows && gsRows.length > 0) {
        for (const r of gsRows) {
          const c = Number(r.coins) || 0;
          if (r.game_id === 'coin-rush') coinRushCoins += c;
          else if (r.game_id === 'treasure-hunt') treasureHuntCoins += c;
          else if (r.game_id === 'puzzle-master') puzzleMasterCoins += c;
          else if (r.game_id === 'speed-tap') speedTapCoins += c;
        }
      }
    }
  } catch {
    // fallback
  }

  if (cleanWallet) {
    const prof = SERVER_PROFILES_STORE.get(cleanWallet);
    if (prof && prof.coinsBalance > 0 && (coinRushCoins + treasureHuntCoins + puzzleMasterCoins + speedTapCoins) === 0) {
      coinRushCoins = prof.coinsBalance;
    }
  }

  const totalCoinsCollected = coinRushCoins + treasureHuntCoins + puzzleMasterCoins + speedTapCoins;
  const eligibleEarnings = totalCoinsCollected;

  let paidTotal = 0;
  let reservedAmount = 0;

  try {
    let wQuery = serverSupabase.from('withdrawal_requests').select('amount_coins, status');
    if (cleanWallet && cleanUid) {
      wQuery = wQuery.or(`wallet_address.ilike.${cleanWallet},user_id.eq.${cleanUid}`);
    } else if (cleanWallet) {
      wQuery = wQuery.ilike('wallet_address', cleanWallet);
    } else if (cleanUid) {
      wQuery = wQuery.eq('user_id', cleanUid);
    }
    const { data: wRows } = await wQuery;
    if (wRows && wRows.length > 0) {
      for (const w of wRows) {
        const amt = Number(w.amount_coins) || 0;
        if (w.status === 'completed' || w.status === 'paid') {
          paidTotal += amt;
        } else if (w.status === 'pending' || w.status === 'approved' || w.status === 'processing') {
          reservedAmount += amt;
        }
      }
    }
  } catch {
    for (const w of SERVER_WITHDRAWALS) {
      if ((cleanWallet && w.walletAddress.toLowerCase() === cleanWallet) || (cleanUid && w.userId === cleanUid)) {
        if (w.status === 'completed' || w.status === 'paid') {
          paidTotal += w.amountCoins;
        } else if (w.status === 'pending' || w.status === 'approved' || w.status === 'processing') {
          reservedAmount += w.amountCoins;
        }
      }
    }
  }

  const availableBalance = Math.max(0, eligibleEarnings - paidTotal - reservedAmount);

  return {
    coinRushCoins,
    treasureHuntCoins,
    puzzleMasterCoins,
    speedTapCoins,
    totalCoinsCollected,
    eligibleEarnings,
    paidTotal,
    reservedAmount,
    availableBalance,
  };
}

// 7. Get Authoritative Player Coin Totals & Balances
app.get('/api/player/coin-totals', async (req, res) => {
  try {
    const walletAddress = req.query.walletAddress as string | undefined;
    const userId = req.query.userId as string | undefined;

    if (!walletAddress && !userId) {
      return res.status(400).json({ success: false, error: 'walletAddress or userId query parameter is required.' });
    }

    const summary = await computePlayerCoinSummary(walletAddress, userId);
    return res.status(200).json({ success: true, summary });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Player Submit Withdrawal Request (10,000 Minimum)
app.post('/api/player/withdraw', async (req, res) => {
  try {
    const { walletAddress, userId, playerName, amountCoins, destinationWallet } = req.body;

    const amount = parseInt(String(amountCoins || 0), 10);
    if (isNaN(amount) || amount < 10000) {
      return res.status(400).json({
        success: false,
        error: 'Minimum withdrawal threshold is 10,000 PINN coins.',
      });
    }

    const cleanDest = String(destinationWallet || walletAddress || '').trim();
    if (!cleanDest || cleanDest.length < 32 || cleanDest.length > 44) {
      return res.status(400).json({
        success: false,
        error: 'Valid destination Solana wallet address (32-44 characters) is required.',
      });
    }

    // Authoritative Server-Side Balance Check
    const summary = await computePlayerCoinSummary(walletAddress, userId);
    if (amount > summary.availableBalance) {
      return res.status(400).json({
        success: false,
        error: `Insufficient available balance. You requested ${amount.toLocaleString()} coins, but only ${summary.availableBalance.toLocaleString()} coins are available to withdraw.`,
      });
    }

    const requestId = crypto.randomUUID();
    const rawAmount = (BigInt(amount) * (10n ** BigInt(PINN_DECIMALS))).toString();
    const nowIso = new Date().toISOString();

    const withdrawalRecord: ServerWithdrawalRequest = {
      id: requestId,
      userId: userId || null,
      playerId: null,
      playerName: playerName || 'Player',
      walletAddress: cleanDest,
      amountCoins: amount,
      amountRaw: rawAmount,
      tokenMint: OFFICIAL_PINN_MINT,
      status: 'pending',
      adminNotes: '',
      rejectionReason: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      await serverSupabase.from('withdrawal_requests').insert({
        id: requestId,
        user_id: userId || null,
        player_name: playerName || 'Player',
        wallet_address: cleanDest,
        amount_coins: amount,
        amount_raw: rawAmount,
        token_mint: OFFICIAL_PINN_MINT,
        status: 'pending',
      });
    } catch {
      // fallback
    }

    SERVER_WITHDRAWALS.unshift(withdrawalRecord);

    return res.status(200).json({
      success: true,
      message: `Withdrawal request submitted for ${amount.toLocaleString()} PINN coins. Reserved against available balance pending administrative review.`,
      request: withdrawalRecord,
      newAvailableBalance: summary.availableBalance - amount,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Get Player's Own Withdrawal Requests
app.get('/api/player/withdrawals', async (req, res) => {
  try {
    const walletAddress = req.query.walletAddress as string | undefined;
    const userId = req.query.userId as string | undefined;

    if (!walletAddress && !userId) {
      return res.status(400).json({ success: false, error: 'walletAddress or userId query parameter is required.' });
    }

    const cleanWallet = (walletAddress || '').trim().toLowerCase();
    const cleanUid = (userId || '').trim();

    let list: any[] = [];
    try {
      let q = serverSupabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false });
      if (cleanWallet && cleanUid) {
        q = q.or(`wallet_address.ilike.${cleanWallet},user_id.eq.${cleanUid}`);
      } else if (cleanWallet) {
        q = q.ilike('wallet_address', cleanWallet);
      } else if (cleanUid) {
        q = q.eq('user_id', cleanUid);
      }
      const { data } = await q;
      if (data && data.length > 0) {
        list = data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          playerId: d.player_id,
          playerName: d.player_name,
          walletAddress: d.wallet_address,
          amountCoins: d.amount_coins,
          amountRaw: d.amount_raw,
          tokenMint: d.token_mint,
          status: d.status,
          adminNotes: d.admin_notes,
          rejectionReason: d.rejection_reason,
          txSignature: d.tx_signature,
          verifiedAt: d.verified_at,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch {
      // fallback
    }

    if (list.length === 0) {
      list = SERVER_WITHDRAWALS.filter((w) =>
        (cleanWallet && w.walletAddress.toLowerCase() === cleanWallet) || (cleanUid && w.userId === cleanUid)
      );
    }

    return res.status(200).json({ success: true, withdrawals: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Admin: Searchable Player Balances
app.get('/api/admin/player-balances', async (req, res) => {
  try {
    const searchQuery = String(req.query.q || '').trim().toLowerCase();

    // Collect all players from player_profiles & scores
    const playerMap = new Map<string, { id: string; userId: string; playerName: string; walletAddress?: string; lastActive?: string }>();

    try {
      const { data: dbProfiles } = await serverSupabase.from('player_profiles').select('*');
      if (dbProfiles) {
        for (const p of dbProfiles) {
          const key = (p.wallet_address || p.id).toLowerCase();
          playerMap.set(key, {
            id: p.id,
            userId: p.auth_user_id || p.id,
            playerName: p.display_name,
            walletAddress: p.wallet_address,
            lastActive: p.updated_at || p.created_at,
          });
        }
      }
    } catch {
      // fallback
    }

    for (const [key, p] of SERVER_PROFILES_STORE.entries()) {
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          id: p.id,
          userId: p.authUserId || p.id,
          playerName: p.displayName,
          walletAddress: p.walletAddress,
          lastActive: p.updatedAt,
        });
      }
    }

    const results = [];
    for (const player of playerMap.values()) {
      if (
        searchQuery &&
        !player.playerName.toLowerCase().includes(searchQuery) &&
        !player.userId.toLowerCase().includes(searchQuery) &&
        !(player.walletAddress && player.walletAddress.toLowerCase().includes(searchQuery))
      ) {
        continue;
      }

      const summary = await computePlayerCoinSummary(player.walletAddress, player.userId);

      results.push({
        id: player.id,
        userId: player.userId,
        playerName: player.playerName,
        walletAddress: player.walletAddress,
        coinRushCoins: summary.coinRushCoins,
        treasureHuntCoins: summary.treasureHuntCoins,
        puzzleMasterCoins: summary.puzzleMasterCoins,
        speedTapCoins: summary.speedTapCoins,
        totalCoinsCollected: summary.totalCoinsCollected,
        eligibleEarnings: summary.eligibleEarnings,
        paidTotal: summary.paidTotal,
        reservedAmount: summary.reservedAmount,
        availableBalance: summary.availableBalance,
        lastActive: player.lastActive || new Date().toISOString(),
      });
    }

    return res.status(200).json({ success: true, players: results, total: results.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Admin: View All Withdrawal Requests
app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    const statusFilter = req.query.status as string | undefined;

    let list: any[] = [];
    try {
      let q = serverSupabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false });
      if (statusFilter && statusFilter !== 'all') {
        q = q.eq('status', statusFilter);
      }
      const { data } = await q;
      if (data && data.length > 0) {
        list = data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          playerId: d.player_id,
          playerName: d.player_name,
          walletAddress: d.wallet_address,
          amountCoins: d.amount_coins,
          amountRaw: d.amount_raw,
          tokenMint: d.token_mint,
          status: d.status,
          adminNotes: d.admin_notes,
          rejectionReason: d.rejection_reason,
          txSignature: d.tx_signature,
          verifiedAt: d.verified_at,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch {
      // fallback
    }

    if (list.length === 0) {
      list = SERVER_WITHDRAWALS;
      if (statusFilter && statusFilter !== 'all') {
        list = list.filter((w) => w.status === statusFilter);
      }
    }

    return res.status(200).json({ success: true, withdrawals: list, total: list.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Admin: Update Withdrawal Request Status (Approve, Process, Reject)
app.post('/api/admin/withdrawals/status', async (req, res) => {
  try {
    const { requestId, status, adminNotes, rejectionReason } = req.body;

    if (!requestId || !status) {
      return res.status(400).json({ success: false, error: 'requestId and status are required.' });
    }

    const validStatuses = ['approved', 'processing', 'rejected', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const nowIso = new Date().toISOString();

    try {
      await serverSupabase
        .from('withdrawal_requests')
        .update({
          status,
          admin_notes: adminNotes || '',
          rejection_reason: rejectionReason || '',
          updated_at: nowIso,
        })
        .eq('id', requestId);
    } catch {
      // fallback
    }

    const mem = SERVER_WITHDRAWALS.find((w) => w.id === requestId);
    if (mem) {
      mem.status = status;
      if (adminNotes) mem.adminNotes = adminNotes;
      if (rejectionReason) mem.rejectionReason = rejectionReason;
      mem.updatedAt = nowIso;
    }

    return res.status(200).json({
      success: true,
      message: status === 'rejected'
        ? 'Withdrawal request rejected. Reserved balance has been released.'
        : `Withdrawal request status updated to ${status}.`,
      status,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Admin: Settle Withdrawal with Solana On-Chain Verification (Mark Paid)
app.post('/api/admin/withdrawals/settle', async (req, res) => {
  try {
    const { requestId, txSignature, note } = req.body;

    if (!requestId || !txSignature) {
      return res.status(400).json({ success: false, error: 'requestId and txSignature are required.' });
    }

    const cleanSig = String(txSignature).trim();
    if (cleanSig.length < 30) {
      return res.status(400).json({ success: false, error: 'Invalid Solana transaction signature format (minimum 30 base58 characters required).' });
    }

    if (RECORDED_SERVER_SIGNATURES.has(cleanSig)) {
      return res.status(409).json({
        success: false,
        error: `DUPLICATE REJECTED: Transaction signature ${cleanSig.slice(0, 14)}... has already been used for another payout.`,
      });
    }

    try {
      const { data: existingPayment } = await serverSupabase
        .from('payment_records')
        .select('id, tx_signature')
        .eq('tx_signature', cleanSig)
        .maybeSingle();

      if (existingPayment) {
        RECORDED_SERVER_SIGNATURES.add(cleanSig);
        return res.status(409).json({
          success: false,
          error: `DUPLICATE REJECTED: Transaction signature ${cleanSig.slice(0, 14)}... has already been recorded for payment ${existingPayment.id}.`,
        });
      }
    } catch {
      // continue
    }

    let withdrawal: any = null;
    try {
      const { data: dbW } = await serverSupabase
        .from('withdrawal_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();
      if (dbW) withdrawal = dbW;
    } catch {
      // fallback
    }

    if (!withdrawal) {
      withdrawal = SERVER_WITHDRAWALS.find((w) => w.id === requestId);
    }

    if (!withdrawal) {
      return res.status(404).json({ success: false, error: `Withdrawal request ${requestId} not found.` });
    }

    if (withdrawal.status === 'completed' || withdrawal.status === 'paid') {
      return res.status(409).json({ success: false, error: 'Withdrawal request has already been marked completed/paid.' });
    }

    // Independent On-Chain Verification
    const verification = await verifySolanaTransactionOnChain({
      signature: cleanSig,
      expectedRecipientWallet: withdrawal.wallet_address || withdrawal.walletAddress,
      expectedAmount: withdrawal.amount_coins || withdrawal.amountCoins,
    });

    if (!verification.verified) {
      return res.status(400).json({
        success: false,
        error: `PAYMENT REJECTED: ${verification.error}`,
      });
    }

    RECORDED_SERVER_SIGNATURES.add(cleanSig);
    const nowIso = new Date().toISOString();

    try {
      await serverSupabase
        .from('withdrawal_requests')
        .update({
          status: 'completed',
          tx_signature: cleanSig,
          verified_at: nowIso,
          admin_notes: note || `Verified on-chain payout: ${cleanSig.slice(0, 8)}...`,
          updated_at: nowIso,
        })
        .eq('id', requestId);
    } catch {
      // fallback
    }

    const paymentPayload = {
      reward_request_id: null,
      tournament_id: null,
      user_id: withdrawal.user_id || withdrawal.userId,
      player_name: withdrawal.player_name || withdrawal.playerName,
      wallet_address: withdrawal.wallet_address || withdrawal.walletAddress,
      amount: `${(withdrawal.amount_coins || withdrawal.amountCoins).toLocaleString()} $PINN`,
      token_mint: OFFICIAL_PINN_MINT,
      tx_signature: cleanSig,
      status: 'verified_paid',
      is_verified_on_chain: true,
      verified_at: nowIso,
      note: note || 'Verified Solana on-chain withdrawal payout.',
      updated_at: nowIso,
    };

    try {
      await serverSupabase.from('payment_records').insert(paymentPayload);
    } catch {
      // fallback
    }

    const mem = SERVER_WITHDRAWALS.find((w) => w.id === requestId);
    if (mem) {
      mem.status = 'completed';
      mem.txSignature = cleanSig;
      mem.verifiedAt = nowIso;
      mem.updatedAt = nowIso;
    }

    return res.status(200).json({
      success: true,
      message: `Withdrawal marked paid and verified on-chain with signature: ${cleanSig.slice(0, 12)}...`,
      txSignature: cleanSig,
      payment: paymentPayload,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Health check & status endpoint
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    project: 'PINN Arcade',
    tokenMint: OFFICIAL_PINN_MINT,
    solanaRpcEndpoints: SOLANA_RPC_ENDPOINTS.length,
    timestamp: new Date().toISOString(),
  });
});

async function start() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`PINN Arcade Full-Stack server running on port ${PORT}`);
  });
}

start().catch(console.error);
