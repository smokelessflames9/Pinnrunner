/**
 * PINN Arcade Player Authentication & Profile Synchronization Service
 * 
 * Enforces:
 * 1. Cryptographic Solana signature verification (nonce-based proof of ownership)
 * 2. Automatic profile synchronization with normalized Solana wallet address
 * 3. Caribbean/PINN Arcade themed username generation with collision retry
 * 4. Stable internal UUID player identity
 * 5. Reconciles existing verified game-coin balance, ledger, and stats
 * 6. Account switching & disconnect isolation
 */

import { PlayerProfile, WalletAuthChallenge, WalletAuthResult } from '../types';
import bs58 from 'bs58';
import { generateThemedUsername } from './usernameGenerator';

function safeBs58Encode(data: Uint8Array): string {
  const encoder = typeof bs58.encode === 'function' ? bs58.encode : (bs58 as any).default?.encode;
  return encoder(data);
}

const STORAGE_KEYS = {
  PROFILE: 'pinn_authenticated_player_profile',
  TOKEN: 'pinn_auth_session_token',
  LAST_WALLET: 'pinn_auth_last_wallet',
};

export type PlayerAuthStatus =
  | 'idle'
  | 'requesting_signature'
  | 'verifying'
  | 'authenticated'
  | 'error';

class PlayerAuthService {
  private currentProfile: PlayerProfile | null = null;
  private sessionToken: string | null = null;
  private authStatus: PlayerAuthStatus = 'idle';
  private authError: string | null = null;
  private listeners: Array<
    (profile: PlayerProfile | null, status: PlayerAuthStatus, error: string | null) => void
  > = [];

  constructor() {
    this.restoreSession();
  }

  private restoreSession() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const storedProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
      const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (storedProfile && storedToken) {
        const parsed = JSON.parse(storedProfile);
        if (parsed.walletAddress && parsed.id) {
          this.currentProfile = parsed;
          this.sessionToken = storedToken;
          this.authStatus = 'authenticated';
        }
      }
    } catch {
      this.clearSession();
    }
  }

  public subscribe(
    listener: (profile: PlayerProfile | null, status: PlayerAuthStatus, error: string | null) => void
  ): () => void {
    this.listeners.push(listener);
    listener(this.currentProfile, this.authStatus, this.authError);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.currentProfile, this.authStatus, this.authError));
    if (typeof localStorage !== 'undefined') {
      if (this.currentProfile && this.sessionToken) {
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(this.currentProfile));
        localStorage.setItem(STORAGE_KEYS.TOKEN, this.sessionToken);
        localStorage.setItem(STORAGE_KEYS.LAST_WALLET, this.currentProfile.walletAddress);
      } else {
        localStorage.removeItem(STORAGE_KEYS.PROFILE);
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
      }
    }
  }

  public getProfile(): PlayerProfile | null {
    return this.currentProfile;
  }

  public getStatus(): PlayerAuthStatus {
    return this.authStatus;
  }

  public getError(): string | null {
    return this.authError;
  }

  public getSessionToken(): string | null {
    return this.sessionToken;
  }

  public isAuthenticated(): boolean {
    return this.authStatus === 'authenticated' && Boolean(this.currentProfile);
  }

  /**
   * Automatic wallet authentication & profile synchronization flow:
   * 1. Detect public key from connected wallet
   * 2. Request unique server-generated nonce & canonical challenge message
   * 3. Prompt wallet adapter to sign challenge
   * 4. Verify signature server-side and atomically retrieve/create player profile
   */
  public async authenticateWallet(
    walletAddress: string,
    walletProvider?: any
  ): Promise<PlayerProfile> {
    const cleanWallet = walletAddress.trim();

    // Check if already authenticated with this exact wallet address
    if (
      this.currentProfile &&
      this.currentProfile.walletAddress.toLowerCase() === cleanWallet.toLowerCase() &&
      this.sessionToken
    ) {
      this.authStatus = 'authenticated';
      this.authError = null;
      this.notify();
      return this.currentProfile;
    }

    // Reset previous account data if switching wallets
    if (
      this.currentProfile &&
      this.currentProfile.walletAddress.toLowerCase() !== cleanWallet.toLowerCase()
    ) {
      this.clearSession(false);
    }

    try {
      this.authStatus = 'requesting_signature';
      this.authError = null;
      this.notify();

      const domain = typeof window !== 'undefined' ? window.location.host : 'pinnarcade.io';

      // 1. Fetch server-generated short-lived nonce and canonical sign-in message
      const challengeRes = await fetch('/api/auth/solana-nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: cleanWallet, domain }),
      });

      if (!challengeRes.ok) {
        const errJson = await challengeRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to acquire authentication challenge from server.');
      }

      const challenge: WalletAuthChallenge = await challengeRes.json();
      let signatureBase58: string = '';

      // Request cryptographic signature from wallet extension (Phantom, Solflare, etc.)
      const provider = walletProvider || (typeof window !== 'undefined' ? (window.solana || (window as any).phantom?.solana) : null);
      if (!provider || typeof provider.signMessage !== 'function') {
        throw new Error('Connected wallet does not support message signing (signMessage).');
      }

      const encodedMsg = new TextEncoder().encode(challenge.message);
      const signed = await provider.signMessage(encodedMsg, 'utf8');

      // Extract signature bytes
      const sigBytes: Uint8Array = signed.signature || signed;
      signatureBase58 = safeBs58Encode(sigBytes);

      this.authStatus = 'verifying';
      this.notify();

      // 2. Submit signature to server for verification and profile synchronization
      const verifyRes = await fetch('/api/auth/solana-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: cleanWallet,
          signature: signatureBase58,
          nonce: challenge.nonce,
          domain: challenge.domain,
          issuedAt: challenge.issuedAt,
        }),
      });

      const verifyData: WalletAuthResult = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success || !verifyData.player) {
        throw new Error(verifyData.error || 'Cryptographic verification failed.');
      }

      this.currentProfile = verifyData.player;
      this.sessionToken = verifyData.token || `token_${Date.now()}`;
      this.authStatus = 'authenticated';
      this.authError = null;
      this.notify();

      return this.currentProfile;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.authStatus = 'error';
      this.authError = msg;
      this.notify();
      throw err;
    }
  }

  /**
   * Refreshes the player profile and verified coin balance from the server
   */
  public async refreshProfile(): Promise<PlayerProfile | null> {
    if (!this.currentProfile) return null;
    try {
      const res = await fetch(
        `/api/player/profile?walletAddress=${encodeURIComponent(this.currentProfile.walletAddress)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.player) {
          this.currentProfile = data.player;
          this.notify();
          return this.currentProfile;
        }
      }
    } catch {
      // ignore
    }
    return this.currentProfile;
  }

  /**
   * Updates the player's display name
   */
  public async updateDisplayName(newName: string): Promise<PlayerProfile> {
    if (!this.currentProfile) {
      throw new Error('No authenticated player profile.');
    }

    const clean = newName.trim().slice(0, 24);
    if (clean.length < 3) {
      throw new Error('Username must be at least 3 characters.');
    }

    const res = await fetch('/api/player/update-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: this.currentProfile.walletAddress,
        displayName: clean,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update username.');
    }

    this.currentProfile = data.player;
    this.notify();
    return data.player;
  }

  /**
   * Authoritatively records game coins won into player account and ledger
   */
  public async recordGameCoins(coins: number, durationMs: number = 0, gameId: string = 'coin-rush'): Promise<void> {
    if (!this.currentProfile || coins <= 0) return;
    try {
      const res = await fetch('/api/player/record-coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: this.currentProfile.walletAddress,
          coinsEarned: coins,
          durationMs,
          gameId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.player) {
          this.currentProfile = data.player;
          this.notify();
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Disconnects and resets player session
   */
  public clearSession(notifyListeners: boolean = true) {
    this.currentProfile = null;
    this.sessionToken = null;
    this.authStatus = 'idle';
    this.authError = null;
    if (notifyListeners) {
      this.notify();
    }
  }
}

export const playerAuthService = new PlayerAuthService();
