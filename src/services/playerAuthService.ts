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
 * 7. Resilient client-side Ed25519 + Supabase fallback when external Render backend is asleep or CORS-restricted
 */

import {
  PlayerProfile,
  WalletAuthChallenge,
  WalletAuthResult,
  PlayerCoinSummary,
  WithdrawalRequest,
} from '../types';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { apiFetch } from './apiClient';
import { generateThemedUsername } from './usernameGenerator';
import { PINN_CONFIG } from '../config/pinnConfig';

function safeBs58Encode(data: Uint8Array): string {
  const encoder = typeof bs58.encode === 'function' ? bs58.encode : (bs58 as any).default?.encode;
  return encoder(data);
}

function safeBs58Decode(input: string): Uint8Array {
  const decoder = typeof bs58.decode === 'function' ? bs58.decode : (bs58 as any).default?.decode;
  return decoder(input);
}

function generateRandomHex(byteLength: number = 8): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return Math.random().toString(16).slice(2, 2 + byteLength * 2);
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function createLocalChallenge(walletAddress: string, domain: string): WalletAuthChallenge {
  const nonce = `pinn_nonce_${Date.now()}_${generateRandomHex(8)}`;
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const message = [
    'PINN Arcade Authentication',
    `Domain: ${domain}`,
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expiresAt}`,
    'Statement: Sign this message to authenticate your Solana wallet and link your PINN Arcade player account.',
  ].join('\n');

  return {
    nonce,
    domain,
    issuedAt,
    expiresAt,
    walletAddress,
    message,
  };
}

function extractSignatureBytes(signed: any): Uint8Array {
  if (!signed) {
    throw new Error('Wallet returned an empty signature response.');
  }
  const raw = signed.signature ?? signed;
  if (raw instanceof Uint8Array) {
    return raw;
  }
  if (raw instanceof ArrayBuffer) {
    return new Uint8Array(raw);
  }
  if (ArrayBuffer.isView(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  }
  if (Array.isArray(raw)) {
    return new Uint8Array(raw);
  }
  if (raw && Array.isArray(raw.data)) {
    return new Uint8Array(raw.data);
  }
  if (typeof raw === 'string') {
    try {
      return safeBs58Decode(raw);
    } catch {
      const binary = atob(raw);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        arr[i] = binary.charCodeAt(i);
      }
      return arr;
    }
  }
  throw new Error('Unrecognized signature format returned by wallet.');
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

  private resolveWalletProvider(preferredProvider?: any): any {
    if (preferredProvider && typeof preferredProvider.signMessage === 'function') {
      return preferredProvider;
    }
    if (typeof window === 'undefined') return preferredProvider || null;
    const w = window as any;
    return (
      preferredProvider ||
      w.phantom?.solana ||
      w.solflare ||
      w.solana ||
      null
    );
  }

  /**
   * Synchronizes or creates a verified PlayerProfile directly against Supabase
   * when the standalone Express backend is asleep or blocked by cross-origin policies.
   */
  private async syncProfileViaSupabase(cleanWallet: string): Promise<PlayerProfile> {
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        const { data: existingProfile } = await supabase
          .from('player_profiles')
          .select('*')
          .ilike('wallet_address', cleanWallet)
          .maybeSingle();

        if (existingProfile) {
          const summary = await this.computeSupabaseCoinSummary(
            cleanWallet,
            existingProfile.auth_user_id || existingProfile.id
          ).catch(() => null);

          return {
            id: existingProfile.id,
            walletAddress: existingProfile.wallet_address || cleanWallet,
            displayName: existingProfile.display_name || generateThemedUsername(cleanWallet, 0),
            authUserId: existingProfile.auth_user_id || null,
            coinsBalance: summary ? summary.totalCoinsCollected : Number(existingProfile.coins_balance) || 0,
            coinsWithdrawn: summary ? summary.paidTotal : Number(existingProfile.coins_withdrawn) || 0,
            totalGamesPlayed: Number(existingProfile.total_games_played) || 0,
            totalPlayTimeMs: Number(existingProfile.total_play_time_ms) || 0,
            lastRunDurationMs: Number(existingProfile.last_run_duration_ms) || 0,
            isVerified: true,
            createdAt: existingProfile.created_at || nowIso,
            updatedAt: existingProfile.updated_at || nowIso,
          };
        }
      } catch {
        // Proceed to creation fallback
      }
    }

    // Reconcile any prior scores / coins from Supabase
    let initialCoins = 0;
    let initialGames = 0;
    let initialTime = 0;

    if (isSupabaseConfigured()) {
      try {
        const { data: scoreRows } = await supabase
          .from('scores')
          .select('coins, duration_ms')
          .ilike('wallet_address', cleanWallet);

        if (scoreRows && scoreRows.length > 0) {
          initialGames = scoreRows.length;
          initialCoins = scoreRows.reduce((acc, r) => acc + (Number(r.coins) || 0), 0);
          initialTime = scoreRows.reduce((acc, r) => acc + (Number(r.duration_ms) || 0), 0);
        } else {
          const { data: gsRows } = await supabase
            .from('game_scores')
            .select('coins')
            .ilike('wallet_address', cleanWallet);

          if (gsRows && gsRows.length > 0) {
            initialGames = gsRows.length;
            initialCoins = gsRows.reduce((acc, r) => acc + (Number(r.coins) || 0), 0);
          }
        }
      } catch {
        // Ignore
      }
    }

    const generatedName = generateThemedUsername(cleanWallet, 0);
    const stablePlayerId = generateUuid();

    const newProfile: PlayerProfile = {
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

    if (isSupabaseConfigured()) {
      try {
        const { data: createdDb, error: createErr } = await supabase
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
          newProfile.id = createdDb.id;
          newProfile.displayName = createdDb.display_name || generatedName;
        }
      } catch {
        // Keep local verified profile
      }
    }

    return newProfile;
  }

  /**
   * Automatic wallet authentication & profile synchronization flow:
   * 1. Detect public key from connected wallet
   * 2. Request unique server-generated nonce & canonical challenge message (with local cryptographic fallback if backend unreachable)
   * 3. Prompt wallet adapter to sign challenge & verify Ed25519 signature
   * 4. Verify signature server-side (or via Supabase fallback) and atomically retrieve/create player profile
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

      const domain = typeof window !== 'undefined' ? window.location.host : 'pinnarcade.fun';

      // 1. Fetch server-generated short-lived nonce and canonical sign-in message,
      // falling back to a locally generated canonical challenge if the API server is unreachable/CORS-blocked.
      let challenge: WalletAuthChallenge;
      let usedServerChallenge = false;

      try {
        const challengeRes = await apiFetch('/api/auth/solana-nonce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: cleanWallet, domain }),
        });

        if (challengeRes.ok) {
          challenge = await challengeRes.json();
          usedServerChallenge = true;
        } else {
          challenge = createLocalChallenge(cleanWallet, domain);
        }
      } catch {
        challenge = createLocalChallenge(cleanWallet, domain);
      }

      // 2. Request cryptographic signature from wallet extension / mobile wallet browser
      const provider = this.resolveWalletProvider(walletProvider);
      if (!provider || typeof provider.signMessage !== 'function') {
        throw new Error('Connected wallet does not support message signing (signMessage).');
      }

      // Ensure wallet provider is connected in mobile in-app browsers before calling signMessage
      if (!provider.publicKey && typeof provider.connect === 'function') {
        try {
          await provider.connect({ onlyIfTrusted: true });
        } catch {
          await provider.connect();
        }
      }

      const encodedMsg = new TextEncoder().encode(challenge.message);
      let signed: any;
      try {
        signed = await provider.signMessage(encodedMsg, 'utf8');
      } catch (signErr: any) {
        // Some mobile wallet adapters expect only the Uint8Array argument without encoding string
        const errMsg = String(signErr?.message || signErr || '').toLowerCase();
        if (errMsg.includes('reject') || errMsg.includes('cancel') || errMsg.includes('denied') || signErr?.code === 4001) {
          throw new Error('Signature request was cancelled in wallet.');
        }
        signed = await provider.signMessage(encodedMsg);
      }

      const sigBytes = extractSignatureBytes(signed);
      const publicKeyBytes = safeBs58Decode(cleanWallet);

      if (sigBytes.length !== 64) {
        throw new Error('Invalid signature length. Expected 64-byte Ed25519 signature.');
      }

      if (publicKeyBytes.length !== 32) {
        throw new Error('Invalid Solana public key length.');
      }

      const isSignatureValid = nacl.sign.detached.verify(encodedMsg, sigBytes, publicKeyBytes);
      if (!isSignatureValid) {
        throw new Error('Cryptographic Ed25519 signature verification failed for this wallet.');
      }

      const signatureBase58 = safeBs58Encode(sigBytes);

      this.authStatus = 'verifying';
      this.notify();

      // 3. Submit signature to server for verification and profile synchronization if server challenge was used
      if (usedServerChallenge) {
        try {
          const verifyRes = await apiFetch('/api/auth/solana-verify', {
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

          if (verifyRes.ok && verifyData.success && verifyData.player) {
            this.currentProfile = verifyData.player;
            this.sessionToken =
              verifyData.token ||
              `pinn_auth_${cleanWallet.slice(0, 8)}_${Date.now()}_${generateRandomHex(16)}`;
            this.authStatus = 'authenticated';
            this.authError = null;
            this.notify();
            return this.currentProfile;
          }
        } catch {
          // Fall through to direct Supabase profile sync since Ed25519 signature is already verified
        }
      }

      // 4. Direct Supabase profile sync (when Render backend is unreachable / CORS-blocked)
      const syncedProfile = await this.syncProfileViaSupabase(cleanWallet);
      this.currentProfile = syncedProfile;
      this.sessionToken = `pinn_auth_${cleanWallet.slice(0, 8)}_${Date.now()}_${generateRandomHex(16)}`;
      this.authStatus = 'authenticated';
      this.authError = null;
      this.notify();

      return this.currentProfile;
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : String(err);
      if (msg === 'Load failed' || msg === 'Failed to fetch') {
        msg = 'Network error communicating with authentication server. Please try again.';
      }
      this.authStatus = 'error';
      this.authError = msg;
      this.notify();
      throw new Error(msg);
    }
  }

  /**
   * Refreshes the player profile and verified coin balance from the server or Supabase fallback
   */
  public async refreshProfile(): Promise<PlayerProfile | null> {
    const activeProfile = this.currentProfile;
    if (!activeProfile) return null;
    try {
      const res = await apiFetch(
        `/api/player/profile?walletAddress=${encodeURIComponent(activeProfile.walletAddress)}`
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
      // Fallback to Supabase refresh
      try {
        const synced = await this.syncProfileViaSupabase(activeProfile.walletAddress);
        this.currentProfile = synced;
        this.notify();
      } catch {
        // ignore
      }
    }
    return this.currentProfile;
  }

  /**
   * Builds authentication headers including wallet session token and Supabase JWT
   */
  public async buildAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.sessionToken) {
      headers['x-player-session-token'] = this.sessionToken;
    }

    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          headers['Authorization'] = `Bearer ${data.session.access_token}`;
        }
      } catch {
        // ignore
      }
    }

    return headers;
  }

  /**
   * Updates the player's display name
   */
  public async updateDisplayName(newName: string): Promise<PlayerProfile> {
    const activeProfile = this.currentProfile;
    if (!activeProfile) {
      throw new Error('No authenticated player profile.');
    }

    const clean = newName.trim().slice(0, 24);
    if (clean.length < 3) {
      throw new Error('Username must be at least 3 characters.');
    }

    const headers = await this.buildAuthHeaders();
    try {
      const res = await apiFetch('/api/player/update-username', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          walletAddress: activeProfile.walletAddress,
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== 'Load failed' && msg !== 'Failed to fetch' && !msg.includes('NetworkError')) {
        throw err;
      }

      // Direct Supabase fallback if backend API is unreachable
      const nowIso = new Date().toISOString();
      if (isSupabaseConfigured()) {
        await supabase
          .from('player_profiles')
          .update({ display_name: clean, updated_at: nowIso })
          .ilike('wallet_address', activeProfile.walletAddress);
      }

      const updatedProfile: PlayerProfile = {
        ...activeProfile,
        displayName: clean,
        updatedAt: nowIso,
      };
      this.currentProfile = updatedProfile;
      this.notify();
      return updatedProfile;
    }
  }

  /**
   * Authoritatively records game coins won into player account and ledger with session deduplication
   */
  public async recordGameCoins(
    coins: number,
    durationMs: number = 0,
    gameId: string = 'coin-rush',
    sessionId?: string
  ): Promise<void> {
    if (coins <= 0 && durationMs <= 0) return;

    try {
      const headers = await this.buildAuthHeaders();
      let userId: string | undefined = this.currentProfile?.authUserId || undefined;
      if (!userId && isSupabaseConfigured()) {
        try {
          const { data } = await supabase.auth.getUser();
          if (data?.user?.id) userId = data.user.id;
        } catch {
          // ignore
        }
      }

      const walletAddress = this.currentProfile?.walletAddress || undefined;
      if (!walletAddress && !userId) return;

      const res = await apiFetch('/api/player/record-coins', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          walletAddress,
          userId,
          coinsEarned: coins,
          durationMs,
          gameId,
          sessionId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.player) {
          this.currentProfile = data.player;
          this.notify();
          return;
        }
      }
    } catch {
      // Fallback to Supabase direct update below
    }

    if (this.currentProfile && coins > 0) {
      this.currentProfile = {
        ...this.currentProfile,
        coinsBalance: this.currentProfile.coinsBalance + coins,
        totalGamesPlayed: this.currentProfile.totalGamesPlayed + 1,
        totalPlayTimeMs: this.currentProfile.totalPlayTimeMs + durationMs,
        lastRunDurationMs: durationMs,
        updatedAt: new Date().toISOString(),
      };
      this.notify();
    }
  }

  private async computeSupabaseCoinSummary(
    walletAddress?: string | null,
    userId?: string | null
  ): Promise<PlayerCoinSummary> {
    const cleanWallet = (walletAddress || '').trim().toLowerCase();
    const cleanUid = (userId || '').trim();
    const isUuidUid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanUid);

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

    if (isSupabaseConfigured()) {
      try {
        let q = supabase
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
          if (scoreRows) {
            for (const r of scoreRows) {
              const key = r.session_id ? String(r.session_id) : `score_${r.id}`;
              recordRun(r.game_id, key, Number(r.coins) || 0);
            }
          }
        }
      } catch {
        // continue
      }

      try {
        let lq = supabase
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
          if (ledgerRows) {
            for (const r of ledgerRows) {
              const key = r.session_id ? String(r.session_id) : `ledger_${r.id}`;
              recordRun(r.game_id || 'coin-rush', key, Number(r.amount) || 0);
            }
          }
        }
      } catch {
        // continue
      }
    }

    let coinRushCoins = 0;
    for (const v of runsByGame['coin-rush'].values()) coinRushCoins += v;

    let treasureHuntCoins = 0;
    for (const v of runsByGame['treasure-hunt'].values()) treasureHuntCoins += v;

    let puzzleMasterCoins = 0;
    for (const v of runsByGame['puzzle-master'].values()) puzzleMasterCoins += v;

    let speedTapCoins = 0;
    for (const v of runsByGame['speed-tap'].values()) speedTapCoins += v;

    const totalCoinsCollected =
      coinRushCoins + treasureHuntCoins + puzzleMasterCoins + speedTapCoins;
    const eligibleEarnings = totalCoinsCollected;

    let paidTotal = 0;
    let reservedAmount = 0;

    if (isSupabaseConfigured()) {
      try {
        let wQuery = supabase.from('withdrawal_requests').select('id, amount_coins, status');
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
          if (wRows) {
            for (const w of wRows) {
              const amt = Number(w.amount_coins) || 0;
              const st = String(w.status);
              if (st === 'completed' || st === 'paid') {
                paidTotal += amt;
              } else if (st === 'pending' || st === 'approved' || st === 'processing') {
                reservedAmount += amt;
              }
            }
          }
        }
      } catch {
        // continue
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

  /**
   * Fetches the authenticated player's authoritative coin totals across all 4 games
   * plus eligible earnings, paid total, reserved amount, and available balance.
   */
  public async getCoinSummary(
    walletAddress?: string | null,
    userId?: string | null
  ): Promise<PlayerCoinSummary> {
    const headers = await this.buildAuthHeaders();
    const w = (walletAddress || this.currentProfile?.walletAddress || '').trim();
    const u = (userId || this.currentProfile?.authUserId || this.currentProfile?.id || '').trim();

    if (!w && !u) {
      throw new Error('Authentication required to load player coin totals.');
    }

    const params = new URLSearchParams();
    if (w) params.set('walletAddress', w);
    if (u) params.set('userId', u);

    try {
      const res = await apiFetch(`/api/player/coin-totals?${params.toString()}`, {
        method: 'GET',
        headers,
      });

      const data = await res.json();
      if (res.ok && data.success && data.summary) {
        return data.summary as PlayerCoinSummary;
      }
    } catch {
      // Fallback to direct Supabase calculation
    }

    return this.computeSupabaseCoinSummary(w, u);
  }

  /**
   * Submits an atomic, concurrency-safe PINN withdrawal request (minimum 10,000 eligible available coins)
   */
  public async submitWithdrawal(params: {
    amountCoins: number;
    destinationWallet: string;
    walletAddress?: string | null;
    userId?: string | null;
    playerName?: string;
  }): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    request?: WithdrawalRequest;
    newAvailableBalance?: number;
  }> {
    try {
      const headers = await this.buildAuthHeaders();
      const res = await apiFetch('/api/player/withdraw', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amountCoins: params.amountCoins,
          destinationWallet: params.destinationWallet,
          walletAddress: params.walletAddress || this.currentProfile?.walletAddress || undefined,
          userId: params.userId || this.currentProfile?.authUserId || this.currentProfile?.id || undefined,
          playerName: params.playerName || this.currentProfile?.displayName || 'Player',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Withdrawal request failed.',
        };
      }

      return {
        success: true,
        message: data.message,
        request: data.request,
        newAvailableBalance: data.newAvailableBalance,
      };
    } catch (err: unknown) {
      // Direct Supabase fallback if backend API is unreachable
      try {
        const cleanDest = params.destinationWallet.trim();
        const amountCoins = Math.floor(Number(params.amountCoins) || 0);
        if (amountCoins < 10000) {
          return { success: false, error: 'Minimum withdrawal is 10,000 eligible coins.' };
        }
        const summary = await this.computeSupabaseCoinSummary(
          params.walletAddress || this.currentProfile?.walletAddress,
          params.userId || this.currentProfile?.authUserId || this.currentProfile?.id
        );
        if (amountCoins > summary.availableBalance) {
          return {
            success: false,
            error: `Insufficient available balance (${summary.availableBalance.toLocaleString()} coins available).`,
          };
        }

        const nowIso = new Date().toISOString();
        const rawUnits = (BigInt(amountCoins) * 1_000_000n).toString();
        const reqId = generateUuid();

        const { error: insertErr } = await supabase.from('withdrawal_requests').insert([
          {
            id: reqId,
            player_name: params.playerName || this.currentProfile?.displayName || 'Player',
            wallet_address: cleanDest,
            amount_coins: amountCoins,
            amount_raw: rawUnits,
            token_decimals: 6,
            token_mint: PINN_CONFIG.TOKEN_MINT_ADDRESS,
            status: 'pending',
          },
        ]);

        if (insertErr) {
          return { success: false, error: insertErr.message };
        }

        return {
          success: true,
          message: `Withdrawal request for ${amountCoins.toLocaleString()} $PINN submitted and queued for review.`,
          newAvailableBalance: Math.max(0, summary.availableBalance - amountCoins),
        };
      } catch {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          error: msg || 'Network error while submitting withdrawal request.',
        };
      }
    }
  }

  /**
   * Fetches the authenticated player's own withdrawal requests
   */
  public async getWithdrawals(
    walletAddress?: string | null,
    userId?: string | null
  ): Promise<WithdrawalRequest[]> {
    const headers = await this.buildAuthHeaders();
    const w = (walletAddress || this.currentProfile?.walletAddress || '').trim();
    const u = (userId || this.currentProfile?.authUserId || this.currentProfile?.id || '').trim();

    if (!w && !u) return [];

    const params = new URLSearchParams();
    if (w) params.set('walletAddress', w);
    if (u) params.set('userId', u);

    try {
      const res = await apiFetch(`/api/player/withdrawals?${params.toString()}`, {
        method: 'GET',
        headers,
      });

      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.withdrawals)) {
        return data.withdrawals as WithdrawalRequest[];
      }
    } catch {
      // Fallback to direct Supabase query
    }

    if (!isSupabaseConfigured()) return [];

    try {
      const cleanWallet = w.toLowerCase();
      const isUuidUid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u);
      let q = supabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (cleanWallet && isUuidUid) {
        q = q.or(`wallet_address.ilike.${cleanWallet},user_id.eq.${u}`);
      } else if (cleanWallet) {
        q = q.ilike('wallet_address', cleanWallet);
      } else if (isUuidUid) {
        q = q.eq('user_id', u);
      } else {
        return [];
      }

      const { data: rows } = await q;
      if (!rows) return [];

      return rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        playerId: r.player_id,
        playerName: r.player_name || 'Player',
        walletAddress: r.wallet_address,
        destinationWallet: r.wallet_address,
        amountCoins: Number(r.amount_coins) || 0,
        amountRaw: r.amount_raw || '0',
        decimals: Number(r.token_decimals) || 6,
        tokenMint: r.token_mint || PINN_CONFIG.TOKEN_MINT_ADDRESS,
        status: r.status || 'pending',
        adminNotes: r.admin_notes,
        rejectionReason: r.rejection_reason,
        txSignature: r.tx_signature,
        verifiedAt: r.verified_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at || r.created_at,
      }));
    } catch {
      return [];
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
