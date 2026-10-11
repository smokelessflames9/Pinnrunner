import React from 'react';
import { Send, ExternalLink, ShieldCheck, Heart } from 'lucide-react';
import { PageNav } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';

interface FooterProps {
  onNavigate: (page: PageNav) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="w-full bg-black border-t border-gold-subtle/30 text-zinc-400 text-sm">
      {/* Top Footer Banner: Official Telegram Community */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border-b border-gold-subtle/20 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="w-12 h-12 rounded-xl bg-gold-gradient flex items-center justify-center text-black shrink-0 shadow-lg shadow-amber-500/20">
              <Send className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                Official PINN Telegram Community
              </h3>
              <p className="text-xs text-zinc-400 max-w-xl">
                Connect with the PINN community for project updates, gaming announcements, tournament brackets, and verified competition results.
              </p>
            </div>
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

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gold-gradient flex items-center justify-center text-black font-serif font-black text-xs">
                P
              </div>
              <span className="font-serif font-bold text-white text-lg tracking-wider">
                PINN ARCADE
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The premier Solana gaming ecosystem connected to The Pinnacle Montego Bay ($PINN). Play arcade games, climb leaderboards, and enter community competitions.
            </p>
            <p className="text-[11px] text-amber-400/90 font-mono-arcade uppercase">
              {PINN_CONFIG.TAGLINE}
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Ecosystem</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('games')}
                  className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                >
                  Games Catalog (4 Games)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('play')}
                  className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                >
                  Play PINN Coin Rush
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('token')}
                  className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                >
                  $PINN Token Information
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('tournaments')}
                  className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                >
                  Tournaments & Seasons
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('leaderboard')}
                  className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                >
                  Leaderboard
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('rewards')}
                  className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                >
                  Community Rewards
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('admin')}
                  className="hover:text-amber-400 transition-colors text-left cursor-pointer text-zinc-500"
                >
                  Admin Portal (Restricted)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('about')}
                  className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                >
                  About PINN Arcade
                </button>
              </li>
            </ul>
          </div>

          {/* Token & Blockchain Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Token Contract</h4>
            <div className="space-y-2 text-xs">
              <div className="text-zinc-400">
                <span className="text-zinc-400">Asset: </span>
                <span className="text-white font-semibold">{PINN_CONFIG.TOKEN_NAME} (${PINN_CONFIG.TOKEN_SYMBOL})</span>
              </div>
              <div className="text-zinc-400">
                <span className="text-zinc-400">Chain: </span>
                <span className="text-white font-semibold">{PINN_CONFIG.BLOCKCHAIN}</span>
              </div>
              <div className="pt-1">
                <span className="text-[10px] text-zinc-400 block font-mono-arcade">Mint Address:</span>
                <span className="text-[11px] font-mono-arcade text-amber-300/90 break-all select-all">
                  {PINN_CONFIG.TOKEN_MINT_ADDRESS}
                </span>
              </div>
              <a
                href={PINN_CONFIG.SOLSCAN_TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium pt-1"
              >
                <span>View on Solscan</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Legal & Policy Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Compliance & Rules</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('terms')}
                  className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                >
                  Terms of Use & Game Rules
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('privacy')}
                  className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <a
                  href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-amber-400 transition-colors inline-flex items-center gap-1"
                >
                  <span>Telegram Community Support</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>

            <div className="pt-2 flex items-center gap-1.5 text-[11px] text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Free to Play · Non-custodial</span>
            </div>
          </div>
        </div>

        {/* Disclaimer Section */}
        <div className="mt-10 pt-6 border-t border-zinc-900 text-xs text-zinc-400 leading-relaxed">
          <p className="font-semibold text-zinc-400 mb-1 uppercase tracking-wider text-[11px]">
            Risk & Gameplay Disclaimer:
          </p>
          <p>{PINN_CONFIG.WEBSITE_DISCLAIMER}</p>
        </div>

        {/* Bottom Copyright */}
        <div className="mt-8 pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 gap-4">
          <p>© 2026 PINN Arcade · Connected to The Pinnacle Montego Bay ($PINN).</p>
          <p className="flex items-center gap-1">
            <span>Built for the Montego Bay Solana community</span>
            <Heart className="w-3.5 h-3.5 text-amber-400 fill-current" />
          </p>
        </div>
      </div>
    </footer>
  );
};
