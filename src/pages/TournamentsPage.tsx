import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Calendar,
  Clock,
  ShieldCheck,
  Award,
  Sparkles,
  Play,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  User,
  Medal,
  RefreshCw,
  Coins,
  ArrowRight,
} from 'lucide-react';
import { PageNav, Tournament, TournamentRankingEntry, TournamentStatus, GameId } from '../types';
import { tournamentService } from '../services/tournamentService';
import { getCurrentUser } from '../services/supabaseClient';

interface TournamentsPageProps {
  onNavigate: (page: PageNav) => void;
  onOpenAuthModal?: () => void;
}

export const TournamentsPage: React.FC<TournamentsPageProps> = ({ onNavigate, onOpenAuthModal }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [rankings, setRankings] = useState<TournamentRankingEntry[]>([]);
  const [playerScore, setPlayerScore] = useState<{
    score: number;
    rank: number | null;
    isVerified: boolean;
    status: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<TournamentStatus | 'all'>('active');
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadTournaments();
    getCurrentUser().then((u) => {
      if (u) setCurrentUserId(u.id);
    });
  }, []);

  const loadTournaments = async () => {
    setIsLoading(true);
    try {
      const data = await tournamentService.getTournaments();
      setTournaments(data);
      if (data.length > 0) {
        // Select first active or first available tournament
        const activeOne = data.find((t) => t.status === 'active') || data[0];
        setSelectedTournament(activeOne);
        await loadRankingsForTournament(activeOne);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadRankingsForTournament = async (t: Tournament) => {
    const list = await tournamentService.getTournamentRankings(t);
    setRankings(list);

    const user = await getCurrentUser();
    if (user) {
      const pScore = await tournamentService.getPlayerTournamentScore(t, user.id);
      setPlayerScore(pScore);
    } else {
      setPlayerScore(null);
    }
  };

  const handleSelectTournament = async (t: Tournament) => {
    setSelectedTournament(t);
    await loadRankingsForTournament(t);
  };

  const getGameRoute = (gameId: GameId): PageNav => {
    switch (gameId) {
      case 'coin-rush':
        return 'play';
      case 'treasure-hunt':
        return 'play-treasure';
      case 'puzzle-master':
        return 'play-puzzle';
      case 'speed-tap':
        return 'play-speedtap';
      default:
        return 'play';
    }
  };

  const getGameBadge = (gameId: GameId) => {
    switch (gameId) {
      case 'coin-rush':
        return { name: 'PINN Coin Rush', color: 'from-amber-500 to-yellow-600' };
      case 'treasure-hunt':
        return { name: 'PINN Treasure Hunt', color: 'from-emerald-500 to-teal-600' };
      case 'puzzle-master':
        return { name: 'PINN Puzzle Master', color: 'from-cyan-500 to-blue-600' };
      case 'speed-tap':
        return { name: 'PINN Speed Tap', color: 'from-purple-500 to-pink-600' };
      default:
        return { name: 'PINN Game', color: 'from-amber-500 to-yellow-600' };
    }
  };

  const getStatusBadge = (status: TournamentStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Active Tournament
          </span>
        );
      case 'upcoming':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <Clock className="w-3.5 h-3.5" />
            Upcoming
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-950/40 text-red-400 border border-red-500/30">
            Cancelled
          </span>
        );
    }
  };

  const filteredTournaments = tournaments.filter((t) => {
    if (activeTab === 'all') return true;
    return t.status === activeTab;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col items-center">
      {/* Header */}
      <div className="text-center mb-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-gold-subtle/50 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-3">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Official Arcade Competitions</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight">
          TOURNAMENTS & LEAGUES
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 mt-2">
          Compete in high-stakes arcade seasons across all 4 games. Only server-verified scores count
          toward official rankings and eligible $PINN prize pools.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8 bg-zinc-950/80 p-1.5 rounded-2xl border border-gold-subtle/30">
        {(['active', 'upcoming', 'completed', 'all'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === tab
                ? 'bg-gold-gradient text-black shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            {tab === 'active' && 'Active Tournaments'}
            {tab === 'upcoming' && 'Upcoming'}
            {tab === 'completed' && 'Completed Results'}
            {tab === 'all' && 'All Tournaments'}
          </button>
        ))}
      </div>

      {/* Main Grid: Tournament List on Left, Detail & Leaderboard on Right */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Tournament Cards (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
              Select Tournament ({filteredTournaments.length})
            </h2>
            <button
              onClick={loadTournaments}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {filteredTournaments.length === 0 ? (
            <div className="p-8 text-center bg-zinc-950 border border-zinc-800 rounded-2xl text-zinc-400 text-sm">
              No tournaments found for this filter.
            </div>
          ) : (
            filteredTournaments.map((t) => {
              const isSelected = selectedTournament?.id === t.id;
              const badge = getGameBadge(t.gameId);
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTournament(t)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer text-left relative overflow-hidden ${
                    isSelected
                      ? 'bg-zinc-900/90 border-amber-500/80 shadow-lg shadow-amber-500/10'
                      : 'bg-zinc-950/80 border-gold-subtle/30 hover:border-gold-subtle/60 hover:bg-zinc-900/50'
                  }`}
                >
                  {/* Active highlight glow */}
                  {isSelected && (
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-400 to-yellow-600" />
                  )}

                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full text-white bg-gradient-to-r ${badge.color}`}
                    >
                      {badge.name}
                    </span>
                    {getStatusBadge(t.status)}
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-amber-300 line-clamp-1 mb-1">
                    {t.title}
                  </h3>

                  <p className="text-xs text-zinc-400 line-clamp-2 mb-3">
                    {t.description}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                      <Coins className="w-3.5 h-3.5" />
                      <span>{t.prizePool}</span>
                    </div>

                    <div className="flex items-center gap-1 text-zinc-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {new Date(t.startDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        -{' '}
                        {new Date(t.endDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT COLUMN: Selected Tournament Details & Verified Leaderboard (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {selectedTournament ? (
            <>
              {/* Tournament Banner Card */}
              <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-gold-subtle/50 shadow-2xl relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white bg-gradient-to-r ${
                        getGameBadge(selectedTournament.gameId).color
                      }`}
                    >
                      {getGameBadge(selectedTournament.gameId).name}
                    </span>
                    {getStatusBadge(selectedTournament.status)}
                  </div>

                  {/* Play Game Button */}
                  {selectedTournament.status === 'active' && (
                    <button
                      onClick={() => onNavigate(getGameRoute(selectedTournament.gameId))}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-black" />
                      <span>Play Tournament</span>
                    </button>
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white font-serif tracking-tight mb-2">
                  {selectedTournament.title}
                </h2>

                <p className="text-sm text-zinc-300 mb-6 leading-relaxed">
                  {selectedTournament.description}
                </p>

                {/* Prize & Rules Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {/* Prize Details */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-amber-500/30 flex flex-col">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-2">
                      <Award className="w-4 h-4" />
                      <span>Prize Description</span>
                    </div>
                    <div className="text-xl font-black text-gold-gradient font-serif mb-1">
                      {selectedTournament.prizePool}
                    </div>
                    <p className="text-xs text-zinc-300">
                      {selectedTournament.prizeDescription}
                    </p>
                  </div>

                  {/* Anti-Cheat & Rules */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-gold-subtle/30 flex flex-col">
                    <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs uppercase tracking-wider mb-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Tournament Rules</span>
                    </div>
                    <p className="text-xs text-zinc-300 mb-2">
                      {selectedTournament.rules}
                    </p>
                    <div className="mt-auto text-[11px] text-amber-400/90 font-mono-arcade flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Only verified server scores count toward rankings.</span>
                    </div>
                  </div>
                </div>

                {/* Player's Own Score Status Card */}
                <div className="p-4 rounded-2xl bg-black/60 border border-gold-subtle/40 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-gold-subtle/50 flex items-center justify-center text-amber-400">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-zinc-400 font-bold">
                        Your Tournament Status
                      </div>
                      {playerScore ? (
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-white">
                            Score: {playerScore.score.toLocaleString()}
                          </span>
                          {playerScore.isVerified ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                              Rank #{playerScore.rank || 'N/A'} (Verified)
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                              Status: {playerScore.status} (Pending Validation)
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-400">
                          {currentUserId ? (
                            'No verified tournament score submitted yet. Play to rank!'
                          ) : (
                            <span>
                              Sign in to submit verified scores & track rankings.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {!currentUserId && onOpenAuthModal && (
                    <button
                      onClick={onOpenAuthModal}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-gold-subtle/50 text-xs font-bold uppercase tracking-wider text-amber-400 transition-colors cursor-pointer"
                    >
                      Player Sign In
                    </button>
                  )}
                </div>
              </div>

              {/* Verified Official Rankings Table */}
              <div className="p-6 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white uppercase font-serif tracking-tight flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>Official Tournament Rankings</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Fair-play verified submissions only. Pending or rejected scores are strictly excluded.
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 border border-gold-subtle/40 text-amber-400 font-mono-arcade">
                    {rankings.length} Verified Entries
                  </span>
                </div>

                {rankings.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400 text-sm">
                    No verified scores recorded for this tournament yet. Be the first to submit a verified run!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[11px] tracking-wider">
                          <th className="py-3 px-3">Rank</th>
                          <th className="py-3 px-3">Player</th>
                          <th className="py-3 px-3">Score</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3 text-right">Potential Prize</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {rankings.map((entry) => {
                          const isPodium = entry.rank <= 3;
                          return (
                            <tr
                              key={`${entry.rank}-${entry.playerId}`}
                              className={`transition-colors ${
                                isPodium ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-zinc-900/40'
                              }`}
                            >
                              {/* Rank */}
                              <td className="py-3 px-3 font-bold">
                                {entry.rank === 1 && (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gold-gradient text-black font-extrabold text-xs shadow-sm shadow-amber-500/30">
                                    1
                                  </span>
                                )}
                                {entry.rank === 2 && (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-300 text-black font-bold text-xs">
                                    2
                                  </span>
                                )}
                                {entry.rank === 3 && (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-800 text-white font-bold text-xs">
                                    3
                                  </span>
                                )}
                                {entry.rank > 3 && (
                                  <span className="text-zinc-400 ml-2">#{entry.rank}</span>
                                )}
                              </td>

                              {/* Player */}
                              <td className="py-3 px-3 font-semibold text-white">
                                <div className="flex flex-col">
                                  <span>{entry.playerName}</span>
                                  {entry.walletAddress && (
                                    <span className="text-[10px] text-zinc-500 font-mono-arcade">
                                      {entry.walletAddress}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Score */}
                              <td className="py-3 px-3 font-mono-arcade text-amber-300 font-bold text-sm">
                                {entry.score.toLocaleString()}
                              </td>

                              {/* Status */}
                              <td className="py-3 px-3">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Verified</span>
                                </span>
                              </td>

                              {/* Potential Prize */}
                              <td className="py-3 px-3 text-right">
                                {entry.potentialPrize ? (
                                  <span className="text-xs font-bold text-gold-gradient font-serif">
                                    {entry.potentialPrize}
                                  </span>
                                ) : (
                                  <span className="text-zinc-500 text-xs">-</span>
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
            </>
          ) : (
            <div className="p-12 text-center bg-zinc-950 border border-zinc-800 rounded-3xl text-zinc-400">
              Select a tournament to view details and rankings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
