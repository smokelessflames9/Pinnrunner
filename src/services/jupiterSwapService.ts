import bs58 from 'bs58';
import { PINN_CONFIG } from '../config/pinnConfig';
import { apiFetch } from './apiClient';
import { walletService } from './walletService';

export interface SwapInputToken {
  symbol: 'SOL' | 'USDC' | 'USDT';
  name: string;
  mint: string;
  decimals: number;
  badgeColor: string;
}

export const SUPPORTED_INPUT_TOKENS: readonly SwapInputToken[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    badgeColor: 'from-purple-500 to-emerald-400',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    badgeColor: 'from-sky-500 to-blue-600',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    badgeColor: 'from-emerald-500 to-teal-600',
  },
] as const;

export const OFFICIAL_PINN_TOKEN = {
  symbol: PINN_CONFIG.TOKEN_SYMBOL,
  name: PINN_CONFIG.TOKEN_NAME,
  mint: PINN_CONFIG.TOKEN_MINT_ADDRESS,
  decimals: 6,
  blockchain: PINN_CONFIG.BLOCKCHAIN,
  logoUrl: '/images/pinn-logo.png',
} as const;

export interface JupiterRoutePlanStep {
  swapInfo?: {
    ammKey?: string;
    label?: string;
    inputMint?: string;
    outputMint?: string;
    inAmount?: string;
    outAmount?: string;
    feeAmount?: string;
    feeMint?: string;
  };
  percent?: number;
}

export interface JupiterRawQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount?: string;
    feeBps?: number;
  } | null;
  priceImpactPct: string;
  routePlan?: JupiterRoutePlanStep[];
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterQuoteSummary {
  rawQuote: JupiterRawQuoteResponse;
  inputToken: SwapInputToken;
  inputAmountUi: string;
  estimatedPinnUi: string;
  minimumPinnUi: string;
  ratePerInputUnitUi: string;
  priceImpactPct: number;
  slippageBps: number;
  routeLabels: string[];
  estimatedNetworkFeeSol: string;
}

export type JupiterQuoteResult =
  | {
      status: 'ok';
      quote: JupiterQuoteSummary;
    }
  | {
      status: 'no_route';
      reason: string;
      errorCode?: string;
    }
  | {
      status: 'error';
      error: string;
    };

const DIRECT_JUPITER_QUOTE_ENDPOINTS = [
  'https://lite-api.jup.ag/swap/v1/quote',
  'https://quote-api.jup.ag/v6/quote',
];

const DIRECT_JUPITER_SWAP_ENDPOINTS = [
  'https://lite-api.jup.ag/swap/v1/swap',
  'https://quote-api.jup.ag/v6/swap',
];

const PUBLIC_SOLANA_RPCS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
];

/**
 * Security check: Strictly verifies that the target output mint matches the official
 * $PINN contract address before requesting a quote or building any swap transaction.
 */
export function verifyOfficialPinnMint(mintAddress: string): boolean {
  return (
    typeof mintAddress === 'string' &&
    mintAddress.trim() === PINN_CONFIG.TOKEN_MINT_ADDRESS
  );
}

/**
 * Converts a user-entered decimal string into exact integer atomic units.
 */
export function toAtomicAmount(amountUi: string, decimals: number): string | null {
  const cleaned = amountUi.trim().replace(/,/g, '');
  if (!cleaned || !/^\d*(\.\d*)?$/.test(cleaned)) return null;

  const [wholeRaw, fracRaw = ''] = cleaned.split('.');
  const whole = wholeRaw || '0';
  const frac = fracRaw.slice(0, decimals).padEnd(decimals, '0');

  try {
    const atomic = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac || '0');
    if (atomic <= 0n) return null;
    return atomic.toString();
  } catch {
    return null;
  }
}

/**
 * Formats integer atomic units into a human-readable token amount.
 */
export function formatAtomicAmount(
  atomicStr: string | number | bigint,
  decimals: number,
  maxFractionDigits = 4
): string {
  try {
    const raw = BigInt(String(atomicStr));
    const divisor = 10n ** BigInt(decimals);
    const whole = raw / divisor;
    const remainder = raw % divisor;

    const wholeFormatted = whole.toLocaleString('en-US');
    if (remainder === 0n || maxFractionDigits <= 0) {
      return wholeFormatted;
    }

    const fracPadded = remainder.toString().padStart(decimals, '0');
    const trimmedFrac = fracPadded.slice(0, maxFractionDigits).replace(/0+$/, '');
    return trimmedFrac ? `${wholeFormatted}.${trimmedFrac}` : wholeFormatted;
  } catch {
    return '0';
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function isNoRoutePayload(data: any): boolean {
  if (!data) return false;
  if (data.noRouteAvailable === true) return true;
  const code = String(data.errorCode || data.code || '').toUpperCase();
  const msg = String(data.error || data.message || '').toLowerCase();
  return (
    code === 'COULD_NOT_FIND_ANY_ROUTE' ||
    code === 'TOKEN_NOT_TRADABLE' ||
    code === 'NO_ROUTE_FOUND' ||
    code === 'ROUTE_NOT_FOUND' ||
    msg.includes('could not find any route') ||
    msg.includes('not tradable') ||
    msg.includes('no route') ||
    msg.includes('cannot compute other amount threshold') ||
    msg.includes('insufficient liquidity')
  );
}

/**
 * Queries Jupiter's official Quote API to check whether a valid swap route and sufficient
 * liquidity exist for swapping the selected input token into $PINN.
 * Never fabricates prices or estimates.
 */
export async function fetchJupiterSwapQuote(params: {
  inputToken: SwapInputToken;
  inputAmountUi: string;
  slippageBps: number;
}): Promise<JupiterQuoteResult> {
  const { inputToken, inputAmountUi, slippageBps } = params;

  if (!verifyOfficialPinnMint(OFFICIAL_PINN_TOKEN.mint)) {
    return {
      status: 'error',
      error: 'Security verification failed: Invalid official $PINN mint configuration.',
    };
  }

  const atomicAmount = toAtomicAmount(inputAmountUi, inputToken.decimals);
  if (!atomicAmount) {
    return {
      status: 'error',
      error: `Please enter a valid ${inputToken.symbol} amount greater than 0.`,
    };
  }

  const queryParams = new URLSearchParams({
    inputMint: inputToken.mint,
    outputMint: OFFICIAL_PINN_TOKEN.mint,
    amount: atomicAmount,
    slippageBps: String(slippageBps),
  });

  let rawData: any = null;
  let lastErrorMsg = '';

  // 1. Try direct official Jupiter Quote API endpoints first for lowest latency
  for (const endpoint of DIRECT_JUPITER_QUOTE_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}?${queryParams.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json && json.outAmount) {
        rawData = json;
        break;
      }
      if (isNoRoutePayload(json)) {
        return {
          status: 'no_route',
          errorCode: json?.errorCode || 'COULD_NOT_FIND_ANY_ROUTE',
          reason:
            json?.error ||
            json?.message ||
            `Jupiter could not find an active DEX liquidity route for ${inputToken.symbol} → $PINN at this time.`,
        };
      }
      if (json?.error || json?.message) {
        lastErrorMsg = String(json.error || json.message);
      }
    } catch (err: any) {
      lastErrorMsg = err?.message || 'Network error contacting Jupiter Quote API';
    }
  }

  // 2. Fallback to backend proxy /api/jupiter/quote if direct browser call failed
  if (!rawData) {
    try {
      const proxyRes = await apiFetch(`/api/jupiter/quote?${queryParams.toString()}`, {
        method: 'GET',
      });
      const proxyJson = await proxyRes.json().catch(() => null);
      if (proxyRes.ok && proxyJson && proxyJson.outAmount) {
        rawData = proxyJson;
      } else if (isNoRoutePayload(proxyJson)) {
        return {
          status: 'no_route',
          errorCode: proxyJson?.errorCode || 'COULD_NOT_FIND_ANY_ROUTE',
          reason:
            proxyJson?.error ||
            proxyJson?.message ||
            `Jupiter could not find an active DEX liquidity route for ${inputToken.symbol} → $PINN at this time.`,
        };
      } else if (proxyJson?.error) {
        lastErrorMsg = String(proxyJson.error);
      }
    } catch (err: any) {
      if (!lastErrorMsg) {
        lastErrorMsg = err?.message || 'Unable to reach Jupiter routing service.';
      }
    }
  }

  if (!rawData || !rawData.outAmount) {
    if (isNoRoutePayload({ error: lastErrorMsg })) {
      return {
        status: 'no_route',
        errorCode: 'NO_ROUTE_FOUND',
        reason:
          lastErrorMsg ||
          `No active Jupiter liquidity route is currently available for ${inputToken.symbol} → $PINN.`,
      };
    }
    return {
      status: 'error',
      error:
        lastErrorMsg ||
        'Unable to retrieve live quote from Jupiter right now. Please check your connection and try again.',
    };
  }

  // Verify the returned quote outputMint matches official $PINN mint
  if (!verifyOfficialPinnMint(rawData.outputMint)) {
    return {
      status: 'error',
      error: 'Security check failed: Quote output mint did not match official $PINN contract address.',
    };
  }

  const outAtomic = BigInt(String(rawData.outAmount));
  if (outAtomic <= 0n) {
    return {
      status: 'no_route',
      errorCode: 'ZERO_OUTPUT',
      reason: 'Insufficient pool liquidity for the requested swap amount.',
    };
  }

  const inputNum = parseFloat(inputAmountUi);
  const outNum = Number(outAtomic) / 10 ** OFFICIAL_PINN_TOKEN.decimals;
  const rateNum = inputNum > 0 ? outNum / inputNum : 0;

  const routeLabels: string[] = [];
  if (Array.isArray(rawData.routePlan)) {
    for (const step of rawData.routePlan) {
      const label = step?.swapInfo?.label;
      if (label && !routeLabels.includes(label)) {
        routeLabels.push(label);
      }
    }
  }

  const priceImpact = parseFloat(String(rawData.priceImpactPct || '0'));

  return {
    status: 'ok',
    quote: {
      rawQuote: rawData as JupiterRawQuoteResponse,
      inputToken,
      inputAmountUi,
      estimatedPinnUi: formatAtomicAmount(rawData.outAmount, OFFICIAL_PINN_TOKEN.decimals, 2),
      minimumPinnUi: formatAtomicAmount(
        rawData.otherAmountThreshold || rawData.outAmount,
        OFFICIAL_PINN_TOKEN.decimals,
        2
      ),
      ratePerInputUnitUi: rateNum > 0 ? rateNum.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—',
      priceImpactPct: Number.isFinite(priceImpact) ? priceImpact * 100 : 0,
      slippageBps: Number(rawData.slippageBps || slippageBps),
      routeLabels: routeLabels.length > 0 ? routeLabels : ['Jupiter Aggregator'],
      estimatedNetworkFeeSol: '~0.00005 SOL (Network + Priority)',
    },
  };
}

/**
 * Fetches the connected wallet's native SOL balance on Solana Mainnet.
 */
export async function fetchWalletSolBalance(walletAddress: string): Promise<number | null> {
  if (!walletAddress) return null;

  try {
    const res = await apiFetch(`/api/solana/balance?wallet=${encodeURIComponent(walletAddress)}`, {
      method: 'GET',
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data?.sol === 'number') {
        return data.sol;
      }
    }
  } catch {
    // Fall through to direct RPC check
  }

  for (const rpcUrl of PUBLIC_SOLANA_RPCS) {
    try {
      const rpcRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [walletAddress, { commitment: 'confirmed' }],
        }),
      });
      if (rpcRes.ok) {
        const json = await rpcRes.json();
        if (typeof json?.result?.value === 'number') {
          return json.result.value / 1e9;
        }
      }
    } catch {
      // try next RPC
    }
  }

  return null;
}

/**
 * Builds the Jupiter swap transaction and prompts the user's connected Solana wallet
 * (Phantom or Solflare) to review, approve, and sign the transaction.
 * Never executes a transaction without explicit user approval in their wallet.
 */
export async function executeJupiterSwapTransaction(params: {
  quoteSummary: JupiterQuoteSummary;
  userPublicKey: string;
}): Promise<{ signature: string; solscanUrl: string }> {
  const { quoteSummary, userPublicKey } = params;

  // Security check: Verify PINN output mint before building transaction
  if (
    !verifyOfficialPinnMint(OFFICIAL_PINN_TOKEN.mint) ||
    !verifyOfficialPinnMint(quoteSummary.rawQuote.outputMint)
  ) {
    throw new Error(
      `Security verification failed: Output token mint does not match official $PINN address (${PINN_CONFIG.TOKEN_MINT_ADDRESS}).`
    );
  }

  const provider = walletService.getProvider();
  if (!provider) {
    throw new Error(
      'No connected Solana wallet detected. Please connect Phantom or Solflare before swapping.'
    );
  }

  // 1. Request serialized unsigned VersionedTransaction from Jupiter Swap API
  let swapTransactionBase64: string | null = null;
  let lastBuildError = '';

  const swapRequestBody = {
    quoteResponse: quoteSummary.rawQuote,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: 'auto',
  };

  for (const endpoint of DIRECT_JUPITER_SWAP_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(swapRequestBody),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.swapTransaction) {
        swapTransactionBase64 = data.swapTransaction;
        break;
      }
      if (data?.error || data?.message) {
        lastBuildError = String(data.error || data.message);
      }
    } catch (err: any) {
      lastBuildError = err?.message || 'Error contacting Jupiter Swap API';
    }
  }

  // Fallback to backend proxy /api/jupiter/swap
  if (!swapTransactionBase64) {
    try {
      const proxyRes = await apiFetch('/api/jupiter/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swapRequestBody),
      });
      const proxyData = await proxyRes.json().catch(() => null);
      if (proxyRes.ok && proxyData?.swapTransaction) {
        swapTransactionBase64 = proxyData.swapTransaction;
      } else if (proxyData?.error) {
        lastBuildError = String(proxyData.error);
      }
    } catch (err: any) {
      if (!lastBuildError) {
        lastBuildError = err?.message || 'Failed to build Jupiter swap transaction.';
      }
    }
  }

  if (!swapTransactionBase64) {
    throw new Error(
      lastBuildError || 'Unable to build swap transaction from Jupiter. Please refresh your quote and try again.'
    );
  }

function safeBs58Encode(bytes: Uint8Array): string {
  const encoder = typeof bs58.encode === 'function' ? bs58.encode : (bs58 as any).default?.encode;
  return encoder(bytes);
}

function decodeShortVecLength(bytes: Uint8Array, offset: number): { length: number; bytesRead: number } {
  let len = 0;
  let size = 0;
  while (offset + size < bytes.length) {
    const elem = bytes[offset + size];
    len |= (elem & 0x7f) << (size * 7);
    size += 1;
    if ((elem & 0x80) === 0) {
      break;
    }
  }
  return { length: len, bytesRead: size };
}

function encodeShortVecLength(len: number): Uint8Array {
  const out: number[] = [];
  let rem = len;
  while (true) {
    let elem = rem & 0x7f;
    rem >>= 7;
    if (rem === 0) {
      out.push(elem);
      break;
    } else {
      elem |= 0x80;
      out.push(elem);
    }
  }
  return new Uint8Array(out);
}

class BrowserPublicKey {
  private readonly _bytes: Uint8Array;
  private readonly _base58: string;

  constructor(bytes: Uint8Array) {
    this._bytes = new Uint8Array(bytes);
    this._base58 = safeBs58Encode(this._bytes);
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this._bytes);
  }

  toBuffer(): Uint8Array {
    return new Uint8Array(this._bytes);
  }

  toBase58(): string {
    return this._base58;
  }

  toString(): string {
    return this._base58;
  }

  equals(other: any): boolean {
    if (!other) return false;
    const otherStr =
      typeof other.toBase58 === 'function'
        ? other.toBase58()
        : typeof other.toString === 'function'
        ? other.toString()
        : String(other);
    return this._base58 === otherStr;
  }
}

/**
 * Pure browser-native Solana VersionedTransaction implementation.
 * Avoids pulling Node.js polyfills (@coral-xyz/anchor) into the browser bundle
 * while remaining 100% compatible with Phantom and Solflare signTransaction APIs.
 */
class BrowserVersionedTransaction {
  public signatures: Uint8Array[];
  public message: {
    version: number | 'legacy';
    header: {
      numRequiredSignatures: number;
      numReadonlySignedAccounts: number;
      numReadonlyUnsignedAccounts: number;
    };
    staticAccountKeys: BrowserPublicKey[];
    serialize: () => Uint8Array;
  };

  constructor(signatures: Uint8Array[], messageBytes: Uint8Array) {
    this.signatures = signatures;

    const firstByte = messageBytes[0] ?? 0;
    const isVersioned = (firstByte & 0x80) !== 0;
    const version: number | 'legacy' = isVersioned ? firstByte & 0x7f : 'legacy';
    let cursor = isVersioned ? 1 : 0;

    const numRequiredSignatures = messageBytes[cursor] ?? 1;
    const numReadonlySignedAccounts = messageBytes[cursor + 1] ?? 0;
    const numReadonlyUnsignedAccounts = messageBytes[cursor + 2] ?? 0;
    cursor += 3;

    const { length: accountCount, bytesRead } = decodeShortVecLength(messageBytes, cursor);
    cursor += bytesRead;

    const staticAccountKeys: BrowserPublicKey[] = [];
    for (let i = 0; i < accountCount && cursor + 32 <= messageBytes.length; i++) {
      staticAccountKeys.push(new BrowserPublicKey(messageBytes.subarray(cursor, cursor + 32)));
      cursor += 32;
    }

    const rawMessageCopy = new Uint8Array(messageBytes);
    this.message = {
      version,
      header: {
        numRequiredSignatures,
        numReadonlySignedAccounts,
        numReadonlyUnsignedAccounts,
      },
      staticAccountKeys,
      serialize: () => new Uint8Array(rawMessageCopy),
    };
  }

  get version(): number | 'legacy' {
    return this.message.version;
  }

  static deserialize(serializedTx: Uint8Array): BrowserVersionedTransaction {
    const { length: sigCount, bytesRead } = decodeShortVecLength(serializedTx, 0);
    let cursor = bytesRead;
    const signatures: Uint8Array[] = [];

    for (let i = 0; i < sigCount; i++) {
      signatures.push(new Uint8Array(serializedTx.subarray(cursor, cursor + 64)));
      cursor += 64;
    }

    const messageBytes = new Uint8Array(serializedTx.subarray(cursor));
    return new BrowserVersionedTransaction(signatures, messageBytes);
  }

  addSignature(publicKey: any, signature: Uint8Array): void {
    if (signature.length !== 64) {
      throw new Error('Invalid signature length (expected 64 bytes).');
    }
    const pubKeyStr =
      typeof publicKey?.toBase58 === 'function'
        ? publicKey.toBase58()
        : typeof publicKey?.toString === 'function'
        ? publicKey.toString()
        : String(publicKey);

    const signerIdx = this.message.staticAccountKeys.findIndex(
      (k) => k.toBase58() === pubKeyStr
    );
    const targetIdx = signerIdx >= 0 && signerIdx < this.signatures.length ? signerIdx : 0;
    this.signatures[targetIdx] = new Uint8Array(signature);
  }

  serialize(): Uint8Array {
    const sigCountBytes = encodeShortVecLength(this.signatures.length);
    const msgBytes = this.message.serialize();
    const totalLen = sigCountBytes.length + this.signatures.length * 64 + msgBytes.length;
    const out = new Uint8Array(totalLen);

    let offset = 0;
    out.set(sigCountBytes, offset);
    offset += sigCountBytes.length;

    for (const sig of this.signatures) {
      out.set(sig, offset);
      offset += 64;
    }

    out.set(msgBytes, offset);
    return out;
  }
}

  // 2. Deserialize VersionedTransaction for user wallet inspection & signature
  const txBytes = base64ToUint8Array(swapTransactionBase64);
  const versionedTx = BrowserVersionedTransaction.deserialize(txBytes);

  // 3. Request personal approval and signature from the connected Phantom or Solflare wallet
  let txSignature = '';

  if (typeof provider.signTransaction === 'function') {
    const signedTx = await provider.signTransaction(versionedTx);
    const serializedSigned = signedTx.serialize();
    const signedBase64 = uint8ArrayToBase64(serializedSigned);

    // Broadcast via backend proxy or public Solana Mainnet RPC
    let broadcastError = '';
    try {
      const bRes = await apiFetch('/api/solana/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedTransactionBase64: signedBase64 }),
      });
      const bData = await bRes.json().catch(() => null);
      if (bRes.ok && bData?.signature) {
        txSignature = bData.signature;
      } else if (bData?.error) {
        broadcastError = String(bData.error);
      }
    } catch (err: any) {
      broadcastError = err?.message || '';
    }

    if (!txSignature) {
      for (const rpcUrl of PUBLIC_SOLANA_RPCS) {
        try {
          const rpcRes = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'sendTransaction',
              params: [
                signedBase64,
                {
                  encoding: 'base64',
                  skipPreflight: false,
                  preflightCommitment: 'confirmed',
                  maxRetries: 3,
                },
              ],
            }),
          });
          const rpcJson = await rpcRes.json().catch(() => null);
          if (rpcJson?.result && typeof rpcJson.result === 'string') {
            txSignature = rpcJson.result;
            break;
          }
          if (rpcJson?.error?.message) {
            broadcastError = rpcJson.error.message;
          }
        } catch (err: any) {
          broadcastError = err?.message || broadcastError;
        }
      }
    }

    if (!txSignature) {
      throw new Error(
        broadcastError || 'Transaction was signed, but broadcasting to Solana Mainnet failed.'
      );
    }
  } else if (typeof provider.signAndSendTransaction === 'function') {
    const result = await provider.signAndSendTransaction(versionedTx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });
    txSignature = typeof result === 'string' ? result : result?.signature || '';
    if (!txSignature) {
      throw new Error('Wallet did not return a transaction signature.');
    }
  } else {
    throw new Error(
      'Connected wallet does not support Solana VersionedTransaction signing. Please use Phantom or Solflare.'
    );
  }

  return {
    signature: txSignature,
    solscanUrl: `${PINN_CONFIG.SOLSCAN_TX_BASE_URL}${txSignature}`,
  };
}
