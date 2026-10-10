import { LeaderboardEntry, PlayerStats } from '../types';

const STATS_KEY = 'pinn_arcade_player_stats';
const LOCAL_SCORES_KEY = 'pinn_arcade_recent_scores';

// Initial realistic benchmark demonstration scores (clearly flagged as isDemo)
const DEMO_LEADERBOARD_ENTRIES: LeaderboardEntry[] = [
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
    dateAchieved: '2026-10-09',
    period: 'all-time',
    isVerified: false,
    isDemo: true,
  },
  {
    id: 'demo-6',
    rank: 6,
    displayName: 'TropicalDash',
    score: 7520,
    coinsCollected: 91,
    dateAchieved: '2026-10-07',
    period: 'all-time',
    isVerified: false,
    isDemo: true,
  },
  {
    id: 'demo-7',
    rank: 7,
    displayName: 'PinnacleVibe',
    score: 6940,
    coinsCollected: 85,
    dateAchieved: '2026-10-08',
    period: 'all-time',
    isVerified: false,
    isDemo: true,
  },
  {
    id: 'demo-8',
    rank: 8,
    displayName: 'IslandSpeed',
    score: 5880,
    coinsCollected: 72,
    dateAchieved: '2026-10-09',
    period: 'all-time',
    isVerified: false,
    isDemo: true,
  },
  {
    id: 'demo-9',
    rank: 9,
    displayName: 'SolSprint',
    score: 4720,
    coinsCollected: 58,
    dateAchieved: '2026-10-05',
    period: 'all-time',
    isVerified: false,
    isDemo: true,
  },
  {
    id: 'demo-10',
    rank: 10,
    displayName: 'MobayChallenger',
    score: 3950,
    coinsCollected: 49,
    dateAchieved: '2026-10-09',
    period: 'all-time',
    isVerified: false,
    isDemo: true,
  },
];

export interface ScoreSubmissionResult {
  isNewPersonalBest: boolean;
  score: number;
  stats: PlayerStats;
}

class LeaderboardService {
  private sessionBest: number = 0;

  public getPlayerStats(): PlayerStats {
    try {
      const data = localStorage.getItem(STATS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          displayName: parsed.displayName || 'PinnRunner',
          personalBest: Number(parsed.personalBest) || 0,
          sessionBest: this.sessionBest,
          totalGamesPlayed: Number(parsed.totalGamesPlayed) || 0,
          totalCoinsCollected: Number(parsed.totalCoinsCollected) || 0,
          lastPlayedAt: parsed.lastPlayedAt,
        };
      }
    } catch {
      // ignore
    }

    return {
      displayName: 'PinnRunner',
      personalBest: 0,
      sessionBest: this.sessionBest,
      totalGamesPlayed: 0,
      totalCoinsCollected: 0,
    };
  }

  public updateDisplayName(name: string): PlayerStats {
    const clean = name.trim().slice(0, 20) || 'PinnRunner';
    const current = this.getPlayerStats();
    const updated: PlayerStats = {
      ...current,
      displayName: clean,
    };
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    return updated;
  }

  public recordGameResult(score: number, coins: number): ScoreSubmissionResult {
    const current = this.getPlayerStats();
    let isNewPb = false;

    if (score > this.sessionBest) {
      this.sessionBest = score;
    }

    let newPb = current.personalBest;
    if (score > current.personalBest) {
      newPb = score;
      isNewPb = true;
    }

    const updated: PlayerStats = {
      displayName: current.displayName,
      personalBest: newPb,
      sessionBest: this.sessionBest,
      totalGamesPlayed: current.totalGamesPlayed + 1,
      totalCoinsCollected: current.totalCoinsCollected + coins,
      lastPlayedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(updated));
      
      // Also save to recent score log
      const recentRaw = localStorage.getItem(LOCAL_SCORES_KEY);
      const recent = recentRaw ? JSON.parse(recentRaw) : [];
      recent.unshift({
        score,
        coins,
        date: new Date().toISOString(),
      });
      // keep max 20
      localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(recent.slice(0, 20)));
    } catch {
      // ignore
    }

    return {
      isNewPersonalBest: isNewPb,
      score,
      stats: updated,
    };
  }

  /**
   * Service interface to fetch leaderboard entries.
   * Currently returns demonstration data with player's local personal best integrated if higher.
   * Can be swapped directly with a real backend API endpoint.
   */
  public async getLeaderboard(period: 'all-time' | 'weekly'): Promise<LeaderboardEntry[]> {
    const stats = this.getPlayerStats();
    const list = [...DEMO_LEADERBOARD_ENTRIES];

    // If player has a personal best, include or compare for local view
    if (stats.personalBest > 0) {
      const existingUserIdx = list.findIndex(e => e.displayName === stats.displayName);
      if (existingUserIdx >= 0) {
        if (stats.personalBest > list[existingUserIdx].score) {
          list[existingUserIdx].score = stats.personalBest;
        }
      } else {
        list.push({
          id: 'local-player',
          rank: 999,
          displayName: `${stats.displayName} (You)`,
          score: stats.personalBest,
          coinsCollected: stats.totalCoinsCollected,
          dateAchieved: stats.lastPlayedAt ? stats.lastPlayedAt.split('T')[0] : 'Today',
          period: 'all-time',
          isVerified: false,
          isDemo: false,
        });
      }
    }

    // Sort descending by score
    list.sort((a, b) => b.score - a.score);

    // Re-rank top 10
    return list.slice(0, 10).map((item, index) => ({
      ...item,
      rank: index + 1,
      period,
    }));
  }

  /**
   * Stub for future backend submission:
   * Production requirement: Server-side validation, HMAC/signature of game telemetry,
   * timestamping, rate limiting, and replay prevention.
   */
  public async submitScoreToBackend(
    _score: number,
    _coins: number,
    _gameTelemetry?: unknown
  ): Promise<{ success: boolean; message: string }> {
    // In production, this calls e.g. POST /api/leaderboard/submit
    return {
      success: true,
      message: 'Local score saved. Backend integration ready for deployment.',
    };
  }
}

export const leaderboardService = new LeaderboardService();
