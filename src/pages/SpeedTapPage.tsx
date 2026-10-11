import React from 'react';
import { Zap, Send, Trophy, ArrowRight, ShieldCheck } from 'lucide-react';
import { PinnSpeedTap } from '../components/game/PinnSpeedTap';
import { PageNav } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';

interface SpeedTapPageProps {
  onNavigate: (page: PageNav) => void;
}

export const SpeedTapPage: React.FC<SpeedTapPageProps> = ({ onNavigate }) => {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col items-center">
      {/* Back to Games Hub & Quick Switcher */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-6">
        <button
          onClick={() => onNavigate('games')}
          className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
        >
          <span>← Back to All Games Hub</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-zinc-500 hidden sm:inline">Switch Game:</span>
          <button
            onClick={() => onNavigate('play')}
            className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
          >
            Coin Rush
          </button>
          <button
            onClick={() => onNavigate('play-treasure')}
            className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
          >
            Treasure Hunt
          </button>
          <button
            onClick={() => onNavigate('play-puzzle')}
            className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
          >
            Puzzle Master
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-rose-500/30 text-rose-300 text-xs font-semibold uppercase tracking-wider mb-2">
          <Zap className="w-3.5 h-3.5" />
          <span>Reflex & Precision Sprint</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight">
          PINN SPEED TAP
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 font-mono-arcade mt-1 uppercase tracking-wider">
          30-Second Countdown · Fast Targets · Dodge Traps
        </p>
      </div>

      {/* Game Component */}
      <PinnSpeedTap
        onBackToHub={() => onNavigate('games')}
        onNavigateToLeaderboard={() => onNavigate('leaderboard')}
      />

      {/* Rules & Pro Tips */}
      <div className="w-full mt-8 p-6 rounded-2xl bg-zinc-950 border border-zinc-850 space-y-4">
        <h3 className="text-base font-bold text-white uppercase tracking-wider font-serif">
          Reflex Arena Rules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-300">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
            <span className="font-bold text-amber-400 uppercase block font-mono-arcade">
              Prioritize Diamonds
            </span>
            <p className="text-zinc-400 leading-relaxed">
              Cyan diamonds are worth +250 points but disappear quickly. Tap them first when they appear!
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
            <span className="font-bold text-amber-400 uppercase block font-mono-arcade">
              Never Tap Skulls
            </span>
            <p className="text-zinc-400 leading-relaxed">
              Red skull hazards dock -150 points and immediately wipe your active combo multiplier.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
            <span className="font-bold text-amber-400 uppercase block font-mono-arcade">
              Maintain Streak
            </span>
            <p className="text-zinc-400 leading-relaxed">
              5 consecutive hits give 2x points; 10 consecutive hits give 3x points on every target!
            </p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Scores stored locally · 100% Free to Play</span>
          </div>

          <button
            onClick={() => onNavigate('leaderboard')}
            className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>View Tournament Leaderboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Telegram Community Invite */}
      <div className="w-full mt-6 p-6 rounded-2xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-gold-glow flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-lg font-bold text-white uppercase tracking-wider font-serif">
            JOIN OUR TELEGRAM
          </h3>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-xl leading-relaxed">
            Compete against the fastest community tappers and climb the reaction sprint rankings in the official Telegram group.
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
