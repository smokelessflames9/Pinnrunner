import { LeaderboardEntry, PlayerStats, ScoreRecord } from '../types';
import {
  submitScoreSecurely,
  fetchTopScoresFromSupabase,
  testSupabaseConnection,
  SubmitScoreResponse,
  getCurrentUser,
} from './supabaseClient';
import { walletService } from './walletService';
import { adminService } from './adminService';
import { playerAuthService } from './playerAuthService';

const STATS_KEY = 'pinn_arcade_player_stats';
const LOCAL_SCORES_KEY = 'pinn_arcade_recent_scores';

// Initial realistic benchmark demonstration scores (clearly flagged as isDemo)
const DEMO_LEADERBOARD_ENTRIES: Record<string, LeaderboardEntry[]> = {
  'coin-rush': [
    {
      id: 'demo-1',
      rank: 1,
      displayName: 'MontegoKing',
      score: 14850,
      coinsCollected: 182,
      dateAchieved: '2026-10-08',
      period: 'all-time',
      isVerified: true,
      isDemo: true,
    },
    {
      id: 'demo-2',
      rank: 2,
      displayName: 'PinnaclePro',
      score: 12420,
      coinsCollected: 154,
      dateAchieved: '2026-10-07',
      period: 'all-time',
      isVerified: true,
      isDemo: true,
    },
    {
      id: 'demo-3',
      rank: 3,
      displayName: 'SolanaSurfer',
      score: 10980,
      coinsCollected: 139,
      dateAchieved: '2026-10-08',
      period: 'all-time',
      isVerified: true,
      isDemo: true,
    },
    {
      id: 'demo-4',
      rank: 4,
      displayName: 'CaribbeanRunner',
      score: 9340,
      coinsCollected: 112,
      dateAchieved: '2026-10-06',
      period: 'all-time',
      isVerified: false,
      isDemo: true,
    },
    {
      id: 'demo-5',
      rank: 5,
      displayName: 'GoldRush99',
      score: 8760,
      coinsCollected: 104,
      dateAchieved: '2026-10-05',
      period: 'all-time',
      isVerified: true,
      isDemo: true,
    },
  ],
  'treasure-hunt': [
    {
      id: 'th-1',
      rank: 1,
      displayName: 'CorsairCap',
      score: 4850,
      coinsCollected: 64,
      dateAchieved: '2026-10-09',
      period: 'all-time',
      isVerified: true,
      isDemo: true,
    },
    {
      id: 'th-2',
      rank: 2,
      displayName: 'IslandHunter',
      score: 4120,
      coinsCollected: 52,
      dateAchieved: '2026-10-08',
      period: 'all-time',
      isVerified: true,
      isDemo: true,
    },
  ],
  'puzzle-master': [
    {
      id: 'pm-1',
      rank: 1,
      displayName: 'CrypticMind',
      score: 3200,
      coinsCollected: 0,
      dateAchieved: '2026-10-10',
      period: 'all-time',
      isVerified: true,
      isDemo: true,
    },
    {
      id: 'pm-2',
      rank: 2,
      displayName: 'LogicQueen',
      score: 2950,
      coinsCollected: 0,
      dateAchieved: '2026-10-09',
      period: 'all-time',
      isVerified: false,
      isDemo: true,
    },
  ],
  'speed-tap': [
    {
      id: 'st-1',
      rank: 1,
      displayName: 'HyperReflex',
      score: 2450,
      coinsCollected: 0,
      dateAchieved: '2026-10-10',
      period: 'all-time',
      isVerified: true,
      isDemo: true,
    },
    {
      id: 'st-2',
      rank: 2,
      displayName: 'FlashGamer',
      score: 2180,
      coinsCollected: 0,
      dateAchieved: '2026-10-09',
      period: 'all-time',
      isVerified: false,
      isDemo: true,
    },
  ],
};

export interface ScoreSubmissionResult {
  isNewPersonalBest: boolean;
  score: number;
  stats: PlayerStats;
  submissionStatus?: 'verified' | 'pending' | 'rejected' | 'offline';
  message?: string;
  error?: string;
}

class LeaderboardService {
  private sessionBest: number = 0;
  // Last submission feedback
  private lastSubmissionResult: SubmitScoreResponse | null = null;
  private submissionListeners: ((res: SubmitScoreResponse) => void)[] = [];

  public subscribeSubmission(listener: (res: SubmitScoreResponse) => void) {
    this.submissionListeners.push(listener);
    return () => {
      this.submissionListeners = this.submissionListeners.filter((l) => l !== listener);
    };
  }

  public getLastSubmission(): SubmitScoreResponse | null {
    return this.lastSubmissionResult;
  }

  public getPlayerStats(): PlayerStats {
    const authProfile = playerAuthService.getProfile();
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(STATS_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          return {
            displayName: authProfile?.displayName || parsed.displayName || 'PinnRunner',
            personalBest: Number(parsed.personalBest) || 0,
            sessionBest: this.sessionBest,
            totalGamesPlayed: authProfile ? authProfile.totalGamesPlayed : (Number(parsed.totalGamesPlayed) || 0),
            totalCoinsCollected: authProfile ? authProfile.coinsBalance : (Number(parsed.totalCoinsCollected) || 0),
            totalPlayTimeMs: authProfile ? authProfile.totalPlayTimeMs : (Number(parsed.totalPlayTimeMs) || 0),
            lastRunDurationMs: authProfile ? authProfile.lastRunDurationMs : (Number(parsed.lastRunDurationMs) || 0),
            lastPlayedAt: parsed.lastPlayedAt || authProfile?.updatedAt,
          };
        }
      }
    } catch {
      // ignore
    }

    return {
      displayName: authProfile?.displayName || 'PinnRunner',
      personalBest: 0,
      sessionBest: this.sessionBest,
      totalGamesPlayed: authProfile?.totalGamesPlayed || 0,
      totalCoinsCollected: authProfile?.coinsBalance || 0,
      totalPlayTimeMs: authProfile?.totalPlayTimeMs || 0,
      lastRunDurationMs: authProfile?.lastRunDurationMs || 0,
      lastPlayedAt: authProfile?.updatedAt,
    };
  }

  public updateDisplayName(name: string): PlayerStats {
    const clean = name.trim().slice(0, 24) || 'PinnRunner';
    const current = this.getPlayerStats();
    const updated: PlayerStats = {
      ...current,
      displayName: clean,
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STATS_KEY, JSON.stringify(updated));
      }
    } catch {
      // ignore
    }

    if (playerAuthService.isAuthenticated()) {
      playerAuthService.updateDisplayName(clean).catch((err) => {
        console.warn('Profile username sync note:', err?.message || err);
      });
    }

    return updated;
  }

  /**
   * Records Coin Rush game result and submits through secure anti-cheat pipeline
   */
  public recordGameResult(
    score: number,
    coins: number,
    extraTelemetry?: {
      sessionId?: string;
      durationMs?: number;
      distanceMeters?: number;
      obstaclesPassed?: number;
    }
  ): ScoreSubmissionResult {
    const current = this.getPlayerStats();
    const isNewPersonalBest = score > current.personalBest;

    if (score > this.sessionBest) {
      this.sessionBest = score;
    }

    const durationMs = extraTelemetry?.durationMs || Math.max(3500, Math.floor(score * 15));

    const updated: PlayerStats = {
      displayName: current.displayName,
      personalBest: isNewPersonalBest ? score : current.personalBest,
      sessionBest: this.sessionBest,
      totalGamesPlayed: current.totalGamesPlayed + 1,
      totalCoinsCollected: current.totalCoinsCollected + coins,
      totalPlayTimeMs: (current.totalPlayTimeMs || 0) + durationMs,
      lastRunDurationMs: durationMs,
      lastPlayedAt: new Date().toISOString(),
    };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STATS_KEY, JSON.stringify(updated));

        const recentRaw = localStorage.getItem(LOCAL_SCORES_KEY);
        const recent = recentRaw ? JSON.parse(recentRaw) : [];
        recent.unshift({
          score,
          coins,
          durationMs,
          date: new Date().toISOString(),
        });
        localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(recent.slice(0, 20)));
      }
    } catch {
      // ignore
    }

    // Submit securely to Supabase Edge Function with anti-cheat telemetry
    const walletAddress = walletService.getState().address;
    const sessionId = extraTelemetry?.sessionId || `cr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Authoritatively synchronize coins into player account ledger with session deduplication
    if (coins > 0 || durationMs > 0) {
      playerAuthService.recordGameCoins(coins, durationMs, 'coin-rush', sessionId);
    }

    // Ingest into admin moderation queue
    const liveScoreRecord: ScoreRecord = {
      id: `sc-live-${Date.now()}`,
      userId: walletAddress || 'usr-local',
      playerName: current.displayName,
      gameId: 'coin-rush',
      score,
      coins,
      durationMs,
      sessionId,
      status: 'pending',
      validationReason: 'Player live run; awaiting verification.',
      walletAddress,
      createdAt: new Date().toISOString(),
    };
    adminService.ingestScoreSubmission(liveScoreRecord);

    submitScoreSecurely({
      gameId: 'coin-rush',
      score,
      coins,
      sessionId,
      durationMs,
      playerName: current.displayName,
      walletAddress,
      telemetry: {
        distanceMeters: extraTelemetry?.distanceMeters || Math.floor(score / 2),
        obstaclesPassed: extraTelemetry?.obstaclesPassed || 5,
        coinsGathered: coins,
      },
    })
      .then((res) => {
        this.lastSubmissionResult = res;
        this.submissionListeners.forEach((l) => l(res));
        if (res.status === 'verified') {
          liveScoreRecord.status = 'verified';
          liveScoreRecord.validationReason = res.message || 'Server verified run.';
          adminService.ingestScoreSubmission(liveScoreRecord);
        } else if (res.status === 'rejected') {
          liveScoreRecord.status = 'rejected';
          liveScoreRecord.validationReason = res.message || 'Server anti-cheat rejection.';
          adminService.ingestScoreSubmission(liveScoreRecord);
        }
      })
      .catch((err) => {
        console.warn('Secure submission warning:', err);
      });

    return {
      isNewPersonalBest,
      score,
      stats: updated,
    };
  }

  /**
   * Service interface to fetch leaderboard entries.
   * Pulls real verified records from Supabase; merges personal best and demo records.
   */
  public async getLeaderboard(
    period: 'all-time' | 'weekly',
    gameId: 'coin-rush' | 'treasure-hunt' | 'puzzle-master' | 'speed-tap' = 'coin-rush'
  ): Promise<{ entries: LeaderboardEntry[]; isLiveSupabase: boolean }> {
    const stats = this.getPlayerStats();
    const pb = this.getGameBest(gameId);

    // 1. Attempt to fetch live scores from Supabase
    try {
      const liveRows = await fetchTopScoresFromSupabase(gameId, 25);
      if (liveRows && liveRows.length > 0) {
        // Map Supabase rows to LeaderboardEntry
        const entries: LeaderboardEntry[] = liveRows.map((row, idx) => ({
          id: row.id || `sb-${idx}`,
          rank: idx + 1,
          displayName: row.player_name,
          walletAddress: row.wallet_address || undefined,
          score: row.score,
          coinsCollected: row.coins || 0,
          durationMs: row.duration_ms,
          dateAchieved: row.created_at ? row.created_at.split('T')[0] : 'Today',
          period,
          isVerified: row.status ? row.status === 'verified' : Boolean(row.wallet_address),
          isDemo: false,
        }));

        // Check if player's local PB is not yet in top entries, inject it if appropriate
        const playerInList = entries.some((e) => e.displayName === stats.displayName);
        if (!playerInList && pb > 0) {
          entries.push({
            id: 'local-player',
            rank: 999,
            displayName: `${stats.displayName} (You)`,
            score: pb,
            coinsCollected: gameId === 'coin-rush' ? stats.totalCoinsCollected : 0,
            durationMs: stats.lastRunDurationMs,
            dateAchieved: 'Today',
            period,
            isVerified: Boolean(walletService.getState().address),
            isDemo: false,
          });
          entries.sort((a, b) => b.score - a.score);
          entries.forEach((e, i) => (e.rank = i + 1));
        }

        return { entries: entries.slice(0, 15), isLiveSupabase: true };
      }
    } catch (err) {
      console.warn('Failed to query Supabase leaderboard, falling back to local/demo:', err);
    }

    // 2. Fallback to demonstration benchmarks merged with player personal best
    const fallbackList = DEMO_LEADERBOARD_ENTRIES[gameId] || DEMO_LEADERBOARD_ENTRIES['coin-rush'];
    const list: LeaderboardEntry[] = fallbackList.map((e) => ({ ...e }));

    if (pb > 0) {
      const existingUserIdx = list.findIndex((e) => e.displayName === stats.displayName);
      if (existingUserIdx >= 0) {
        if (pb > list[existingUserIdx].score) {
          list[existingUserIdx].score = pb;
        }
      } else {
        list.push({
          id: 'local-player',
          rank: 999,
          displayName: `${stats.displayName} (You)`,
          score: pb,
          coinsCollected: gameId === 'coin-rush' ? stats.totalCoinsCollected : 0,
          dateAchieved: 'Today',
          period,
          isVerified: Boolean(walletService.getState().address),
          isDemo: false,
        });
      }
    }

    list.sort((a, b) => b.score - a.score);
    list.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    return { entries: list.slice(0, 10), isLiveSupabase: false };
  }

  /**
   * Get personal best for a specific game
   */
  public getGameBest(gameId: 'coin-rush' | 'treasure-hunt' | 'puzzle-master' | 'speed-tap'): number {
    try {
      if (typeof localStorage === 'undefined') return 0;
      if (gameId === 'coin-rush') {
        const stats = this.getPlayerStats();
        return stats.personalBest;
      }
      const val = localStorage.getItem(`pinn_pb_${gameId}`);
      return val ? Number(val) || 0 : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Multi-game personal best score recording with secure anti-cheat telemetry
   */
  public recordGameBest(
    gameId: 'coin-rush' | 'treasure-hunt' | 'puzzle-master' | 'speed-tap',
    score: number,
    options?: {
      coins?: number;
      sessionId?: string;
      durationMs?: number;
      telemetry?: Record<string, unknown>;
    }
  ): { isNewPb: boolean; pb: number } {
    try {
      const current = this.getGameBest(gameId);
      const isNewPb = score > current;
      const pb = isNewPb ? score : current;
      if (isNewPb && typeof localStorage !== 'undefined') {
        localStorage.setItem(`pinn_pb_${gameId}`, String(pb));
      }

      if (gameId === 'coin-rush') {
        this.recordGameResult(score, options?.coins || 0, {
          sessionId: options?.sessionId,
          durationMs: options?.durationMs,
        });
      } else {
        // Secure server-side validation submission
        const stats = this.getPlayerStats();
        const walletAddress = walletService.getState().address;
        const sessionId = options?.sessionId || `${gameId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const durationMs = options?.durationMs || 30000;

        // Update player stats with playtime duration
        const updatedStats: PlayerStats = {
          ...stats,
          totalGamesPlayed: stats.totalGamesPlayed + 1,
          totalPlayTimeMs: (stats.totalPlayTimeMs || 0) + durationMs,
          lastRunDurationMs: durationMs,
          lastPlayedAt: new Date().toISOString(),
        };
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STATS_KEY, JSON.stringify(updatedStats));
          }
        } catch {
          // ignore
        }

        // Authoritatively synchronize coins into player account ledger with session deduplication
        if ((options?.coins && options.coins > 0) || durationMs > 0) {
          playerAuthService.recordGameCoins(options?.coins || 0, durationMs, gameId, sessionId);
        }

        // Ingest into admin moderation queue
        const liveScoreRecord: ScoreRecord = {
          id: `sc-live-${Date.now()}`,
          userId: walletAddress || 'usr-local',
          playerName: stats.displayName,
          gameId,
          score,
          coins: options?.coins || 0,
          durationMs,
          sessionId,
          status: 'pending',
          validationReason: 'Player live run; awaiting verification.',
          walletAddress,
          createdAt: new Date().toISOString(),
        };
        adminService.ingestScoreSubmission(liveScoreRecord);

        submitScoreSecurely({
          gameId,
          score,
          coins: options?.coins || 0,
          sessionId,
          durationMs,
          playerName: stats.displayName,
          walletAddress,
          telemetry: options?.telemetry,
        })
          .then((res) => {
            this.lastSubmissionResult = res;
            this.submissionListeners.forEach((l) => l(res));
            if (res.status === 'verified') {
              liveScoreRecord.status = 'verified';
              liveScoreRecord.validationReason = res.message || 'Server verified run.';
              adminService.ingestScoreSubmission(liveScoreRecord);
            } else if (res.status === 'rejected') {
              liveScoreRecord.status = 'rejected';
              liveScoreRecord.validationReason = res.message || 'Server anti-cheat rejection.';
              adminService.ingestScoreSubmission(liveScoreRecord);
            }
          })
          .catch((err) => {
            console.warn('Secure submission warning:', err);
          });
      }
      return { isNewPb, pb };
    } catch {
      return { isNewPb: false, pb: score };
    }
  }

  /**
   * Fetch all personal best scores across games
   */
  public getAllGameBests() {
    return {
      coinRush: this.getGameBest('coin-rush'),
      treasureHunt: this.getGameBest('treasure-hunt'),
      puzzleMaster: this.getGameBest('puzzle-master'),
      speedTap: this.getGameBest('speed-tap'),
    };
  }

  /**
   * Checks Supabase connection status
   */
  public async getSupabaseStatus() {
    return await testSupabaseConnection();
  }
}

export const leaderboardService = new LeaderboardService();
