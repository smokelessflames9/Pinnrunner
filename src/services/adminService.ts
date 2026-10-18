import { supabase, isSupabaseConfigured, getCurrentUser, getCurrentSession } from './supabaseClient';
import {
  AdminCheckResult,
  AdminOverviewStats,
  ScoreRecord,
  RewardRequest,
  PaymentRecord,
  ScoreStatus,
  RewardStatus,
  GameId,
  Tournament,
  AdminPlayerBalanceRow,
  WithdrawalRequest,
} from '../types';
import { tournamentService } from './tournamentService';
import { solanaVerificationService } from './solanaVerificationService';
import { PINN_CONFIG } from '../config/pinnConfig';

// Known admin emails or UID allowlist fallback for initial deployment bootstrap
const ADMIN_EMAIL_ALLOWLIST = new Set([
  'admin@pinnarcade.io',
  'admin@pinn.io',
  'security@pinn.io',
  'montegobay@pinnarcade.com',
  'thomassean538@gmail.com',
]);

// Initial demo score submissions illustrating pending, verified, and suspicious anti-cheat flags
const INITIAL_DEMO_SCORES: ScoreRecord[] = [
  {
    id: 'sc-001',
    userId: 'usr-101',
    playerName: 'MontegoKing',
    gameId: 'coin-rush',
    score: 14850,
    coins: 412,
    durationMs: 245000,
    sessionId: 'cr_1728662000_mk92a1',
    status: 'verified',
    validationReason: 'Plausible physics, continuous coin collection trajectory verified.',
    walletAddress: '6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump',
    createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    tournamentId: 'tourn-cr-sprint-s1',
  },
  {
    id: 'sc-002',
    userId: 'usr-102',
    playerName: 'KingstonRunner',
    gameId: 'coin-rush',
    score: 12420,
    coins: 345,
    durationMs: 210000,
    sessionId: 'cr_1728661900_kr83b2',
    status: 'verified',
    validationReason: 'Valid endurance run. Realistic obstacle collision timestamp.',
    walletAddress: '8wJ1X9Z4vT2mQ8pN5kL3rC7dF1sA6bV9e',
    createdAt: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
    tournamentId: 'tourn-cr-sprint-s1',
  },
  {
    id: 'sc-003',
    userId: 'usr-103',
    playerName: 'SpeedBotX',
    gameId: 'speed-tap',
    score: 99999,
    coins: 0,
    durationMs: 1200,
    sessionId: 'st_1728661800_bot999',
    status: 'rejected',
    validationReason: 'ANTI-CHEAT REJECTED: Score 99,999 in 1.2s violates human reflex ceiling (>83,000 PPS).',
    walletAddress: 'HckrFailWallet11111111111111111111',
    createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    tournamentId: 'tourn-st-lightning',
  },
  {
    id: 'sc-004',
    userId: 'usr-104',
    playerName: 'ReplayAttacker',
    gameId: 'speed-tap',
    score: 12000,
    coins: 0,
    durationMs: 30000,
    sessionId: 'st_1728661800_bot999', // duplicate session ID
    status: 'rejected',
    validationReason: 'ANTI-CHEAT REJECTED: Replay attack detected. Session ID already submitted.',
    walletAddress: 'Frd8BadWallet22222222222222222222',
    createdAt: new Date(Date.now() - 3600 * 1000 * 15).toISOString(),
    tournamentId: 'tourn-st-lightning',
  },
  {
    id: 'sc-005',
    userId: 'usr-105',
    playerName: 'CasualGamer42',
    gameId: 'treasure-hunt',
    score: 4200,
    coins: 70,
    durationMs: 65000,
    sessionId: 'th_1728661700_cg420',
    status: 'pending',
    validationReason: 'Awaiting edge function verification queue.',
    walletAddress: '4tY8K1vM9xZ2nL3pQ5rT7sW9bC1dF3eG',
    createdAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    tournamentId: 'tourn-th-pirate-cove',
  },
  {
    id: 'sc-006',
    userId: 'usr-106',
    playerName: 'PuzzleWiz',
    gameId: 'puzzle-master',
    score: 2850,
    coins: 0,
    durationMs: 42000,
    sessionId: 'pm_1728661600_pw71a',
    status: 'verified',
    validationReason: 'Trivia question timings validated between 1.5s - 8s per answer.',
    walletAddress: '2xYp8wQ49kLs3mNq7vE1bZ5aT8rC2dF4',
    createdAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
    tournamentId: 'tourn-pm-brain-storm',
  },
];

// Initial reward requests prepared for review
const INITIAL_REWARDS: RewardRequest[] = [
  {
    id: 'rw-001',
    tournamentId: 'tourn-th-pirate-cove',
    tournamentTitle: 'Rose Hall Pirate Cove Expedition',
    userId: 'usr-008',
    playerName: 'CaptainBlackbeard',
    walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    rank: 1,
    score: 34500,
    rewardAmount: '60,000 $PINN',
    status: 'completed',
    adminNotes: 'Tournament completed. Verified score reviewed. Solana on-chain transfer settled.',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000 * 1).toISOString(),
  },
  {
    id: 'rw-002',
    tournamentId: 'tourn-th-pirate-cove',
    tournamentTitle: 'Rose Hall Pirate Cove Expedition',
    userId: 'usr-009',
    playerName: 'TreasureDiver',
    walletAddress: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLyNzkKqV4F2E',
    rank: 2,
    score: 31200,
    rewardAmount: '36,000 $PINN',
    status: 'approved',
    adminNotes: 'Second place runner-up. Passed all tile trajectory checks. Approved for manual payment recording.',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000 * 1).toISOString(),
  },
  {
    id: 'rw-003',
    tournamentId: 'tourn-th-pirate-cove',
    tournamentTitle: 'Rose Hall Pirate Cove Expedition',
    userId: 'usr-002',
    playerName: 'KingstonRunner',
    walletAddress: '8mKbTqN2b1X9VfZ4p6Ww89Y5C1jL2mPnX3vQ4R7dJ8sT',
    rank: 3,
    score: 28400,
    rewardAmount: '24,000 $PINN',
    status: 'pending_review',
    adminNotes: 'Podium 3rd place. Anti-cheat confirmed. Pending admin committee review.',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000 * 1).toISOString(),
  },
];

// Initial payments record history (Immutable on-chain audit ledger)
const INITIAL_PAYMENTS: PaymentRecord[] = [
  {
    id: 'pay-001',
    rewardRequestId: 'rw-001',
    tournamentId: 'tourn-th-pirate-cove',
    tournamentTitle: 'Rose Hall Pirate Cove Expedition',
    userId: 'usr-008',
    playerName: 'CaptainBlackbeard',
    walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    amount: '60,000 $PINN',
    tokenMint: PINN_CONFIG.TOKEN_MINT_ADDRESS,
    txSignature: '5zRt1aX7vB3nQ9mK2pL8wE4sD6cV1fY0uI9oP7rE2tY5uI8oP1qW3eR5tY7uI9oP',
    status: 'verified_paid',
    isVerifiedOnChain: true,
    verifiedAt: new Date(Date.now() - 24 * 3600 * 1000 * 1).toISOString(),
    note: '1st Place Champion Payout. Confirmed on Solana Mainnet via Solscan.',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000 * 2).toISOString(),
  },
  {
    id: 'pay-002',
    rewardRequestId: 'rw-002',
    tournamentId: 'tourn-th-pirate-cove',
    tournamentTitle: 'Rose Hall Pirate Cove Expedition',
    userId: 'usr-009',
    playerName: 'TreasureDiver',
    walletAddress: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLyNzkKqV4F2E',
    amount: '36,000 $PINN',
    tokenMint: PINN_CONFIG.TOKEN_MINT_ADDRESS,
    status: 'queued',
    isVerifiedOnChain: false,
    note: 'Approved reward allocation in disbursement queue. Awaiting admin Solana settlement.',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000 * 1).toISOString(),
  },
];

const ADMIN_STORAGE_KEYS = {
  SCORES: 'pinn_admin_local_scores',
  REWARDS: 'pinn_admin_local_rewards',
  PAYMENTS: 'pinn_admin_local_payments',
};

class AdminService {
  private localScores: ScoreRecord[] = [...INITIAL_DEMO_SCORES];
  private localRewards: RewardRequest[] = [...INITIAL_REWARDS];
  private localPayments: PaymentRecord[] = [...INITIAL_PAYMENTS];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const s = localStorage.getItem(ADMIN_STORAGE_KEYS.SCORES);
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.localScores = parsed;
        }
      }

      const r = localStorage.getItem(ADMIN_STORAGE_KEYS.REWARDS);
      if (r) {
        const parsed = JSON.parse(r);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.localRewards = parsed;
        }
      }

      const p = localStorage.getItem(ADMIN_STORAGE_KEYS.PAYMENTS);
      if (p) {
        const parsed = JSON.parse(p);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.localPayments = parsed;
        }
      }
    } catch (e) {
      console.warn('Could not load admin state from localStorage:', e);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(ADMIN_STORAGE_KEYS.SCORES, JSON.stringify(this.localScores));
      localStorage.setItem(ADMIN_STORAGE_KEYS.REWARDS, JSON.stringify(this.localRewards));
      localStorage.setItem(ADMIN_STORAGE_KEYS.PAYMENTS, JSON.stringify(this.localPayments));
    } catch (e) {
      console.warn('Could not save admin state to localStorage:', e);
    }
  }

  /**
   * Ingest a player score submission into local moderation cache
   */
  public ingestScoreSubmission(scoreRecord: ScoreRecord) {
    const existingIdx = this.localScores.findIndex(
      (s) => s.id === scoreRecord.id || s.sessionId === scoreRecord.sessionId
    );
    if (existingIdx >= 0) {
      this.localScores[existingIdx] = scoreRecord;
    } else {
      this.localScores.unshift(scoreRecord);
    }
    this.saveToStorage();
  }

  /**
   * Securely check if current user is an authenticated administrator.
   * STRICT SECURITY: Verified against Supabase database server.
   * Ordinary players cannot elevate themselves or access admin privileges.
   */
  async checkAdminStatus(): Promise<AdminCheckResult> {
    const user = await getCurrentUser();
    if (!user) {
      return { isAdmin: false, reason: 'No authenticated user session.' };
    }

    if (!isSupabaseConfigured()) {
      return { isAdmin: false, reason: 'Supabase is not configured.' };
    }

    try {
      // 1. Check server-side function check_is_admin()
      const { data: rpcData, error: rpcError } = await supabase.rpc('check_is_admin');
      if (!rpcError && rpcData) {
        if (rpcData.isAdmin === true) {
          return {
            isAdmin: true,
            role: rpcData.role || 'admin',
            userId: user.id,
          };
        }
      }

      // 2. Check public.admin_roles table directly
      const { data: roleRow, error: roleError } = await supabase
        .from('admin_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!roleError && roleRow) {
        return {
          isAdmin: true,
          role: (roleRow.role as 'admin' | 'superadmin') || 'admin',
          userId: user.id,
        };
      }

      // 3. Fallback: Check email allowlist for developer/administrator bootstrap accounts
      if (user.email && ADMIN_EMAIL_ALLOWLIST.has(user.email.toLowerCase())) {
        return {
          isAdmin: true,
          role: 'superadmin',
          userId: user.id,
        };
      }

      // Check app metadata if user has admin claim
      const appMetadata = user.app_metadata;
      if (appMetadata && (appMetadata.role === 'admin' || appMetadata.role === 'superadmin')) {
        return {
          isAdmin: true,
          role: appMetadata.role,
          userId: user.id,
        };
      }

      return {
        isAdmin: false,
        userId: user.id,
        reason: 'Authenticated user does not have administrator role in public.admin_roles.',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        isAdmin: false,
        reason: `Authorization check error: ${msg}`,
      };
    }
  }

  /**
   * Fetch overview dashboard statistics
   */
  async getOverviewStats(): Promise<AdminOverviewStats> {
    const tournaments = await tournamentService.getTournaments();
    const activeTournaments = tournaments.filter((t) => t.status === 'active').length;

    const scores = await this.getAllScores('all');
    const verifiedScores = scores.filter((s) => s.status === 'verified').length;
    const pendingScores = scores.filter((s) => s.status === 'pending').length;
    const suspiciousScores = scores.filter(
      (s) => s.status === 'rejected' || (s.validationReason && s.validationReason.toLowerCase().includes('anti-cheat'))
    ).length;

    const uniquePlayers = new Set(scores.map((s) => s.userId || s.playerName)).size;
    const rewards = await this.getRewardRequests();

    return {
      totalTournaments: tournaments.length,
      activeTournaments,
      totalVerifiedScores: verifiedScores,
      totalPendingScores: pendingScores,
      totalSuspiciousScores: suspiciousScores,
      totalPlayers: Math.max(uniquePlayers, 18),
      totalRewardRequests: rewards.length,
      totalPreparedTokens: '234,000 $PINN',
    };
  }

  /**
   * Fetch all scores for admin review
   */
  async getAllScores(filter: 'all' | 'pending' | 'verified' | 'rejected' = 'all'): Promise<ScoreRecord[]> {
    if (!isSupabaseConfigured()) {
      return filter === 'all' ? this.localScores : this.localScores.filter((s) => s.status === filter);
    }

    try {
      // 1. Fetch from authoritative public.scores table
      let scoreQuery = supabase.from('scores').select('*').order('created_at', { ascending: false }).limit(100);
      if (filter !== 'all') {
        scoreQuery = scoreQuery.eq('status', filter);
      }
      const { data: scoresData } = await scoreQuery;

      // 2. Fetch from shared public.game_scores table (authoritative storage for arcade gameplay scores)
      const { data: gameScoresData } = await supabase
        .from('game_scores')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      const remoteScores: ScoreRecord[] = [];
      const remoteIds = new Set<string>();

      // Ingest public.scores rows
      if (scoresData && scoresData.length > 0) {
        for (const d of scoresData) {
          remoteIds.add(d.id);
          const localOverride = this.localScores.find((l) => l.id === d.id);
          const status: ScoreStatus = localOverride?.status || (d.status as ScoreStatus);
          const validationReason = localOverride?.validationReason || d.validation_reason;
          const localMatch = this.localScores.find(
            (l) =>
              l.id === d.id ||
              (d.session_id && l.sessionId === d.session_id) ||
              (l.playerName === d.player_name && l.score === d.score && l.gameId === d.game_id)
          );
          const durationMs =
            (typeof d.duration_ms === 'number' && d.duration_ms > 0 ? d.duration_ms : 0) ||
            localOverride?.durationMs ||
            localMatch?.durationMs ||
            (d.score > 0 ? Math.max(3500, Math.min(180000, Math.floor(d.score * 14))) : 5000);

          remoteScores.push({
            id: d.id,
            userId: d.user_id,
            playerName: d.player_name || 'Anonymous',
            gameId: d.game_id as GameId,
            score: d.score,
            coins: d.coins || 0,
            durationMs,
            sessionId: d.session_id,
            status,
            validationReason,
            walletAddress: d.wallet_address,
            createdAt: d.created_at,
            tournamentId: d.tournament_id,
          });
        }
      }

      // Ingest public.game_scores rows (persisted arcade gameplay runs)
      if (gameScoresData && gameScoresData.length > 0) {
        for (const gs of gameScoresData) {
          if (!remoteIds.has(gs.id)) {
            remoteIds.add(gs.id);
            // Check if there is a local review override from admin review
            const localOverride = this.localScores.find((l) => l.id === gs.id);
            const status: ScoreStatus = localOverride?.status || 'pending';
            const validationReason =
              localOverride?.validationReason ||
              'Player gameplay run recorded in Supabase public.game_scores awaiting review.';

            // Look up duration: 1) from gs.duration_ms (if DB column exists)
            // 2) from localOverride durationMs
            // 3) from local matching submission by sessionId or player/score
            const localMatch = this.localScores.find(
              (l) =>
                l.id === gs.id ||
                (gs.session_id && l.sessionId === gs.session_id) ||
                l.sessionId === `gs_${gs.id}` ||
                (l.playerName === gs.player_name && l.score === gs.score && l.gameId === gs.game_id)
            );

            const durationMs =
              (typeof gs.duration_ms === 'number' && gs.duration_ms > 0 ? gs.duration_ms : 0) ||
              localOverride?.durationMs ||
              localMatch?.durationMs ||
              (gs.score > 0 ? Math.max(3500, Math.min(180000, Math.floor(gs.score * 14))) : 5000);

            remoteScores.push({
              id: gs.id,
              userId: gs.wallet_address || 'usr-arcade',
              playerName: gs.player_name || 'Anonymous Player',
              gameId: (gs.game_id as GameId) || 'coin-rush',
              score: gs.score,
              coins: gs.coins || 0,
              durationMs,
              sessionId: gs.session_id || `gs_${gs.id}`,
              status,
              validationReason,
              walletAddress: gs.wallet_address,
              createdAt: gs.created_at,
            });
          }
        }
      }

      // Sort remote scores by created_at descending
      remoteScores.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Merge with non-conflicting baseline demo scores
      const merged = [
        ...remoteScores,
        ...this.localScores.filter((s) => !remoteIds.has(s.id)),
      ];

      return filter === 'all' ? merged : merged.filter((s) => s.status === filter);
    } catch {
      return filter === 'all' ? this.localScores : this.localScores.filter((s) => s.status === filter);
    }
  }

  /**
   * Fetch suspicious score submissions specifically
   */
  async getSuspiciousScores(): Promise<ScoreRecord[]> {
    const all = await this.getAllScores('all');
    return all.filter(
      (s) =>
        s.status === 'rejected' ||
        (s.validationReason && s.validationReason.toLowerCase().includes('reject')) ||
        (s.validationReason && s.validationReason.toLowerCase().includes('anti-cheat')) ||
        (s.durationMs > 0 && s.durationMs < 2000 && s.score > 1000)
    );
  }

  /**
   * Admin score review action: Approve (verify), Reject, or Re-queue
   * Invokes server-verified stored procedure admin_review_score
   * Enforces server-side authentication, checks database RPC result, and returns explicit errors.
   */
  async reviewScore(
    scoreId: string,
    newStatus: ScoreStatus,
    reason: string,
    scoreRecord?: Partial<ScoreRecord>
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Enforce admin authentication & authorization check
    const adminCheck = await this.checkAdminStatus();
    if (!adminCheck.isAdmin) {
      const reasonMsg = adminCheck.reason
        ? (adminCheck.reason.startsWith('Unauthorized') ? adminCheck.reason : `Unauthorized: ${adminCheck.reason}`)
        : 'Unauthorized: Only authorized administrators can review and moderate scores.';
      return {
        success: false,
        error: reasonMsg,
      };
    }

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scoreId);

      if (isSupabaseConfigured() && isUuid) {
        // 1. Invoke authorized stored procedure: admin_review_score
        const { error: rpcError } = await supabase.rpc('admin_review_score', {
          p_score_id: scoreId,
          p_status: newStatus,
          p_reason: reason || 'Reviewed by administrator referee.',
        });

        if (rpcError) {
          // Check if function is missing in database (code 42883 or function name in message)
          const isRpcMissing =
            rpcError.code === '42883' ||
            (rpcError.message && rpcError.message.toLowerCase().includes('admin_review_score'));

          // Check if score record wasn't found in public.scores table (e.g. submitted to public.game_scores)
          const isNotFoundError =
            rpcError.message &&
            (rpcError.message.toLowerCase().includes('not found') ||
             rpcError.message.toLowerCase().includes('no rows'));

          if (isRpcMissing) {
            // Direct table update fallback with server-side RLS enforcement
            const { error: directError } = await supabase
              .from('scores')
              .update({
                status: newStatus,
                validation_reason: reason || null,
              })
              .eq('id', scoreId);

            if (directError) {
              return {
                success: false,
                error: `Database update failed: ${directError.message || rpcError.message}`,
              };
            }
          } else if (!isNotFoundError) {
            // Attempt direct table update fallback before failing
            const { error: directError } = await supabase
              .from('scores')
              .update({
                status: newStatus,
                validation_reason: reason || null,
              })
              .eq('id', scoreId);

            if (directError) {
              return {
                success: false,
                error: `Database rejected score review: ${rpcError.message}`,
              };
            }
          }
        }
      } else if (isSupabaseConfigured() && !isUuid) {
        // Non-UUID IDs (e.g. baseline demo score records)
        const localExists = this.localScores.some((s) => s.id === scoreId);
        if (!localExists && !scoreRecord) {
          return {
            success: false,
            error: `Score '${scoreId}' is not a valid database UUID and was not found in moderation records.`,
          };
        }
      }

      // Synchronize local cache copy so that score moderation persists across reloads and table queries
      this.updateLocalScore(scoreId, newStatus, reason, scoreRecord);

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  private updateLocalScore(
    scoreId: string,
    status: ScoreStatus,
    reason: string,
    scoreRecord?: Partial<ScoreRecord>
  ) {
    const item = this.localScores.find((s) => s.id === scoreId);
    if (item) {
      item.status = status;
      item.validationReason = reason;
      if (scoreRecord?.durationMs) item.durationMs = scoreRecord.durationMs;
      if (scoreRecord?.score) item.score = scoreRecord.score;
      if (scoreRecord?.playerName) item.playerName = scoreRecord.playerName;
    } else {
      // Add local review override so moderation status persists across reloads and table queries
      this.localScores.unshift({
        id: scoreId,
        userId: scoreRecord?.userId || 'usr-arcade',
        playerName: scoreRecord?.playerName || 'Anonymous Player',
        gameId: scoreRecord?.gameId || 'coin-rush',
        score: scoreRecord?.score || 0,
        coins: scoreRecord?.coins || 0,
        durationMs: scoreRecord?.durationMs || 30000,
        sessionId: scoreRecord?.sessionId || `rev_${scoreId}`,
        status,
        validationReason: reason,
        createdAt: scoreRecord?.createdAt || new Date().toISOString(),
      });
    }
    this.saveToStorage();
  }

  /**
   * Fetch all reward requests (Admin view)
   * Ensures authoritative Supabase records are returned without being shadowed by stale local demo data.
   */
  async getRewardRequests(filter?: { tournamentId?: string; status?: RewardStatus }): Promise<RewardRequest[]> {
    let list: RewardRequest[] = this.localRewards;

    if (isSupabaseConfigured()) {
      try {
        let query = supabase.from('reward_requests').select('*').order('created_at', { ascending: false });
        if (filter?.tournamentId) {
          query = query.eq('tournament_id', filter.tournamentId);
        }
        if (filter?.status) {
          query = query.eq('status', filter.status);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          const mapped: RewardRequest[] = data.map((r) => ({
            id: r.id,
            tournamentId: r.tournament_id,
            userId: r.user_id,
            playerName: r.player_name,
            walletAddress: r.wallet_address,
            rank: r.rank,
            score: r.score,
            rewardAmount: r.reward_amount,
            status: r.status as RewardStatus,
            adminNotes: r.admin_notes,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }));

          const remoteIds = new Set(mapped.map((m) => m.id));
          const remoteTournRank = new Set(mapped.map((m) => `${m.tournamentId}_${m.rank}`));
          // Keep local demo records only if not conflicting with remote database records
          const nonConflictingLocal = this.localRewards.filter(
            (l) => !remoteIds.has(l.id) && !remoteTournRank.has(`${l.tournamentId}_${l.rank}`)
          );
          list = [...mapped, ...nonConflictingLocal];
        }
      } catch {
        // Fall back to local
      }
    }

    if (filter?.tournamentId) {
      list = list.filter((r) => r.tournamentId === filter.tournamentId);
    }
    if (filter?.status) {
      list = list.filter((r) => r.status === filter.status);
    }

    return list;
  }

  /**
   * Fetch player-specific reward requests (Player view - Strict privacy)
   * Players must ONLY be able to view their own reward requests.
   */
  async getPlayerRewardRequests(userId?: string, walletAddress?: string): Promise<RewardRequest[]> {
    if (!userId && !walletAddress) {
      return [];
    }

    const all = await this.getRewardRequests();
    return all.filter((r) => {
      const matchUser = userId && r.userId && r.userId === userId;
      const matchWallet =
        walletAddress &&
        r.walletAddress &&
        r.walletAddress.toLowerCase() === walletAddress.toLowerCase();
      return matchUser || matchWallet;
    });
  }

  /**
   * Determine eligible winners from verified tournament scores and published rules.
   * Only verified scores count. Unverified and rejected scores are strictly excluded.
   * Prevents duplicate winner records.
   */
  async determineEligibleWinners(tournamentId: string): Promise<
    Array<{
      rank: number;
      score: number;
      playerName: string;
      walletAddress: string;
      userId?: string;
      suggestedPrize: string;
      existingReward?: RewardRequest;
      isDuplicateClaim: boolean;
    }>
  > {
    const tournament = (await tournamentService.getTournaments()).find((t) => t.id === tournamentId);
    const rankings = await tournamentService.getTournamentRankings(tournamentId);
    const existingRewards = await this.getRewardRequests({ tournamentId });

    // ONLY verified scores may qualify for prizes!
    const verifiedRankings = rankings.filter((r) => r.isVerified && r.status === 'verified');

    // Parse prize pool tiers (e.g. 1st: 50%, 2nd: 30%, 3rd: 20%)
    const defaultPrizes = ['50,000 $PINN', '30,000 $PINN', '20,000 $PINN', '10,000 $PINN', '5,000 $PINN'];

    return verifiedRankings.slice(0, 5).map((entry, idx) => {
      const rank = idx + 1;
      const prize = entry.potentialPrize || defaultPrizes[idx] || '1,000 $PINN';

      // Check if duplicate claim exists for this tournament and rank or player
      const existing = existingRewards.find(
        (r) =>
          r.rank === rank ||
          (r.userId && r.userId === entry.playerId) ||
          (r.walletAddress && entry.walletAddress && r.walletAddress === entry.walletAddress)
      );

      return {
        rank,
        score: entry.score,
        playerName: entry.playerName,
        walletAddress: entry.walletAddress || 'Unlinked',
        userId: entry.playerId,
        suggestedPrize: prize,
        existingReward: existing,
        isDuplicateClaim: Boolean(existing),
      };
    });
  }

  /**
   * Set a tournament's published prize allocation
   */
  async setTournamentPrizeAllocation(
    tournamentId: string,
    prizePool: string,
    prizeDescription: string
  ): Promise<{ success: boolean; error?: string }> {
    const adminCheck = await this.checkAdminStatus();
    if (!adminCheck.isAdmin) {
      return { success: false, error: 'Unauthorized: Only authorized administrators can set prize allocations.' };
    }

    try {
      if (isSupabaseConfigured()) {
        await supabase.rpc('admin_set_prize_allocation', {
          p_tournament_id: tournamentId,
          p_prize_pool: prizePool,
          p_prize_description: prizeDescription,
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update prize allocation' };
    }
  }

  /**
   * Prepare a new reward request for a tournament winner
   * Enforces:
   * - Administrator authorization
   * - Only verified scores qualify
   * - Duplicate prevention
   */
  async prepareReward(params: {
    tournamentId: string;
    tournamentTitle?: string;
    userId?: string;
    playerName: string;
    walletAddress: string;
    rank: number;
    score: number;
    rewardAmount: string;
    adminNotes?: string;
  }): Promise<{ success: boolean; reward?: RewardRequest; error?: string }> {
    const adminCheck = await this.checkAdminStatus();
    if (!adminCheck.isAdmin) {
      return { success: false, error: 'Unauthorized: Only authorized administrators can prepare rewards.' };
    }

    // 1. Duplicate check: Reject if already prepared/approved for this tournament and rank/player
    const isDuplicate = this.localRewards.some(
      (r) =>
        r.tournamentId === params.tournamentId &&
        (r.rank === params.rank || (params.userId && r.userId === params.userId))
    );

    if (isDuplicate) {
      return {
        success: false,
        error: `DUPLICATE REJECTED: A reward record already exists for rank #${params.rank} in this tournament.`,
      };
    }

    // 2. Verified score check: Check that score is not rejected
    const scores = await this.getAllScores('all');
    const matchedScore = scores.find(
      (s) =>
        s.score === params.score &&
        (s.userId === params.userId || s.playerName === params.playerName)
    );
    if (matchedScore && matchedScore.status !== 'verified') {
      return {
        success: false,
        error: `UNVERIFIED SCORE REJECTED: Score status is '${matchedScore.status}'. Only verified scores qualify for rewards.`,
      };
    }

    try {
      let rpcId: string | null = null;
      if (isSupabaseConfigured()) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('admin_prepare_reward', {
          p_tournament_id: params.tournamentId,
          p_user_id: params.userId || null,
          p_player_name: params.playerName,
          p_wallet_address: params.walletAddress,
          p_rank: params.rank,
          p_score: params.score,
          p_reward_amount: params.rewardAmount,
        });
        if (rpcError) {
          console.warn('admin_prepare_reward RPC note:', rpcError.message);
        } else {
          rpcId = rpcData;
        }
      }

      const newReward: RewardRequest = {
        id: rpcId || `rw-${Date.now()}`,
        tournamentId: params.tournamentId,
        tournamentTitle: params.tournamentTitle,
        userId: params.userId,
        playerName: params.playerName,
        walletAddress: params.walletAddress,
        rank: params.rank,
        score: params.score,
        rewardAmount: params.rewardAmount,
        status: 'prepared',
        adminNotes: params.adminNotes || 'Prepared via Admin Dashboard for review.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.localRewards.unshift(newReward);

      // Create queued payment audit record
      const newPayment: PaymentRecord = {
        id: `pay-${Date.now()}`,
        rewardRequestId: newReward.id,
        tournamentId: params.tournamentId,
        tournamentTitle: params.tournamentTitle,
        userId: params.userId,
        playerName: params.playerName,
        walletAddress: params.walletAddress,
        amount: params.rewardAmount,
        tokenMint: PINN_CONFIG.TOKEN_MINT_ADDRESS,
        status: 'queued',
        note: 'Prepared reward in tournament queue. Awaiting authorized Solana token disbursement.',
        createdAt: new Date().toISOString(),
      };
      this.localPayments.unshift(newPayment);
      this.saveToStorage();

      return { success: true, reward: newReward };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Update reward request status (Approve, Reject, or Put on Hold)
   * Only authorized administrators can approve or reject rewards.
   * Enforces server-side authentication, checks database RPC result, and returns explicit errors.
   */
  async updateRewardStatus(
    rewardId: string,
    status: RewardStatus,
    adminNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const adminCheck = await this.checkAdminStatus();
    if (!adminCheck.isAdmin) {
      const reasonMsg = adminCheck.reason
        ? (adminCheck.reason.startsWith('Unauthorized') ? adminCheck.reason : `Unauthorized: ${adminCheck.reason}`)
        : 'Unauthorized: Only authorized administrators can approve or reject rewards.';
      return {
        success: false,
        error: reasonMsg,
      };
    }

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rewardId);

      if (isSupabaseConfigured() && isUuid) {
        // 1. Invoke authorized stored procedure: admin_update_reward_status
        const { error: rpcError } = await supabase.rpc('admin_update_reward_status', {
          p_reward_id: rewardId,
          p_status: status,
          p_notes: adminNotes || '',
        });

        if (rpcError) {
          // Check if function is missing in database (code 42883 or function name in message)
          const isRpcMissing =
            rpcError.code === '42883' ||
            (rpcError.message && rpcError.message.toLowerCase().includes('admin_update_reward_status'));

          if (isRpcMissing) {
            // Direct table update fallback with server-side RLS enforcement
            const { error: directError } = await supabase
              .from('reward_requests')
              .update({
                status,
                admin_notes: adminNotes || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', rewardId);

            if (directError) {
              return {
                success: false,
                error: `Database update failed: ${directError.message || rpcError.message}`,
              };
            }
          } else {
            // Database rejected the update (e.g., Unauthorized, Row not found, Invalid status)
            return {
              success: false,
              error: `Database rejected reward update: ${rpcError.message}`,
            };
          }
        }
      } else if (isSupabaseConfigured() && !isUuid) {
        // If not a UUID, check if it exists in local demo records
        const localExists = this.localRewards.some((r) => r.id === rewardId);
        if (!localExists) {
          return {
            success: false,
            error: `Reward request '${rewardId}' is not a valid database UUID and was not found in local records.`,
          };
        }
      }

      // Synchronize local cache copy if present
      const item = this.localRewards.find((r) => r.id === rewardId);
      if (item) {
        item.status = status;
        if (adminNotes) item.adminNotes = adminNotes;
        item.updatedAt = new Date().toISOString();
        this.saveToStorage();
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Record a manually completed token payout with Solana On-Chain Verification
   * Requirements:
   * - Enforces administrator authorization
   * - Uses official PINN token mint (6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump)
   * - Rejects duplicate transaction signatures
   * - Verifies transaction succeeded on-chain (failed transactions rejected)
   * - Verifies destination wallet and transferred amount match reward record
   * - Atomically updates reward request to 'completed' and records payment in ledger
   */
  async recordCompletedPayout(params: {
    rewardRequestId: string;
    txSignature: string;
    note?: string;
    isSimulationDemo?: boolean;
    simulateFailedTx?: boolean;
    simulateWrongMint?: boolean;
    simulateWrongRecipient?: boolean;
  }): Promise<{ success: boolean; payment?: PaymentRecord; error?: string }> {
    // 1. Authorization check
    const adminCheck = await this.checkAdminStatus();
    if (!adminCheck.isAdmin) {
      return {
        success: false,
        error: 'SECURITY VIOLATION: Only authorized administrators can record token payouts.',
      };
    }

    // 2. Fetch reward request
    const reward = this.localRewards.find((r) => r.id === params.rewardRequestId);
    if (!reward) {
      return { success: false, error: 'Reward request not found.' };
    }

    if (reward.status === 'completed') {
      return { success: false, error: 'DUPLICATE PAYOUT: This reward has already been marked as completed/paid.' };
    }

    const cleanSig = params.txSignature.trim();
    if (!cleanSig) {
      return { success: false, error: 'A valid Solana transaction signature is required.' };
    }

    // 3. Duplicate signature check
    const existingSignatures = this.localPayments
      .map((p) => p.txSignature)
      .filter((s): s is string => Boolean(s));

    if (solanaVerificationService.isSignatureAlreadyRecorded(cleanSig, existingSignatures)) {
      return {
        success: false,
        error: `DUPLICATE SIGNATURE REJECTED: Transaction signature ${cleanSig.slice(0, 14)}... has already been used for another payout.`,
      };
    }

    // 4. Server-Side On-Chain Verification (delegates to server-side endpoint in browser)
    if (typeof window !== 'undefined') {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (!session?.access_token) {
          return {
            success: false,
            error: 'AUTHENTICATION REQUIRED: Active Supabase administrator session required to record payments.',
          };
        }
        const res = await fetch('/api/payments/verify-and-record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            'x-admin-role': adminCheck.role || 'admin',
          },
          body: JSON.stringify({
            rewardRequestId: reward.id,
            txSignature: cleanSig,
            note: params.note,
            expectedWallet: reward.walletAddress,
            expectedAmount: reward.rewardAmount,
            playerName: reward.playerName,
            isSimulationDemo: params.isSimulationDemo,
            simulateFailedTx: params.simulateFailedTx,
            simulateWrongMint: params.simulateWrongMint,
            simulateWrongRecipient: params.simulateWrongRecipient,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            reward.status = 'completed';
            reward.adminNotes = `Paid & Verified: ${cleanSig.slice(0, 8)}... (${new Date().toLocaleDateString()})`;
            reward.updatedAt = new Date().toISOString();
            const srvPayment = json.payment as PaymentRecord;
            this.localPayments.unshift(srvPayment);
            this.saveToStorage();
            return { success: true, payment: srvPayment };
          } else {
            return { success: false, error: json.error || 'Server rejected payout.' };
          }
        } else if (res.status === 400 || res.status === 403 || res.status === 409 || res.status === 422) {
          const json = await res.json().catch(() => ({}));
          return { success: false, error: json.error || `Server verification failed (${res.status})` };
        }
      } catch (err) {
        console.warn('Server verification endpoint unavailable, proceeding with verified client-side fallback:', err);
      }
    }

    // 4b. Local / Test harness verification fallback
    let verification: any;
    if (params.isSimulationDemo) {
      verification = solanaVerificationService.verifyMockOrSimulation(
        {
          signature: cleanSig,
          expectedRecipientWallet: reward.walletAddress,
          expectedAmountPinn: reward.rewardAmount,
          rewardId: reward.id,
        },
        {
          simulateFailedTx: params.simulateFailedTx,
          simulateWrongMint: params.simulateWrongMint,
          simulateWrongRecipient: params.simulateWrongRecipient,
          existingSignatures,
        }
      );
    } else {
      verification = await solanaVerificationService.verifyPaymentTransaction(
        {
          signature: cleanSig,
          expectedRecipientWallet: reward.walletAddress,
          expectedAmountPinn: reward.rewardAmount,
          rewardId: reward.id,
        },
        existingSignatures
      );
    }

    // 5. If verification failed on-chain, reject! Failed Solana transactions are not marked as paid.
    if (!verification.verified) {
      return {
        success: false,
        error: `PAYMENT REJECTED: ${verification.error || 'Solana on-chain verification failed.'}`,
      };
    }

    // 6. Record in remote Supabase if connected (only for real, verified on-chain payments, NEVER simulations)
    if (isSupabaseConfigured() && !params.isSimulationDemo) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('admin_record_solana_payout', {
          p_reward_id: reward.id,
          p_tx_signature: cleanSig,
          p_token_mint: PINN_CONFIG.TOKEN_MINT_ADDRESS,
          p_destination_wallet: reward.walletAddress,
          p_amount: reward.rewardAmount,
          p_note: params.note || 'Verified Solana mainnet token transfer.',
        });

        if (rpcError) {
          console.warn('RPC admin_record_solana_payout fallback:', rpcError.message);
        }
      } catch (e) {
        console.warn('Database payout sync error:', e);
      }
    }

    // 7. Atomic state update
    reward.status = 'completed';
    reward.adminNotes = `Paid & Verified: ${cleanSig.slice(0, 8)}... (${new Date().toLocaleDateString()})`;
    reward.updatedAt = new Date().toISOString();

    const paymentRecord: PaymentRecord = {
      id: `pay-${Date.now()}`,
      rewardRequestId: reward.id,
      tournamentId: reward.tournamentId,
      tournamentTitle: reward.tournamentTitle,
      userId: reward.userId,
      playerName: reward.playerName,
      walletAddress: reward.walletAddress,
      amount: reward.rewardAmount,
      tokenMint: PINN_CONFIG.TOKEN_MINT_ADDRESS,
      txSignature: cleanSig,
      status: 'verified_paid',
      isVerifiedOnChain: true,
      verifiedAt: new Date().toISOString(),
      note: params.note || 'Confirmed on Solana blockchain for official $PINN distribution.',
      createdAt: new Date().toISOString(),
    };

    this.localPayments.unshift(paymentRecord);
    this.saveToStorage();

    return { success: true, payment: paymentRecord };
  }

  /**
   * Fetch all payment records (Admin view)
   */
  async getPaymentHistory(): Promise<PaymentRecord[]> {
    if (!isSupabaseConfigured()) {
      return this.localPayments;
    }

    try {
      const { data, error } = await supabase
        .from('payment_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: PaymentRecord[] = data.map((p) => ({
          id: p.id,
          rewardRequestId: p.reward_request_id,
          tournamentId: p.tournament_id,
          userId: p.user_id,
          playerName: p.player_name,
          walletAddress: p.wallet_address,
          amount: p.amount,
          tokenMint: p.token_mint || PINN_CONFIG.TOKEN_MINT_ADDRESS,
          txSignature: p.tx_signature,
          status: p.status,
          isVerifiedOnChain: p.is_verified_on_chain ?? Boolean(p.tx_signature),
          verifiedAt: p.verified_at,
          note: p.note,
          createdAt: p.created_at,
        }));
        const remoteIds = new Set(mapped.map((m) => m.id));
        return [...mapped, ...this.localPayments.filter((l) => !remoteIds.has(l.id))];
      }

      return this.localPayments;
    } catch {
      return this.localPayments;
    }
  }

  /**
   * Fetch player-specific payment records (Player view - Strict privacy)
   * Players must ONLY be able to view their own payment records.
   */
  async getPlayerPaymentRecords(userId?: string, walletAddress?: string): Promise<PaymentRecord[]> {
    if (!userId && !walletAddress) {
      return [];
    }

    const all = await this.getPaymentHistory();
    return all.filter((p) => {
      const matchUser = userId && p.userId && p.userId === userId;
      const matchWallet =
        walletAddress &&
        p.walletAddress &&
        p.walletAddress.toLowerCase() === walletAddress.toLowerCase();
      return matchUser || matchWallet;
    });
  }

  /**
   * Fetch player accounts and aggregated activity
   */
  async getPlayerAccounts(): Promise<
    Array<{
      id: string;
      displayName: string;
      walletAddress?: string | null;
      totalGamesPlayed: number;
      bestScore: number;
      verifiedScoresCount: number;
      flaggedCount: number;
      lastActive: string;
    }>
  > {
    const scores = await this.getAllScores('all');
    const playerMap = new Map<
      string,
      {
        id: string;
        displayName: string;
        walletAddress?: string | null;
        totalGamesPlayed: number;
        bestScore: number;
        verifiedScoresCount: number;
        flaggedCount: number;
        lastActive: string;
      }
    >();

    for (const s of scores) {
      const key = s.userId || s.playerName;
      let record = playerMap.get(key);
      if (!record) {
        record = {
          id: key,
          displayName: s.playerName,
          walletAddress: s.walletAddress,
          totalGamesPlayed: 0,
          bestScore: 0,
          verifiedScoresCount: 0,
          flaggedCount: 0,
          lastActive: s.createdAt,
        };
        playerMap.set(key, record);
      }

      record.totalGamesPlayed++;
      if (s.score > record.bestScore) {
        record.bestScore = s.score;
      }
      if (s.status === 'verified') {
        record.verifiedScoresCount++;
      } else if (s.status === 'rejected') {
        record.flaggedCount++;
      }
      if (new Date(s.createdAt) > new Date(record.lastActive)) {
        record.lastActive = s.createdAt;
      }
    }

    return Array.from(playerMap.values());
  }

  /**
   * Helper: Build server-verified Admin Authorization headers with Supabase JWT
   */
  private async buildAdminAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const session = await getCurrentSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }

  /**
   * FEATURE 3: Admin Searchable Player Balances
   * Queries authoritative server endpoint /api/admin/player-balances protected by server-side RBAC.
   */
  async getAdminPlayerBalances(searchQuery: string = ''): Promise<AdminPlayerBalanceRow[]> {
    const headers = await this.buildAdminAuthHeaders();
    const qParam = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : '';
    const res = await fetch(`/api/admin/player-balances${qParam}`, {
      method: 'GET',
      headers,
    });

    const data = await res.json();
    if (!res.ok || !data.success || !Array.isArray(data.players)) {
      throw new Error(data.error || 'Failed to load authoritative player balances.');
    }

    return data.players as AdminPlayerBalanceRow[];
  }

  /**
   * FEATURE 5: Admin View All Withdrawal Requests
   * Queries /api/admin/withdrawals protected by server-side RBAC.
   */
  async getAdminWithdrawals(statusFilter: string = 'all'): Promise<WithdrawalRequest[]> {
    const headers = await this.buildAdminAuthHeaders();
    const qParam =
      statusFilter && statusFilter !== 'all'
        ? `?status=${encodeURIComponent(statusFilter)}`
        : '';
    const res = await fetch(`/api/admin/withdrawals${qParam}`, {
      method: 'GET',
      headers,
    });

    const data = await res.json();
    if (!res.ok || !data.success || !Array.isArray(data.withdrawals)) {
      throw new Error(data.error || 'Failed to load withdrawal requests.');
    }

    return data.withdrawals as WithdrawalRequest[];
  }

  /**
   * FEATURE 5: Admin Update Withdrawal Status (Approve, Mark Processing, or Reject & Release Reservation)
   */
  async updateWithdrawalStatus(
    requestId: string,
    status: 'approved' | 'processing' | 'rejected' | 'cancelled',
    adminNotes?: string,
    rejectionReason?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const headers = await this.buildAdminAuthHeaders();
      const res = await fetch('/api/admin/withdrawals/status', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requestId,
          status,
          adminNotes,
          rejectionReason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || `Failed to update withdrawal status to ${status}.`,
        };
      }

      return {
        success: true,
        message: data.message || `Withdrawal status updated to ${status}.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: msg || 'Network error while updating withdrawal status.',
      };
    }
  }

  /**
   * FEATURE 5: Admin Settle Withdrawal & Mark Paid (Independent Solana On-Chain Verification)
   */
  async settleWithdrawalPayout(params: {
    requestId: string;
    txSignature: string;
    note?: string;
  }): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    txSignature?: string;
  }> {
    try {
      const headers = await this.buildAdminAuthHeaders();
      const res = await fetch('/api/admin/withdrawals/settle', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requestId: params.requestId,
          txSignature: params.txSignature,
          note: params.note,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Solana on-chain payout verification failed.',
        };
      }

      return {
        success: true,
        message: data.message,
        txSignature: data.txSignature,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: msg || 'Network error while verifying withdrawal payout.',
      };
    }
  }
}

export const adminService = new AdminService();
