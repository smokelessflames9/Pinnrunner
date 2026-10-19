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
import { generateThemedUsername } from './src/services/usernameGenerator.ts';

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

// Explicit CORS configuration for Cloudflare production frontend and local development origins
const ALLOWED_ORIGINS = new Set<string>([
  'https://pinnarcade.fun',
  'https://www.pinnarcade.fun',
  'https://pinnrunner.thomassean538.workers.dev',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);

if (process.env.CORS_ALLOWED_ORIGINS) {
  for (const rawOrigin of process.env.CORS_ALLOWED_ORIGINS.split(',')) {
    const clean = rawOrigin.trim().replace(/\/+$/, '');
    if (clean) {
      ALLOWED_ORIGINS.add(clean);
    }
  }
}

function isAllowedCorsOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return (
      host === 'pinnarcade.fun' ||
      host.endsWith('.pinnarcade.fun') ||
      host.endsWith('.workers.dev') ||
      host.endsWith('.pages.dev') ||
      host.endsWith('.run.app')
    );
  } catch {
    return false;
  }
}

app.use((req, res, next) => {
  const origin = req.headers.origin ? req.headers.origin.trim().replace(/\/+$/, '') : '';
  if (origin && isAllowedCorsOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-player-session-token, x-admin-role, Accept'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

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
  userId?: string | null;
  walletAddress: string;
  gameId?: 'coin-rush' | 'treasure-hunt' | 'puzzle-master' | 'speed-tap';
  sessionId?: string;
  amount: number;
  balanceAfter: number;
  entryType: 'game_reward' | 'tournament_prize' | 'withdrawal' | 'adjustment';
  status?: 'eligible' | 'pending' | 'rejected' | 'void';
  referenceId?: string;
  description?: string;
  createdAt: string;
}

const SERVER_COIN_LEDGER: ServerCoinLedgerEntry[] = [];

// Active cryptographic wallet sessions issued by /api/auth/solana-verify
interface ActivePlayerSession {
  token: string;
  walletAddress: string;
  playerId: string;
  issuedAt: number;
  expiresAt: number;
}
const ACTIVE_PLAYER_SESSIONS = new Map<string, ActivePlayerSession>();

// Track recorded game sessions -> coins already credited for that sessionId to prevent replay / double counting
const RECORDED_COIN_SESSIONS = new Map<string, { gameId: string; coinsCredited: number; walletAddress: string }>();

// Concurrency locks for withdrawal creation and payout settlement
const ACTIVE_WITHDRAWAL_LOCKS = new Set<string>();
const ACTIVE_SETTLING_WITHDRAWALS = new Set<string>();


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
          gameId: 'coin-rush',
          sessionId: `init_${profile.id}`,
          amount: initialCoins,
          balanceAfter: initialCoins,
          entryType: 'game_reward',
          status: 'eligible',
          description: 'Initial reconciled game-coin balance from prior gameplay runs.',
          createdAt: nowIso,
        });
      }
    }

    // Generate secure session token and register in server session store
    const sessionToken = `pinn_auth_${cleanWallet.slice(0, 8)}_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    ACTIVE_PLAYER_SESSIONS.set(sessionToken, {
      token: sessionToken,
      walletAddress: cleanWallet,
      playerId: profile.id,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

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
 * Helper: Resolve and verify authenticated player identity from session header or Supabase Bearer JWT
 */
async function resolveAuthenticatedPlayer(req: express.Request): Promise<{
  authenticated: boolean;
  userId?: string | null;
  playerId?: string | null;
  walletAddress?: string | null;
  email?: string | null;
}> {
  const playerTokenHeader = (req.headers['x-player-session-token'] as string | undefined)?.trim();
  const authHeader = (req.headers.authorization || '').trim();
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  let verifiedWallet: string | null = null;
  let verifiedPlayerId: string | null = null;
  let verifiedUserId: string | null = null;
  let verifiedEmail: string | null = null;

  // 1. Check x-player-session-token or Bearer pinn_auth_* token
  const candidateSessionToken =
    playerTokenHeader || (bearerToken.startsWith('pinn_auth_') ? bearerToken : '');

  if (candidateSessionToken) {
    const sess = ACTIVE_PLAYER_SESSIONS.get(candidateSessionToken);
    if (sess && sess.expiresAt > Date.now()) {
      verifiedWallet = sess.walletAddress;
      verifiedPlayerId = sess.playerId;
    }
  }

  // 2. Check Supabase Auth JWT if provided
  if (bearerToken && !bearerToken.startsWith('pinn_auth_')) {
    try {
      const { data, error } = await serverSupabase.auth.getUser(bearerToken);
      if (!error && data?.user) {
        verifiedUserId = data.user.id;
        verifiedEmail = data.user.email || null;
        const metaWallet = data.user.user_metadata?.wallet_address;
        if (metaWallet && !verifiedWallet) {
          verifiedWallet = String(metaWallet).trim();
        }
      }
    } catch {
      // ignore invalid jwt
    }
  }

  // Resolve linked wallet/user from profile if one side is known
  if (verifiedWallet && !verifiedUserId) {
    const prof = SERVER_PROFILES_STORE.get(verifiedWallet.toLowerCase());
    if (prof) {
      verifiedPlayerId = prof.id;
      if (prof.authUserId) verifiedUserId = prof.authUserId;
    }
  }

  return {
    authenticated: Boolean(verifiedWallet || verifiedUserId),
    userId: verifiedUserId,
    playerId: verifiedPlayerId,
    walletAddress: verifiedWallet,
    email: verifiedEmail,
  };
}

/**
 * Helper: Enforce server-side Administrator RBAC authorization on /api/admin/* endpoints
 */
async function verifyServerAdmin(req: express.Request): Promise<{
  authorized: boolean;
  status: number;
  userId?: string;
  email?: string;
  role?: 'admin' | 'superadmin';
  error?: string;
}> {
  const authHeader = (req.headers.authorization || '').trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return {
      authorized: false,
      status: 401,
      error: 'Administrator authentication required. Missing Authorization Bearer token.',
    };
  }

  try {
    const { data: userData, error: userError } = await serverSupabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return {
        authorized: false,
        status: 401,
        error: 'Invalid or expired administrator session token.',
      };
    }

    const user = userData.user;
    const email = (user.email || '').toLowerCase();

    // 1. Check public.admin_roles table in Supabase
    try {
      const { data: roleRow } = await serverSupabase
        .from('admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleRow && (roleRow.role === 'admin' || roleRow.role === 'superadmin')) {
        return {
          authorized: true,
          status: 200,
          userId: user.id,
          email: user.email,
          role: roleRow.role,
        };
      }
    } catch {
      // continue to fallback checks
    }

    // 2. Check user app_metadata / user_metadata role or configured project owner admin email
    const allowedEmails = (process.env.ADMIN_EMAILS || 'thomassean538@gmail.com,admin@pinnarcade.io')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const metaRole = user.app_metadata?.role || user.user_metadata?.role;
    if (
      metaRole === 'admin' ||
      metaRole === 'superadmin' ||
      (email && allowedEmails.includes(email))
    ) {
      return {
        authorized: true,
        status: 200,
        userId: user.id,
        email: user.email,
        role: metaRole === 'superadmin' ? 'superadmin' : 'admin',
      };
    }

    return {
      authorized: false,
      status: 403,
      error: `Access denied: account (${user.email || user.id}) does not hold administrator privileges in public.admin_roles.`,
    };
  } catch (err: any) {
    return {
      authorized: false,
      status: 500,
      error: `Administrator verification failed: ${err.message}`,
    };
  }
}

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

    // Compute authoritative summary so profile.coinsBalance always reflects real verified coins
    const summary = await computePlayerCoinSummary(profile.walletAddress, profile.authUserId || profile.id);
    profile.coinsBalance = summary.totalCoinsCollected;
    profile.coinsWithdrawn = summary.paidTotal;

    return res.status(200).json({ success: true, player: profile, summary });
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

    const authPlayer = await resolveAuthenticatedPlayer(req);
    const cleanWallet = String(walletAddress).trim();
    if (
      authPlayer.authenticated &&
      authPlayer.walletAddress &&
      authPlayer.walletAddress.toLowerCase() !== cleanWallet.toLowerCase()
    ) {
      return res.status(403).json({ success: false, error: 'Cannot modify another player\'s username.' });
    }

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
 * 5. Player coin ledger & activity (restricted to authenticated player owner)
 */
app.get('/api/player/ledger', async (req, res) => {
  try {
    const authPlayer = await resolveAuthenticatedPlayer(req);
    const requestedWallet = (req.query.walletAddress as string | undefined)?.trim();

    if (!requestedWallet && !authPlayer.walletAddress) {
      return res.status(400).json({ success: false, error: 'walletAddress is required.' });
    }

    if (
      authPlayer.authenticated &&
      authPlayer.walletAddress &&
      requestedWallet &&
      authPlayer.walletAddress.toLowerCase() !== requestedWallet.toLowerCase()
    ) {
      return res.status(403).json({ success: false, error: 'Forbidden: cannot view another player\'s coin ledger.' });
    }

    const cleanWallet = (authPlayer.walletAddress || requestedWallet || '').trim().toLowerCase();
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

// Per-game coin anti-cheat ceilings
const GAME_COIN_RULES: Record<
  'coin-rush' | 'treasure-hunt' | 'puzzle-master' | 'speed-tap',
  { minDurationMs: number; maxCoinsPerRun: number; maxCoinsPerSec: number }
> = {
  'coin-rush': { minDurationMs: 2500, maxCoinsPerRun: 5000, maxCoinsPerSec: 18 },
  'treasure-hunt': { minDurationMs: 3000, maxCoinsPerRun: 1000, maxCoinsPerSec: 12 },
  'puzzle-master': { minDurationMs: 4000, maxCoinsPerRun: 500, maxCoinsPerSec: 12 },
  'speed-tap': { minDurationMs: 4000, maxCoinsPerRun: 500, maxCoinsPerSec: 16 },
};

/**
 * 6. Authoritative coin recording from game runs (with session deduplication & anti-cheat validation)
 */
app.post('/api/player/record-coins', async (req, res) => {
  try {
    const authPlayer = await resolveAuthenticatedPlayer(req);
    const { walletAddress, userId, coinsEarned, durationMs, gameId, sessionId } = req.body;

    const cleanWallet = String(authPlayer.walletAddress || walletAddress || '').trim();
    const cleanUid = String(authPlayer.userId || userId || '').trim() || null;

    if (!cleanWallet && !cleanUid) {
      return res.status(401).json({
        success: false,
        error: 'Authenticated player session or wallet address is required to record coins.',
      });
    }

    // Prevent spoofing another wallet if authenticated session exists
    if (
      authPlayer.authenticated &&
      authPlayer.walletAddress &&
      walletAddress &&
      authPlayer.walletAddress.toLowerCase() !== String(walletAddress).trim().toLowerCase()
    ) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: session wallet does not match target walletAddress.',
      });
    }

    const normalizedGameId = (
      ['coin-rush', 'treasure-hunt', 'puzzle-master', 'speed-tap'].includes(String(gameId))
        ? String(gameId)
        : 'coin-rush'
    ) as 'coin-rush' | 'treasure-hunt' | 'puzzle-master' | 'speed-tap';

    const rule = GAME_COIN_RULES[normalizedGameId];
    const requestedCoins = Math.max(0, parseInt(String(coinsEarned || 0), 10));
    const runDuration = Math.max(0, parseInt(String(durationMs || 0), 10));
    const cleanSessionId = String(sessionId || `${normalizedGameId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`).trim();

    // Anti-cheat validation on coin earnings
    if (requestedCoins > rule.maxCoinsPerRun) {
      return res.status(422).json({
        success: false,
        error: `Rejected by anti-cheat: ${requestedCoins} coins exceeds max limit (${rule.maxCoinsPerRun}) for ${normalizedGameId}.`,
      });
    }

    if (requestedCoins > 0 && runDuration > 0 && runDuration < rule.minDurationMs) {
      return res.status(422).json({
        success: false,
        error: `Rejected by anti-cheat: run duration (${runDuration}ms) below minimum threshold (${rule.minDurationMs}ms).`,
      });
    }

    const durationSec = Math.max(1, runDuration / 1000);
    if (requestedCoins > 10 && requestedCoins / durationSec > rule.maxCoinsPerSec) {
      return res.status(422).json({
        success: false,
        error: `Rejected by anti-cheat: coin collection rate (${(requestedCoins / durationSec).toFixed(1)}/s) exceeds plausible limit.`,
      });
    }

    // Deduplicate by sessionId (supports multi-level cumulative updates in Treasure Hunt by crediting only incremental delta)
    const prevSession = RECORDED_COIN_SESSIONS.get(cleanSessionId);
    const prevCredited = prevSession ? prevSession.coinsCredited : 0;
    const incrementalCoins = Math.max(0, requestedCoins - prevCredited);

    RECORDED_COIN_SESSIONS.set(cleanSessionId, {
      gameId: normalizedGameId,
      coinsCredited: Math.max(prevCredited, requestedCoins),
      walletAddress: cleanWallet.toLowerCase(),
    });

    const normalizedKey = cleanWallet.toLowerCase();
    let profile = normalizedKey ? SERVER_PROFILES_STORE.get(normalizedKey) : undefined;

    if (!profile && cleanWallet) {
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
            authUserId: dbProfile.auth_user_id || cleanUid,
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

    const nowIso = new Date().toISOString();

    if (incrementalCoins > 0) {
      // Check if an in-memory ledger entry for this sessionId already exists
      const existingLedgerEntry = SERVER_COIN_LEDGER.find((e) => e.sessionId === cleanSessionId);
      if (existingLedgerEntry) {
        existingLedgerEntry.amount = Math.max(existingLedgerEntry.amount, requestedCoins);
        existingLedgerEntry.balanceAfter += incrementalCoins;
      } else {
        SERVER_COIN_LEDGER.push({
          id: crypto.randomUUID(),
          playerId: profile?.id || cleanUid || 'player',
          userId: cleanUid || profile?.authUserId || null,
          walletAddress: cleanWallet,
          gameId: normalizedGameId,
          sessionId: cleanSessionId,
          amount: requestedCoins,
          balanceAfter: (profile?.coinsBalance || 0) + incrementalCoins,
          entryType: 'game_reward',
          status: 'eligible',
          description: `Verified collectible coins earned in ${normalizedGameId}.`,
          createdAt: nowIso,
        });
      }

      // Persist to Supabase public.coin_ledger (upsert by session_id so multi-level runs never double-count)
      try {
        const isUuidUser = cleanUid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanUid);
        await serverSupabase.from('coin_ledger').upsert(
          {
            user_id: isUuidUser ? cleanUid : (profile?.authUserId || null),
            player_id: profile?.id || null,
            wallet_address: cleanWallet || null,
            game_id: normalizedGameId,
            session_id: cleanSessionId,
            amount: Math.max(prevCredited, requestedCoins),
            balance_after: (profile?.coinsBalance || 0) + incrementalCoins,
            entry_type: 'game_reward',
            status: 'eligible',
            description: `Verified collectible coins earned in ${normalizedGameId}.`,
          },
          { onConflict: 'session_id' }
        );
      } catch {
        // fallback if migration not yet applied
      }
    }

    if (profile) {
      profile.coinsBalance += incrementalCoins;
      if (!prevSession) {
        profile.totalGamesPlayed += 1;
      }
      profile.totalPlayTimeMs += runDuration;
      profile.lastRunDurationMs = runDuration;
      profile.updatedAt = nowIso;
      SERVER_PROFILES_STORE.set(normalizedKey, profile);

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

    const summary = await computePlayerCoinSummary(cleanWallet, cleanUid || profile?.authUserId);
    if (profile) {
      profile.coinsBalance = summary.totalCoinsCollected;
    }

    return res.status(200).json({
      success: true,
      coinsBalance: summary.totalCoinsCollected,
      summary,
      player: profile,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

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
  tokenDecimals: number;
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

/**
 * Authoritative computation of a player's per-game & combined verified coins,
 * eligible earnings, completed payouts, active reservations, and available balance.
 * Strictly excludes rejected, pending, duplicate, and unverified runs.
 */
async function computePlayerCoinSummary(walletAddress?: string | null, userId?: string | null) {
  const cleanWallet = (walletAddress || '').trim().toLowerCase();
  const cleanUid = (userId || '').trim();
  const isUuidUid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanUid);

  // Track unique runs by (gameId, sessionKey) -> max verified coins so runs are never double-counted
  const runsByGame: Record<'coin-rush' | 'treasure-hunt' | 'puzzle-master' | 'speed-tap', Map<string, number>> = {
    'coin-rush': new Map(),
    'treasure-hunt': new Map(),
    'puzzle-master': new Map(),
    'speed-tap': new Map(),
  };

  const recordRun = (gameId: string, sessionKey: string, coins: number) => {
    const c = Math.max(0, Math.floor(Number(coins) || 0));
    if (c <= 0) return;
    if (
      gameId === 'coin-rush' ||
      gameId === 'treasure-hunt' ||
      gameId === 'puzzle-master' ||
      gameId === 'speed-tap'
    ) {
      const prev = runsByGame[gameId].get(sessionKey) || 0;
      if (c > prev) {
        runsByGame[gameId].set(sessionKey, c);
      }
    }
  };

  // 1. Query verified scores from Supabase public.scores (strictly status = 'verified')
  try {
    let q = serverSupabase
      .from('scores')
      .select('id, game_id, coins, session_id, status')
      .eq('status', 'verified');

    if (cleanWallet && isUuidUid) {
      q = q.or(`wallet_address.ilike.${cleanWallet},user_id.eq.${cleanUid}`);
    } else if (cleanWallet) {
      q = q.ilike('wallet_address', cleanWallet);
    } else if (isUuidUid) {
      q = q.eq('user_id', cleanUid);
    } else {
      q = null as any;
    }

    if (q) {
      const { data: scoreRows } = await q;
      if (scoreRows && scoreRows.length > 0) {
        for (const r of scoreRows) {
          const key = r.session_id ? String(r.session_id) : `score_${r.id}`;
          recordRun(r.game_id, key, Number(r.coins) || 0);
        }
      }
    }
  } catch {
    // continue
  }

  // 2. Query eligible entries from Supabase public.coin_ledger (strictly entry_type = 'game_reward' and status = 'eligible')
  try {
    let lq = serverSupabase
      .from('coin_ledger')
      .select('id, game_id, amount, session_id, status, entry_type')
      .eq('entry_type', 'game_reward')
      .eq('status', 'eligible');

    if (cleanWallet && isUuidUid) {
      lq = lq.or(`wallet_address.ilike.${cleanWallet},user_id.eq.${cleanUid},player_id.eq.${cleanUid}`);
    } else if (cleanWallet) {
      lq = lq.ilike('wallet_address', cleanWallet);
    } else if (isUuidUid) {
      lq = lq.or(`user_id.eq.${cleanUid},player_id.eq.${cleanUid}`);
    } else {
      lq = null as any;
    }

    if (lq) {
      const { data: ledgerRows } = await lq;
      if (ledgerRows && ledgerRows.length > 0) {
        for (const r of ledgerRows) {
          const key = r.session_id ? String(r.session_id) : `ledger_${r.id}`;
          recordRun(r.game_id || 'coin-rush', key, Number(r.amount) || 0);
        }
      }
    }
  } catch {
    // continue
  }

  // 3. Also merge in-memory SERVER_COIN_LEDGER eligible entries (deduplicated by sessionId)
  for (const entry of SERVER_COIN_LEDGER) {
    if (entry.entryType !== 'game_reward' || (entry.status && entry.status !== 'eligible')) continue;
    const matchWallet = cleanWallet && entry.walletAddress.toLowerCase() === cleanWallet;
    const matchUid = cleanUid && (entry.userId === cleanUid || entry.playerId === cleanUid);
    if (matchWallet || matchUid) {
      const key = entry.sessionId || `mem_${entry.id}`;
      recordRun(entry.gameId || 'coin-rush', key, entry.amount);
    }
  }

  // Sum per-game verified totals
  let coinRushCoins = 0;
  for (const v of runsByGame['coin-rush'].values()) coinRushCoins += v;

  let treasureHuntCoins = 0;
  for (const v of runsByGame['treasure-hunt'].values()) treasureHuntCoins += v;

  let puzzleMasterCoins = 0;
  for (const v of runsByGame['puzzle-master'].values()) puzzleMasterCoins += v;

  let speedTapCoins = 0;
  for (const v of runsByGame['speed-tap'].values()) speedTapCoins += v;

  // Combined total strictly equals the sum of the four eligible per-game totals
  const totalCoinsCollected =
    coinRushCoins + treasureHuntCoins + puzzleMasterCoins + speedTapCoins;
  const eligibleEarnings = totalCoinsCollected;

  // 4. Calculate Paid/Withdrawn and Reserved amounts without double counting
  const withdrawalMap = new Map<string, { amountCoins: number; status: string }>();

  try {
    let wQuery = serverSupabase.from('withdrawal_requests').select('id, amount_coins, status');
    if (cleanWallet && isUuidUid) {
      wQuery = wQuery.or(`wallet_address.ilike.${cleanWallet},user_id.eq.${cleanUid}`);
    } else if (cleanWallet) {
      wQuery = wQuery.ilike('wallet_address', cleanWallet);
    } else if (isUuidUid) {
      wQuery = wQuery.eq('user_id', cleanUid);
    } else {
      wQuery = null as any;
    }

    if (wQuery) {
      const { data: wRows } = await wQuery;
      if (wRows && wRows.length > 0) {
        for (const w of wRows) {
          withdrawalMap.set(String(w.id), {
            amountCoins: Number(w.amount_coins) || 0,
            status: String(w.status),
          });
        }
      }
    }
  } catch {
    // continue
  }

  for (const w of SERVER_WITHDRAWALS) {
    const matchWallet = cleanWallet && w.walletAddress.toLowerCase() === cleanWallet;
    const matchUid = cleanUid && (w.userId === cleanUid || w.playerId === cleanUid);
    if ((matchWallet || matchUid) && !withdrawalMap.has(w.id)) {
      withdrawalMap.set(w.id, {
        amountCoins: w.amountCoins,
        status: w.status,
      });
    }
  }

  let paidTotal = 0;
  let reservedAmount = 0;

  for (const w of withdrawalMap.values()) {
    if (w.status === 'completed' || w.status === 'paid') {
      paidTotal += w.amountCoins;
    } else if (w.status === 'pending' || w.status === 'approved' || w.status === 'processing') {
      reservedAmount += w.amountCoins;
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

// 7. Get Authoritative Player Coin Totals & Balances (Protected by Player Ownership Check)
app.get('/api/player/coin-totals', async (req, res) => {
  try {
    const authPlayer = await resolveAuthenticatedPlayer(req);
    const queryWallet = (req.query.walletAddress as string | undefined)?.trim();
    const queryUserId = (req.query.userId as string | undefined)?.trim();

    if (!queryWallet && !queryUserId && !authPlayer.walletAddress && !authPlayer.userId) {
      return res.status(400).json({
        success: false,
        error: 'Authenticated player session, walletAddress, or userId is required.',
      });
    }

    // If the caller has an authenticated session, prevent querying another player's balances
    if (authPlayer.authenticated) {
      if (
        authPlayer.walletAddress &&
        queryWallet &&
        authPlayer.walletAddress.toLowerCase() !== queryWallet.toLowerCase()
      ) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: players can only view their own coin totals.',
        });
      }
      if (
        authPlayer.userId &&
        queryUserId &&
        authPlayer.userId !== queryUserId &&
        authPlayer.playerId !== queryUserId
      ) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: players can only view their own coin totals.',
        });
      }
    }

    const effectiveWallet = authPlayer.walletAddress || queryWallet || null;
    const effectiveUserId = authPlayer.userId || queryUserId || authPlayer.playerId || null;

    const summary = await computePlayerCoinSummary(effectiveWallet, effectiveUserId);
    return res.status(200).json({ success: true, summary });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Player Submit Withdrawal Request (10,000 Minimum, Atomic Concurrency-Safe Lock & Ownership Verified)
app.post('/api/player/withdraw', async (req, res) => {
  try {
    const authPlayer = await resolveAuthenticatedPlayer(req);
    const { walletAddress, userId, playerName, amountCoins, destinationWallet } = req.body;

    // Require authenticated player session (Supabase Auth JWT or verified Solana wallet session)
    if (!authPlayer.authenticated && !walletAddress && !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in or authenticate your wallet before requesting a withdrawal.',
      });
    }

    // Enforce strict ownership: never trust client-supplied userId/walletAddress if mismatched with authenticated session
    if (authPlayer.authenticated) {
      if (
        authPlayer.walletAddress &&
        walletAddress &&
        authPlayer.walletAddress.toLowerCase() !== String(walletAddress).trim().toLowerCase()
      ) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: cannot submit a withdrawal request on behalf of another wallet.',
        });
      }
      if (
        authPlayer.userId &&
        userId &&
        authPlayer.userId !== String(userId).trim() &&
        authPlayer.playerId !== String(userId).trim()
      ) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: cannot submit a withdrawal request on behalf of another user ID.',
        });
      }
    }

    const effectiveWallet = (authPlayer.walletAddress || walletAddress || '').trim();
    const effectiveUserId = (authPlayer.userId || userId || authPlayer.playerId || '').trim() || null;

    if (!effectiveWallet && !effectiveUserId) {
      return res.status(401).json({
        success: false,
        error: 'Unable to determine authenticated player identity.',
      });
    }

    const amount = Number(amountCoins);
    if (!Number.isInteger(amount) || amount < 10000) {
      return res.status(400).json({
        success: false,
        error: 'Minimum withdrawal is 10,000 eligible available PINN coins (exact integer required).',
      });
    }

    const cleanDest = String(destinationWallet || effectiveWallet || '').trim();
    if (!cleanDest || cleanDest.length < 32 || cleanDest.length > 44) {
      return res.status(400).json({
        success: false,
        error: 'A valid destination Solana wallet address (32-44 base58 characters) is required.',
      });
    }

    // Strict cryptographic base58 public key validation (must decode to 32 bytes)
    try {
      const decodedDest = safeBs58Decode(cleanDest);
      if (decodedDest.length !== 32) {
        return res.status(400).json({
          success: false,
          error: 'Invalid destination Solana wallet address: decoded public key must be 32 bytes.',
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid destination Solana wallet address: contains non-base58 characters.',
      });
    }

    // Acquire atomic server-side concurrency lock for this player to prevent overlapping double-spend requests
    const lockKeys = [
      effectiveUserId ? `uid:${effectiveUserId.toLowerCase()}` : '',
      effectiveWallet ? `wal:${effectiveWallet.toLowerCase()}` : '',
      `dest:${cleanDest.toLowerCase()}`,
    ].filter(Boolean);

    if (lockKeys.some((k) => ACTIVE_WITHDRAWAL_LOCKS.has(k))) {
      return res.status(429).json({
        success: false,
        error: 'CONCURRENT REQUEST BLOCKED: Another withdrawal request for your account is currently being processed. Please wait.',
      });
    }

    for (const k of lockKeys) ACTIVE_WITHDRAWAL_LOCKS.add(k);

    try {
      // Authoritative Server-Side Balance Check inside lock
      const summary = await computePlayerCoinSummary(effectiveWallet || cleanDest, effectiveUserId);
      if (amount > summary.availableBalance) {
        return res.status(400).json({
          success: false,
          error: `Insufficient available balance. You requested ${amount.toLocaleString()} PINN coins, but your available balance is ${summary.availableBalance.toLocaleString()} PINN coins.`,
          availableBalance: summary.availableBalance,
        });
      }

      const rawAmount = (BigInt(amount) * 10n ** BigInt(PINN_DECIMALS)).toString();
      const nowIso = new Date().toISOString();
      const isUuidUser =
        effectiveUserId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveUserId);

      // Resolve display name from authoritative profile if available
      const prof = effectiveWallet ? SERVER_PROFILES_STORE.get(effectiveWallet.toLowerCase()) : undefined;
      const resolvedPlayerName = prof?.displayName || String(playerName || 'Player').trim().slice(0, 32);

      let requestId: string = crypto.randomUUID();

      // 1. Try atomic Supabase RPC submit_withdrawal_request (which uses pg_advisory_xact_lock)
      let persistedViaRpc = false;
      try {
        const { data: rpcRes, error: rpcErr } = await serverSupabase.rpc('submit_withdrawal_request', {
          p_user_id: isUuidUser ? effectiveUserId : null,
          p_player_name: resolvedPlayerName,
          p_wallet_address: cleanDest,
          p_amount_coins: amount,
          p_token_decimals: PINN_DECIMALS,
          p_token_mint: OFFICIAL_PINN_MINT,
        });

        if (!rpcErr && rpcRes && rpcRes.success && rpcRes.requestId) {
          requestId = String(rpcRes.requestId);
          persistedViaRpc = true;
        }
      } catch {
        // fallback to direct table insert below
      }

      // 2. If RPC wasn't available, insert directly into public.withdrawal_requests
      if (!persistedViaRpc) {
        try {
          await serverSupabase.from('withdrawal_requests').insert({
            id: requestId,
            user_id: isUuidUser ? effectiveUserId : null,
            player_id: prof?.id || null,
            player_name: resolvedPlayerName,
            wallet_address: cleanDest,
            amount_coins: amount,
            amount_raw: rawAmount,
            token_decimals: PINN_DECIMALS,
            token_mint: OFFICIAL_PINN_MINT,
            status: 'pending',
          });
        } catch {
          // fallback to SERVER_WITHDRAWALS
        }
      }

      const withdrawalRecord: ServerWithdrawalRequest = {
        id: requestId,
        userId: effectiveUserId,
        playerId: prof?.id || null,
        playerName: resolvedPlayerName,
        walletAddress: cleanDest,
        amountCoins: amount,
        amountRaw: rawAmount,
        tokenDecimals: PINN_DECIMALS,
        tokenMint: OFFICIAL_PINN_MINT,
        status: 'pending',
        adminNotes: '',
        rejectionReason: '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      SERVER_WITHDRAWALS.unshift(withdrawalRecord);

      const newAvailableBalance = Math.max(0, summary.availableBalance - amount);

      return res.status(200).json({
        success: true,
        message: `Withdrawal request #${requestId.slice(0, 8)} submitted for ${amount.toLocaleString()} PINN coins. Funds are now reserved pending administrative review.`,
        request: withdrawalRecord,
        newAvailableBalance,
      });
    } finally {
      for (const k of lockKeys) ACTIVE_WITHDRAWAL_LOCKS.delete(k);
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Get Player's Own Withdrawal Requests (Protected by Player Ownership Check)
app.get('/api/player/withdrawals', async (req, res) => {
  try {
    const authPlayer = await resolveAuthenticatedPlayer(req);
    const queryWallet = (req.query.walletAddress as string | undefined)?.trim();
    const queryUserId = (req.query.userId as string | undefined)?.trim();

    if (!queryWallet && !queryUserId && !authPlayer.walletAddress && !authPlayer.userId) {
      return res.status(400).json({
        success: false,
        error: 'Authenticated player session, walletAddress, or userId is required.',
      });
    }

    if (authPlayer.authenticated) {
      if (
        authPlayer.walletAddress &&
        queryWallet &&
        authPlayer.walletAddress.toLowerCase() !== queryWallet.toLowerCase()
      ) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: players can only query their own withdrawal requests.',
        });
      }
      if (
        authPlayer.userId &&
        queryUserId &&
        authPlayer.userId !== queryUserId &&
        authPlayer.playerId !== queryUserId
      ) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: players can only query their own withdrawal requests.',
        });
      }
    }

    const cleanWallet = (authPlayer.walletAddress || queryWallet || '').trim().toLowerCase();
    const cleanUid = (authPlayer.userId || queryUserId || authPlayer.playerId || '').trim();
    const isUuidUid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanUid);

    const mergedMap = new Map<string, ServerWithdrawalRequest>();

    try {
      let q = serverSupabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (cleanWallet && isUuidUid) {
        q = q.or(`wallet_address.ilike.${cleanWallet},user_id.eq.${cleanUid}`);
      } else if (cleanWallet) {
        q = q.ilike('wallet_address', cleanWallet);
      } else if (isUuidUid) {
        q = q.eq('user_id', cleanUid);
      } else {
        q = null as any;
      }

      if (q) {
        const { data } = await q;
        if (data && data.length > 0) {
          for (const d of data) {
            mergedMap.set(String(d.id), {
              id: d.id,
              userId: d.user_id,
              playerId: d.player_id,
              playerName: d.player_name,
              walletAddress: d.wallet_address,
              amountCoins: Number(d.amount_coins) || 0,
              amountRaw: d.amount_raw,
              tokenDecimals: d.token_decimals ?? PINN_DECIMALS,
              tokenMint: d.token_mint || OFFICIAL_PINN_MINT,
              status: d.status === 'completed' ? 'paid' : d.status,
              adminNotes: d.admin_notes || '',
              rejectionReason: d.rejection_reason || '',
              txSignature: d.tx_signature,
              verifiedAt: d.verified_at,
              createdAt: d.created_at,
              updatedAt: d.updated_at,
            });
          }
        }
      }
    } catch {
      // fallback
    }

    for (const w of SERVER_WITHDRAWALS) {
      const matchWallet = cleanWallet && w.walletAddress.toLowerCase() === cleanWallet;
      const matchUid = cleanUid && (w.userId === cleanUid || w.playerId === cleanUid);
      if ((matchWallet || matchUid) && !mergedMap.has(w.id)) {
        mergedMap.set(w.id, {
          ...w,
          status: w.status === 'completed' ? 'paid' : w.status,
        });
      }
    }

    const list = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.status(200).json({ success: true, withdrawals: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Admin: Searchable Player Balances (Protected by Server-Side Admin Verification)
app.get('/api/admin/player-balances', async (req, res) => {
  try {
    const adminCheck = await verifyServerAdmin(req);
    if (!adminCheck.authorized) {
      return res.status(adminCheck.status).json({ success: false, error: adminCheck.error });
    }

    const searchQuery = String(req.query.q || '').trim().toLowerCase();

    // Collect all players from player_profiles, verified scores, and withdrawal_requests
    const playerMap = new Map<
      string,
      { id: string; userId: string; playerName: string; walletAddress?: string; lastActive?: string }
    >();

    try {
      const { data: dbProfiles } = await serverSupabase.from('player_profiles').select('*');
      if (dbProfiles) {
        for (const p of dbProfiles) {
          const key = (p.wallet_address || p.auth_user_id || p.id).toLowerCase();
          playerMap.set(key, {
            id: p.id,
            userId: p.auth_user_id || p.id,
            playerName: p.display_name || 'Player',
            walletAddress: p.wallet_address || undefined,
            lastActive: p.updated_at || p.created_at,
          });
        }
      }
    } catch {
      // fallback
    }

    try {
      const { data: scorePlayers } = await serverSupabase
        .from('scores')
        .select('user_id, player_name, wallet_address, created_at')
        .eq('status', 'verified')
        .order('created_at', { ascending: false });

      if (scorePlayers) {
        for (const sp of scorePlayers) {
          const key = (sp.wallet_address || sp.user_id || '').toLowerCase();
          if (key && !playerMap.has(key)) {
            playerMap.set(key, {
              id: sp.user_id,
              userId: sp.user_id,
              playerName: sp.player_name || 'Player',
              walletAddress: sp.wallet_address || undefined,
              lastActive: sp.created_at,
            });
          }
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
        walletAddress: player.walletAddress || null,
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

    results.sort((a, b) => b.totalCoinsCollected - a.totalCoinsCollected);

    return res.status(200).json({ success: true, players: results, total: results.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Admin: View All Withdrawal Requests (Protected by Server-Side Admin Verification)
app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    const adminCheck = await verifyServerAdmin(req);
    if (!adminCheck.authorized) {
      return res.status(adminCheck.status).json({ success: false, error: adminCheck.error });
    }

    const statusFilter = req.query.status as string | undefined;
    const mergedMap = new Map<string, ServerWithdrawalRequest>();

    try {
      let q = serverSupabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'paid' || statusFilter === 'completed') {
          q = q.in('status', ['paid', 'completed']);
        } else {
          q = q.eq('status', statusFilter);
        }
      }

      const { data } = await q;
      if (data && data.length > 0) {
        for (const d of data) {
          mergedMap.set(String(d.id), {
            id: d.id,
            userId: d.user_id,
            playerId: d.player_id,
            playerName: d.player_name,
            walletAddress: d.wallet_address,
            amountCoins: Number(d.amount_coins) || 0,
            amountRaw: d.amount_raw,
            tokenDecimals: d.token_decimals ?? PINN_DECIMALS,
            tokenMint: d.token_mint || OFFICIAL_PINN_MINT,
            status: d.status === 'completed' ? 'paid' : d.status,
            adminNotes: d.admin_notes || '',
            rejectionReason: d.rejection_reason || '',
            txSignature: d.tx_signature,
            verifiedAt: d.verified_at,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          });
        }
      }
    } catch {
      // fallback
    }

    for (const w of SERVER_WITHDRAWALS) {
      const normalizedStatus = w.status === 'completed' ? 'paid' : w.status;
      if (statusFilter && statusFilter !== 'all') {
        const target = statusFilter === 'completed' ? 'paid' : statusFilter;
        if (normalizedStatus !== target) continue;
      }
      if (!mergedMap.has(w.id)) {
        mergedMap.set(w.id, { ...w, status: normalizedStatus });
      }
    }

    const list = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.status(200).json({ success: true, withdrawals: list, total: list.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Admin: Update Withdrawal Request Status (Approve, Processing, Reject — Protected & Lifecycle-Validated)
app.post('/api/admin/withdrawals/status', async (req, res) => {
  try {
    const adminCheck = await verifyServerAdmin(req);
    if (!adminCheck.authorized) {
      return res.status(adminCheck.status).json({ success: false, error: adminCheck.error });
    }

    const { requestId, status, adminNotes, rejectionReason } = req.body;

    if (!requestId || !status) {
      return res.status(400).json({ success: false, error: 'requestId and status are required.' });
    }

    const validStatuses = ['approved', 'processing', 'rejected', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status transition. Must be one of: ${validStatuses.join(', ')}. Use /api/admin/withdrawals/settle to mark Paid after on-chain verification.`,
      });
    }

    // Fetch existing withdrawal request to enforce state machine rules
    let existing: any = null;
    try {
      const { data: dbRow } = await serverSupabase
        .from('withdrawal_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();
      if (dbRow) existing = dbRow;
    } catch {
      // fallback
    }

    const mem = SERVER_WITHDRAWALS.find((w) => w.id === requestId);
    if (!existing && mem) {
      existing = mem;
    }

    if (!existing) {
      return res.status(404).json({ success: false, error: `Withdrawal request ${requestId} not found.` });
    }

    const currentStatus = existing.status;

    // Prevent modifying already Paid/Completed requests
    if (currentStatus === 'paid' || currentStatus === 'completed') {
      return res.status(409).json({
        success: false,
        error: 'Cannot modify a withdrawal request that has already been verified and marked Paid.',
      });
    }

    // Prevent re-rejecting or re-activating an already Rejected/Cancelled request (prevents duplicate refund/release)
    if (currentStatus === 'rejected' || currentStatus === 'cancelled') {
      return res.status(409).json({
        success: false,
        error: `Withdrawal request is already finalized as "${currentStatus}" and its reservation has already been released.`,
      });
    }

    const nowIso = new Date().toISOString();

    try {
      await serverSupabase
        .from('withdrawal_requests')
        .update({
          status,
          admin_notes: adminNotes !== undefined ? adminNotes : existing.admin_notes || '',
          rejection_reason:
            status === 'rejected'
              ? rejectionReason || adminNotes || 'Rejected by administrator.'
              : existing.rejection_reason || '',
          reviewed_by: adminCheck.userId || null,
          reviewed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', requestId);
    } catch {
      // fallback
    }

    if (mem) {
      mem.status = status;
      if (adminNotes !== undefined) mem.adminNotes = adminNotes;
      if (status === 'rejected') {
        mem.rejectionReason = rejectionReason || adminNotes || 'Rejected by administrator.';
      }
      mem.updatedAt = nowIso;
    }

    return res.status(200).json({
      success: true,
      message:
        status === 'rejected'
          ? 'Withdrawal request rejected. Reserved balance has been released back to the player\'s available balance.'
          : `Withdrawal request status updated to ${status.toUpperCase()}.`,
      status,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Admin: Settle Withdrawal with Solana On-Chain Verification (Mark Paid)
app.post('/api/admin/withdrawals/settle', async (req, res) => {
  try {
    const adminCheck = await verifyServerAdmin(req);
    if (!adminCheck.authorized) {
      return res.status(adminCheck.status).json({ success: false, error: adminCheck.error });
    }

    const { requestId, txSignature, note } = req.body;

    if (!requestId || !txSignature) {
      return res.status(400).json({ success: false, error: 'requestId and txSignature are required.' });
    }

    const cleanSig = String(txSignature).trim();
    if (cleanSig.length < 64 || cleanSig.length > 96) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Solana transaction signature format (expected 64-96 base58 characters).',
      });
    }

    // Validate base58 signature encoding
    try {
      const sigBytes = safeBs58Decode(cleanSig);
      if (sigBytes.length !== 64) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Solana transaction signature: must decode to 64 bytes.',
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid Solana transaction signature: contains non-base58 characters.',
      });
    }

    // Concurrency lock on both requestId and txSignature
    const lockId = `req:${requestId}`;
    const lockSig = `sig:${cleanSig}`;
    if (ACTIVE_SETTLING_WITHDRAWALS.has(lockId) || ACTIVE_SETTLING_WITHDRAWALS.has(lockSig)) {
      return res.status(409).json({
        success: false,
        error: 'CONCURRENT SETTLEMENT BLOCKED: This withdrawal or signature is currently being verified.',
      });
    }

    ACTIVE_SETTLING_WITHDRAWALS.add(lockId);
    ACTIVE_SETTLING_WITHDRAWALS.add(lockSig);

    try {
      if (RECORDED_SERVER_SIGNATURES.has(cleanSig)) {
        return res.status(409).json({
          success: false,
          error: `DUPLICATE REJECTED: Transaction signature ${cleanSig.slice(0, 14)}... has already been used for another payout.`,
        });
      }

      // Check signature replay in payment_records and withdrawal_requests
      try {
        const [{ data: existingPayment }, { data: existingWithdrawalSig }] = await Promise.all([
          serverSupabase
            .from('payment_records')
            .select('id, tx_signature')
            .eq('tx_signature', cleanSig)
            .maybeSingle(),
          serverSupabase
            .from('withdrawal_requests')
            .select('id, tx_signature')
            .eq('tx_signature', cleanSig)
            .maybeSingle(),
        ]);

        if (existingPayment || existingWithdrawalSig) {
          RECORDED_SERVER_SIGNATURES.add(cleanSig);
          return res.status(409).json({
            success: false,
            error: `DUPLICATE REJECTED: Transaction signature ${cleanSig.slice(0, 14)}... has already been recorded in the payout ledger.`,
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
        return res.status(409).json({
          success: false,
          error: 'Withdrawal request has already been verified and marked Paid.',
        });
      }

      if (withdrawal.status === 'rejected' || withdrawal.status === 'cancelled') {
        return res.status(409).json({
          success: false,
          error: `Cannot mark a ${withdrawal.status} withdrawal request as Paid.`,
        });
      }

      const recipientWallet = withdrawal.wallet_address || withdrawal.walletAddress;
      const expectedCoins = Number(withdrawal.amount_coins || withdrawal.amountCoins || 0);

      // Independent On-Chain Verification against Solana Mainnet RPC:
      // Verifies confirmation, official $PINN mint, destination token-account owner, and exact raw integer amount
      const verification = await verifySolanaTransactionOnChain({
        signature: cleanSig,
        expectedRecipientWallet: recipientWallet,
        expectedAmount: expectedCoins,
      });

      if (!verification.verified) {
        return res.status(400).json({
          success: false,
          error: `PAYMENT REJECTED: ${verification.error}`,
        });
      }

      RECORDED_SERVER_SIGNATURES.add(cleanSig);
      const nowIso = new Date().toISOString();
      const settlementNote =
        note || `Verified on-chain $PINN withdrawal payout (${cleanSig.slice(0, 10)}...)`;

      // 1. Attempt atomic RPC admin_settle_withdrawal (locks row FOR UPDATE, updates withdrawal_requests, inserts payment_records)
      let settledViaRpc = false;
      try {
        const { data: rpcData, error: rpcErr } = await serverSupabase.rpc('admin_settle_withdrawal', {
          p_request_id: requestId,
          p_tx_signature: cleanSig,
          p_token_mint: OFFICIAL_PINN_MINT,
          p_note: settlementNote,
        });

        if (!rpcErr && rpcData && rpcData.success) {
          settledViaRpc = true;
        } else if (rpcData && !rpcData.success && rpcData.error) {
          return res.status(409).json({ success: false, error: rpcData.error });
        }
      } catch {
        // fallback to direct table updates below
      }

      const paymentPayload = {
        reward_request_id: null,
        tournament_id: null,
        user_id: withdrawal.user_id || withdrawal.userId || null,
        player_name: withdrawal.player_name || withdrawal.playerName || 'Player',
        wallet_address: recipientWallet,
        amount: `${expectedCoins.toLocaleString()} $PINN`,
        token_mint: OFFICIAL_PINN_MINT,
        tx_signature: cleanSig,
        status: 'verified_paid',
        is_verified_on_chain: true,
        verified_at: nowIso,
        note: settlementNote,
      };

      if (!settledViaRpc) {
        try {
          await serverSupabase
            .from('withdrawal_requests')
            .update({
              status: 'paid',
              tx_signature: cleanSig,
              verified_at: nowIso,
              admin_notes: settlementNote,
              reviewed_by: adminCheck.userId || null,
              reviewed_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', requestId);
        } catch {
          // fallback
        }

        try {
          await serverSupabase.from('payment_records').insert(paymentPayload);
        } catch {
          // fallback
        }
      }

      const mem = SERVER_WITHDRAWALS.find((w) => w.id === requestId);
      if (mem) {
        mem.status = 'paid';
        mem.txSignature = cleanSig;
        mem.verifiedAt = nowIso;
        mem.adminNotes = settlementNote;
        mem.updatedAt = nowIso;
      }

      return res.status(200).json({
        success: true,
        status: 'paid',
        message: `Withdrawal marked PAID after independent Solana Mainnet verification (${cleanSig.slice(0, 12)}...).`,
        txSignature: cleanSig,
        verification,
        payment: paymentPayload,
      });
    } finally {
      ACTIVE_SETTLING_WITHDRAWALS.delete(lockId);
      ACTIVE_SETTLING_WITHDRAWALS.delete(lockSig);
    }
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
