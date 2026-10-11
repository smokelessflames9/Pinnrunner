import React, { useState, useEffect } from 'react';
import {
  Send,
  Gift,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Search,
  Sparkles,
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
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  PageNav,
  Tournament,
  RewardRequest,
  PaymentRecord,
  TournamentRankingEntry,
} from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';
import { tournamentService } from '../services/tournamentService';
import { adminService } from '../services/adminService';
import { getCurrentUser } from '../services/supabaseClient';
import { walletService } from '../services/walletService';

interface RewardsPageProps {
  onNavigate: (page: PageNav) => void;
  onOpenAuthModal?: () => void;
}

type RewardsTab = 'results' | 'my-rewards' | 'my-payouts' | 'rules';

export const RewardsPage: React.FC<RewardsPageProps> = ({ onNavigate, onOpenAuthModal }) => {
  const [activeTab, setActiveTab] = useState<RewardsTab>('results');
  const [txLookupInput, setTxLookupInput] = useState('');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // User and Wallet State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [walletState, setWalletState] = useState(walletService.getState());

  // Data
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [rankings, setRankings] = useState<TournamentRankingEntry[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(false);

  // Player-specific rewards & payments (Strict privacy)
  const [myRewards, setMyRewards] = useState<RewardRequest[]>([]);
  const [myPayments, setMyPayments] = useState<PaymentRecord[]>([]);
  const [loadingMyData, setLoadingMyData] = useState(false);

  const comp = PINN_CONFIG.COMPETITION;

  // Subscribe to wallet state
  useEffect(() => {
    const unsub = walletService.subscribe((state) => {
      setWalletState(state);
    });
    return () => unsub();
  }, []);

  // Fetch initial data
  useEffect(() => {
    loadUserDataAndTournaments();
  }, [walletState.address]);

  const loadUserDataAndTournaments = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);

      const tourns = await tournamentService.getTournaments();
      setTournaments(tourns);

      // Select active or completed tournament for results
      const defaultTourn =
        tourns.find((t) => t.status === 'completed') ||
        tourns.find((t) => t.status === 'active') ||
        tourns[0];
      if (defaultTourn) {
        setSelectedTournament(defaultTourn);
        loadRankingsForTournament(defaultTourn.id);
      }

      // Load player-specific rewards & payments
      const uid = user?.id;
      const wAddr = walletState.address || undefined;

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
      console.error('Error loading rewards data:', err);
    }
  };

  const loadRankingsForTournament = async (tournId: string) => {
    setLoadingRankings(true);
    try {
      const r = await tournamentService.getTournamentRankings(tournId);
      // Strictly verified scores only
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

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col items-center">
      {/* Page Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-gold-subtle/50 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
          <Gift className="w-3.5 h-3.5" />
          <span>Ecosystem Rewards & Prize Management Hub</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight">
          PINN REWARDS & PRIZES
        </h1>
        <p className="text-sm text-zinc-400 max-w-2xl mx-auto mt-2">
          Transparent, verifiable tournament rewards for PINN Arcade. Every prize payout is verified
          on the Solana blockchain with the official $PINN token mint.
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
      <div className="w-full mb-8 p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gold-gradient text-black flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-semibold uppercase">Player Account</div>
              <div className="text-xs font-bold text-white">
                {currentUser?.email || (currentUser ? 'Authenticated Player' : 'Not Signed In')}
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-700 text-amber-400 flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 font-semibold uppercase">Solana Wallet</div>
              <div className="text-xs font-bold text-white font-mono">
                {walletState.isConnected && walletState.address ? (
                  `${walletState.address.slice(0, 6)}...${walletState.address.slice(-6)}`
                ) : (
                  <span className="text-zinc-500">Unconnected</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!currentUser && onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="px-4 py-2 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow hover:scale-105 transition-all cursor-pointer"
            >
              Sign In to View My Rewards
            </button>
          )}
          <button
            onClick={loadUserDataAndTournaments}
            title="Refresh Data"
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-amber-400 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="w-full mb-8 flex flex-wrap items-center justify-center gap-2 border-b border-zinc-800 pb-4">
        {[
          { id: 'results', label: 'Verified Tournament Results', icon: Trophy },
          { id: 'my-rewards', label: 'My Eligible & Pending Rewards', icon: Award },
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
              {tab.id === 'my-rewards' && myRewards.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-black text-amber-300 text-[10px]">
                  {myRewards.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

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
                  <div className="text-[10px] text-zinc-400 uppercase font-bold">Total Prize Pool</div>
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
                  anti-cheat system qualify for official podium ranking and prize eligibility. Unverified,
                  pending, or disqualified runs are strictly excluded.
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
                                {entry.potentialPrize || (isTopPodium ? 'Podium Tier Prize' : 'Rank Honor')}
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
          TAB 2: MY ELIGIBLE REWARDS & CLAIM STATUS (Strict Player Privacy)
      ========================================================================= */}
      {activeTab === 'my-rewards' && (
        <section className="w-full flex flex-col gap-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-gold-glow shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white uppercase font-serif tracking-tight flex items-center gap-2">
                  <Award className="w-6 h-6 text-amber-400" />
                  <span>MY ELIGIBLE REWARDS & ALLOCATIONS</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Private reward status for your authenticated player profile. Only you can view these
                  records.
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-zinc-400 font-bold uppercase">Reward Records</span>
                <div className="text-xl font-bold text-amber-300">{myRewards.length} Claims</div>
              </div>
            </div>

            {!currentUser && (
              <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center flex flex-col items-center">
                <Lock className="w-8 h-8 text-amber-400 mb-2" />
                <h3 className="text-base font-bold text-white mb-1">Authentication Required</h3>
                <p className="text-xs text-zinc-400 max-w-md mb-4">
                  Please sign in with your player account so we can securely retrieve your verified
                  podium finishes and pending reward claims.
                </p>
                {onOpenAuthModal && (
                  <button
                    onClick={onOpenAuthModal}
                    className="px-6 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Player Sign In
                  </button>
                )}
              </div>
            )}

            {currentUser && myRewards.length === 0 && (
              <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center flex flex-col items-center">
                <Trophy className="w-8 h-8 text-zinc-600 mb-2" />
                <h3 className="text-base font-bold text-white mb-1">No Active Reward Claims Yet</h3>
                <p className="text-xs text-zinc-400 max-w-md mb-4">
                  Compete in active tournaments, set a high score, and finish in the top podium ranks
                  to unlock $PINN tournament prize allocations.
                </p>
                <button
                  onClick={() => onNavigate('tournaments')}
                  className="px-6 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Browse Active Tournaments
                </button>
              </div>
            )}

            {currentUser && myRewards.length > 0 && (
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
                approved rewards are settled on-chain, transaction hashes and Solscan links will
                appear here.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-zinc-800 mb-8">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400 uppercase text-[11px] tracking-wider">
                      <th className="py-3 px-4">Payout ID</th>
                      <th className="py-3 px-4">Tournament</th>
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
                          {p.tournamentTitle || p.tournamentId || 'PINN Tournament'}
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
                Verify any tournament reward distribution signature directly on the Solana block
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
                  desc: 'Sign in to ensure scores are submitted with server-backed identity.',
                },
                {
                  step: 3,
                  title: 'Pass Anti-Cheat Audit',
                  desc: 'Run trajectories are strictly verified by backend edge routines.',
                },
                {
                  step: 4,
                  title: 'Reach Top 3 Podium',
                  desc: 'Compete during active tournament brackets to secure winning ranks.',
                },
                {
                  step: 5,
                  title: 'Receive $PINN Transfer',
                  desc: 'Prizes are manually settled to verified Solana addresses on-chain.',
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
                  <li>Automated botting, memory injectors, and speed hacks result in immediate disqualification.</li>
                  <li>Replayed session tokens are rejected automatically.</li>
                  <li>Only verified scores count toward tournament rankings and prizes.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span>Prize Distribution & Non-Custodial Terms</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-zinc-400 list-disc list-inside">
                  <li>Tournament prizes are distributed manually by project administrators.</li>
                  <li>The platform does not custody private keys or execute automated contract deductions.</li>
                  <li>All payment records are publicly verifiable via Solana transaction hashes.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
