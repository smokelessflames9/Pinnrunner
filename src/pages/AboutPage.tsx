import React from 'react';
import { Send, Sparkles, ShieldCheck, MapPin, Target, Compass, Award } from 'lucide-react';
import { PageNav } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';

interface AboutPageProps {
  onNavigate: (page: PageNav) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 flex flex-col items-center">
      {/* Page Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-gold-subtle/50 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-3">
          <Compass className="w-3.5 h-3.5" />
          <span>Project Philosophy & Vision</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight">
          ABOUT PINN ARCADE
        </h1>
        <p className="text-sm text-zinc-400 font-mono-arcade mt-2 uppercase tracking-wider">
          {PINN_CONFIG.TAGLINE}
        </p>
      </div>

      {/* Main Narrative Card */}
      <div className="w-full bg-zinc-950 border border-gold-glow rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 mb-10 leading-relaxed text-zinc-300 text-sm sm:text-base">
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-900">
          <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center text-black font-bold">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-serif uppercase tracking-wider">
              Montego Bay Inspiration
            </h2>
            <span className="text-xs text-zinc-400">Caribbean Energy Meets Solana Gaming</span>
          </div>
        </div>

        <p>
          PINN Arcade is a community gaming project inspired by <strong>The Pinnacle Montego Bay</strong> and the vibrant energy of Jamaica.
        </p>

        <p>
          Our goal is to combine accessible browser gaming, friendly competition, and community participation in one seamless digital experience.
        </p>

        <p>
          Players can jump straight into <strong>PINN Coin Rush</strong>, improve their personal scores, explore the global leaderboard, and follow official tournament announcements.
        </p>

        <p>
          PINN Arcade is being developed as an expanding gaming ecosystem, with additional games and optional token utility planned for future releases.
        </p>

        <div className="pt-4 border-t border-zinc-900 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <span className="font-bold text-amber-400 uppercase block font-mono-arcade">Accessible Fun</span>
            <p className="text-zinc-400">Zero friction, free-to-play, no compulsory wallet connection required.</p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <span className="font-bold text-amber-400 uppercase block font-mono-arcade">Honest Data</span>
            <p className="text-zinc-400">Real token contract configuration on Solana without fabricated market statistics.</p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
            <span className="font-bold text-amber-400 uppercase block font-mono-arcade">Community First</span>
            <p className="text-zinc-400">Organized around active community competitions and authentic interaction.</p>
          </div>
        </div>
      </div>

      {/* Official Telegram Call to Action */}
      <div className="w-full p-8 rounded-3xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-gold-glow text-center flex flex-col items-center shadow-2xl mb-10">
        <div className="w-12 h-12 rounded-xl bg-gold-gradient flex items-center justify-center text-black mb-4 shadow-md shadow-amber-500/20">
          <Send className="w-6 h-6 fill-current" />
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-wider font-serif mb-2">
          JOIN THE PINN COMMUNITY
        </h3>

        <p className="text-xs sm:text-sm text-zinc-300 max-w-md mb-6 leading-relaxed">
          Follow the official PINN Telegram group for community updates, gaming announcements, and competitive tournaments.
        </p>

        <a
          href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-8 py-3.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-widest hover:opacity-95 shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4 fill-current" />
          <span>JOIN THE PINN COMMUNITY</span>
        </a>

        <span className="text-xs text-zinc-400 mt-3 font-mono-arcade">
          {PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
        </span>
      </div>

      {/* Compliance / Authenticity Notice */}
      <div className="w-full p-4 rounded-2xl bg-zinc-950 border border-zinc-850 text-xs text-zinc-400 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          PINN Arcade makes no claims of unverified endorsements, institutional banking partnerships, or guaranteed financial investments. The project is an independent community gaming initiative connected to The Pinnacle Montego Bay ($PINN) meme coin ecosystem on Solana.
        </p>
      </div>
    </div>
  );
};
