import React, { useEffect, useState } from 'react';
import {
  Gamepad2,
  Trophy,
  Play,
  Sparkles,
  Compass,
  Brain,
  Zap,
  Flame,
  Send,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { PageNav, GameId, GameInfo } from '../types';
import { leaderboardService } from '../services/leaderboardService';
import { PINN_CONFIG } from '../config/pinnConfig';

interface GamesPageProps {
  onNavigate: (page: PageNav) => void;
}

const GAMES_CATALOG: GameInfo[] = [
  {
    id: 'coin-rush',
    title: 'PINN Coin Rush',
    tagline: 'Endless Tropical Promenade Runner',
    category: '2D Action Runner',
    difficulty: 'Adaptive',
    difficultyColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    description:
      'Sprint through the luxury Montego Bay promenade. Jump over coral spikes, slide under resort awnings, and grab gold $PINN medallions.',
    features: ['Double-jump mechanics', 'Adaptive speed scaling', 'Web Audio synthesizer', 'Mobile touch & keyboard'],
    route: 'play',
  },
  {
    id: 'treasure-hunt',
    title: 'PINN Treasure Hunt',
    tagline: '10-Level Island Expedition',
    category: 'Island Exploration',
    difficulty: 'Progressive',
    difficultyColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    description:
      'Navigate 10 treacherous Jamaican coves and keys. Collect treasure chests, bypass spike traps and patrol crabs to reach the escape boat.',
    features: ['10 handcrafted island maps', 'Treasure chest bonuses', 'Virtual mobile D-pad', 'Exit vessel unlock'],
    route: 'play-treasure',
  },
  {
    id: 'puzzle-master',
    title: 'PINN Puzzle Master',
    tagline: '30+ Multi-Tier Logic Challenges',
    category: 'Logic & IQ Challenge',
    difficulty: 'Multi-tier',
    difficultyColor: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
    description:
      'Challenge your brain with sequences, pattern recognition, spatial geometry, and crypto math puzzles across Easy, Medium, and Hard tiers.',
    features: ['33 verified original questions', 'Multi-tier difficulty', 'Streak combo multipliers', 'Speed bonus timer'],
    route: 'play-puzzle',
  },
  {
    id: 'speed-tap',
    title: 'PINN Speed Tap',
    tagline: '30-Second Reaction Sprint',
    category: 'Reflex & Precision',
    difficulty: 'Reflex Sprint',
    difficultyColor: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    description:
      'Test your tap speed and reaction time in a 30-second sprint. Snag gold coins and rare diamonds while dodging dangerous penalty skulls.',
    features: ['30-second countdown', 'Dynamic target scaling', 'Combo multipliers up to 3x', 'Instant touch responsiveness'],
    route: 'play-speedtap',
  },
];

export const GamesPage: React.FC<GamesPageProps> = ({ onNavigate }) => {
  const [bests, setBests] = useState(leaderboardService.getAllGameBests());

  useEffect(() => {
    setBests(leaderboardService.getAllGameBests());
  }, []);

  const getPersonalBest = (id: GameId): number => {
    switch (id) {
      case 'coin-rush':
        return bests.coinRush;
      case 'treasure-hunt':
        return bests.treasureHunt;
      case 'puzzle-master':
        return bests.puzzleMaster;
      case 'speed-tap':
        return bests.speedTap;
      default:
        return 0;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col items-center">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-gold-subtle/50 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
          <Gamepad2 className="w-3.5 h-3.5" />
          <span>Montego Bay Arcade Suite</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight">
          ARCADE GAME SELECTION
        </h1>
        <p className="text-sm text-zinc-400 max-w-xl mx-auto mt-2 leading-relaxed">
          Select an arcade title below to compete for personal bests and community leaderboard recognition. Free-to-play with no wallet required.
        </p>
      </div>

      {/* 4 Games Grid */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-12">
        {GAMES_CATALOG.map((game) => {
          const pb = getPersonalBest(game.id);

          return (
            <div
              key={game.id}
              className="bg-zinc-950 border border-gold-subtle/40 hover:border-gold-glow rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-xl hover:shadow-amber-500/10 transition-all group relative overflow-hidden"
            >
              {/* Top Accent Gradient Line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent group-hover:via-amber-400 transition-all" />

              <div>
                {/* Visual Header & Illustration Artwork */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    {/* Game CSS-Based Illustration Icon */}
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 shadow-md group-hover:scale-105 transition-transform">
                      {game.id === 'coin-rush' && <Flame className="w-6 h-6 text-amber-400" />}
                      {game.id === 'treasure-hunt' && <Compass className="w-6 h-6 text-emerald-400" />}
                      {game.id === 'puzzle-master' && <Brain className="w-6 h-6 text-sky-400" />}
                      {game.id === 'speed-tap' && <Zap className="w-6 h-6 text-rose-400" />}
                    </div>

                    <div>
                      <span className="text-[10px] font-mono-arcade text-zinc-400 uppercase tracking-wider block">
                        {game.category}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-bold text-white font-serif uppercase tracking-tight group-hover:text-amber-300 transition-colors">
                        {game.title}
                      </h3>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-mono-arcade uppercase px-2.5 py-1 rounded-full border font-semibold ${game.difficultyColor}`}
                  >
                    {game.difficulty}
                  </span>
                </div>

                {/* Tagline & Description */}
                <p className="text-xs font-semibold text-amber-400/90 mb-2 font-mono-arcade">
                  {game.tagline}
                </p>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-5">
                  {game.description}
                </p>

                {/* Feature Tags */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {game.features.map((feat, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-850 text-zinc-400"
                    >
                      {feat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Card Footer: PB & Play Button */}
              <div className="pt-4 border-t border-zinc-900 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-[10px] uppercase text-zinc-500 block font-mono-arcade">
                      Personal Best
                    </span>
                    <span className="text-sm font-bold font-mono-arcade text-gold-gradient">
                      {pb > 0 ? pb.toLocaleString() : 'No Runs Yet'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onNavigate(game.route)}
                  className="px-6 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>PLAY NOW</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Community Challenge Section */}
      <div className="w-full p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-gold-glow flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-lg font-bold text-white uppercase tracking-wider font-serif">
            COMPETE IN COMMUNITY EVENTS
          </h3>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-xl leading-relaxed">
            All 4 titles feed into seasonal tournament competitions. Join the official PINN Telegram community to stay notified of upcoming brackets!
          </p>
        </div>

        <a
          href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-widest hover:opacity-95 shadow-md shadow-amber-500/20 flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Send className="w-4 h-4 fill-current" />
          <span>JOIN TELEGRAM</span>
        </a>
      </div>
    </div>
  );
};
