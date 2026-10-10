export type PageNav = 'home' | 'play' | 'leaderboard' | 'rewards' | 'about' | 'terms' | 'privacy';

export interface LeaderboardEntry {
  id: string;
  rank: number;
  displayName: string;
  score: number;
  coinsCollected: number;
  dateAchieved: string;
  period: 'all-time' | 'weekly';
  isVerified: boolean;
  walletAddress?: string;
  isDemo?: boolean;
}

export interface PlayerStats {
  displayName: string;
  personalBest: number;
  sessionBest: number;
  totalGamesPlayed: number;
  totalCoinsCollected: number;
  lastPlayedAt?: string;
}

export interface CompetitionWinner {
  rank: number;
  displayName: string;
  walletSnippet: string;
  score: number;
  rewardText: string;
  txSignature?: string;
  isDemo?: boolean;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  walletName: string | null;
}
