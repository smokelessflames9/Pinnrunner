import React from 'react';
import {
  Play,
  Trophy,
  Send,
  Flame,
  Sparkles,
  ArrowRight,
  Compass,
  ExternalLink,
} from 'lucide-react';
import { PageNav } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';
import { TokenHubSection } from '../components/TokenHubSection';
import { trackPinnEvent } from '../services/analyticsService';

interface HomePageProps {
  onNavigate: (page: PageNav) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const handleHeroPlayNow = () => {
    trackPinnEvent('pinn_homepage_play_clicked', {
      section: 'hero_primary_cta',
    });
    onNavigate('games');
  };

  const handleExplorePinnScroll = () => {
    const el = document.getElementById('pinn-token-hub');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleHeroTelegramClick = () => {
    trackPinnEvent('pinn_telegram_clicked', {
      platform: 'telegram',
      section: 'hero_telegram_cta',
    });
  };

  const handleSpotlightPlayClick = () => {
    trackPinnEvent('pinn_homepage_play_clicked', {
      section: 'featured_game_spotlight',
    });
    onNavigate('play');
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* 1. HOMEPAGE HERO SECTION */}
      <section className="relative w-full overflow-hidden bg-gradient-to-b from-black via-[#060d1a] to-black pt-14 pb-20 sm:pt-20 sm:pb-24 border-b border-sky-500/20 bg-montegobay-grid">
        {/* Subtle Ambient Electric Blue & Gold Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[340px] bg-sky-500/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute -top-10 right-10 w-72 h-72 bg-amber-500/10 blur-[110px] rounded-full pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          {/* Brand Kicker */}
          <div className="inline-flex items-center gap-2 text-amber-300 text-xs font-semibold uppercase tracking-widest mb-5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>PINN Arcade · Montego Bay Solana Gaming &amp; $PINN Ecosystem</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white uppercase font-serif mb-4 leading-tight max-w-4xl">
            PLAY THE GAME.{' '}
            <span className="text-gold-gradient drop-shadow-md">JOIN THE MOVEMENT.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-slate-200 max-w-2xl leading-relaxed mb-8">
            Welcome to PINN Arcade — your destination for arcade gaming, community competition,
            and the growing <span className="text-amber-300 font-bold">$PINN</span> ecosystem.
          </p>

          {/* Primary & Secondary Hero Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-xl mb-8">
            {/* Primary CTA: PLAY NOW */}
            <button
              type="button"
              onClick={handleHeroPlayNow}
              className="w-full sm:flex-1 px-8 py-4 rounded-xl bg-gold-gradient text-black font-extrabold text-sm sm:text-base uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 whitespace-nowrap"
            >
              <Play className="w-5 h-5 fill-current shrink-0" />
              <span>PLAY NOW</span>
            </button>

            {/* Secondary CTA: EXPLORE $PINN */}
            <button
              type="button"
              onClick={handleExplorePinnScroll}
              className="w-full sm:flex-1 px-7 py-4 rounded-xl bg-[#0b162c]/90 hover:bg-[#102040] text-sky-200 border border-sky-400/50 hover:border-sky-300 font-extrabold text-sm sm:text-base uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-sky-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap"
            >
              <Compass className="w-5 h-5 text-sky-400 shrink-0" />
              <span>EXPLORE $PINN</span>
            </button>
          </div>

          {/* Quick Arcade Links (Direct Coin Rush & Leaderboard Access) */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-zinc-300 mb-10">
            <button
              type="button"
              onClick={handleSpotlightPlayClick}
              className="hover:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-amber-400" />
              <span>Launch PINN Coin Rush</span>
            </button>
            <span aria-hidden="true" className="text-zinc-600">
              ·
            </span>
            <button
              type="button"
              onClick={() => onNavigate('leaderboard')}
              className="hover:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>View Global Leaderboard</span>
            </button>
            <span aria-hidden="true" className="text-zinc-600">
              ·
            </span>
            <button
              type="button"
              onClick={() => onNavigate('tournaments')}
              className="hover:text-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Active Tournaments</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>

          {/* Telegram Quick Bar in Hero */}
          <div className="w-full max-w-lg p-4 rounded-2xl bg-zinc-950/90 border border-gold-subtle/50 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
            <div className="text-center sm:text-left">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Official $PINN Telegram Community
              </span>
              <span className="text-[11px] text-zinc-400">
                Project updates, tournament brackets &amp; community events
              </span>
            </div>
            <a
              href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleHeroTelegramClick}
              className="px-5 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-95 flex items-center gap-2 shrink-0 cursor-pointer shadow-sm whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5 fill-current" />
              <span>JOIN TELEGRAM</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>

      {/* 2. DEDICATED $PINN TOKEN HUB, ANNOUNCEMENT BANNER, COMMUNITY ACCESS & TRANSPARENCY PANEL */}
      <TokenHubSection onNavigate={onNavigate} />

      {/* 3. FEATURED GAME SPOTLIGHT */}
      <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-gold-subtle/50 rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
          <div className="space-y-4 max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-amber-400 font-mono-arcade">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Flagship Browser Game · 4 Arcade Titles Available</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-serif uppercase tracking-tight">
              PINN COIN RUSH
            </h2>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              Sprint along the Montego Bay promenade. Jump over tropical reef obstacles, slide
              under resort awnings, grab shimmering gold $PINN coins, and climb the local &amp;
              global leaderboards!
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs text-zinc-400 pt-1">
              <span>100% Free to Play</span>
              <span aria-hidden="true">·</span>
              <span>Mobile &amp; Desktop</span>
              <span aria-hidden="true">·</span>
              <span>Audio &amp; Touch Controls</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSpotlightPlayClick}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gold-gradient text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:scale-105 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>PLAY COIN RUSH</span>
            </button>
            <button
              type="button"
              onClick={() => {
                trackPinnEvent('pinn_homepage_play_clicked', {
                  section: 'explore_all_games_button',
                });
                onNavigate('games');
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-gold-subtle/40 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>EXPLORE ALL 4 GAMES</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-zinc-400 font-mono-arcade">
              No wallet or account required
            </span>
          </div>
        </div>
      </section>

      {/* 4. FUTURE TOKEN UTILITY (PLANNED) */}
      <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-4xl font-black text-white font-serif uppercase tracking-tight mb-2">
            FUTURE <span className="text-gold-gradient">$PINN</span> UTILITY
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            Upcoming ecosystem capabilities planned for future releases. All features below are
            explicitly in roadmap planning.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PINN_CONFIG.PLANNED_UTILITIES.map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-gold-subtle/50 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono-arcade text-amber-400">
                  <span>0{idx + 1}.</span>
                  <span>{item.status}</span>
                </div>
                <h3 className="text-base font-bold text-white uppercase tracking-wide">
                  {item.title}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/70 text-center text-xs text-zinc-400 max-w-2xl mx-auto">
          Note: No token purchases are implemented in the initial release. Holding tokens does not
          guarantee price appreciation or investment returns.
        </div>
      </section>
    </div>
  );
};
