import React, { useState, useEffect } from 'react';
import {
  Send,
  Gift,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Search,
  Award,
  Trophy,
  Clock,
  Coins,
  Lock,
  User,
  Wallet,
  AlertTriangle,
  RefreshCw,
  Check,
  Copy,
  Info,
  Flame,
  Compass,
  Brain,
  Zap,
  ArrowUpRight,
  Loader2,
  XCircle,
} from 'lucide-react';
import {
  PageNav,
  Tournament,
  RewardRequest,
  PaymentRecord,
  TournamentRankingEntry,
  PlayerProfile,
  PlayerCoinSummary,
  WithdrawalRequest,
} from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';
import { tournamentService } from '../services/tournamentService';
import { adminService } from '../services/adminService';
import { getCurrentUser, supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { walletService } from '../services/walletService';
import { playerAuthService } from '../services/playerAuthService';

interface RewardsPageProps {
  onNavigate: (page: PageNav) => void;
  onOpenAuthModal?: () => void;
  onOpenWalletModal?: () => void;
}

type RewardsTab = 'withdraw' | 'results' | 'my-rewards' | 'my-payouts' | 'rules';

const MIN_WITHDRAWAL_COINS = 10000;

export const RewardsPage: React.FC<RewardsPageProps> = ({
  onNavigate,
  onOpenAuthModal,
  onOpenWalletModal,
}) => {
  const [activeTab, setActiveTab] = useState<RewardsTab>('withdraw');
  const [txLookupInput, setTxLookupInput] = useState('');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // User and Wallet State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [walletState, setWalletState] = useState(walletService.getState());
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(() =>
    playerAuthService.getProfile()
  );

  // Authoritative Player Coin Summary & Withdrawal Requests (Features 1, 2, 4)
  const [coinSummary, setCoinSummary] = useState<PlayerCoinSummary | null>(null);
  const [loadingCoinSummary, setLoadingCoinSummary] = useState<boolean>(false);
  const [coinSummaryError, setCoinSummaryError] = useState<string | null>(null);

  const [myWithdrawals, setMyWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState<boolean>(false);
  const [withdrawalsError, setWithdrawalsError] = useState<string | null>(null);

  // Withdrawal Request Form State
  const [withdrawAmountInput, setWithdrawAmountInput] = useState<string>('10000');
  const [destinationWalletInput, setDestinationWalletInput] = useState<string>('');
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState<boolean>(false);
  const [withdrawalFormError, setWithdrawalFormError] = useState<string | null>(null);
  const [withdrawalFormSuccess, setWithdrawalFormSuccess] = useState<{
    message: string;
    request: WithdrawalRequest;
  } | null>(null);

  // Tournament & Reward Data
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [rankings, setRankings] = useState<TournamentRankingEntry[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(false);

  // Player-specific tournament rewards & payments (Strict privacy)
  const [myRewards, setMyRewards] = useState<RewardRequest[]>([]);
  const [myPayments, setMyPayments] = useState<PaymentRecord[]>([]);
  const [loadingMyData, setLoadingMyData] = useState(false);

  // Subscribe to wallet state, player profile, and Supabase auth changes
  useEffect(() => {
    const unsubWallet = walletService.subscribe((state) => {
      setWalletState(state);
      if (state.address && !destinationWalletInput) {
        setDestinationWalletInput(state.address);
      }
    });
    const unsubAuth = playerAuthService.subscribe((profile) => {
      setPlayerProfile(profile);
      if (profile?.walletAddress && !destinationWalletInput) {
        setDestinationWalletInput(profile.walletAddress);
      }
    });

    let authSub: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setCurrentUser(session?.user || null);
        loadUserDataAndTournaments();
      });
      authSub = data?.subscription || null;
    }

    return () => {
      unsubWallet();
      unsubAuth();
      authSub?.unsubscribe();
    };
  }, []);

  // Fetch initial data on sign-in or wallet change
  useEffect(() => {
    loadUserDataAndTournaments();
  }, [walletState.address, playerProfile?.id, currentUser?.id]);

  const loadUserDataAndTournaments = async (overrideProfile?: PlayerProfile) => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);

      const profile = overrideProfile || playerProfile || playerAuthService.getProfile();
      if (profile) {
        setPlayerProfile(profile);
      }

      const wAddr = profile?.walletAddress || walletState.address || undefined;
      const uid = user?.id || profile?.authUserId || profile?.id || undefined;

      if (wAddr && !destinationWalletInput) {
        setDestinationWalletInput(wAddr);
      }

      // 1. Load Authoritative Coin Totals & Withdrawal Requests if player is signed in
      if (uid || wAddr) {
        setLoadingCoinSummary(true);
        setCoinSummaryError(null);
        setLoadingWithdrawals(true);
        setWithdrawalsError(null);

        try {
          const summary = await playerAuthService.getCoinSummary(wAddr, uid);
          setCoinSummary(summary);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setCoinSummaryError(
            msg || 'Unable to load authoritative coin totals from server. Please retry.'
          );
          setCoinSummary(null);
        } finally {
          setLoadingCoinSummary(false);
        }

        try {
          const wList = await playerAuthService.getWithdrawals(wAddr, uid);
          setMyWithdrawals(wList);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setWithdrawalsError(msg || 'Unable to load withdrawal requests.');
        } finally {
          setLoadingWithdrawals(false);
        }
      } else {
        setCoinSummary(null);
        setCoinSummaryError(null);
        setMyWithdrawals([]);
        setWithdrawalsError(null);
      }

      // 2. Load Tournaments
      const tourns = await tournamentService.getTournaments();
      setTournaments(tourns);

      const defaultTourn =
        tourns.find((t) => t.status === 'completed') ||
        tourns.find((t) => t.status === 'active') ||
        tourns[0];
      if (defaultTourn && !selectedTournament) {
        setSelectedTournament(defaultTourn);
        loadRankingsForTournament(defaultTourn.id);
      }

      // 3. Load Tournament Podium Rewards & Payment History
      if (uid || wAddr) {
        setLoadingMyData(true);
        const [rewardsList, paymentsList] = await Promise.all([
          adminService.getPlayerRewardRequests(uid, wAddr),
          adminService.getPlayerPaymentRecords(uid, wAddr),
        ]);
        setMyRewards(rewardsList);
        setMyPayments(paymentsList);
        setLoadingMyData(false);
      } else {
        setMyRewards([]);
        setMyPayments([]);
      }
    } catch (err) {
      console.error('Error loading rewards dashboard data:', err);
    }
  };

  const loadRankingsForTournament = async (tournId: string) => {
    setLoadingRankings(true);
    try {
      const r = await tournamentService.getTournamentRankings(tournId);
      setRankings(r);
    } finally {
      setLoadingRankings(false);
    }
  };

  const handleSelectTournament = (tourn: Tournament) => {
    setSelectedTournament(tourn);
    loadRankingsForTournament(tourn.id);
  };

  const handleOpenTx = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = txLookupInput.trim();
    if (!clean) return;
    window.open(`${PINN_CONFIG.SOLSCAN_TX_BASE_URL}${clean}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingWithdrawal) return;

    setWithdrawalFormError(null);
    setWithdrawalFormSuccess(null);

    const isSignedIn = Boolean(currentUser || playerProfile || walletState.address);
    if (!isSignedIn) {
      setWithdrawalFormError('Please sign in or authenticate your wallet first.');
      return;
    }

    if (!coinSummary) {
      setWithdrawalFormError(
        'Cannot submit withdrawal while authoritative balance is unavailable. Please refresh.'
      );
      return;
    }

    const parsedAmount = parseInt(withdrawAmountInput.replace(/,/g, '').trim(), 10);
    if (isNaN(parsedAmount) || parsedAmount < MIN_WITHDRAWAL_COINS) {
      setWithdrawalFormError(
        `Minimum withdrawal is ${MIN_WITHDRAWAL_COINS.toLocaleString()} eligible available PINN coins.`
      );
      return;
    }

    if (parsedAmount > coinSummary.availableBalance) {
      setWithdrawalFormError(
        `Requested amount (${parsedAmount.toLocaleString()}) exceeds your available balance (${coinSummary.availableBalance.toLocaleString()} PINN coins).`
      );
      return;
    }

    const cleanDest = destinationWalletInput.trim();
    if (!cleanDest || cleanDest.length < 32 || cleanDest.length > 44) {
      setWithdrawalFormError(
        'Please enter a valid destination Solana wallet address (32–44 base58 characters).'
      );
      return;
    }

    setIsSubmittingWithdrawal(true);
    try {
      const uid = currentUser?.id || playerProfile?.authUserId || playerProfile?.id;
      const wAddr = playerProfile?.walletAddress || walletState.address;
      const displayName =
        playerProfile?.displayName ||
        currentUser?.user_metadata?.display_name ||
        currentUser?.email?.split('@')[0] ||
        'Player';

      const res = await playerAuthService.submitWithdrawal({
        amountCoins: parsedAmount,
        destinationWallet: cleanDest,
        walletAddress: wAddr,
        userId: uid,
        playerName: displayName,
      });

      if (!res.success || !res.request) {
        setWithdrawalFormError(res.error || 'Failed to submit withdrawal request.');
        return;
      }

      setWithdrawalFormSuccess({
        message:
          res.message ||
          `Withdrawal request #${res.request.id.slice(0, 8)} submitted and reserved against your available balance.`,
        request: res.request,
      });

      // Refresh authoritative coin summary & withdrawals from backend
      await loadUserDataAndTournaments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setWithdrawalFormError(msg || 'Unexpected error submitting withdrawal.');
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  const isPlayerAuthenticated = Boolean(currentUser || playerProfile || walletState.isConnected);
  const parsedPreviewAmount = Math.max(
    0,
    parseInt(withdrawAmountInput.replace(/,/g, '').trim(), 10) || 0
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col items-center">
      {/* Page Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-gold-subtle/50 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
          <Gift className="w-3.5 h-3.5" />
          <span>Player Dashboard, Coin Ledger & Prize Hub</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight">
          PLAYER DASHBOARD & REWARDS
        </h1>
        <p className="text-sm text-zinc-400 max-w-2xl mx-auto mt-2">
          Track your verified collectible coins across all four PINN Arcade titles, request manual
          $PINN token withdrawals, and inspect on-chain Solana payouts.
        </p>

        {/* Token Mint Verification Banner */}
        <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-zinc-950 border border-gold-subtle/40 text-xs">
          <span className="text-zinc-400 font-semibold">Official $PINN Token Mint:</span>
          <code className="text-amber-300 font-mono text-[11px] bg-black/60 px-2 py-0.5 rounded border border-zinc-800">
            {PINN_CONFIG.TOKEN_MINT_ADDRESS}
          </code>
          <button
            onClick={() => handleCopy(PINN_CONFIG.TOKEN_MINT_ADDRESS)}
            title="Copy Mint Address"
            className="text-zinc-400 hover:text-amber-300 p-1 cursor-pointer"
          >
            {copiedAddress === PINN_CONFIG.TOKEN_MINT_ADDRESS ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <a
            href={PINN_CONFIG.SOLSCAN_TOKEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-amber-400 hover:underline text-[11px] font-bold ml-1"
          >
            <span>Solscan</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Player Session & Wallet Authentication Bar */}
      <div className="w-full mb-6 p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gold-gradient text-black flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-semibold uppercase">Player Account</div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                {playerProfile ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-serif text-amber-300 font-black">
                      {playerProfile.displayName}
                    </span>
                  </>
                ) : currentUser ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{currentUser.email || 'Authenticated Player'}</span>
                  </>
                ) : walletState.isConnected ? (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Synchronizing Player Account...</span>
                  </span>
                ) : (
                  <span className="text-zinc-500">Not Signed In</span>
                )}
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-700 text-amber-400 flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-semibold uppercase">Linked Wallet</div>
              <div className="text-xs font-bold text-white font-mono">
                {walletState.isConnected && walletState.address ? (
                  `${walletState.address.slice(0, 6)}...${walletState.address.slice(-6)}`
                ) : playerProfile?.walletAddress ? (
                  `${playerProfile.walletAddress.slice(0, 6)}...${playerProfile.walletAddress.slice(-6)}`
                ) : (
                  <span className="text-zinc-500">Manual Destination Entry Enabled</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isPlayerAuthenticated && (
            <>
              {onOpenAuthModal && (
                <button
                  onClick={onOpenAuthModal}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-gold-subtle/50 text-amber-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Player Sign In
                </button>
              )}
              {onOpenWalletModal && (
                <button
                  onClick={onOpenWalletModal}
                  className="px-4 py-2 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow hover:scale-105 transition-all cursor-pointer"
                >
                  Connect Solana Wallet
                </button>
              )}
            </>
          )}
          <button
            onClick={() => loadUserDataAndTournaments()}
            title="Refresh Authoritative Balances"
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-amber-400 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loadingCoinSummary ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          FEATURE 1 & FEATURE 2: TOTAL COINS COLLECTED & PER-GAME TOTALS CARD
      ========================================================================= */}
      <div className="w-full mb-8 rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900/95 to-zinc-950 border border-gold-glow p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        {!isPlayerAuthenticated ? (
          <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gold-gradient text-black flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                <Coins className="w-7 h-7" />
              </div>
              <div>
                <div className="text-xs font-mono-arcade uppercase text-amber-400 tracking-wider font-bold">
                  TOTAL COINS COLLECTED
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white font-serif uppercase mt-0.5">
                  Sign In to Load Your Verified Coin Ledger
                </h2>
                <p className="text-xs text-zinc-400 max-w-xl mt-1 leading-relaxed">
                  Sign in with your PINN Arcade account or authenticate your Solana wallet to view
                  your persistent combined and per-game collectible coin balances across PINN Coin
                  Rush, PINN Treasure Hunt, PINN Puzzle Master, and PINN Speed Tap.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {onOpenAuthModal && (
                <button
                  onClick={onOpenAuthModal}
                  className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-gold-subtle/50 text-amber-300 font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Sign In with Email
                </button>
              )}
              {onOpenWalletModal && (
                <button
                  onClick={onOpenWalletModal}
                  className="px-5 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow-lg hover:scale-105 transition-all cursor-pointer"
                >
                  Authenticate Wallet
                </button>
              )}
            </div>
          </div>
        ) : loadingCoinSummary && !coinSummary ? (
          <div className="py-10 flex flex-col items-center justify-center text-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <div className="text-sm font-bold text-white uppercase tracking-wider font-serif">
              Loading Authoritative Coin Ledger...
            </div>
            <p className="text-xs text-zinc-400">
              Synchronizing verified game earnings and withdrawal reservations from Supabase...
            </p>
          </div>
        ) : coinSummaryError ? (
          <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-red-200 uppercase">
                  Coin Ledger Synchronization Error
                </div>
                <p className="text-xs text-red-300/90 mt-1">{coinSummaryError}</p>
              </div>
            </div>
            <button
              onClick={() => loadUserDataAndTournaments()}
              className="px-4 py-2 rounded-xl bg-red-900/60 hover:bg-red-800 text-white text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Load</span>
            </button>
          </div>
        ) : coinSummary ? (
          <div className="space-y-6">
            {/* Top Row: Prominent TOTAL COINS COLLECTED + Balance Breakdown */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gold-gradient text-black flex items-center justify-center shrink-0 shadow-xl shadow-amber-500/20">
                  <Coins className="w-8 h-8" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-mono-arcade font-bold uppercase tracking-widest text-amber-400">
                    <span>TOTAL COINS COLLECTED</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-gold-gradient font-mono-arcade tracking-tight mt-0.5">
                    {coinSummary.totalCoinsCollected.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1">
                    Combined verified collectible coins across all 4 PINN Arcade games
                  </div>
                </div>
              </div>

              {/* Authoritative Ledger Breakdown Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-black/50 border border-zinc-800">
                  <div className="text-[10px] font-mono-arcade uppercase text-zinc-400">
                    Eligible Earnings
                  </div>
                  <div className="text-lg font-black text-white font-mono-arcade mt-0.5">
                    {coinSummary.eligibleEarnings.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-semibold">Verified Runs</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/50 border border-zinc-800">
                  <div className="text-[10px] font-mono-arcade uppercase text-zinc-400">
                    Reserved (Pending)
                  </div>
                  <div className="text-lg font-black text-amber-300 font-mono-arcade mt-0.5">
                    {coinSummary.reservedAmount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-semibold">In Active Requests</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/50 border border-zinc-800">
                  <div className="text-[10px] font-mono-arcade uppercase text-zinc-400">
                    Paid / Withdrawn
                  </div>
                  <div className="text-lg font-black text-sky-400 font-mono-arcade mt-0.5">
                    {coinSummary.paidTotal.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-semibold">Settled On-Chain</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40">
                  <div className="text-[10px] font-mono-arcade uppercase text-emerald-300 font-bold">
                    Available Balance
                  </div>
                  <div className="text-lg font-black text-emerald-400 font-mono-arcade mt-0.5">
                    {coinSummary.availableBalance.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-300/80 font-semibold">
                    {coinSummary.availableBalance >= MIN_WITHDRAWAL_COINS
                      ? 'Ready to Withdraw'
                      : 'Min 10,000 to Withdraw'}
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2: Individual Per-Game Collectible Coin Totals */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Verified Collectible Coins By Game Title</span>
                </span>
                <span className="text-[11px] text-zinc-400 font-mono">
                  Sum = {coinSummary.coinRushCoins.toLocaleString()} +{' '}
                  {coinSummary.treasureHuntCoins.toLocaleString()} +{' '}
                  {coinSummary.puzzleMasterCoins.toLocaleString()} +{' '}
                  {coinSummary.speedTapCoins.toLocaleString()} ={' '}
                  <strong className="text-amber-300">
                    {coinSummary.totalCoinsCollected.toLocaleString()} Coins
                  </strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {[
                  {
                    id: 'coin-rush',
                    title: 'PINN Coin Rush',
                    coins: coinSummary.coinRushCoins,
                    icon: Flame,
                    accent: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
                    route: 'play' as PageNav,
                  },
                  {
                    id: 'treasure-hunt',
                    title: 'PINN Treasure Hunt',
                    coins: coinSummary.treasureHuntCoins,
                    icon: Compass,
                    accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                    route: 'play-treasure' as PageNav,
                  },
                  {
                    id: 'puzzle-master',
                    title: 'PINN Puzzle Master',
                    coins: coinSummary.puzzleMasterCoins,
                    icon: Brain,
                    accent: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
                    route: 'play-puzzle' as PageNav,
                  },
                  {
                    id: 'speed-tap',
                    title: 'PINN Speed Tap',
                    coins: coinSummary.speedTapCoins,
                    icon: Zap,
                    accent: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
                    route: 'play-speedtap' as PageNav,
                  },
                ].map((g) => {
                  const GameIcon = g.icon;
                  return (
                    <div
                      key={g.id}
                      className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-gold-subtle/50 transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-xl border flex items-center justify-center ${g.accent}`}
                          >
                            <GameIcon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-white font-serif uppercase">
                            {g.title}
                          </span>
                        </div>
                        <button
                          onClick={() => onNavigate(g.route)}
                          title={`Play ${g.title}`}
                          className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Play</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="pt-2 border-t border-zinc-800/80 flex items-baseline justify-between">
                        <span className="text-[10px] text-zinc-500 uppercase font-mono-arcade">
                          Game Total
                        </span>
                        <span className="text-xl font-black text-amber-300 font-mono-arcade">
                          {g.coins.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {coinSummary.totalCoinsCollected === 0 && (
                <div className="mt-4 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
                  <span>
                    No verified collectible coins recorded yet for your account. Complete a run in
                    any of the four arcade games to start accumulating eligible PINN coins!
                  </span>
                  <button
                    onClick={() => onNavigate('games')}
                    className="px-4 py-1.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Play Games Now
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Navigation Tabs */}
      <div className="w-full mb-8 flex flex-wrap items-center justify-center gap-2 border-b border-zinc-800 pb-4">
        {[
          { id: 'withdraw', label: 'Withdraw PINN', icon: Coins, count: myWithdrawals.length },
          { id: 'results', label: 'Verified Tournament Results', icon: Trophy },
          { id: 'my-rewards', label: 'My Tournament Rewards', icon: Award, count: myRewards.length },
          { id: 'my-payouts', label: 'Completed Payouts & Explorer', icon: CheckCircle2 },
          { id: 'rules', label: 'Fair Play & Reward Rules', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as RewardsTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isActive
                  ? 'bg-gold-gradient text-black shadow-lg shadow-amber-500/10'
                  : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive ? 'bg-black text-amber-300' : 'bg-zinc-900 text-zinc-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 0 (FEATURE 4): WITHDRAW PINN SECTION & PLAYER WITHDRAWAL REQUESTS
      ========================================================================= */}
      {activeTab === 'withdraw' && (
        <section className="w-full flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Withdraw PINN Request Form */}
            <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-gold-glow shadow-2xl flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase mb-2">
                  Manual Admin-Reviewed Token Payout
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white uppercase font-serif flex items-center gap-2">
                  <Coins className="w-6 h-6 text-amber-400" />
                  <span>WITHDRAW PINN COINS</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Request a withdrawal of your eligible available PINN coins to your Solana wallet.
                  Minimum withdrawal is{' '}
                  <strong className="text-amber-300">
                    {MIN_WITHDRAWAL_COINS.toLocaleString()} eligible available PINN coins
                  </strong>
                  . Submitted requests atomically reserve funds against your available balance
                  without reducing your lifetime coins collected.
                </p>

                {/* Official Token Mint Reference */}
                <div className="mt-4 p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-400 font-semibold">Official $PINN Solana Mint:</span>
                  <div className="flex items-center gap-1.5">
                    <code className="text-amber-300 font-mono text-[11px] break-all">
                      {PINN_CONFIG.TOKEN_MINT_ADDRESS}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(PINN_CONFIG.TOKEN_MINT_ADDRESS)}
                      className="text-zinc-400 hover:text-amber-300 p-1 cursor-pointer"
                    >
                      {copiedAddress === PINN_CONFIG.TOKEN_MINT_ADDRESS ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {!isPlayerAuthenticated ? (
                  <div className="mt-6 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center">
                    <Lock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-white uppercase">
                      Authentication Required to Withdraw
                    </h3>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 mb-4">
                      Sign in or authenticate your Solana wallet so the server can verify your
                      eligible available balance.
                    </p>
                    <button
                      onClick={onOpenWalletModal || onOpenAuthModal}
                      className="px-5 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                    >
                      Sign In / Authenticate Wallet
                    </button>
                  </div>
                ) : !coinSummary ? (
                  <div className="mt-6 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center text-xs text-zinc-400">
                    {loadingCoinSummary
                      ? 'Verifying available balance from server...'
                      : coinSummaryError || 'Balance data unavailable. Please refresh.'}
                  </div>
                ) : coinSummary.availableBalance < MIN_WITHDRAWAL_COINS ? (
                  /* Below 10,000 Minimum Threshold Explanation */
                  <div className="mt-6 p-5 rounded-2xl bg-amber-950/20 border border-amber-500/40 space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-bold text-amber-200 uppercase">
                          Minimum Withdrawal Threshold: {MIN_WITHDRAWAL_COINS.toLocaleString()} PINN
                          Coins
                        </h3>
                        <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                          You currently have{' '}
                          <strong className="text-emerald-400 font-mono">
                            {coinSummary.availableBalance.toLocaleString()}
                          </strong>{' '}
                          eligible available PINN coins (and{' '}
                          <strong className="text-amber-300 font-mono">
                            {coinSummary.reservedAmount.toLocaleString()}
                          </strong>{' '}
                          reserved in active requests). Collect{' '}
                          <strong className="text-amber-300 font-mono">
                            {(MIN_WITHDRAWAL_COINS - coinSummary.availableBalance).toLocaleString()}
                          </strong>{' '}
                          more eligible coins across the four arcade games to unlock withdrawals.
                        </p>
                      </div>
                    </div>

                    {/* Progress bar toward 10,000 */}
                    <div className="pt-2">
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
                        <span>Available: {coinSummary.availableBalance.toLocaleString()}</span>
                        <span>Minimum Required: {MIN_WITHDRAWAL_COINS.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                        <div
                          className="h-full bg-gold-gradient transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.floor((coinSummary.availableBalance / MIN_WITHDRAWAL_COINS) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Eligible Withdrawal Request Form (availableBalance >= 10,000) */
                  <form onSubmit={handleSubmitWithdrawal} className="mt-6 space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold uppercase text-zinc-300">
                          Withdrawal Amount (PINN Coins) *
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setWithdrawAmountInput(String(MIN_WITHDRAWAL_COINS))}
                            className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono cursor-pointer"
                          >
                            Min (10,000)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setWithdrawAmountInput(String(coinSummary.availableBalance))
                            }
                            className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-mono font-bold cursor-pointer"
                          >
                            Max ({coinSummary.availableBalance.toLocaleString()})
                          </button>
                        </div>
                      </div>
                      <input
                        type="number"
                        min={MIN_WITHDRAWAL_COINS}
                        max={coinSummary.availableBalance}
                        step={1}
                        value={withdrawAmountInput}
                        onChange={(e) => setWithdrawAmountInput(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-black border border-zinc-800 focus:border-amber-400 text-white font-mono-arcade text-base focus:outline-none"
                        placeholder="10000"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-300 mb-1">
                        Destination Solana Wallet Address *
                      </label>
                      <input
                        type="text"
                        value={destinationWalletInput}
                        onChange={(e) => setDestinationWalletInput(e.target.value)}
                        placeholder="Enter valid Solana mainnet address (32–44 base58 characters)..."
                        className="w-full px-4 py-2.5 rounded-xl bg-black border border-zinc-800 focus:border-amber-400 text-amber-300 font-mono text-xs focus:outline-none"
                        required
                      />
                      <span className="text-[11px] text-zinc-500 mt-1 block">
                        {walletState.isConnected && walletState.address
                          ? 'Pre-filled with your connected wallet address. You may also enter another valid Solana destination address.'
                          : 'No wallet extension required — enter the Solana wallet address where you wish to receive manual $PINN payouts.'}
                      </span>
                    </div>

                    {/* Confirmation Summary Box */}
                    <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2 text-xs">
                      <div className="text-[11px] font-bold uppercase text-amber-300 tracking-wider mb-1">
                        Withdrawal Confirmation Summary
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Requested Amount:</span>
                        <span className="font-mono-arcade font-bold text-white">
                          {parsedPreviewAmount.toLocaleString()} PINN Coins
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Exact Token Base Units (6 Decimals):</span>
                        <span className="font-mono text-zinc-300 text-[11px]">
                          {(BigInt(parsedPreviewAmount) * 1000000n).toString()} raw units
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Destination Solana Wallet:</span>
                        <span className="font-mono text-amber-300 text-[11px] truncate max-w-[220px]">
                          {destinationWalletInput.trim() || 'Not specified'}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-zinc-800">
                        <span className="text-zinc-400">Available Balance After Reservation:</span>
                        <span className="font-mono-arcade font-bold text-emerald-400">
                          {Math.max(
                            0,
                            coinSummary.availableBalance - parsedPreviewAmount
                          ).toLocaleString()}{' '}
                          PINN Coins
                        </span>
                      </div>
                    </div>

                    {withdrawalFormError && (
                      <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-xs font-bold flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span>{withdrawalFormError}</span>
                      </div>
                    )}

                    {withdrawalFormSuccess && (
                      <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-200 text-xs space-y-1.5">
                        <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{withdrawalFormSuccess.message}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-mono text-zinc-300">
                          <div>Request ID: {withdrawalFormSuccess.request.id.slice(0, 12)}...</div>
                          <div>Status: {withdrawalFormSuccess.request.status.toUpperCase()}</div>
                          <div className="col-span-2">
                            Submitted:{' '}
                            {new Date(withdrawalFormSuccess.request.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={
                        isSubmittingWithdrawal ||
                        parsedPreviewAmount < MIN_WITHDRAWAL_COINS ||
                        parsedPreviewAmount > coinSummary.availableBalance
                      }
                      className="w-full py-3 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow-lg hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmittingWithdrawal ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Reserving & Submitting Request...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>
                            Submit Withdrawal Request ({parsedPreviewAmount.toLocaleString()} PINN)
                          </span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Right Column: Reservation & Settlement Lifecycle Guide */}
            <div className="lg:col-span-5 p-6 sm:p-7 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl flex flex-col justify-between space-y-6">
              <div>
                <h3 className="text-base font-bold text-white uppercase font-serif tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <span>Withdrawal & Reservation Rules</span>
                </h3>
                <ul className="mt-4 space-y-3 text-xs text-zinc-300">
                  <li className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <strong className="text-amber-300 block mb-0.5">
                      1. 10,000 Eligible Coin Minimum
                    </strong>
                    Only server-verified collectible coins from completed arcade runs count toward
                    eligible available balance.
                  </li>
                  <li className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <strong className="text-amber-300 block mb-0.5">
                      2. Atomic Balance Reservation
                    </strong>
                    Pending, Approved, and Processing requests hold a reservation against your
                    available balance so coins cannot be double-spent, while preserving your
                    lifetime Total Coins Collected.
                  </li>
                  <li className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <strong className="text-amber-300 block mb-0.5">
                      3. Rejected Requests Release Funds
                    </strong>
                    If a request is rejected during admin review, the reserved coins are
                    automatically released back to your available balance.
                  </li>
                  <li className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <strong className="text-emerald-400 block mb-0.5">
                      4. Verified On-Chain Settlement
                    </strong>
                    Requests are marked <strong>PAID</strong> only after the backend independently
                    verifies the Solana mainnet transaction signature, official $PINN mint,
                    destination token account owner, and exact raw token amount.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Player's Withdrawal Requests History Table */}
          <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white uppercase font-serif tracking-tight">
                  MY WITHDRAWAL REQUESTS
                </h3>
                <p className="text-xs text-zinc-400">
                  Persistent record of your submitted PINN withdrawal requests, reservation status,
                  and verified Solana transaction signatures.
                </p>
              </div>
              <span className="text-xs font-mono text-amber-300 font-bold">
                {myWithdrawals.length} Request(s)
              </span>
            </div>

            {loadingWithdrawals ? (
              <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Loading your withdrawal requests...</span>
              </div>
            ) : withdrawalsError ? (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
                {withdrawalsError}
              </div>
            ) : myWithdrawals.length === 0 ? (
              <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center text-xs text-zinc-500">
                You have not submitted any PINN withdrawal requests yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400 uppercase text-[11px] tracking-wider">
                      <th className="py-3 px-4">Request ID</th>
                      <th className="py-3 px-4">Submitted</th>
                      <th className="py-3 px-4">Amount (PINN)</th>
                      <th className="py-3 px-4">Destination Wallet</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Admin Decision / Notes</th>
                      <th className="py-3 px-4 text-right">On-Chain Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {myWithdrawals.map((w) => {
                      const isPaid = w.status === 'paid' || w.status === 'completed';
                      const isRejected = w.status === 'rejected' || w.status === 'cancelled';
                      return (
                        <tr key={w.id} className="hover:bg-zinc-900/40">
                          <td className="py-3.5 px-4 font-mono text-xs text-zinc-300">
                            {w.id.slice(0, 10)}...
                          </td>
                          <td className="py-3.5 px-4 text-xs text-zinc-400">
                            {new Date(w.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-mono-arcade font-bold text-amber-300">
                              {w.amountCoins.toLocaleString()} PINN
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              {w.amountRaw} raw
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-zinc-300">
                            {w.walletAddress.slice(0, 6)}...{w.walletAddress.slice(-6)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-flex items-center gap-1 ${
                                isPaid
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                  : w.status === 'processing'
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                  : w.status === 'approved'
                                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                  : isRejected
                                  ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              {isPaid ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : isRejected ? (
                                <XCircle className="w-3 h-3" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              <span>{isPaid ? 'PAID' : w.status.toUpperCase()}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-zinc-400 max-w-xs">
                            {isRejected
                              ? w.rejectionReason || w.adminNotes || 'Rejected — reservation released.'
                              : w.adminNotes || 'Reserved pending admin review.'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {w.txSignature ? (
                              <a
                                href={`${PINN_CONFIG.SOLSCAN_TX_BASE_URL}${w.txSignature}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-gold-subtle/40 text-amber-400 text-xs font-bold"
                              >
                                <span>{w.txSignature.slice(0, 8)}...</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-zinc-600 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =========================================================================
          TAB 1: VERIFIED TOURNAMENT RESULTS & PODIUM WINNERS
      ========================================================================= */}
      {activeTab === 'results' && (
        <section className="w-full flex flex-col gap-6">
          {/* Tournament selector pills */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
              Select Tournament Bracket:
            </span>
            <div className="flex flex-wrap gap-2">
              {tournaments.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTournament(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedTournament?.id === t.id
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  {t.title} ({t.status.toUpperCase()})
                </button>
              ))}
            </div>
          </div>

          {selectedTournament && (
            <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-gold-glow shadow-2xl">
              {/* Tournament Prize Allocation Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-zinc-800">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase mb-2">
                    Official Tournament Prize Allocation
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white uppercase font-serif">
                    {selectedTournament.title}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                    {selectedTournament.prizeDescription}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-zinc-400 uppercase font-bold">
                    Total Prize Pool
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-gold-gradient font-serif">
                    {selectedTournament.prizePool}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                    Funded in $PINN SPL Tokens
                  </div>
                </div>
              </div>

              {/* Strict Verification Note */}
              <div className="mt-4 p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Anti-Cheat Rule:</strong> Only server-verified scores processed by the
                  anti-cheat system qualify for official podium ranking and prize eligibility.
                  Unverified, pending, or disqualified runs are strictly excluded.
                </span>
              </div>

              {/* Verified Podium Table */}
              <div className="mt-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Official Verified Rankings & Prize Winners</span>
                </h3>

                {loadingRankings ? (
                  <div className="p-12 text-center text-zinc-500 text-xs">
                    Loading verified tournament rankings...
                  </div>
                ) : rankings.length === 0 ? (
                  <div className="p-12 text-center text-zinc-500 text-xs">
                    No verified scores have been recorded yet for this tournament.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400 uppercase text-[11px] tracking-wider">
                          <th className="py-3 px-4">Rank</th>
                          <th className="py-3 px-4">Player Display Name</th>
                          <th className="py-3 px-4">Verified Score</th>
                          <th className="py-3 px-4">Eligible Prize Allocation</th>
                          <th className="py-3 px-4 text-right">Verification Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {rankings.slice(0, 10).map((entry) => {
                          const isTopPodium = entry.rank <= 3;
                          return (
                            <tr
                              key={entry.rank}
                              className={`hover:bg-zinc-900/40 ${
                                isTopPodium ? 'bg-amber-950/10' : ''
                              }`}
                            >
                              <td className="py-3.5 px-4 font-bold">
                                {entry.rank === 1 && (
                                  <span className="inline-flex items-center gap-1 text-amber-300">
                                    🥇 #1
                                  </span>
                                )}
                                {entry.rank === 2 && (
                                  <span className="inline-flex items-center gap-1 text-zinc-300">
                                    🥈 #2
                                  </span>
                                )}
                                {entry.rank === 3 && (
                                  <span className="inline-flex items-center gap-1 text-amber-600">
                                    🥉 #3
                                  </span>
                                )}
                                {entry.rank > 3 && (
                                  <span className="text-zinc-500 font-mono">#{entry.rank}</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 font-bold text-white">
                                {entry.playerName}
                                {entry.walletAddress && (
                                  <span className="block text-[10px] text-zinc-500 font-mono">
                                    {entry.walletAddress.slice(0, 4)}...
                                    {entry.walletAddress.slice(-4)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 font-mono-arcade font-bold text-amber-300 text-sm">
                                {entry.score.toLocaleString()}
                              </td>
                              <td className="py-3.5 px-4 font-bold font-serif text-gold-gradient">
                                {entry.potentialPrize ||
                                  (isTopPodium ? 'Podium Tier Prize' : 'Rank Honor')}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {entry.isVerified ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Verified
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold uppercase tracking-wider">
                                    <Clock className="w-3 h-3" />
                                    Pending Audit
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          TAB 2: MY ELIGIBLE TOURNAMENT REWARDS & CLAIM STATUS (Strict Player Privacy)
      ========================================================================= */}
      {activeTab === 'my-rewards' && (
        <section className="w-full flex flex-col gap-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-gold-glow shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white uppercase font-serif tracking-tight flex items-center gap-2">
                  <Award className="w-6 h-6 text-amber-400" />
                  <span>MY TOURNAMENT REWARDS & ALLOCATIONS</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Private tournament reward status for your authenticated player profile. Only you
                  can view these records.
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-zinc-400 font-bold uppercase">
                  Reward Records
                </span>
                <div className="text-xl font-bold text-amber-300">{myRewards.length} Claims</div>
              </div>
            </div>

            {!currentUser && !playerProfile && (
              <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center flex flex-col items-center">
                <Lock className="w-8 h-8 text-amber-400 mb-2" />
                <h3 className="text-base font-bold text-white mb-1">
                  Player Authentication Required
                </h3>
                <p className="text-xs text-zinc-400 max-w-md mb-4">
                  Sign in or connect your Solana wallet to retrieve your verified tournament podium
                  finishes and token allocations.
                </p>
                <button
                  onClick={onOpenWalletModal || onOpenAuthModal}
                  className="px-6 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer shadow-lg hover:scale-105 transition-all"
                >
                  Authenticate Account
                </button>
              </div>
            )}

            {(currentUser || playerProfile) && myRewards.length === 0 && (
              <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center flex flex-col items-center">
                <Trophy className="w-8 h-8 text-zinc-600 mb-2" />
                <h3 className="text-base font-bold text-white mb-1">
                  No Active Tournament Reward Claims Yet
                </h3>
                <p className="text-xs text-zinc-400 max-w-md mb-4">
                  Compete in active tournaments, set a high score, and finish in the top podium
                  ranks to unlock $PINN tournament prize allocations.
                </p>
                <button
                  onClick={() => onNavigate('tournaments')}
                  className="px-6 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Browse Active Tournaments
                </button>
              </div>
            )}

            {(currentUser || playerProfile) && myRewards.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400 uppercase text-[11px] tracking-wider">
                      <th className="py-3 px-4">Tournament</th>
                      <th className="py-3 px-4">Finish Rank</th>
                      <th className="py-3 px-4">Verified Score</th>
                      <th className="py-3 px-4">Prize Allocation</th>
                      <th className="py-3 px-4">Claim Status</th>
                      <th className="py-3 px-4 text-right">Admin Review Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {myRewards.map((reward) => (
                      <tr key={reward.id} className="hover:bg-zinc-900/40">
                        <td className="py-3.5 px-4 font-bold text-white">
                          {reward.tournamentTitle || reward.tournamentId}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-amber-400">#{reward.rank}</td>
                        <td className="py-3.5 px-4 font-mono-arcade font-bold text-amber-300">
                          {reward.score.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 font-bold font-serif text-gold-gradient text-base">
                          {reward.rewardAmount}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              reward.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : reward.status === 'approved'
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                : reward.status === 'prepared' || reward.status === 'pending_review'
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                : 'bg-red-500/20 text-red-400 border-red-500/40'
                            }`}
                          >
                            {reward.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-xs text-zinc-400">
                          {reward.adminNotes || 'Under tournament committee review.'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =========================================================================
          TAB 3: COMPLETED PAYOUTS & SOLANA EXPLORER (Proof of Payment)
      ========================================================================= */}
      {activeTab === 'my-payouts' && (
        <section className="w-full flex flex-col gap-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-gold-glow shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white uppercase font-serif tracking-tight flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <span>COMPLETED PAYOUTS & ON-CHAIN PROOF</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Immutable record of verified token disbursements on the Solana blockchain.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-400 font-bold uppercase">Token Mint:</span>
                <span className="text-xs text-amber-300 font-mono font-bold">$PINN</span>
              </div>
            </div>

            {/* List of Player Completed Payments */}
            {myPayments.length === 0 ? (
              <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center text-zinc-500 text-xs">
                No completed payout transactions recorded for your connected account yet. Once
                approved rewards or withdrawals are settled on-chain, transaction hashes and Solscan
                links will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-zinc-800 mb-8">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400 uppercase text-[11px] tracking-wider">
                      <th className="py-3 px-4">Payout ID</th>
                      <th className="py-3 px-4">Source</th>
                      <th className="py-3 px-4">Disbursed Amount</th>
                      <th className="py-3 px-4">Destination Wallet</th>
                      <th className="py-3 px-4">Status & On-Chain Proof</th>
                      <th className="py-3 px-4 text-right">Solscan Explorer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {myPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-900/40">
                        <td className="py-3.5 px-4 font-mono text-zinc-400 text-xs">{p.id}</td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          {p.tournamentTitle || p.tournamentId || 'Coin Withdrawal Payout'}
                        </td>
                        <td className="py-3.5 px-4 font-bold font-serif text-gold-gradient text-base">
                          {p.amount}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-zinc-400">
                          {p.walletAddress}
                        </td>
                        <td className="py-3.5 px-4">
                          {p.isVerifiedOnChain ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold uppercase">
                              <CheckCircle2 className="w-3 h-3" />
                              Confirmed Mainnet
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold uppercase">
                              <Clock className="w-3 h-3" />
                              {p.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {p.txSignature ? (
                            <a
                              href={`${PINN_CONFIG.SOLSCAN_TX_BASE_URL}${p.txSignature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-gold-subtle/30 text-amber-400 text-xs font-bold transition-all"
                            >
                              <span>View Tx</span>
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
            )}

            {/* Solscan Public Transaction Lookup Tool */}
            <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-400" />
                <span>Public Solana Transaction Signature Lookup</span>
              </h3>
              <p className="text-xs text-zinc-400 mb-4">
                Verify any reward or withdrawal distribution signature directly on the Solana block
                explorer.
              </p>
              <form onSubmit={handleOpenTx} className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  type="text"
                  value={txLookupInput}
                  onChange={(e) => setTxLookupInput(e.target.value)}
                  placeholder="Paste 88-character Solana transaction signature..."
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-gold-glow font-mono"
                />
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-95 shrink-0 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Inspect On Solscan</span>
                </button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          TAB 4: FAIR PLAY & REWARD RULES (5 Steps & Legal Disclaimers)
      ========================================================================= */}
      {activeTab === 'rules' && (
        <section className="w-full flex flex-col gap-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-6 h-6 rounded-md bg-gold-gradient flex items-center justify-center text-black font-bold text-xs">
                A
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white uppercase font-serif tracking-tight">
                HOW TO PARTICIPATE & QUALIFY
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                {
                  step: 1,
                  title: 'Select An Arcade Game',
                  desc: 'Play any of the 4 arcade titles in browser on desktop or mobile.',
                },
                {
                  step: 2,
                  title: 'Authenticate Session',
                  desc: 'Sign in to ensure scores and coins are submitted with server-backed identity.',
                },
                {
                  step: 3,
                  title: 'Pass Anti-Cheat Audit',
                  desc: 'Run trajectories and coin earnings are strictly verified by backend routines.',
                },
                {
                  step: 4,
                  title: 'Collect 10,000+ Coins',
                  desc: 'Accumulate at least 10,000 eligible available coins or reach a tournament podium.',
                },
                {
                  step: 5,
                  title: 'Receive $PINN Transfer',
                  desc: 'Prizes and withdrawals are manually settled to verified Solana addresses on-chain.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-gold-gradient text-black font-black text-xs flex items-center justify-center mb-3">
                      0{item.step}
                    </div>
                    <h3 className="font-bold text-white text-sm mb-1 uppercase font-serif">
                      {item.title}
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-900 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Fair Play & Anti-Cheat Requirements</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-zinc-400 list-disc list-inside">
                  <li>
                    Automated botting, memory injectors, and speed hacks result in immediate
                    disqualification.
                  </li>
                  <li>Replayed session tokens are rejected automatically.</li>
                  <li>
                    Only verified scores and eligible coin ledger runs count toward balances and
                    prizes.
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span>Prize Distribution & Non-Custodial Terms</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-zinc-400 list-disc list-inside">
                  <li>
                    Withdrawals and tournament prizes are distributed manually by project
                    administrators.
                  </li>
                  <li>
                    The platform does not custody private keys or execute automated contract
                    deductions.
                  </li>
                  <li>
                    All payment records are publicly verifiable via Solana transaction hashes.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
