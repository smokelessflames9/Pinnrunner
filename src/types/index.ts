export type PageNav =
  | 'home'
  | 'games'
  | 'play'
  | 'play-treasure'
  | 'play-puzzle'
  | 'play-speedtap'
  | 'tournaments'
  | 'admin'
  | 'token'
  | 'leaderboard'
  | 'rewards'
  | 'about'
  | 'terms'
  | 'privacy';

export type GameId = 'coin-rush' | 'treasure-hunt' | 'puzzle-master' | 'speed-tap';

export interface GameInfo {
  id: GameId;
  title: string;
  tagline: string;
  category: string;
  difficulty: 'Adaptive' | 'Progressive' | 'Multi-tier' | 'Reflex Sprint';
  difficultyColor: string;
  description: string;
  features: string[];
  route: PageNav;
}

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
  durationMs?: number;
}

export interface PlayerStats {
  displayName: string;
  personalBest: number;
  sessionBest: number;
  totalGamesPlayed: number;
  totalCoinsCollected: number;
  lastPlayedAt?: string;
  totalPlayTimeMs?: number;
  lastRunDurationMs?: number;
}

export interface GamePersonalBests {
  coinRush: number;
  treasureHunt: number;
  puzzleMaster: number;
  speedTap: number;
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

// ==========================================
// TOURNAMENT SYSTEM TYPES
// ==========================================

export type TournamentStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

export interface Tournament {
  id: string;
  title: string;
  description: string;
  gameId: GameId;
  startDate: string;
  endDate: string;
  prizePool: string;
  prizeDescription: string;
  rules: string;
  status: TournamentStatus;
  participantCount?: number;
  verifiedScoresCount?: number;
  createdAt?: string;
  createdBy?: string;
}

export interface TournamentRankingEntry {
  rank: number;
  playerId: string;
  playerName: string;
  walletAddress?: string | null;
  score: number;
  isVerified: boolean;
  status: 'verified' | 'pending' | 'rejected';
  achievedAt: string;
  potentialPrize?: string;
}

// ==========================================
// ADMIN DASHBOARD & SECURITY TYPES
// ==========================================

export type ScoreStatus = 'pending' | 'verified' | 'rejected';

export interface ScoreRecord {
  id: string;
  userId: string;
  playerName: string;
  gameId: GameId;
  score: number;
  coins: number;
  durationMs: number;
  sessionId: string;
  status: ScoreStatus;
  validationReason?: string;
  walletAddress?: string | null;
  createdAt: string;
  tournamentId?: string | null;
  metadata?: Record<string, unknown>;
}

export type RewardStatus = 'pending_review' | 'approved' | 'rejected' | 'prepared' | 'completed';

export interface RewardRequest {
  id: string;
  tournamentId: string;
  tournamentTitle?: string;
  userId?: string;
  playerName: string;
  walletAddress: string;
  rank: number;
  score: number;
  rewardAmount: string;
  status: RewardStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus =
  | 'queued'
  | 'simulated'
  | 'ready_for_distribution'
  | 'verified_paid'
  | 'failed'
  | 'rejected';

export interface PaymentRecord {
  id: string;
  rewardRequestId?: string;
  tournamentId?: string;
  tournamentTitle?: string;
  userId?: string;
  playerName: string;
  walletAddress: string;
  amount: string;
  tokenMint: string;
  txSignature?: string;
  status: PaymentStatus;
  isVerifiedOnChain?: boolean;
  verifiedAt?: string;
  note: string;
  createdAt: string;
}

export interface AdminOverviewStats {
  totalTournaments: number;
  activeTournaments: number;
  totalVerifiedScores: number;
  totalPendingScores: number;
  totalSuspiciousScores: number;
  totalPlayers: number;
  totalRewardRequests: number;
  totalPreparedTokens: string;
}

export interface AdminCheckResult {
  isAdmin: boolean;
  role?: 'admin' | 'superadmin';
  userId?: string;
  reason?: string;
}

// ==========================================
// SOLANA WALLET AUTHENTICATION & PLAYER PROFILES
// ==========================================

export interface PlayerProfile {
  id: string; // Stable internal UUID
  walletAddress: string; // Verified normalized Solana wallet address
  displayName: string; // Themed username (e.g. MobayCoinChaser)
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

export interface WalletAuthChallenge {
  nonce: string;
  domain: string;
  issuedAt: string;
  expiresAt: string;
  walletAddress: string;
  message: string;
}

export interface WalletAuthResult {
  success: boolean;
  token?: string;
  player?: PlayerProfile;
  error?: string;
  isFirstTime?: boolean;
}

export interface CoinLedgerEntry {
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

// ==========================================
// AUTHORITATIVE COIN TOTALS & WITHDRAWALS
// ==========================================

export interface PlayerCoinSummary {
  coinRushCoins: number;
  treasureHuntCoins: number;
  puzzleMasterCoins: number;
  speedTapCoins: number;
  totalCoinsCollected: number; // strictly equals sum of the four games
  eligibleEarnings: number;
  paidTotal: number;
  reservedAmount: number;
  availableBalance: number;
}

export type WithdrawalStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'rejected'
  | 'completed'
  | 'paid'
  | 'cancelled';

export interface WithdrawalRequest {
  id: string;
  userId?: string | null;
  playerId?: string | null;
  playerName: string;
  walletAddress: string; // Destination Solana address
  amountCoins: number;
  amountRaw: string | number;
  tokenMint: string;
  status: WithdrawalStatus;
  adminNotes?: string;
  rejectionReason?: string;
  txSignature?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPlayerBalanceItem {
  id: string;
  userId: string;
  playerName: string;
  walletAddress?: string;
  coinRushCoins: number;
  treasureHuntCoins: number;
  puzzleMasterCoins: number;
  speedTapCoins: number;
  totalCoinsCollected: number;
  eligibleEarnings: number;
  paidTotal: number;
  reservedAmount: number;
  availableBalance: number;
  lastActive?: string;
}

