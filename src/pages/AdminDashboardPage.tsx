import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  Award,
  Coins,
  Copy,
  Check,
  Lock,
  LogOut,
  ChevronRight,
  Database,
  Terminal,
  Activity,
  FileText,
  DollarSign,
  UserCheck,
  AlertCircle,
  Sliders,
  Send,
  Zap,
  Loader2,
} from 'lucide-react';
import {
  PageNav,
  Tournament,
  TournamentStatus,
  ScoreRecord,
  ScoreStatus,
  RewardRequest,
  RewardStatus,
  PaymentRecord,
  AdminOverviewStats,
  AdminCheckResult,
  GameId,
} from '../types';
import { adminService } from '../services/adminService';
import { tournamentService } from '../services/tournamentService';
import { testSupabaseConnection, getCurrentUser, supabase } from '../services/supabaseClient';
import { PINN_CONFIG } from '../config/pinnConfig';
import { AdminPortal, AdminAuthContext } from '../components/AdminPortal';

interface AdminDashboardPageProps {
  onNavigate: (page: PageNav) => void;
  onOpenAuthModal?: () => void;
}

type AdminTab =
  | 'overview'
  | 'tournaments'
  | 'scores'
  | 'suspicious'
  | 'players'
  | 'rewards'
  | 'payments'
  | 'system';

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  onNavigate,
  onOpenAuthModal,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [adminStatus, setAdminStatus] = useState<AdminCheckResult | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Statistics
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);

  // Tournaments
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isCreateTournOpen, setIsCreateTournOpen] = useState(false);
  const [selectedTournForRankings, setSelectedTournForRankings] = useState<Tournament | null>(null);
  const [tournRankings, setTournRankings] = useState<any[]>([]);

  // Tournament Prize Allocation Modal
  const [editingPrizeTourn, setEditingPrizeTourn] = useState<Tournament | null>(null);
  const [prizePoolInput, setPrizePoolInput] = useState('');
  const [prizeDescInput, setPrizeDescInput] = useState('');

  // Scores
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [scoreFilter, setScoreFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [suspiciousScores, setSuspiciousScores] = useState<ScoreRecord[]>([]);

  // Players
  const [players, setPlayers] = useState<any[]>([]);

  // Rewards & Payments
  const [rewardRequests, setRewardRequests] = useState<RewardRequest[]>([]);
  const [rewardFilter, setRewardFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'completed'>('all');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  // Payout Recording Modal (Part 3 & 4: Solana On-Chain Settlement)
  const [selectedRewardForPayout, setSelectedRewardForPayout] = useState<RewardRequest | null>(null);
  const [payoutTxSignature, setPayoutTxSignature] = useState('');
  const [payoutNote, setPayoutNote] = useState('');
  const [isSimulationDemoPayout, setIsSimulationDemoPayout] = useState(false);
  const [isVerifyingPayout, setIsVerifyingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);

  // System Health
  const [systemHealth, setSystemHealth] = useState<{
    connected: boolean;
    tableReady: boolean;
    scoresTableReady: boolean;
    edgeFunctionReady: boolean;
    message: string;
  } | null>(null);

  // Form State for New Tournament
  const [newTourn, setNewTourn] = useState<{
    title: string;
    description: string;
    gameId: GameId;
    startDate: string;
    endDate: string;
    prizePool: string;
    prizeDescription: string;
    rules: string;
    status: TournamentStatus;
  }>({
    title: '',
    description: '',
    gameId: 'coin-rush',
    startDate: new Date().toISOString().slice(0, 16),
    endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16),
    prizePool: '100,000 $PINN',
    prizeDescription: 'Top 3 verified scores: 1st: 50,000 $PINN, 2nd: 30,000 $PINN, 3rd: 20,000 $PINN.',
    rules: 'Official server verification required. Multiple runs permitted; highest verified score ranks.',
    status: 'upcoming',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [copiedMigration, setCopiedMigration] = useState(false);
  const [updatingRewardId, setUpdatingRewardId] = useState<string | null>(null);
  const [updatingRewardAction, setUpdatingRewardAction] = useState<'approved' | 'rejected' | null>(null);
  const [rewardTabError, setRewardTabError] = useState<string | null>(null);
  const [rewardTabSuccess, setRewardTabSuccess] = useState<string | null>(null);
  const [reviewingScoreId, setReviewingScoreId] = useState<string | null>(null);
  const [reviewingScoreAction, setReviewingScoreAction] = useState<ScoreStatus | null>(null);
  const [scoreTabError, setScoreTabError] = useState<string | null>(null);
  const [scoreTabSuccess, setScoreTabSuccess] = useState<string | null>(null);

  // Load Admin Data
  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    setCheckingAuth(true);
    try {
      const user = await getCurrentUser();
      setCurrentUserEmail(user?.email || null);

      const status = await adminService.checkAdminStatus();
      setAdminStatus(status);

      // Load data even in preview mode so admin features can be inspected
      await refreshAllData();
    } catch (err) {
      console.error('Error during admin auth check:', err);
    } finally {
      setCheckingAuth(false);
    }
  };

  const refreshAllData = async () => {
    try {
      const [
        tourns,
        overviewStats,
        allScores,
        suspicious,
        playerAccounts,
        rewards,
        paymentList,
        health,
      ] = await Promise.all([
        tournamentService.getTournaments(),
        adminService.getOverviewStats(),
        adminService.getAllScores(scoreFilter),
        adminService.getSuspiciousScores(),
        adminService.getPlayerAccounts(),
        adminService.getRewardRequests(),
        adminService.getPaymentHistory(),
        testSupabaseConnection(),
      ]);

      setTournaments(tourns);
      setStats(overviewStats);
      setScores(allScores);
      setSuspiciousScores(suspicious);
      setPlayers(playerAccounts);
      setRewardRequests(rewards);
      setPayments(paymentList);
      setSystemHealth(health);
    } catch (err) {
      console.error('Error refreshing admin dashboard data:', err);
    }
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newTourn.title.trim()) {
      setFormError('Tournament title is required.');
      return;
    }

    const res = await tournamentService.createTournament({
      title: newTourn.title.trim(),
      description: newTourn.description.trim(),
      gameId: newTourn.gameId,
      startDate: new Date(newTourn.startDate).toISOString(),
      endDate: new Date(newTourn.endDate).toISOString(),
      prizePool: newTourn.prizePool.trim(),
      prizeDescription: newTourn.prizeDescription.trim(),
      rules: newTourn.rules.trim(),
      status: newTourn.status,
    });

    if (res.success) {
      setActionSuccess(`Tournament "${newTourn.title}" created successfully!`);
      setIsCreateTournOpen(false);
      await refreshAllData();
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setFormError(res.error || 'Failed to create tournament.');
    }
  };

  const handleUpdateTournamentStatus = async (id: string, status: TournamentStatus) => {
    const res = await tournamentService.updateTournamentStatus(id, status);
    if (res.success) {
      setActionSuccess(`Tournament status updated to ${status}.`);
      await refreshAllData();
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleViewTournamentRankings = async (t: Tournament) => {
    setSelectedTournForRankings(t);
    const eligibleWinners = await adminService.determineEligibleWinners(t.id);
    setTournRankings(eligibleWinners);
  };

  const handleOpenPrizeModal = (t: Tournament) => {
    setEditingPrizeTourn(t);
    setPrizePoolInput(t.prizePool);
    setPrizeDescInput(t.prizeDescription);
  };

  const handleSavePrizeAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrizeTourn) return;

    const res = await adminService.setTournamentPrizeAllocation(
      editingPrizeTourn.id,
      prizePoolInput,
      prizeDescInput
    );

    if (res.success) {
      setActionSuccess(`Prize allocation updated for ${editingPrizeTourn.title}!`);
      setEditingPrizeTourn(null);
      await refreshAllData();
      setTimeout(() => setActionSuccess(null), 3000);
    } else {
      setFormError(res.error || 'Failed to update prize allocation');
    }
  };

  const handleReviewScore = async (
    scoreId: string,
    newStatus: ScoreStatus,
    reason: string,
    scoreRecord?: ScoreRecord
  ) => {
    // Duplicate submission prevention
    if (reviewingScoreId) return;

    setReviewingScoreId(scoreId);
    setReviewingScoreAction(newStatus);
    setScoreTabError(null);
    setScoreTabSuccess(null);

    try {
      const res = await adminService.reviewScore(scoreId, newStatus, reason, scoreRecord);
      if (res.success) {
        const actionLabel =
          newStatus === 'verified'
            ? 'accepted and verified'
            : newStatus === 'rejected'
            ? 'flagged and rejected'
            : 're-queued';

        setScoreTabSuccess(`Score successfully ${actionLabel}!`);
        setActionSuccess(`Score ${scoreId} updated to ${newStatus}.`);

        // Immediate optimistic UI update for instant feedback
        setScores((prev) =>
          prev.map((s) =>
            s.id === scoreId
              ? { ...s, status: newStatus, validationReason: reason }
              : s
          )
        );

        // Refresh authoritative list
        await refreshAllData();

        setTimeout(() => {
          setScoreTabSuccess(null);
          setActionSuccess(null);
        }, 4000);
      } else {
        setScoreTabError(res.error || `Failed to update score status to ${newStatus}.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setScoreTabError(`Failed to update score status: ${msg}`);
    } finally {
      setReviewingScoreId(null);
      setReviewingScoreAction(null);
    }
  };

  const handlePrepareRewardForWinner = async (entry: any, tournament: Tournament) => {
    const res = await adminService.prepareReward({
      tournamentId: tournament.id,
      tournamentTitle: tournament.title,
      userId: entry.userId,
      playerName: entry.playerName,
      walletAddress: entry.walletAddress || 'Pending-Wallet-Connection',
      rank: entry.rank,
      score: entry.score,
      rewardAmount: entry.suggestedPrize || '50,000 $PINN',
      adminNotes: `Prepared for ${tournament.title} Rank #${entry.rank}. Verified score confirmed.`,
    });

    if (res.success) {
      setActionSuccess(`Reward request prepared for ${entry.playerName}!`);
      await refreshAllData();
      // Reload rankings drawer to update duplicate check
      const updatedWinners = await adminService.determineEligibleWinners(tournament.id);
      setTournRankings(updatedWinners);
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setFormError(res.error || 'Failed to prepare reward.');
      setTimeout(() => setFormError(null), 5000);
    }
  };

  const handleUpdateRewardStatus = async (rewardId: string, status: RewardStatus, notes?: string) => {
    // Duplicate submission prevention
    if (updatingRewardId) return;

    setUpdatingRewardId(rewardId);
    setUpdatingRewardAction(status === 'approved' ? 'approved' : 'rejected');
    setFormError(null);
    setActionSuccess(null);
    setRewardTabError(null);
    setRewardTabSuccess(null);

    try {
      const res = await adminService.updateRewardStatus(rewardId, status, notes);
      if (res.success) {
        const successMessage = `Reward request #${rewardId.slice(0, 8)} status successfully updated to ${status}.`;
        setActionSuccess(successMessage);
        setRewardTabSuccess(successMessage);
        // Refresh reward list after successful database confirmation
        await refreshAllData();
        setTimeout(() => {
          setActionSuccess(null);
          setRewardTabSuccess(null);
        }, 5000);
      } else {
        const errorMsg = res.error || `Failed to update reward status to ${status}.`;
        setFormError(errorMsg);
        setRewardTabError(errorMsg);
        setTimeout(() => {
          setFormError(null);
          setRewardTabError(null);
        }, 7000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const errorMsg = `Error updating reward status: ${msg}`;
      setFormError(errorMsg);
      setRewardTabError(errorMsg);
      setTimeout(() => {
        setFormError(null);
        setRewardTabError(null);
      }, 7000);
    } finally {
      // Always restore button state in finally block
      setUpdatingRewardId(null);
      setUpdatingRewardAction(null);
    }
  };

  const handleOpenPayoutModal = (reward: RewardRequest) => {
    setSelectedRewardForPayout(reward);
    setPayoutTxSignature('');
    setPayoutNote(`Disbursed for ${reward.tournamentTitle || reward.tournamentId} rank #${reward.rank}`);
    setPayoutError(null);
    setPayoutSuccess(null);
    setIsSimulationDemoPayout(false);
  };

  const handleExecutePayoutRecording = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRewardForPayout) return;

    const cleanSig = payoutTxSignature.trim();
    if (!cleanSig) {
      setPayoutError('Please provide a Solana transaction signature.');
      return;
    }

    setIsVerifyingPayout(true);
    setPayoutError(null);
    setPayoutSuccess(null);

    try {
      const res = await adminService.recordCompletedPayout({
        rewardRequestId: selectedRewardForPayout.id,
        txSignature: cleanSig,
        note: payoutNote,
        isSimulationDemo: isSimulationDemoPayout,
      });

      if (res.success) {
        setPayoutSuccess(
          `Payout confirmed! On-chain verification succeeded for ${selectedRewardForPayout.playerName}.`
        );
        await refreshAllData();
        setTimeout(() => {
          setSelectedRewardForPayout(null);
          setPayoutSuccess(null);
        }, 2500);
      } else {
        setPayoutError(res.error || 'Solana on-chain verification failed.');
      }
    } catch (err: any) {
      setPayoutError(err.message || 'Payment execution error.');
    } finally {
      setIsVerifyingPayout(false);
    }
  };

  const handleFilterScores = async (f: 'all' | 'pending' | 'verified' | 'rejected') => {
    setScoreFilter(f);
    const data = await adminService.getAllScores(f);
    setScores(data);
  };

  const copyMigrationSql = () => {
    const sql = `-- Run in Supabase SQL Editor:
-- PINN Arcade: Tournaments & RBAC Admin Schema Migration (20261011_tournaments_and_admin.sql)
-- 1. Ensure public.scores exists with tournament foreign key
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid,
  player_name text not null default 'Anonymous Player',
  game_id text not null check (game_id in ('coin-rush', 'treasure-hunt', 'puzzle-master', 'speed-tap')),
  score integer not null check (score >= 0),
  coins integer not null default 0 check (coins >= 0),
  wallet_address text,
  session_id text not null,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  validation_reason text,
  metadata jsonb default '{}'::jsonb,
  tournament_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  game_id text not null,
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  prize_pool text not null default '100,000 $PINN',
  prize_description text not null default '',
  rules text not null default 'Only verified server scores count.',
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'completed', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.reward_requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid references auth.users(id),
  player_name text not null,
  wallet_address text not null,
  rank integer not null check (rank >= 1 and rank <= 100),
  score integer not null check (score >= 0),
  reward_amount text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'prepared', 'completed')),
  admin_notes text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint uq_tourn_rank unique (tournament_id, rank)
);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  reward_request_id uuid references public.reward_requests(id),
  tournament_id uuid references public.tournaments(id),
  user_id uuid references auth.users(id),
  player_name text not null,
  wallet_address text not null,
  amount text not null,
  token_mint text not null default '6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump',
  tx_signature text unique,
  status text not null default 'queued' check (status in ('queued', 'simulated', 'submitted', 'confirmed', 'verified_paid', 'failed', 'rejected')),
  is_verified_on_chain boolean default false,
  verified_at timestamp with time zone,
  error_message text,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  role text not null default 'admin' check (role in ('admin', 'superadmin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create or replace function public.is_admin() returns boolean language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from public.admin_roles where user_id = auth.uid());
$$;

create or replace function public.check_is_admin() returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return jsonb_build_object('isAdmin', public.is_admin(), 'userId', auth.uid());
end;
$$;`;
    navigator.clipboard.writeText(sql);
    setCopiedMigration(true);
    setTimeout(() => setCopiedMigration(false), 3000);
  };

  return (
    <AdminPortal onOpenAuthModal={onOpenAuthModal} onNavigate={onNavigate}>
      {(adminContext: AdminAuthContext) => (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
          {/* Top Header & Breadcrumb */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-gold-subtle/30">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-gold-subtle/50 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Server-Verified Administrator Portal</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white font-serif uppercase tracking-tight">
                ADMIN DASHBOARD
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Tournament operations, anti-cheat score review, and on-chain $PINN reward management.
              </p>
            </div>

            {/* Admin Identity Status Pill */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-bold shadow-lg shadow-emerald-950/50 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Admin Verified: {adminContext.email || currentUserEmail || adminContext.userId.slice(0, 8)}</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] uppercase font-mono tracking-wider ml-1">
                  {adminContext.role}
                </span>
              </div>

              <button
                onClick={refreshAllData}
                title="Refresh All Data"
                className="p-2.5 rounded-xl bg-zinc-900 border border-gold-subtle/30 text-zinc-300 hover:text-amber-400 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {formError && (
        <div className="mb-6 p-4 rounded-2xl bg-red-950/40 border border-red-500/50 text-red-300 text-xs font-bold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>{formError}</span>
          </div>
          <button onClick={() => setFormError(null)} className="cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Section Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-zinc-800 pb-4">
        {[
          { id: 'overview', label: 'Overview & Stats', icon: Activity },
          { id: 'tournaments', label: 'Tournaments', icon: Trophy, count: tournaments.length },
          { id: 'scores', label: 'Score Moderation', icon: ShieldCheck, count: scores.length },
          { id: 'suspicious', label: 'Suspicious Telemetry', icon: AlertTriangle, count: suspiciousScores.length },
          { id: 'players', label: 'Player Accounts', icon: Users, count: players.length },
          { id: 'rewards', label: 'Reward Requests', icon: Award, count: rewardRequests.length },
          { id: 'payments', label: 'Payment History', icon: DollarSign, count: payments.length },
          { id: 'system', label: 'System Diagnostics', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isActive
                  ? 'bg-gold-gradient text-black shadow-lg shadow-amber-500/10'
                  : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-black text-amber-300' : 'bg-zinc-900 text-zinc-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & STATS */}
      {activeTab === 'overview' && stats && (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-zinc-950 border border-gold-subtle/30 shadow-lg">
              <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
                Total Tournaments
              </div>
              <div className="text-3xl font-black text-white mt-1 font-mono-arcade">
                {stats.totalTournaments}
              </div>
              <div className="text-[11px] text-emerald-400 mt-1 font-semibold">
                {stats.activeTournaments} Active Now
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950 border border-gold-subtle/30 shadow-lg">
              <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
                Verified Scores
              </div>
              <div className="text-3xl font-black text-amber-300 mt-1 font-mono-arcade">
                {stats.totalVerifiedScores}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1 font-semibold">
                {stats.totalPendingScores} Pending Review
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950 border border-gold-subtle/30 shadow-lg">
              <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
                Flagged Anti-Cheat
              </div>
              <div className="text-3xl font-black text-red-400 mt-1 font-mono-arcade">
                {stats.totalSuspiciousScores}
              </div>
              <div className="text-[11px] text-red-400/80 mt-1 font-semibold">
                Auto-Disqualified
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-950 border border-gold-subtle/30 shadow-lg">
              <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
                Reward Allocations
              </div>
              <div className="text-3xl font-black text-gold-gradient mt-1 font-serif">
                {rewardRequests.length}
              </div>
              <div className="text-[11px] text-amber-400 mt-1 font-semibold">
                {payments.filter((p) => p.status === 'verified_paid').length} Settled On-Chain
              </div>
            </div>
          </div>

          {/* Quick Actions & System Banner */}
          <div className="p-6 rounded-3xl bg-zinc-950 border border-gold-glow shadow-2xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white uppercase font-serif tracking-tight">
                Quick Tournament Administration
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Launch seasonal tournament windows, enforce server anti-cheat, or disburse $PINN prizes.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setActiveTab('tournaments');
                  setIsCreateTournOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow-md hover:scale-105 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Tournament</span>
              </button>
              <button
                onClick={() => setActiveTab('rewards')}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-gold-subtle/40 text-amber-300 font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Award className="w-4 h-4" />
                <span>Review Rewards</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TOURNAMENTS */}
      {activeTab === 'tournaments' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white uppercase font-serif tracking-tight">
                TOURNAMENT MANAGEMENT
              </h2>
              <p className="text-xs text-zinc-400">
                Manage arcade tournaments connected to Supabase public.tournaments.
              </p>
            </div>
            <button
              onClick={() => setIsCreateTournOpen(!isCreateTournOpen)}
              className="px-4 py-2 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow hover:scale-105 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreateTournOpen ? 'Close Form' : 'New Tournament'}</span>
            </button>
          </div>

          {/* Create Tournament Form */}
          {isCreateTournOpen && (
            <div className="p-6 rounded-3xl bg-zinc-950 border border-gold-glow shadow-2xl">
              <h3 className="text-base font-bold text-white uppercase font-serif tracking-tight mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>Create New Arcade Tournament</span>
              </h3>
              <form onSubmit={handleCreateTournament} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 uppercase font-semibold mb-1">
                    Tournament Title
                  </label>
                  <input
                    type="text"
                    value={newTourn.title}
                    onChange={(e) => setNewTourn({ ...newTourn, title: e.target.value })}
                    placeholder="e.g. Montego Bay Sprint: Season 1 Open"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 uppercase font-semibold mb-1">
                    Select Arcade Game
                  </label>
                  <select
                    value={newTourn.gameId}
                    onChange={(e) => setNewTourn({ ...newTourn, gameId: e.target.value as GameId })}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-400"
                  >
                    <option value="coin-rush">PINN Coin Rush (Endless Runner)</option>
                    <option value="treasure-hunt">PINN Treasure Hunt (Tile Grid)</option>
                    <option value="puzzle-master">PINN Puzzle Master (Trivia & Word)</option>
                    <option value="speed-tap">PINN Speed Tap (Reflex Sprint)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 uppercase font-semibold mb-1">
                    Start Date & Time (UTC)
                  </label>
                  <input
                    type="datetime-local"
                    value={newTourn.startDate}
                    onChange={(e) => setNewTourn({ ...newTourn, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 uppercase font-semibold mb-1">
                    End Date & Time (UTC)
                  </label>
                  <input
                    type="datetime-local"
                    value={newTourn.endDate}
                    onChange={(e) => setNewTourn({ ...newTourn, endDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 uppercase font-semibold mb-1">
                    Prize Pool
                  </label>
                  <input
                    type="text"
                    value={newTourn.prizePool}
                    onChange={(e) => setNewTourn({ ...newTourn, prizePool: e.target.value })}
                    placeholder="100,000 $PINN"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 uppercase font-semibold mb-1">
                    Initial Status
                  </label>
                  <select
                    value={newTourn.status}
                    onChange={(e) => setNewTourn({ ...newTourn, status: e.target.value as TournamentStatus })}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-400"
                  >
                    <option value="upcoming">Upcoming (Scheduled)</option>
                    <option value="active">Active (Playable now)</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs text-zinc-400 uppercase font-semibold mb-1">
                    Prize Breakdown & Rules
                  </label>
                  <input
                    type="text"
                    value={newTourn.prizeDescription}
                    onChange={(e) => setNewTourn({ ...newTourn, prizeDescription: e.target.value })}
                    placeholder="1st: 50,000 $PINN, 2nd: 30,000 $PINN, 3rd: 20,000 $PINN"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateTournOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-gold-gradient text-black text-xs font-extrabold uppercase tracking-wider shadow-lg hover:scale-105 transition-all cursor-pointer"
                  >
                    Create Tournament
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tournaments List Table */}
          <div className="p-6 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-3">Tournament</th>
                  <th className="py-3 px-3">Game</th>
                  <th className="py-3 px-3">Dates</th>
                  <th className="py-3 px-3">Prize Pool</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {tournaments.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-900/40">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{t.title}</div>
                      <div className="text-[11px] text-zinc-500 line-clamp-1">{t.description}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-900 border border-gold-subtle/30 text-amber-300 font-mono-arcade">
                        {t.gameId}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-300 text-xs">
                      <div>{new Date(t.startDate).toLocaleDateString()}</div>
                      <div className="text-[10px] text-zinc-500">
                        to {new Date(t.endDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-gold-gradient font-serif">
                      {t.prizePool}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          t.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : t.status === 'upcoming'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewTournamentRankings(t)}
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-gold-subtle/30 text-amber-400 text-xs font-bold cursor-pointer"
                        >
                          Winners & Rankings
                        </button>
                        <button
                          onClick={() => handleOpenPrizeModal(t)}
                          title="Set published prize allocation"
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
                        >
                          Set Prizes
                        </button>
                        {t.status !== 'active' && (
                          <button
                            onClick={() => handleUpdateTournamentStatus(t.id, 'active')}
                            title="Activate tournament"
                            className="px-2 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer"
                          >
                            Activate
                          </button>
                        )}
                        {t.status === 'active' && (
                          <button
                            onClick={() => handleUpdateTournamentStatus(t.id, 'completed')}
                            title="Complete tournament"
                            className="px-2 py-1 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/40 text-blue-300 text-xs font-bold cursor-pointer"
                          >
                            Complete
                          </button>
                        )}
                        {t.status !== 'cancelled' && (
                          <button
                            onClick={() => handleUpdateTournamentStatus(t.id, 'cancelled')}
                            title="Cancel tournament"
                            className="px-2 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-500/40 text-red-400 text-xs font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Drilldown: Potential Winners & Prepare Rewards */}
          {selectedTournForRankings && (
            <div className="p-6 rounded-3xl bg-zinc-950 border border-amber-500/40 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white uppercase font-serif tracking-tight flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <span>
                      Eligible Winners: {selectedTournForRankings.title}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Determined strictly from verified scores. Duplicate claims are prevented.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTournForRankings(null)}
                  className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              {tournRankings.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-xs">
                  No verified scores yet for this tournament bracket.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[11px]">
                        <th className="py-2.5 px-3">Rank</th>
                        <th className="py-2.5 px-3">Player Name</th>
                        <th className="py-2.5 px-3">Wallet Address</th>
                        <th className="py-2.5 px-3">Verified Score</th>
                        <th className="py-2.5 px-3">Prize Allocation</th>
                        <th className="py-2.5 px-3">Claim Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {tournRankings.map((entry) => (
                        <tr key={entry.rank} className="hover:bg-zinc-900/40">
                          <td className="py-2.5 px-3 font-bold text-amber-400">
                            #{entry.rank}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-white">
                            {entry.playerName}
                          </td>
                          <td className="py-2.5 px-3 font-mono-arcade text-zinc-400 text-xs">
                            {entry.walletAddress || 'No wallet linked'}
                          </td>
                          <td className="py-2.5 px-3 font-mono-arcade font-bold text-amber-300">
                            {entry.score.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-gold-gradient font-serif">
                            {entry.suggestedPrize}
                          </td>
                          <td className="py-2.5 px-3">
                            {entry.isDuplicateClaim ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40">
                                {entry.existingReward?.status || 'Recorded'}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                Eligible
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {entry.isDuplicateClaim ? (
                              <span className="text-xs text-zinc-500 font-semibold">
                                Claim Queued
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  handlePrepareRewardForWinner(entry, selectedTournForRankings)
                                }
                                className="px-3 py-1.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow-sm hover:scale-105 transition-all cursor-pointer"
                              >
                                Prepare Reward
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCORE REVIEW */}
      {activeTab === 'scores' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white uppercase font-serif tracking-tight">
                SCORE MODERATION & REVIEW
              </h2>
              <p className="text-xs text-zinc-400">
                Inspect player score submissions, review session duration, and toggle verification status.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-gold-subtle/30">
              {(['all', 'pending', 'verified', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => handleFilterScores(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                    scoreFilter === f
                      ? 'bg-amber-400 text-black shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Tab-Level Status Banners */}
          {scoreTabSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 text-xs font-bold flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{scoreTabSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setScoreTabSuccess(null)}
                className="cursor-pointer text-emerald-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {scoreTabError && (
            <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/60 text-red-300 text-xs font-bold flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{scoreTabError}</span>
              </div>
              <button
                type="button"
                onClick={() => setScoreTabError(null)}
                className="cursor-pointer text-red-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          <div className="p-6 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-3">Player / ID</th>
                  <th className="py-3 px-3">Game</th>
                  <th className="py-3 px-3">Score & Coins</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-3">Session ID</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Validation Reason</th>
                  <th className="py-3 px-3 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {scores.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-500 text-xs">
                      No scores found matching the &quot;{scoreFilter}&quot; filter.
                    </td>
                  </tr>
                ) : (
                  scores.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-900/40">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{s.playerName}</div>
                        <div className="text-[10px] text-zinc-500 font-mono-arcade">{s.userId}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono-arcade">
                          {s.gameId}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono-arcade font-bold text-amber-300">
                          {s.score.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-zinc-500">{s.coins} coins</div>
                      </td>
                      <td className="py-3 px-3 text-zinc-300 text-xs">
                        {(s.durationMs / 1000).toFixed(1)}s
                      </td>
                      <td className="py-3 px-3 font-mono text-[10px] text-zinc-500 max-w-[120px] truncate">
                        {s.sessionId}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            s.status === 'verified'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : s.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-zinc-400 max-w-xs truncate">
                        {s.validationReason || 'Standard run.'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {s.status !== 'verified' && (
                            <button
                              type="button"
                              disabled={Boolean(reviewingScoreId)}
                              onClick={() =>
                                handleReviewScore(
                                  s.id,
                                  'verified',
                                  'Manually approved by administrator referee.',
                                  s
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
                                reviewingScoreId === s.id && reviewingScoreAction === 'verified'
                                  ? 'bg-emerald-900/80 border-emerald-400 text-white cursor-wait opacity-90'
                                  : reviewingScoreId
                                  ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-600/40 cursor-not-allowed opacity-50'
                                  : 'bg-emerald-950/50 hover:bg-emerald-900/60 border-emerald-500/40 text-emerald-300 hover:text-white cursor-pointer active:scale-95'
                              }`}
                              title="Accept and verify player score"
                            >
                              {reviewingScoreId === s.id && reviewingScoreAction === 'verified' ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                                  <span>Accepting...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Accept</span>
                                </>
                              )}
                            </button>
                          )}
                          {s.status !== 'rejected' && (
                            <button
                              type="button"
                              disabled={Boolean(reviewingScoreId)}
                              onClick={() =>
                                handleReviewScore(
                                  s.id,
                                  'rejected',
                                  'Referee flagged: Disqualified due to anomalous trajectory.',
                                  s
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
                                reviewingScoreId === s.id && reviewingScoreAction === 'rejected'
                                  ? 'bg-red-900/80 border-red-400 text-white cursor-wait opacity-90'
                                  : reviewingScoreId
                                  ? 'bg-red-950/20 border-red-500/20 text-red-600/40 cursor-not-allowed opacity-50'
                                  : 'bg-red-950/50 hover:bg-red-900/60 border-red-500/40 text-red-400 hover:text-white cursor-pointer active:scale-95'
                              }`}
                              title="Flag and reject score submission"
                            >
                              {reviewingScoreId === s.id && reviewingScoreAction === 'rejected' ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-red-300" />
                                  <span>Rejecting...</span>
                                </>
                              ) : (
                                <span>Reject</span>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SUSPICIOUS ANTI-CHEAT TELEMETRY */}
      {activeTab === 'suspicious' && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-white uppercase font-serif tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>SUSPICIOUS SCORE TELEMETRY</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Flags generated by server-side anti-cheat heuristics (replay attacks, impossible reflex PPS, physics teleportation).
            </p>
          </div>

          {/* Tab-Level Status Banners */}
          {scoreTabSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 text-xs font-bold flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{scoreTabSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setScoreTabSuccess(null)}
                className="cursor-pointer text-emerald-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {scoreTabError && (
            <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/60 text-red-300 text-xs font-bold flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{scoreTabError}</span>
              </div>
              <button
                type="button"
                onClick={() => setScoreTabError(null)}
                className="cursor-pointer text-red-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {suspiciousScores.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs bg-zinc-950 rounded-2xl border border-zinc-900">
                No suspicious score telemetry flagged by server anti-cheat.
              </div>
            ) : (
              suspiciousScores.map((s) => (
                <div
                  key={s.id}
                  className="p-5 rounded-2xl bg-zinc-950 border border-red-500/40 shadow-xl flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-red-400 font-bold text-sm">{s.playerName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-red-950/60 border border-red-500/50 text-red-300 font-mono">
                        {s.gameId}
                      </span>
                      <span className="text-xs text-zinc-500">
                        Score: <strong className="text-amber-300">{s.score.toLocaleString()}</strong> in{' '}
                        {(s.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="text-xs text-red-300/90 font-mono">
                      {s.validationReason || 'Heuristic violation triggered.'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={Boolean(reviewingScoreId)}
                      onClick={() =>
                        handleReviewScore(
                          s.id,
                          'verified',
                          'Cleared after manual telemetry review: verified authentic run.',
                          s
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                        reviewingScoreId === s.id && reviewingScoreAction === 'verified'
                          ? 'bg-emerald-900/80 border-emerald-400 text-white cursor-wait opacity-90'
                          : reviewingScoreId
                          ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-600/40 cursor-not-allowed opacity-50'
                          : 'bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-500/50 text-emerald-300 cursor-pointer'
                      }`}
                    >
                      {reviewingScoreId === s.id && reviewingScoreAction === 'verified' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                          <span>Accepting...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Accept / Clear</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(reviewingScoreId)}
                      onClick={() =>
                        handleReviewScore(
                          s.id,
                          'rejected',
                          'Confirmed anti-cheat infraction: Permanently disqualified.',
                          s
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                        reviewingScoreId === s.id && reviewingScoreAction === 'rejected'
                          ? 'bg-red-900/80 border-red-400 text-white cursor-wait opacity-90'
                          : reviewingScoreId
                          ? 'bg-red-950/20 border-red-500/20 text-red-600/40 cursor-not-allowed opacity-50'
                          : 'bg-red-900/60 hover:bg-red-800 border-red-500/50 text-red-200 cursor-pointer'
                      }`}
                    >
                      {reviewingScoreId === s.id && reviewingScoreAction === 'rejected' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-300" />
                          <span>Rejecting...</span>
                        </>
                      ) : (
                        <span>Confirm Rejection</span>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(reviewingScoreId)}
                      onClick={() =>
                        handleReviewScore(
                          s.id,
                          'pending',
                          'Re-queued for manual telemetry inspection.',
                          s
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                        reviewingScoreId === s.id && reviewingScoreAction === 'pending'
                          ? 'opacity-80 cursor-wait'
                          : reviewingScoreId
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}
                    >
                      {reviewingScoreId === s.id && reviewingScoreAction === 'pending' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-300" />
                          <span>Re-queueing...</span>
                        </>
                      ) : (
                        <span>Re-queue</span>
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: PLAYER ACCOUNTS */}
      {activeTab === 'players' && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-white uppercase font-serif tracking-tight">
              PLAYER ACCOUNTS & ACTIVITY
            </h2>
            <p className="text-xs text-zinc-400">
              Unique player profiles derived from authenticated sessions and submissions.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-3">Player Name</th>
                  <th className="py-3 px-3">Wallet Address</th>
                  <th className="py-3 px-3">Games Played</th>
                  <th className="py-3 px-3">Personal Best</th>
                  <th className="py-3 px-3">Verified Runs</th>
                  <th className="py-3 px-3">Flagged Runs</th>
                  <th className="py-3 px-3 text-right">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {players.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-900/40">
                    <td className="py-3 px-3 font-bold text-white">{p.displayName}</td>
                    <td className="py-3 px-3 font-mono-arcade text-zinc-400 text-xs">
                      {p.walletAddress || 'Unlinked'}
                    </td>
                    <td className="py-3 px-3 text-zinc-300">{p.totalGamesPlayed}</td>
                    <td className="py-3 px-3 font-mono-arcade font-bold text-amber-300">
                      {p.bestScore.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-emerald-400 font-bold">
                      {p.verifiedScoresCount}
                    </td>
                    <td className="py-3 px-3">
                      {p.flaggedCount > 0 ? (
                        <span className="text-red-400 font-bold">{p.flaggedCount} flag(s)</span>
                      ) : (
                        <span className="text-zinc-500">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-400 text-xs">
                      {new Date(p.lastActive).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: REWARD REQUESTS & MANAGEMENT */}
      {activeTab === 'rewards' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white uppercase font-serif tracking-tight flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <span>$PINN REWARD MANAGEMENT & SETTLEMENT</span>
              </h2>
              <p className="text-xs text-zinc-400">
                Review podium allocations, approve claims, and record on-chain Solana token disbursements.
              </p>
            </div>

            <div className="px-4 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-bold">
              Official Token Mint: {PINN_CONFIG.TOKEN_MINT_ADDRESS.slice(0, 8)}...
            </div>
          </div>

          {/* Tab-Level Status Banners */}
          {rewardTabSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 text-xs font-bold flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{rewardTabSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setRewardTabSuccess(null)}
                className="cursor-pointer text-emerald-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {rewardTabError && (
            <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/60 text-red-300 text-xs font-bold flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{rewardTabError}</span>
              </div>
              <button
                type="button"
                onClick={() => setRewardTabError(null)}
                className="cursor-pointer text-red-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* Status Filter Tabs / Section Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-950 border border-gold-subtle/30 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Filter by Status:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-black/60 border border-zinc-800 rounded-xl">
              {[
                { id: 'all', label: 'All Requests', count: rewardRequests.length },
                {
                  id: 'pending',
                  label: 'Pending Review',
                  count: rewardRequests.filter((r) => r.status === 'pending_review' || r.status === 'prepared').length,
                },
                {
                  id: 'approved',
                  label: 'Approved',
                  count: rewardRequests.filter((r) => r.status === 'approved').length,
                },
                {
                  id: 'rejected',
                  label: 'Rejected',
                  count: rewardRequests.filter((r) => r.status === 'rejected').length,
                },
                {
                  id: 'completed',
                  label: 'Completed / Paid',
                  count: rewardRequests.filter((r) => r.status === 'completed').length,
                },
              ].map((tab) => {
                const isActive = rewardFilter === tab.id;
                const isRejectedTab = tab.id === 'rejected';
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRewardFilter(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                      isActive
                        ? isRejectedTab
                          ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                          : 'bg-gold-gradient text-black shadow-md shadow-amber-500/20'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive
                          ? isRejectedTab
                            ? 'bg-red-950 text-red-200'
                            : 'bg-black text-amber-300'
                          : 'bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-3">Recipient</th>
                  <th className="py-3 px-3">Tournament</th>
                  <th className="py-3 px-3">Rank / Score</th>
                  <th className="py-3 px-3">Reward Amount</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Admin Notes</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {(() => {
                  const filtered = rewardRequests.filter((r) => {
                    if (rewardFilter === 'all') return true;
                    if (rewardFilter === 'pending') return r.status === 'pending_review' || r.status === 'prepared';
                    return r.status === rewardFilter;
                  });

                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center gap-2">
                            {rewardFilter === 'rejected' ? (
                              <>
                                <XCircle className="w-8 h-8 text-zinc-600 mb-1" />
                                <div className="text-sm font-bold text-white uppercase tracking-wider">
                                  No Rejected Reward Requests
                                </div>
                                <p className="text-xs text-zinc-400 max-w-sm">
                                  Reward requests rejected by tournament administrators will appear in this section with review notes.
                                </p>
                              </>
                            ) : rewardFilter === 'approved' ? (
                              <>
                                <CheckCircle2 className="w-8 h-8 text-blue-500/60 mb-1" />
                                <div className="text-sm font-bold text-white uppercase tracking-wider">
                                  No Approved Requests Awaiting Payout
                                </div>
                                <p className="text-xs text-zinc-400 max-w-sm">
                                  Approve pending tournament requests to queue them for Solana disbursement.
                                </p>
                              </>
                            ) : rewardFilter === 'completed' ? (
                              <>
                                <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mb-1" />
                                <div className="text-sm font-bold text-white uppercase tracking-wider">
                                  No Completed Disbursements
                                </div>
                                <p className="text-xs text-zinc-400 max-w-sm">
                                  Disbursements verified on the Solana blockchain will be listed here.
                                </p>
                              </>
                            ) : (
                              <>
                                <Award className="w-8 h-8 text-zinc-600 mb-1" />
                                <div className="text-sm font-bold text-white uppercase tracking-wider">
                                  No Reward Requests Found
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-900/40">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{r.playerName}</div>
                        <div className="text-[10px] text-zinc-500 font-mono-arcade">
                          {r.walletAddress}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-zinc-300 text-xs">{r.tournamentTitle || r.tournamentId}</td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-amber-400">#{r.rank}</span>
                        <span className="text-xs text-zinc-500 ml-1.5 font-mono-arcade">
                          ({r.score.toLocaleString()})
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-gold-gradient font-serif">
                        {r.rewardAmount}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            r.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : r.status === 'approved'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                              : r.status === 'prepared' || r.status === 'pending_review'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-red-500/20 text-red-400 border border-red-500/40'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-zinc-400 max-w-xs truncate">
                        {r.adminNotes || 'Ready for review.'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status !== 'completed' && r.status !== 'rejected' && (
                            <button
                              type="button"
                              disabled={Boolean(updatingRewardId)}
                              onClick={() => handleOpenPayoutModal(r)}
                              className={`px-2.5 py-1 rounded-lg bg-gold-gradient text-black text-xs font-extrabold uppercase tracking-wider shadow transition-all ${
                                updatingRewardId
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:scale-105 cursor-pointer'
                              }`}
                            >
                              Record Payout
                            </button>
                          )}
                          {r.status !== 'approved' && r.status !== 'completed' && (
                            <button
                              type="button"
                              disabled={Boolean(updatingRewardId)}
                              onClick={() =>
                                handleUpdateRewardStatus(
                                  r.id,
                                  'approved',
                                  'Approved for upcoming Solana distribution.'
                                )
                              }
                              className={`px-2 py-1 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
                                updatingRewardId === r.id && updatingRewardAction === 'approved'
                                  ? 'bg-emerald-900/80 border-emerald-400 text-white cursor-wait opacity-90'
                                  : updatingRewardId
                                  ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-600/40 cursor-not-allowed opacity-50'
                                  : 'bg-emerald-950/50 hover:bg-emerald-900/60 border-emerald-500/40 text-emerald-300 hover:text-white cursor-pointer active:scale-95'
                              }`}
                              title="Approve reward request for distribution"
                            >
                              {updatingRewardId === r.id && updatingRewardAction === 'approved' ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                                  <span>Approving...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Approve</span>
                                </>
                              )}
                            </button>
                          )}
                          {r.status !== 'rejected' && r.status !== 'completed' && (
                            <button
                              type="button"
                              disabled={Boolean(updatingRewardId)}
                              onClick={() =>
                                handleUpdateRewardStatus(
                                  r.id,
                                  'rejected',
                                  'Rejected by tournament committee.'
                                )
                              }
                              className={`px-2 py-1 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
                                updatingRewardId === r.id && updatingRewardAction === 'rejected'
                                  ? 'bg-red-900/80 border-red-400 text-white cursor-wait opacity-90'
                                  : updatingRewardId
                                  ? 'bg-red-950/20 border-red-500/20 text-red-600/40 cursor-not-allowed opacity-50'
                                  : 'bg-red-950/50 hover:bg-red-900/60 border-red-500/40 text-red-400 hover:text-white cursor-pointer active:scale-95'
                              }`}
                              title="Reject reward request"
                            >
                              {updatingRewardId === r.id && updatingRewardAction === 'rejected' ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-red-300" />
                                  <span>Rejecting...</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                                  <span>Reject</span>
                                </>
                              )}
                            </button>
                          )}
                          {r.status === 'rejected' && (
                            <span className="text-[11px] font-bold text-red-400/80 px-2 py-0.5 rounded bg-red-950/30 border border-red-900/40">
                              Disqualified
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: PAYMENT HISTORY & SOLANA AUDIT LEDGER */}
      {activeTab === 'payments' && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-white uppercase font-serif tracking-tight flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <span>PAYMENT HISTORY & ON-CHAIN AUDIT LEDGER</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Immutable ledger of verified Solana transactions and queued disbursements for tournament participants.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-3">Payment ID</th>
                  <th className="py-3 px-3">Player Name</th>
                  <th className="py-3 px-3">Destination Wallet</th>
                  <th className="py-3 px-3">Allocation</th>
                  <th className="py-3 px-3">Token Mint</th>
                  <th className="py-3 px-3">On-Chain Proof</th>
                  <th className="py-3 px-3 text-right">Solscan Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-900/40">
                    <td className="py-3 px-3 font-mono-arcade text-zinc-500 text-xs">
                      {p.id}
                    </td>
                    <td className="py-3 px-3 font-bold text-white">{p.playerName}</td>
                    <td className="py-3 px-3 font-mono-arcade text-zinc-400 text-xs">
                      {p.walletAddress}
                    </td>
                    <td className="py-3 px-3 font-bold text-gold-gradient font-serif">
                      {p.amount}
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-zinc-400">
                      $PINN ({PINN_CONFIG.TOKEN_MINT_ADDRESS.slice(0, 6)}...)
                    </td>
                    <td className="py-3 px-3">
                      {p.isVerifiedOnChain ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1 w-max">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified On-Chain
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                          {p.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {p.txSignature ? (
                        <a
                          href={`${PINN_CONFIG.SOLSCAN_TX_BASE_URL}${p.txSignature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-gold-subtle/30 text-amber-400 text-xs font-bold"
                        >
                          <span>{p.txSignature.slice(0, 8)}...</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-zinc-600 text-xs">Pending Tx</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: DATABASE & SYSTEM DIAGNOSTICS */}
      {activeTab === 'system' && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-white uppercase font-serif tracking-tight flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              <span>DATABASE SCHEMAS & EDGE FUNCTION DEPLOYMENT</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Verify database tables, RLS security policies, and Edge Function deployment status.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl">
              <h3 className="text-base font-bold text-white mb-3">Supabase Integration Status</h3>
              <ul className="space-y-3 text-xs">
                <li className="flex items-center justify-between pb-2 border-b border-zinc-900">
                  <span className="text-zinc-400">Database Connection</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                  </span>
                </li>
                <li className="flex items-center justify-between pb-2 border-b border-zinc-900">
                  <span className="text-zinc-400">Edge Function (submit-score)</span>
                  {systemHealth?.edgeFunctionReady ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Deployed & Responding
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Pending Deployment (404)
                    </span>
                  )}
                </li>
                <li className="flex items-center justify-between pb-2 border-b border-zinc-900">
                  <span className="text-zinc-400">Official Token Mint Enforcement</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Enforced: {PINN_CONFIG.TOKEN_MINT_ADDRESS.slice(0, 8)}...
                  </span>
                </li>
                <li className="flex items-center justify-between pb-2 border-b border-zinc-900">
                  <span className="text-zinc-400">Duplicate Signature Protection</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active (Unique Constraint)
                  </span>
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white mb-2">Deploy Edge Function Command</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Run the Supabase CLI in your terminal to deploy the authorative anti-cheat edge function:
                </p>
                <div className="p-3 rounded-xl bg-black font-mono text-xs text-amber-300 border border-zinc-800">
                  npx supabase functions deploy submit-score --project-ref qkckwsxhejnktuccbeaw
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={copyMigrationSql}
                  className="w-full py-2.5 rounded-xl bg-gold-gradient text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedMigration ? 'Copied Migration SQL!' : 'Copy Complete SQL Migration'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: RECORD SOLANA TOKEN PAYOUT WITH ON-CHAIN VERIFICATION
      ========================================================================= */}
      {selectedRewardForPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-zinc-950 border border-gold-glow p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gold-gradient text-black flex items-center justify-center font-bold">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase font-serif">
                    Record Solana Token Payout
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Verify and record manual $PINN payment on the blockchain ledger.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRewardForPayout(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Recipient:</span>
                <span className="text-white font-bold">{selectedRewardForPayout.playerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Destination Wallet:</span>
                <span className="text-amber-300 font-mono text-[11px]">
                  {selectedRewardForPayout.walletAddress}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Reward Allocation:</span>
                <span className="text-gold-gradient font-bold font-serif text-sm">
                  {selectedRewardForPayout.rewardAmount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Token Mint:</span>
                <span className="text-zinc-400 font-mono text-[10px]">
                  {PINN_CONFIG.TOKEN_MINT_ADDRESS.slice(0, 12)}...
                </span>
              </div>
            </div>

            <form onSubmit={handleExecutePayoutRecording} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 uppercase font-semibold mb-1">
                  Solana Transaction Signature (Hash) *
                </label>
                <input
                  type="text"
                  value={payoutTxSignature}
                  onChange={(e) => setPayoutTxSignature(e.target.value)}
                  placeholder="Paste 80-88 character Solana transaction signature..."
                  className="w-full px-4 py-2.5 rounded-xl bg-black border border-zinc-800 text-amber-300 text-xs font-mono focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 uppercase font-semibold mb-1">
                  Audit Settlement Note
                </label>
                <input
                  type="text"
                  value={payoutNote}
                  onChange={(e) => setPayoutNote(e.target.value)}
                  placeholder="Optional audit comment or memo"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Simulation Demo Toggle for Test Verification */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-300">Simulation / Test Verification</div>
                  <div className="text-[10px] text-zinc-500">
                    Validate structure & duplicate checks without spending live mainnet SOL
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isSimulationDemoPayout}
                  onChange={(e) => setIsSimulationDemoPayout(e.target.checked)}
                  className="w-4 h-4 accent-amber-400 cursor-pointer"
                />
              </div>

              {payoutError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-bold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{payoutError}</span>
                </div>
              )}

              {payoutSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{payoutSuccess}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRewardForPayout(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPayout}
                  className="px-5 py-2 rounded-xl bg-gold-gradient text-black text-xs font-extrabold uppercase tracking-wider shadow-lg hover:scale-105 transition-all cursor-pointer flex items-center gap-2"
                >
                  {isVerifyingPayout ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying On-Chain...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify & Confirm Payout</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT TOURNAMENT PRIZE ALLOCATION
      ========================================================================= */}
      {editingPrizeTourn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-zinc-950 border border-gold-glow p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white uppercase font-serif">
                Set Prize Allocation
              </h3>
              <button
                onClick={() => setEditingPrizeTourn(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePrizeAllocation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 uppercase font-semibold mb-1">
                  Tournament Title
                </label>
                <div className="text-xs font-bold text-amber-300">{editingPrizeTourn.title}</div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 uppercase font-semibold mb-1">
                  Published Prize Pool *
                </label>
                <input
                  type="text"
                  value={prizePoolInput}
                  onChange={(e) => setPrizePoolInput(e.target.value)}
                  placeholder="e.g. 150,000 $PINN"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 uppercase font-semibold mb-1">
                  Prize Tier Breakdown & Terms *
                </label>
                <textarea
                  value={prizeDescInput}
                  onChange={(e) => setPrizeDescInput(e.target.value)}
                  rows={3}
                  placeholder="1st: 75,000 $PINN, 2nd: 45,000 $PINN, 3rd: 30,000 $PINN"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPrizeTourn(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gold-gradient text-black text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Save Prize Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      )}
    </AdminPortal>
  );
};
