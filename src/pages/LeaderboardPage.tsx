import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Send, ShieldAlert, Sparkles, User, RefreshCw, Calendar, CheckCircle2 } from 'lucide-react';
import { PageNav, LeaderboardEntry, PlayerStats } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';
import { leaderboardService } from '../services/leaderboardService';

interface LeaderboardPageProps {
  onNavigate: (page: PageNav) => void;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ onNavigate }) => {
  const [period, setPeriod] = useState<'all-time' | 'weekly'>('all-time');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats>(leaderboardService.getPlayerStats());
  const [loading, setLoading] = useState<boolean>(true);

  const fetchScores = async (selectedPeriod: 'all-time' | 'weekly') => {
    setLoading(true);
    try {
      const data = await leaderboardService.getLeaderboard(selectedPeriod);
      setEntries(data);
      setPlayerStats(leaderboardService.getPlayerStats());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores(period);
  }, [period]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 flex items-center justify-center text-black font-black text-xs shadow-md shadow-amber-500/30">
          <Trophy className="w-4 h-4 fill-current" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 flex items-center justify-center text-black font-black text-xs shadow-sm">
          <Medal className="w-4 h-4" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-700 via-amber-800 to-amber-950 text-amber-200 flex items-center justify-center font-black text-xs shadow-sm">
          <Medal className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 font-mono-arcade text-xs font-bold">
        {rank}
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col items-center">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-gold-subtle/50 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
          <Trophy className="w-3.5 h-3.5" />
          <span>Competitive Arena Rankings</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight">
          GLOBAL LEADERBOARD
        </h1>
        <p className="text-sm text-zinc-400 max-w-lg mx-auto mt-2">
          Top scoring runners in PINN Coin Rush. Compete for community glory and official tournament placement!
        </p>
      </div>

      {/* Local Player Personal Status Banner */}
      <div className="w-full mb-8 p-5 rounded-2xl bg-zinc-950 border border-gold-glow flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-gold-subtle/40 flex items-center justify-center text-amber-400 shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h3 className="text-lg font-bold text-white font-serif">{playerStats.displayName}</h3>
              <span className="text-[10px] font-mono-arcade uppercase px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                You
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Personal Best: <span className="font-mono-arcade font-bold text-gold-gradient text-sm">{playerStats.personalBest}</span>
              {' · '}Session High: <span className="font-mono-arcade text-zinc-300">{playerStats.sessionBest}</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('play')}
          className="px-6 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-95 shadow-md flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <span>BEAT YOUR SCORE</span>
        </button>
      </div>

      {/* Demo Data Disclaimer Banner */}
      <div className="w-full mb-6 p-4 rounded-xl bg-amber-950/20 border border-amber-600/40 text-xs text-amber-200/90 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-amber-300 block mb-0.5 uppercase tracking-wide">
            NOTICE: DEMONSTRATION BENCHMARKS DISPLAYED
          </strong>
          <span>
            Below are demonstration records and your local personal best. A production global leaderboard requires an authorized backend service with server-side validation, rate limiting, duplicate submission prevention, and anti-cheat checks.
          </span>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="w-full flex items-center justify-between gap-4 mb-4">
        {/* Period Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
          <button
            onClick={() => setPeriod('all-time')}
            className={`px-4 py-2 text-xs font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
              period === 'all-time'
                ? 'bg-gold-gradient text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All-Time Records
          </button>
          <button
            onClick={() => setPeriod('weekly')}
            className={`px-4 py-2 text-xs font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
              period === 'weekly'
                ? 'bg-gold-gradient text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Weekly Sprint
          </button>
        </div>

        <button
          onClick={() => fetchScores(period)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-amber-300 rounded-lg bg-zinc-950 border border-zinc-800 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="w-full bg-zinc-950 border border-gold-subtle/40 rounded-2xl overflow-hidden shadow-2xl mb-8">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-4 sm:px-6 py-3.5 bg-zinc-900/90 border-b border-zinc-800 text-[11px] font-mono-arcade uppercase tracking-wider text-zinc-400">
          <div className="col-span-2 sm:col-span-1 text-center">Rank</div>
          <div className="col-span-6 sm:col-span-5">Player Name</div>
          <div className="col-span-4 sm:col-span-3 text-right">High Score</div>
          <div className="hidden sm:block sm:col-span-3 text-right">Date / Status</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-zinc-900">
          {entries.map((entry) => {
            const isLocal = entry.id === 'local-player' || entry.displayName.includes('(You)');
            return (
              <div
                key={entry.id}
                className={`grid grid-cols-12 gap-2 px-4 sm:px-6 py-4 items-center transition-colors ${
                  isLocal
                    ? 'bg-amber-500/10 border-l-4 border-amber-400'
                    : 'hover:bg-zinc-900/50'
                }`}
              >
                {/* Rank */}
                <div className="col-span-2 sm:col-span-1 flex justify-center">
                  {getRankBadge(entry.rank)}
                </div>

                {/* Player Name */}
                <div className="col-span-6 sm:col-span-5 flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm sm:text-base font-serif">
                      {entry.displayName}
                    </span>
                    {entry.isVerified && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono-arcade">
                    {entry.coinsCollected} coins gathered
                  </span>
                </div>

                {/* Score */}
                <div className="col-span-4 sm:col-span-3 text-right flex flex-col justify-center">
                  <span className="text-base sm:text-lg font-bold font-mono-arcade text-gold-gradient">
                    {entry.score.toLocaleString()}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                    points
                  </span>
                </div>

                {/* Date & Demo Tag */}
                <div className="hidden sm:flex sm:col-span-3 flex-col items-end justify-center text-xs text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-zinc-400" />
                    <span>{entry.dateAchieved}</span>
                  </div>
                  {entry.isDemo ? (
                    <span className="text-[10px] text-amber-400/80 uppercase font-mono-arcade">
                      DEMO BENCHMARK
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-400 uppercase font-mono-arcade">
                      LOCAL RECORD
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mandatory Telegram CTA Section (Requirement 9.D) */}
      <div className="w-full p-8 rounded-3xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-gold-glow text-center flex flex-col items-center shadow-xl mb-8">
        <div className="w-12 h-12 rounded-xl bg-gold-gradient flex items-center justify-center text-black mb-3 shadow-md shadow-amber-500/20">
          <Send className="w-6 h-6 fill-current" />
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-wider font-serif mb-2">
          COMPETE WITH THE PINN COMMUNITY
        </h3>

        <p className="text-xs sm:text-sm text-zinc-300 max-w-lg mb-6 leading-relaxed">
          Join the official PINN Telegram group for competition announcements and community updates.
        </p>

        <a
          href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-7 py-3.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-widest hover:opacity-95 shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4 fill-current" />
          <span>JOIN TELEGRAM</span>
        </a>

        <span className="text-[11px] text-zinc-400 mt-3 font-mono-arcade">
          {PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
        </span>
      </div>

      {/* Architecture Architecture Info Box for Production */}
      <div className="w-full p-5 rounded-2xl bg-zinc-950 border border-zinc-850 text-xs text-zinc-400 space-y-2">
        <h4 className="font-bold text-white uppercase tracking-wider text-xs">
          Production Architecture & Security Roadmap
        </h4>
        <p className="leading-relaxed">
          To transition this local leaderboard into a tamper-proof global competition system, connect a backend API (such as Node/Express or Firebase Cloud Functions) providing:
        </p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 pt-1">
          <li>Server-side run replay or cryptographic telemetry validation to prevent speedhacking.</li>
          <li>IP and device rate-limiting with anti-spam throttles.</li>
          <li>Server-generated timestamps and deduplicated submission queues.</li>
          <li>Admin dashboard for manual review and disqualification of malicious clients.</li>
        </ul>
      </div>
    </div>
  );
};
