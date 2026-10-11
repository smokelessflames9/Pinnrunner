import React, { useState } from 'react';
import {
  Coins,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Send,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { PageNav } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';

interface TokenPageProps {
  onNavigate: (page: PageNav) => void;
}

export const TokenPage: React.FC<TokenPageProps> = ({ onNavigate }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(PINN_CONFIG.TOKEN_MINT_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex flex-col items-center">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-gold-subtle/50 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
          <Coins className="w-3.5 h-3.5" />
          <span>Official Solana SPL Token</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight">
          $PINN TOKEN INFORMATION
        </h1>
        <p className="text-sm text-zinc-400 font-mono-arcade mt-1 uppercase tracking-wider">
          {PINN_CONFIG.TOKEN_NAME} · {PINN_CONFIG.BLOCKCHAIN}
        </p>
      </div>

      {/* Main Token Details Card */}
      <div className="w-full bg-zinc-950 border border-gold-glow rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 mb-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gold-gradient" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-900">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gold-gradient flex items-center justify-center text-black font-black text-2xl font-serif shadow-lg shadow-amber-500/20">
              P
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white font-serif uppercase tracking-tight">
                {PINN_CONFIG.TOKEN_NAME}
              </h2>
              <span className="text-sm font-bold font-mono-arcade text-zinc-400">
                Ticker: <span className="text-gold-gradient font-black">${PINN_CONFIG.TOKEN_SYMBOL}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 self-start md:self-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Network: {PINN_CONFIG.BLOCKCHAIN}</span>
          </div>
        </div>

        {/* Mint Address Box */}
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-mono-arcade">
              Token Mint Address
            </span>
            <span className="text-[11px] text-amber-400 font-mono-arcade">Solana SPL Standard</span>
          </div>

          <div className="p-3.5 bg-black/80 rounded-xl border border-zinc-800 text-xs sm:text-sm font-mono-arcade text-amber-300 break-all select-all font-semibold">
            {PINN_CONFIG.TOKEN_MINT_ADDRESS}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleCopy}
              className="px-6 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-95 shadow-md flex items-center gap-2 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'MINT COPIED TO CLIPBOARD!' : 'COPY TOKEN ADDRESS'}</span>
            </button>

            <a
              href={PINN_CONFIG.SOLSCAN_TOKEN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 border border-zinc-700 cursor-pointer"
            >
              <span>VIEW ON SOLSCAN</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>
          </div>
        </div>

        {/* Disclaimers & Integrity */}
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 text-xs text-zinc-400 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Authentic Project Information:</strong> All statistics and token information are sourced strictly from the official contract. PINN Arcade does not display fabricated market caps, trading volumes, or token prices. Participation in cryptocurrency carries risk and does not guarantee financial profit.
          </p>
        </div>
      </div>

      {/* Planned Token Utility in Arcade */}
      <div className="w-full mb-10">
        <h3 className="text-xl sm:text-2xl font-bold text-white font-serif uppercase tracking-tight mb-4 text-center">
          FUTURE $PINN GAMING UTILITY (PLANNED)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PINN_CONFIG.PLANNED_UTILITIES.map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-zinc-950 border border-zinc-850 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-mono-arcade uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold mb-2 inline-block">
                  {item.status}
                </span>
                <h4 className="text-sm font-bold text-white uppercase font-serif mb-1">
                  {item.title}
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Community CTA */}
      <div className="w-full p-8 rounded-3xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-gold-glow text-center flex flex-col items-center shadow-xl">
        <h3 className="text-xl font-bold text-white uppercase tracking-wider font-serif mb-2">
          CONNECT WITH THE $PINN COMMUNITY
        </h3>
        <p className="text-xs sm:text-sm text-zinc-300 max-w-md mb-6 leading-relaxed">
          Stay informed on project announcements, token updates, and arcade tournaments inside the official Telegram channel.
        </p>

        <a
          href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-8 py-3.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-widest hover:opacity-95 shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4 fill-current" />
          <span>JOIN TELEGRAM NOW</span>
        </a>
      </div>
    </div>
  );
};
