import React from 'react';
import { ExternalLink, Vote, Compass, BarChart3, Radar } from 'lucide-react';
import { TokenHubPlatformConfig } from '../config/pinnConfig';
import { trackPinnEvent } from '../services/analyticsService';

interface TokenPlatformCardProps {
  platform: TokenHubPlatformConfig;
}

export const TokenPlatformCard: React.FC<TokenPlatformCardProps> = ({ platform }) => {
  const isPrimary = Boolean(platform.isPrimaryPromotion);

  const handleCardClick = () => {
    trackPinnEvent(platform.eventName, {
      platform: platform.id,
      section: 'token_hub',
    });
  };

  const renderPlatformEmblem = () => {
    switch (platform.id) {
      case 'coinbuzzer':
        return (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 via-sky-500/20 to-amber-500/10 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
            <Vote className="w-5 h-5" />
          </div>
        );
      case 'coinboom':
        return (
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0">
            <Compass className="w-5 h-5" />
          </div>
        );
      case 'dexscreener':
        return (
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
        );
      case 'fomo':
        return (
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
            <Radar className="w-5 h-5" />
          </div>
        );
    }
  };

  return (
    <a
      href={platform.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleCardClick}
      aria-label={`${platform.platformName} — ${platform.heading}. ${platform.buttonLabel} (opens in a new tab)`}
      className={`group relative flex flex-col justify-between rounded-2xl p-6 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black hover:-translate-y-1 ${
        isPrimary
          ? 'bg-gradient-to-b from-[#0b162c] via-[#090d16] to-zinc-950 border-2 border-amber-400/70 hover:border-amber-300 shadow-[0_0_30px_-6px_rgba(212,175,55,0.28)]'
          : 'bg-gradient-to-b from-[#0a1120] via-zinc-950 to-black border border-sky-500/25 hover:border-sky-400/60 shadow-lg hover:shadow-[0_0_24px_-8px_rgba(56,189,248,0.25)]'
      }`}
    >
      {/* Top Section: Platform Identity & Heading */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {renderPlatformEmblem()}
            <div>
              <span
                className={`block text-sm font-extrabold tracking-wide ${
                  isPrimary ? 'text-amber-300' : 'text-sky-300'
                }`}
              >
                {platform.platformName}
              </span>
              <span className="block text-[11px] text-zinc-400 font-mono-arcade">
                Solana · $PINN
              </span>
            </div>
          </div>

          {platform.badge ? (
            <span className="text-[10px] font-mono-arcade font-bold uppercase tracking-wider text-amber-300">
              {platform.badge}
            </span>
          ) : (
            <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-sky-300 transition-colors shrink-0 mt-1" />
          )}
        </div>

        <div className="space-y-2 pt-1">
          <h3 className="text-lg font-black text-white font-serif tracking-tight uppercase">
            {platform.heading}
          </h3>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            {platform.description}
          </p>
        </div>
      </div>

      {/* Bottom CTA Button */}
      <div className="pt-6 mt-6 border-t border-white/10">
        <span
          className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
            isPrimary
              ? 'bg-gold-gradient text-black shadow-md shadow-amber-500/20 group-hover:opacity-95'
              : 'bg-sky-500/15 group-hover:bg-sky-500/25 text-sky-200 border border-sky-400/40 group-hover:border-sky-300'
          }`}
        >
          <span>{platform.buttonLabel}</span>
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
        </span>
      </div>
    </a>
  );
};
