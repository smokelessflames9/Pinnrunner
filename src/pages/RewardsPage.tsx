import React, { useState } from 'react';
import { Send, Gift, ShieldAlert, ShieldCheck, CheckCircle2, ExternalLink, Search, Sparkles, Award } from 'lucide-react';
import { PageNav, CompetitionWinner } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';

interface RewardsPageProps {
  onNavigate: (page: PageNav) => void;
}

// Sample verified winners (clearly marked as demonstration records)
const DEMO_WINNERS: CompetitionWinner[] = [
  {
    rank: 1,
    displayName: 'MontegoKing',
    walletSnippet: '7xKX...gAsU',
    score: 14850,
    rewardText: 'Tier 1 Community Champion Allocation',
    txSignature: '4hGf7uK9z...3mNq',
    isDemo: true,
  },
  {
    rank: 2,
    displayName: 'PinnaclePro',
    walletSnippet: '3J98...V4F2',
    score: 12420,
    rewardText: 'Tier 2 Runner-up Allocation',
    txSignature: '2xYp8wQ4...9kLs',
    isDemo: true,
  },
  {
    rank: 3,
    displayName: 'SolanaSurfer',
    walletSnippet: '8mKb...7dJ8',
    score: 10980,
    rewardText: 'Tier 3 Podium Finisher Allocation',
    txSignature: '5zRt1aX7...8bCv',
    isDemo: true,
  },
];

export const RewardsPage: React.FC<RewardsPageProps> = ({ onNavigate }) => {
  const [txLookupInput, setTxLookupInput] = useState('');
  const comp = PINN_CONFIG.COMPETITION;

  const handleOpenTx = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = txLookupInput.trim();
    if (!clean) return;
    window.open(`${PINN_CONFIG.SOLSCAN_TX_BASE_URL}${clean}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col items-center">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-gold-subtle/50 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
          <Gift className="w-3.5 h-3.5" />
          <span>Ecosystem Rewards & Competitions</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight">
          PINN REWARDS
        </h1>
        <p className="text-sm text-zinc-400 max-w-xl mx-auto mt-2">
          How community competitions, tournament leaderboards, and potential $PINN rewards operate.
        </p>
      </div>

      {/* SECTION A: HOW TO PARTICIPATE (5 Steps) */}
      <section className="w-full mb-12">
        <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-6 h-6 rounded-md bg-gold-gradient flex items-center justify-center text-black font-bold text-xs">
              A
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white uppercase font-serif tracking-tight">
              HOW TO PARTICIPATE
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                step: 1,
                title: 'Play PINN Coin Rush',
                desc: 'Open the game in any mobile or desktop browser completely free of charge.',
              },
              {
                step: 2,
                title: 'Improve Your Score',
                desc: 'Master jumping, sliding, and dodging to set a competitive personal best score.',
              },
              {
                step: 3,
                title: 'Join Competitions',
                desc: 'Participate during officially announced competitive tournament windows.',
              },
              {
                step: 4,
                title: 'Review the Rules',
                desc: 'Confirm rules, eligibility terms, and fair play requirements.',
              },
              {
                step: 5,
                title: 'Check the Results',
                desc: 'Follow the official Telegram community to view verified winners and rankings.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-gold-gradient text-black font-black text-xs flex items-center justify-center mb-3">
                    0{item.step}
                  </div>
                  <h3 className="font-bold text-white text-sm mb-1 uppercase font-serif">
                    {item.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-900 flex justify-center">
            <button
              onClick={() => onNavigate('play')}
              className="px-6 py-2.5 rounded-xl bg-gold-gradient text-black font-bold text-xs uppercase tracking-wider hover:opacity-95 shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span>LAUNCH GAME & PRACTICE NOW</span>
            </button>
          </div>
        </div>
      </section>

      {/* SECTION B: COMPETITIONS */}
      <section className="w-full mb-12">
        <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-gold-glow shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-6 h-6 rounded-md bg-gold-gradient flex items-center justify-center text-black font-bold text-xs">
              B
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white uppercase font-serif tracking-tight">
              COMMUNITY COMPETITIONS
            </h2>
          </div>

          {comp.IS_ACTIVE ? (
            <div className="space-y-6">
              {/* Competition Header Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-zinc-900 border border-gold-subtle/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-mono-arcade text-emerald-400 uppercase mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Status: {comp.STATUS}</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white font-serif uppercase">
                    {comp.TITLE}
                  </h3>
                  <span className="text-xs text-zinc-400 font-mono-arcade">
                    {comp.START_DATE} — {comp.END_DATE}
                  </span>
                </div>

                <div className="px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-right">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-400 block font-mono-arcade">
                    Entry Cost
                  </span>
                  <span className="text-sm font-bold text-amber-300 font-mono-arcade">
                    100% Free Entry
                  </span>
                </div>
              </div>

              {/* Competition Rules & Eligibility */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono-arcade">
                    Official Competition Rules
                  </h4>
                  <ul className="space-y-2 text-xs text-zinc-300">
                    {comp.RULES.map((rule, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono-arcade">
                    Eligibility Requirements
                  </h4>
                  <ul className="space-y-2 text-xs text-zinc-300">
                    {comp.ELIGIBILITY_REQUIREMENTS.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-10 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center">
              <h3 className="text-lg font-bold text-zinc-400 font-serif uppercase tracking-wider">
                NO ACTIVE COMPETITIONS
              </h3>
              <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto">
                No official competition is currently active. Follow the Telegram community for the next tournament announcement date.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* SECTION C: REWARD POOL */}
      <section className="w-full mb-12">
        <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-6 h-6 rounded-md bg-gold-gradient flex items-center justify-center text-black font-bold text-xs">
              C
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white uppercase font-serif tracking-tight">
              REWARD POOL INFORMATION
            </h2>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-zinc-400 font-mono-arcade">
                Pool Funding Model
              </span>
              <span className="text-xs font-bold text-amber-300 font-mono-arcade">
                Community & Admin Sponsored
              </span>
            </div>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {comp.REWARD_POOL_INFORMATION}
            </p>

            <div className="pt-2 text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-800">
              Disclaimer: The website does not custody user cryptocurrency balances, nor does it guarantee monetary amounts. Rewards are allocated based on verified competition parameters disclosed beforehand.
            </div>
          </div>
        </div>
      </section>

      {/* SECTION D: WINNERS (Verified Records) */}
      <section className="w-full mb-12">
        <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-6 h-6 rounded-md bg-gold-gradient flex items-center justify-center text-black font-bold text-xs">
              D
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white uppercase font-serif tracking-tight">
              VERIFIED COMPETITION WINNERS
            </h2>
          </div>

          {/* Demonstration Notice */}
          <div className="mb-4 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-amber-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              The records below illustrate the verification format for past seasonal sprints (DEMONSTRATION RECORDS).
            </span>
          </div>

          <div className="space-y-3">
            {DEMO_WINNERS.map((winner) => (
              <div
                key={winner.rank}
                className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 text-amber-400 font-black text-xs flex items-center justify-center font-mono-arcade">
                    #{winner.rank}
                  </div>
                  <div>
                    <span className="font-bold text-white text-sm font-serif">{winner.displayName}</span>
                    <span className="text-xs text-zinc-400 font-mono-arcade block">
                      Wallet: {winner.walletSnippet} · Score: {winner.score.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-amber-300 font-medium">{winner.rewardText}</span>
                  {winner.isDemo && (
                    <span className="text-[10px] font-mono-arcade px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase">
                      Demo Data
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION E: REWARD DISTRIBUTION & SOLSCAN TX EXPLORER */}
      <section className="w-full mb-12">
        <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-gold-subtle/40 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-6 h-6 rounded-md bg-gold-gradient flex items-center justify-center text-black font-bold text-xs">
              E
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white uppercase font-serif tracking-tight">
              REWARD DISTRIBUTION & VERIFICATION
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6">
            {comp.REWARD_DISTRIBUTION_INFORMATION}
          </p>

          {/* Solscan Signature Lookup Field */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
            <span className="text-xs uppercase font-mono-arcade text-zinc-400 block">
              Verify Solana Payout Signature on Solscan
            </span>
            <form onSubmit={handleOpenTx} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={txLookupInput}
                  onChange={(e) => setTxLookupInput(e.target.value)}
                  placeholder="Paste Solana transaction hash (e.g. 5x7h...)"
                  className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400 font-mono-arcade"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-gold-gradient text-black font-bold text-xs uppercase tracking-wider hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>OPEN ON SOLSCAN</span>
              </button>
            </form>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Zero-Trust Security:</strong> PINN Arcade will NEVER initiate token transfers automatically, request private keys or seed phrases, or connect to wallets without consent.
            </span>
          </div>
        </div>
      </section>

      {/* SECTION F: REWARD RULES & DISCLAIMER */}
      <section className="w-full mb-12">
        <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-zinc-850 shadow-xl space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-md bg-zinc-800 text-amber-400 font-bold text-xs flex items-center justify-center">
              F
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white uppercase font-serif tracking-tight">
              REWARD RULES & COMPLIANCE
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-300">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <strong className="text-amber-400 block mb-1 uppercase font-mono-arcade">Eligibility Terms</strong>
              Holding $PINN tokens does not guarantee rewards. Participation in free arcade games does not guarantee financial returns.
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <strong className="text-amber-400 block mb-1 uppercase font-mono-arcade">Anti-Cheating Policy</strong>
              All submitted scores are subject to review. Memory injection, modified client code, and artificial speed multipliers will result in permanent disqualification.
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <strong className="text-amber-400 block mb-1 uppercase font-mono-arcade">Market Risk</strong>
              Cryptocurrency prices can fluctuate substantially. Digital token valuations are volatile and unregulated in many jurisdictions.
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <strong className="text-amber-400 block mb-1 uppercase font-mono-arcade">No Investment Contracts</strong>
              Competitions represent promotional community gaming tournaments, not financial securities, investments, or profit guarantees.
            </div>
          </div>
        </div>
      </section>

      {/* MANDATORY TELEGRAM SECTION (Requirement 9.E) */}
      <section className="w-full">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-gold-glow text-center flex flex-col items-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-gold-gradient flex items-center justify-center text-black mb-4 shadow-lg shadow-amber-500/20">
            <Send className="w-7 h-7 fill-current" />
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white font-serif uppercase tracking-tight mb-3">
            PINN COMMUNITY ANNOUNCEMENTS
          </h2>

          <p className="text-sm sm:text-base text-zinc-300 max-w-xl mb-8 leading-relaxed">
            Follow the official Telegram group for published competition rules, verified winner announcements, reward updates, and gaming news.
          </p>

          <a
            href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 rounded-xl bg-gold-gradient text-black font-extrabold text-sm uppercase tracking-widest hover:opacity-95 shadow-lg shadow-amber-500/25 flex items-center gap-2.5 cursor-pointer"
          >
            <Send className="w-4 h-4 fill-current" />
            <span>JOIN THE PINN COMMUNITY</span>
          </a>

          <span className="text-xs text-zinc-400 mt-4 font-mono-arcade">
            Official Community: {PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
          </span>
        </div>
      </section>
    </div>
  );
};
