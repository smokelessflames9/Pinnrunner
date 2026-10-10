import React from 'react';
import { ShieldCheck, Lock, Send } from 'lucide-react';
import { PageNav } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';

interface PrivacyPageProps {
  onNavigate: (page: PageNav) => void;
}

export const PrivacyPage: React.FC<PrivacyPageProps> = () => {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-gold-subtle/50 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
          <Lock className="w-3.5 h-3.5" />
          <span>Data Transparency</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white font-serif uppercase tracking-tight">
          PRIVACY POLICY
        </h1>
        <p className="text-xs text-zinc-400 font-mono-arcade mt-1">
          Last updated: October 2026 · PINN Arcade
        </p>
      </div>

      <div className="bg-zinc-950 border border-gold-subtle/40 rounded-3xl p-6 sm:p-10 space-y-8 text-zinc-300 text-xs sm:text-sm leading-relaxed shadow-xl">
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong>Summary:</strong> PINN Arcade is built with privacy in mind. We do not require account registration or email passwords, and we never touch private keys or seed phrases.
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase font-serif tracking-wide">
            1. Information We Collect Locally
          </h2>
          <p>
            When you interact with the PINN Arcade web app, certain non-sensitive operational data is stored directly on your personal device using your browser&apos;s standard <strong>localStorage</strong>:
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-2">
            <li><strong>Player Display Name:</strong> The nickname you choose to display alongside your personal scores.</li>
            <li><strong>High Scores & Game Statistics:</strong> Your personal best score, session score, and total virtual coins collected in PINN Coin Rush.</li>
            <li><strong>Audio Preference:</strong> Your preferred sound volume or mute setting.</li>
          </ul>
          <p className="text-zinc-400 text-xs">
            This data never leaves your device unless you choose to submit a score to an external leaderboard service. You can clear this data at any time by clearing your browser cache.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase font-serif tracking-wide">
            2. Wallet Addresses & Blockchain Data
          </h2>
          <p>
            Connecting a Solana wallet to PINN Arcade is completely optional. If you choose to connect a browser wallet (such as Phantom or Solflare):
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-2">
            <li>We only receive your <strong>public wallet address</strong>.</li>
            <li>We <strong>NEVER</strong> request, access, or store your private key, recovery seed phrase, or wallet passwords.</li>
            <li>We do not initiate transactions without explicit prompt and manual signature in your wallet client.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase font-serif tracking-wide">
            3. Future Backend Leaderboard Handling
          </h2>
          <p>
            When backend database infrastructure is provisioned for global tournaments, submitted leaderboard entries may transmit player display names, public wallet addresses, verified game timestamps, and anti-cheat telemetry to an encrypted database server. Real-time telemetry is solely utilized to verify fairness and prevent unauthorized cheating.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase font-serif tracking-wide">
            4. Third-Party Links & Services
          </h2>
          <p>
            Our website includes links to external third-party services such as Solscan (for block explorer verification) and Telegram (for our official community channel). We do not control and are not responsible for the privacy practices of external websites.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase font-serif tracking-wide">
            5. Contacting the Project Regarding Privacy
          </h2>
          <p>
            If you have questions, feedback, or concerns regarding privacy practices or data retention on PINN Arcade, reach out directly to the moderation team in the official PINN Telegram channel.
          </p>
          <div className="pt-2">
            <a
              href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider"
            >
              <Send className="w-3.5 h-3.5 fill-current" />
              <span>Contact in Official Telegram</span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};
