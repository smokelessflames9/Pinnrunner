import React from 'react';
import { FileText, Send } from 'lucide-react';
import { PageNav } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';

interface TermsPageProps {
  onNavigate: (page: PageNav) => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onNavigate }) => {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-gold-subtle/50 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
          <FileText className="w-3.5 h-3.5" />
          <span>Rules & Guidelines</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white font-serif uppercase tracking-tight">
          TERMS OF USE & GAME RULES
        </h1>
        <p className="text-xs text-zinc-400 font-mono-arcade mt-1">
          Last updated: October 2026 · PINN Arcade
        </p>
      </div>

      <div className="bg-zinc-950 border border-gold-subtle/40 rounded-3xl p-6 sm:p-10 space-y-8 text-zinc-300 text-xs sm:text-sm leading-relaxed shadow-xl">

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase font-serif tracking-wide">
            1. Nature of the Platform & Virtual Game Coins
          </h2>
          <p>
            PINN Arcade provides browser-based 2D arcade gaming experiences. In-game coins and point tallies accumulated during gameplay (such as in PINN Coin Rush) are virtual scorekeeping elements. Virtual coins do not constitute legal tender, shares, deposits, or digital cryptocurrency. Collecting virtual coins in the game does not automatically trigger or guarantee a blockchain token transfer.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase font-serif tracking-wide">
            2. Competition Eligibility & Participation
          </h2>
          <p>
            Participation in PINN Arcade games is free. Players are not required to purchase, stake, or hold $PINN tokens to access the base arcade experience. Tournament competitions are subject to specific rules announced in advance through the official PINN Telegram community. Participants must be of legal age of majority in their jurisdiction.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase font-serif tracking-wide">
            3. Score Verification & Anti-Cheating Measures
          </h2>
          <p>
            Scores submitted locally via the browser are stored in local storage for player convenience. When participating in community leaderboards or tournaments, scores are subject to review. We strictly prohibit the use of automated game bots, modified client files, browser console manipulation, speed hacks, or network packet injection. Suspected cheating will result in disqualification from competition standings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase font-serif tracking-wide">
            4. Reward Conditions & Distribution
          </h2>
          <p>
            Tournament prizes, where offered, are community-sponsored allocations distributed manually by designated project administrators. Token allocations require valid Solana public addresses and compliance with published guidelines. Neither game participation nor holding $PINN tokens guarantees financial profit or capital preservation.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase font-serif tracking-wide">
            5. General Cryptocurrency Risk Disclaimer
          </h2>
          <p>
            Cryptocurrency assets on the Solana network are subject to extreme price volatility, illiquidity risks, and potential total loss of value. The $PINN token is a community meme coin project and does not offer dividend yields, voting governance rights, or guaranteed liquidity. Always exercise caution and never allocate funds you cannot afford to lose.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase font-serif tracking-wide">
            6. Service Availability Limitations
          </h2>
          <p>
            PINN Arcade is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of uninterrupted uptime, error-free browser compatibility, or immediate data recovery. Project administrators reserve the right to modify game parameters, reset seasonal leaderboards, or suspend maintenance windows at their discretion.
          </p>
        </section>

        <section className="pt-4 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-zinc-400">Looking for detailed gameplay rules, leaderboard policies, or reward eligibility terms?</span>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('game-rules')}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-gold-subtle/50 text-amber-300 font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Game Rules &amp; Rewards
            </button>
            <a
              href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 fill-current" />
              <span>Ask on Telegram</span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};
