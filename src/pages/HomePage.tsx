import React, { useState } from 'react';
import { Play, Trophy, Send, Copy, Check, ExternalLink, ShieldCheck, Flame, Sparkles, Award } from 'lucide-react';
import { PageNav } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';

interface HomePageProps {
  onNavigate: (page: PageNav) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyMint = () => {
    navigator.clipboard.writeText(PINN_CONFIG.TOKEN_MINT_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* 1. HERO SECTION */}
      <section className="relative w-full overflow-hidden bg-gradient-to-b from-black via-zinc-950 to-black pt-16 pb-20 sm:pt-24 sm:pb-28 border-b border-gold-subtle/30 bg-montegobay-grid">
        {/* Subtle Ambient Gold Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-amber-500/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute -top-10 right-10 w-72 h-72 bg-amber-600/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/90 border border-gold-subtle/60 text-amber-300 text-xs font-semibold uppercase tracking-widest mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Montego Bay Solana Gaming Ecosystem</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white uppercase font-serif mb-4 leading-tight">
            WELCOME TO <br />
            <span className="text-gold-gradient drop-shadow-md">PINN ARCADE</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-2xl font-bold text-amber-200/90 tracking-wide font-serif max-w-2xl mb-4">
            Enter the arena. Beat the leaderboard. Become a PINN champion.
          </p>

          {/* Supporting Text */}
          <p className="text-sm sm:text-base text-zinc-300 max-w-2xl leading-relaxed mb-8">
            Experience a gaming world inspired by the luxury and energy of Montego Bay, Jamaica.
            Play arcade games, challenge other players, climb the leaderboard, and participate in the PINN community.
          </p>

          {/* Hero Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 w-full max-w-xl mb-12">
            {/* Primary: PLAY NOW */}
            <button
              onClick={() => onNavigate('play')}
              className="flex-1 min-w-[180px] px-8 py-4 rounded-xl bg-gold-gradient text-black font-extrabold text-sm sm:text-base uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>PLAY NOW</span>
            </button>

            {/* Secondary: VIEW LEADERBOARD */}
            <button
              onClick={() => onNavigate('leaderboard')}
              className="flex-1 min-w-[180px] px-7 py-4 rounded-xl bg-zinc-900/90 hover:bg-zinc-850 text-amber-300 border border-gold-subtle font-bold text-sm sm:text-base uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>VIEW LEADERBOARD</span>
            </button>
          </div>

          {/* Telegram CTA in Hero */}
          <div className="w-full max-w-md p-4 rounded-2xl bg-zinc-950/80 border border-gold-subtle/50 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
            <div className="text-center sm:text-left">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Official Telegram Group
              </span>
              <span className="text-[11px] text-zinc-400">
                Tournament updates & community events
              </span>
            </div>
            <a
              href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-95 flex items-center gap-2 shrink-0 cursor-pointer shadow-sm"
            >
              <Send className="w-3.5 h-3.5 fill-current" />
              <span>JOIN THE PINN COMMUNITY</span>
            </a>
          </div>
        </div>
      </section>

      {/* 2. TOKEN INFORMATION SECTION */}
      <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-zinc-950 border border-gold-glow rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Subtle gold line accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gold-gradient" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase font-mono-arcade text-amber-400 tracking-wider mb-1">
                <span>Verified Solana Project</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white font-serif uppercase tracking-tight">
                {PINN_CONFIG.TOKEN_NAME}
              </h2>
              <span className="text-sm font-bold text-zinc-400 font-mono-arcade">
                Ticker: <span className="text-gold-gradient font-black">${PINN_CONFIG.TOKEN_SYMBOL}</span>
              </span>
            </div>

            {/* Solana Chain Badge */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span>Network: {PINN_CONFIG.BLOCKCHAIN}</span>
            </div>
          </div>

          {/* Token Mint Address Box */}
          <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-zinc-400 font-mono-arcade">
                Token Mint Address
              </span>
              <span className="text-[11px] text-amber-400/90 font-mono-arcade">SPL Token</span>
            </div>

            <div className="p-3 bg-black/80 rounded-xl border border-zinc-800 text-xs sm:text-sm font-mono-arcade text-amber-300 break-all select-all font-semibold">
              {PINN_CONFIG.TOKEN_MINT_ADDRESS}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {/* Copy Address Button */}
              <button
                onClick={handleCopyMint}
                className="px-5 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/10"
              >
                {copied ? <Check className="w-4 h-4 text-black stroke-[3]" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'MINT ADDRESS COPIED!' : 'COPY TOKEN ADDRESS'}</span>
              </button>

              {/* View on Solscan Button */}
              <a
                href={PINN_CONFIG.SOLSCAN_TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2 border border-zinc-700"
              >
                <span>VIEW ON SOLSCAN</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              </a>
            </div>
          </div>

          {/* Required Disclaimer */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 text-xs text-zinc-400 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Risk Disclaimer:</strong> Cryptocurrency prices can fluctuate substantially and participation does not guarantee profits. Official project configuration is verified via the mint address above. PINN Arcade does not display fabricated market caps, trading volumes, or prices.
            </p>
          </div>
        </div>
      </section>

      {/* 3. FEATURED GAME SPOTLIGHT */}
      <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-gold-subtle/50 rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
          <div className="space-y-4 max-w-lg text-center md:text-left">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-amber-400 font-mono-arcade">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Flagship Browser Game</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-serif uppercase tracking-tight">
              PINN COIN RUSH
            </h2>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Sprint along the Montego Bay promenade. Jump over tropical reef obstacles, slide under resort awnings, grab shimmering gold $PINN coins, and climb the local & global leaderboards!
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-zinc-400 pt-2">
              <span className="px-3 py-1 bg-zinc-900 rounded-lg border border-zinc-800">100% Free to Play</span>
              <span className="px-3 py-1 bg-zinc-900 rounded-lg border border-zinc-800">Mobile & Desktop</span>
              <span className="px-3 py-1 bg-zinc-900 rounded-lg border border-zinc-800">Audio & Touch Controls</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 shrink-0">
            <button
              onClick={() => onNavigate('play')}
              className="px-8 py-4 rounded-xl bg-gold-gradient text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:scale-105 transition-all flex items-center gap-2.5 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>LAUNCH GAME NOW</span>
            </button>
            <span className="text-[11px] text-zinc-400 font-mono-arcade">
              No wallet or account required
            </span>
          </div>
        </div>
      </section>

      {/* 4. FUTURE TOKEN UTILITY (PLANNED) */}
      <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-4xl font-black text-white font-serif uppercase tracking-tight mb-2">
            FUTURE <span className="text-gold-gradient">$PINN</span> UTILITY
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            Upcoming ecosystem capabilities planned for future releases. All features below are explicitly in roadmap planning.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PINN_CONFIG.PLANNED_UTILITIES.map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-gold-subtle/50 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400">
                    {idx + 1}
                  </span>
                  <span className="text-[10px] font-mono-arcade uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
                    {item.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white uppercase tracking-wide">
                  {item.title}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-zinc-900 text-[11px] text-zinc-400 font-mono-arcade">
                Status: In Design Phase
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/70 text-center text-xs text-zinc-400 max-w-2xl mx-auto">
          Note: No token purchases are implemented in the initial release. Holding tokens does not guarantee price appreciation or investment returns.
        </div>
      </section>

      {/* 5. COMMUNITY INVITATION CTA */}
      <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="bg-gradient-to-b from-zinc-950 to-black border border-gold-glow rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-gold-gradient flex items-center justify-center text-black mb-4 shadow-lg shadow-amber-500/20">
            <Send className="w-7 h-7 fill-current" />
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white font-serif uppercase tracking-tight mb-3">
            JOIN THE PINN COMMUNITY
          </h2>

          <p className="text-sm sm:text-base text-zinc-300 max-w-xl mb-8 leading-relaxed">
            Connect with fellow players, participate in announced community tournaments, view verified winners, and stay ahead with official updates.
          </p>

          <a
            href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 rounded-xl bg-gold-gradient text-black font-extrabold text-sm uppercase tracking-widest hover:opacity-95 shadow-lg shadow-amber-500/25 flex items-center gap-2.5 cursor-pointer"
          >
            <Send className="w-4 h-4 fill-current" />
            <span>JOIN THE PINN COMMUNITY NOW</span>
          </a>

          <span className="text-xs text-zinc-400 mt-4 font-mono-arcade">
            Official link: {PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
          </span>
        </div>
      </section>
    </div>
  );
};
