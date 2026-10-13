/**
 * Solana On-Chain Payment Verification Service for PINN Arcade
 * Official $PINN Token Mint: 6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump
 *
 * Verifies manual token transfers directly against the Solana blockchain JSON-RPC.
 * Enforces:
 * - Transaction exists and has reached 'confirmed' / 'finalized' commitment.
 * - Transaction succeeded without errors (meta.err === null).
 * - Transferred token matches the official PINN token mint.
 * - Destination wallet matches the winner's reward wallet address.
 * - Transferred amount matches the expected tournament prize allocation.
 * - Signature has not been previously used (duplicate / replay rejection).
 */

import { PINN_CONFIG } from '../config/pinnConfig';

export interface SolanaVerificationResult {
  verified: boolean;
  signature: string;
  slot?: number;
  blockTime?: number;
  senderWallet?: string;
  destinationWallet?: string;
  tokenMint?: string;
  amountTransferred?: number;
  amountTransferredFormatted?: string;
  feeLamports?: number;
  statusText?: string;
  error?: string;
  isSimulatedDemo?: boolean;
}

export interface SolanaTxVerificationRequest {
  signature: string;
  expectedRecipientWallet: string;
  expectedAmountPinn: number | string;
  tournamentId?: string;
  rewardId?: string;
}

// Public Solana RPC endpoints with high reliability
const SOLANA_RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
  'https://rpc.ankr.com/solana',
];

// In-memory set of recorded signatures to prevent in-session duplicate reuse
const RECORDED_TX_SIGNATURES = new Set<string>();

export class SolanaVerificationService {
  public readonly OFFICIAL_MINT = PINN_CONFIG.TOKEN_MINT_ADDRESS;

  /**
   * Parse numerical token amount from string like "50,000 $PINN" or "50000"
   */
  public parsePinnAmount(amountStr: string | number): number {
    if (typeof amountStr === 'number') return amountStr;
    const cleaned = amountStr.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Check if a transaction signature has already been recorded
   */
  public isSignatureAlreadyRecorded(signature: string, existingSignatures?: string[]): boolean {
    const cleanSig = signature.trim();
    if (RECORDED_TX_SIGNATURES.has(cleanSig)) {
      return true;
    }
    if (existingSignatures && existingSignatures.includes(cleanSig)) {
      return true;
    }
    return false;
  }

  /**
   * Register a signature in the replay cache
   */
  public registerSignature(signature: string) {
    RECORDED_TX_SIGNATURES.add(signature.trim());
  }

  /**
   * Verify a Solana transaction signature on-chain
   */
  public async verifyPaymentTransaction(
    request: SolanaTxVerificationRequest,
    existingSignatures: string[] = []
  ): Promise<SolanaVerificationResult> {
    const cleanSig = request.signature.trim();
    const expectedAmount = this.parsePinnAmount(request.expectedAmountPinn);
    const expectedWallet = request.expectedRecipientWallet.trim();

    // 1. Basic validation of signature format
    if (!cleanSig || cleanSig.length < 30) {
      return {
        verified: false,
        signature: cleanSig,
        error: 'Invalid Solana transaction signature format. Standard signatures are 80-88 base58 characters.',
      };
    }

    // 2. Duplicate signature check
    if (this.isSignatureAlreadyRecorded(cleanSig, existingSignatures)) {
      return {
        verified: false,
        signature: cleanSig,
        error: `DUPLICATE REJECTED: Transaction signature ${cleanSig.slice(0, 12)}... has already been recorded for a payout.`,
      };
    }

    // 3. Handle known test / demo signatures gracefully if explicitly formatted
    if (cleanSig.startsWith('SIM_') || cleanSig.startsWith('DEMO_') || cleanSig.includes('...')) {
      return {
        verified: false,
        signature: cleanSig,
        error: 'Demonstration or truncated signature cannot be verified on-chain. Please provide a full on-chain signature.',
      };
    }

    // 4. Query Solana JSON-RPC
    let rpcResponse: any = null;
    let rpcError: string | null = null;

    for (const endpoint of SOLANA_RPC_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'pinn-verify-' + Date.now(),
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

    // If transaction was not found on mainnet RPC
    if (!rpcResponse) {
      return {
        verified: false,
        signature: cleanSig,
        error: rpcError
          ? `Solana RPC error: ${rpcError}`
          : 'Transaction not found on Solana blockchain. Ensure the transaction is confirmed on mainnet.',
      };
    }

    // 5. Verify transaction execution status (Must NOT have failed on-chain)
    if (rpcResponse.meta?.err !== null && rpcResponse.meta?.err !== undefined) {
      return {
        verified: false,
        signature: cleanSig,
        error: `TRANSACTION FAILED ON-CHAIN: Transaction resulted in error: ${JSON.stringify(
          rpcResponse.meta.err
        )}. Failed transactions cannot be accepted.`,
      };
    }

    // 6. Inspect Token Balances and Instructions to verify PINN mint, destination, and amount
    const postTokenBalances = rpcResponse.meta?.postTokenBalances || [];
    const preTokenBalances = rpcResponse.meta?.preTokenBalances || [];
    const accountKeys = rpcResponse.transaction?.message?.accountKeys || [];

    let matchedMint = false;
    let recipientMatched = false;
    let amountFound = 0;

    // Check postTokenBalances for our official mint
    for (const post of postTokenBalances) {
      if (post.mint === this.OFFICIAL_MINT) {
        matchedMint = true;

        // Check if owner or token account corresponds to expected wallet
        const owner = post.owner;
        if (owner && owner.toLowerCase() === expectedWallet.toLowerCase()) {
          recipientMatched = true;

          // Compute net balance change for this account
          const pre = preTokenBalances.find(
            (p: any) => p.accountIndex === post.accountIndex && p.mint === post.mint
          );
          const preAmount = pre?.uiTokenAmount?.uiAmount || 0;
          const postAmount = post.uiTokenAmount?.uiAmount || 0;
          const delta = postAmount - preAmount;
          if (delta > 0) {
            amountFound = delta;
          }
        }
      }
    }

    // Also check parsed instructions if SPL Token transfer
    const instructions = rpcResponse.transaction?.message?.instructions || [];
    const innerInstructions = rpcResponse.meta?.innerInstructions || [];
    const allInstructions = [
      ...instructions,
      ...innerInstructions.flatMap((i: any) => i.instructions || []),
    ];

    for (const ix of allInstructions) {
      if (ix.program === 'spl-token' && ix.parsed?.type?.includes('transfer')) {
        const info = ix.parsed.info;
        if (info) {
          // Check mint if transferChecked or info has mint
          if (info.mint === this.OFFICIAL_MINT) {
            matchedMint = true;
          }
          // The recipient must match the actual recipient wallet owner (post.owner or instruction owner)
          if (info.owner && info.owner.toLowerCase() === expectedWallet.toLowerCase()) {
            recipientMatched = true;
          }
          const amt = info.tokenAmount?.uiAmount || parseFloat(info.amount) || 0;
          if (amt > 0 && !amountFound && recipientMatched) {
            amountFound = amt;
          }
        }
      }
    }

    // If transaction involves SOL transfer but not PINN token
    if (!matchedMint) {
      return {
        verified: false,
        signature: cleanSig,
        error: `INVALID TOKEN MINT: Transaction does not transfer official PINN tokens (${this.OFFICIAL_MINT}). Substituting another token is strictly forbidden.`,
      };
    }

    // Destination wallet check (must match winner's wallet owner)
    if (!recipientMatched) {
      return {
        verified: false,
        signature: cleanSig,
        error: `DESTINATION MISMATCH: Transferred recipient does not match reward winner's wallet (${expectedWallet}).`,
      };
    }

    // Amount check: Transferred amount must strictly meet or exceed approved reward amount
    if (expectedAmount > 0 && (amountFound <= 0 || amountFound < expectedAmount)) {
      return {
        verified: false,
        signature: cleanSig,
        amountTransferred: amountFound,
        error: `INSUFFICIENT AMOUNT: Transferred ${amountFound.toLocaleString()} $PINN, which is less than approved reward (${expectedAmount.toLocaleString()} $PINN).`,
      };
    }

    // All on-chain checks passed!
    this.registerSignature(cleanSig);

    return {
      verified: true,
      signature: cleanSig,
      slot: rpcResponse.slot,
      blockTime: rpcResponse.blockTime,
      tokenMint: this.OFFICIAL_MINT,
      destinationWallet: expectedWallet,
      amountTransferred: amountFound,
      amountTransferredFormatted: `${amountFound.toLocaleString()} $PINN`,
      feeLamports: rpcResponse.meta?.fee,
      statusText: 'CONFIRMED ON SOLANA MAINNET',
    };
  }

  /**
   * Deterministic mock verification validator specifically for testing & demonstrations
   * when offline or running in mock harness without spending live SOL on mainnet.
   */
  public verifyMockOrSimulation(
    request: SolanaTxVerificationRequest,
    options?: {
      simulateFailedTx?: boolean;
      simulateWrongMint?: boolean;
      simulateWrongRecipient?: boolean;
      simulateInsufficientAmount?: boolean;
      existingSignatures?: string[];
    }
  ): SolanaVerificationResult {
    const cleanSig = request.signature.trim();
    const expectedAmount = this.parsePinnAmount(request.expectedAmountPinn);
    const expectedWallet = request.expectedRecipientWallet.trim();

    // Duplicate signature check
    if (this.isSignatureAlreadyRecorded(cleanSig, options?.existingSignatures)) {
      return {
        verified: false,
        signature: cleanSig,
        error: `DUPLICATE REJECTED: Transaction signature ${cleanSig.slice(0, 12)}... has already been recorded for a payout.`,
      };
    }

    if (options?.simulateFailedTx) {
      return {
        verified: false,
        signature: cleanSig,
        error: 'TRANSACTION FAILED ON-CHAIN: Transaction resulted in InstructionError (0, Custom: 1). Failed transactions cannot be accepted.',
      };
    }

    if (options?.simulateWrongMint) {
      return {
        verified: false,
        signature: cleanSig,
        error: `INVALID TOKEN MINT: Transaction does not transfer official PINN tokens (${this.OFFICIAL_MINT}). Substituting another token is strictly forbidden.`,
      };
    }

    if (options?.simulateWrongRecipient) {
      return {
        verified: false,
        signature: cleanSig,
        error: `DESTINATION MISMATCH: Transferred recipient does not match reward winner's wallet (${expectedWallet}).`,
      };
    }

    if (options?.simulateInsufficientAmount) {
      return {
        verified: false,
        signature: cleanSig,
        error: `INSUFFICIENT AMOUNT: Transferred 5,000 $PINN, which is less than expected reward (${expectedAmount.toLocaleString()} $PINN).`,
      };
    }

    // Success
    this.registerSignature(cleanSig);

    return {
      verified: true,
      signature: cleanSig,
      slot: 315482901,
      blockTime: Math.floor(Date.now() / 1000),
      tokenMint: this.OFFICIAL_MINT,
      destinationWallet: expectedWallet,
      amountTransferred: expectedAmount,
      amountTransferredFormatted: `${expectedAmount.toLocaleString()} $PINN`,
      statusText: 'VERIFIED SOLANA SETTLEMENT',
      isSimulatedDemo: true,
    };
  }
}

export const solanaVerificationService = new SolanaVerificationService();
