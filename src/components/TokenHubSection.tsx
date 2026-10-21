import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Play,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  ArrowDown,
  BarChart3,
} from 'lucide-react';
import { PageNav } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';
import { TokenPlatformCard } from './TokenPlatformCard';
import { trackPinnEvent } from '../services/analyticsService';

interface TokenHubSectionProps {
  onNavigate: (page: PageNav) => void;
}

/**
 * Copies text to clipboard using the modern Clipboard API with a synchronous
 * offscreen textarea fallback for browsers where navigator.clipboard is unavailable.
 */
async function copyTextWithFallback(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy execCommand fallback
    }
  }

  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.top = '-9999px';
      textArea.style.left = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);
      return copied;
    } catch {
      return false;
    }
  }

  return false;
}

export const TokenHubSection: React.FC<TokenHubSectionProps> = ({ onNavigate }) => {
  const [copiedContract, setCopiedContract] = useState(false);
  const hubSectionRef = useRef<HTMLDivElement | null>(null);
  const hasTrackedViewRef = useRef(false);

  useEffect(() => {
    const el = hubSectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasTrackedViewRef.current) {
            hasTrackedViewRef.current = true;
            trackPinnEvent('pinn_token_hub_viewed', { section: 'token_hub' });
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScrollToHubCards = () => {
    const target = document.getElementById('pinn-token-hub-cards');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCopyContract = async () => {
    const ok = await copyTextWithFallback(PINN_CONFIG.TOKEN_MINT_ADDRESS);
    if (ok) {
      setCopiedContract(true);
      trackPinnEvent('pinn_contract_copied', {
        section: 'token_transparency_panel',
      });
      setTimeout(() => setCopiedContract(false), 3000);
    }
  };

  const handlePlayArcadeClick = () => {
    trackPinnEvent('pinn_homepage_play_clicked', {
      section: 'token_hub_community_cta',
    });
    onNavigate('games');
  };

  const handleTelegramClick = () => {
    trackPinnEvent('pinn_telegram_clicked', {
      platform: 'telegram',
      section: 'token_hub_community_cta',
    });
  };

  const handleDexScreenerTransparencyClick = () => {
    trackPinnEvent('pinn_dexscreener_clicked', {
      platform: 'dexscreener',
      section: 'token_transparency_panel',
    });
  };

  return (
    <section
      id="pinn-token-hub"
      ref={hubSectionRef}
      className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-12 scroll-mt-20"
    >
      {/* 1. ANNOUNCEMENT BANNER ABOVE THE FOUR CARDS */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#071124] via-[#0c1a36] to-[#071124] border border-sky-400/40 p-6 sm:p-8 shadow-[0_0_35px_-10px_rgba(56,189,248,0.22)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="text-xs font-mono-arcade uppercase tracking-widest text-amber-300">
              Official Ecosystem &amp; Community Listings
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white font-serif uppercase tracking-tight">
              DISCOVER $PINN — EXPLORE THE LISTINGS AND JOIN THE COMMUNITY.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Explore the official project links, review available token information, and connect
              with the $PINN community.
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleScrollToHubCards}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 whitespace-nowrap"
            >
              <span>EXPLORE $PINN</span>
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED $PINN TOKEN HUB HEADER & 4 PLATFORM CARDS */}
      <div id="pinn-token-hub-cards" className="space-y-8 scroll-mt-24">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="text-xs font-mono-arcade uppercase tracking-widest text-sky-400">
            Solana Ecosystem · Verified Links
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight">
            <span className="text-gold-gradient">$PINN</span> TOKEN HUB
          </h2>
          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
            Everything you need to discover, track, and connect with $PINN.
          </p>
        </div>

        {/* Four Clickable Platform Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PINN_CONFIG.TOKEN_HUB_PLATFORMS.map((platform) => (
            <TokenPlatformCard key={platform.id} platform={platform} />
          ))}
        </div>
      </div>

      {/* 3. OFFICIAL COMMUNITY ACCESS CTA */}
      <div className="rounded-3xl bg-gradient-to-b from-[#091224] via-zinc-950 to-black border border-sky-500/30 p-6 sm:p-10 shadow-xl">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 text-center lg:text-left">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-mono-arcade uppercase tracking-widest text-amber-400">
              Official Community Channel
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white font-serif uppercase tracking-tight">
              BE PART OF THE $PINN COMMUNITY
            </h3>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              Follow the project, connect with the community, and stay informed about the PINN
              Arcade ecosystem.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full lg:w-auto shrink-0">
            <a
              href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleTelegramClick}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 whitespace-nowrap"
            >
              <Send className="w-4 h-4 fill-current shrink-0" />
              <span>JOIN OFFICIAL TELEGRAM</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>

            <button
              type="button"
              onClick={handlePlayArcadeClick}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-sky-300 border border-sky-400/40 hover:border-sky-300 font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span>PLAY PINN ARCADE</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. TOKEN INFORMATION AND TRANSPARENCY PANEL */}
      <div className="bg-zinc-950 border border-gold-glow rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="space-y-1">
            <div className="text-xs uppercase font-mono-arcade text-amber-400 tracking-wider">
              Token Information &amp; Transparency
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white font-serif uppercase tracking-tight">
              {PINN_CONFIG.TOKEN_NAME}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-mono-arcade text-zinc-300 pt-1">
              <span>
                Project: <strong className="text-white">{PINN_CONFIG.TOKEN_NAME}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Ticker: <strong className="text-gold-gradient font-black">${PINN_CONFIG.TOKEN_SYMBOL}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Blockchain: <strong className="text-sky-300">{PINN_CONFIG.BLOCKCHAIN}</strong>
              </span>
            </div>
          </div>

          <div className="text-xs font-mono-arcade text-zinc-400">
            SPL Token · Mainnet-Beta
          </div>
        </div>

        {/* Contract Address Box */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-4 mb-6">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-mono-arcade">
              Contract Address
            </span>
            {copiedContract && (
              <span
                role="status"
                aria-live="polite"
                className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Contract address copied.</span>
              </span>
            )}
          </div>

          <div className="p-3.5 bg-black/80 rounded-xl border border-zinc-800 text-xs sm:text-sm font-mono-arcade text-amber-300 break-all select-all font-semibold">
            {PINN_CONFIG.TOKEN_MINT_ADDRESS}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleCopyContract}
              className="px-5 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 whitespace-nowrap"
            >
              {copiedContract ? (
                <Check className="w-4 h-4 text-black stroke-[3] shrink-0" />
              ) : (
                <Copy className="w-4 h-4 shrink-0" />
              )}
              <span>{copiedContract ? 'Contract address copied.' : 'COPY CONTRACT ADDRESS'}</span>
            </button>

            <a
              href={PINN_CONFIG.DEXSCREENER_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleDexScreenerTransparencyClick}
              className="px-5 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2 border border-sky-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap"
            >
              <BarChart3 className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              <span>VIEW ON DEXSCREENER</span>
              <ExternalLink className="w-3.5 h-3.5 text-sky-300 shrink-0" />
            </a>

            <a
              href={PINN_CONFIG.SOLSCAN_TOKEN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2 border border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 whitespace-nowrap"
            >
              <span>VIEW ON SOLSCAN</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            </a>
          </div>
        </div>

        {/* Risk Disclosure */}
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 text-xs text-zinc-300 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Risk Disclosure:</strong> {PINN_CONFIG.TOKEN_RISK_DISCLOSURE}
          </p>
        </div>
      </div>
    </section>
  );
};
