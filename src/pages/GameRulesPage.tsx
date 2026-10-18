import React from 'react';
import {
  BookOpen,
  ShieldCheck,
  ShieldAlert,
  Trophy,
  Award,
  Wallet,
  AlertTriangle,
  RefreshCw,
  Send,
  ArrowRight,
  ExternalLink,
  Clock,
  FileText,
} from 'lucide-react';
import { PageNav } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';

interface GameRulesPageProps {
  onNavigate: (page: PageNav) => void;
}

export const GameRulesPage: React.FC<GameRulesPageProps> = ({ onNavigate }) => {
  const placeholders = PINN_CONFIG.GAME_RULES_PLACEHOLDERS;

  const sections = [
    { id: 'purpose', number: '01', title: 'Purpose' },
    { id: 'fair-play', number: '02', title: 'Fair Play' },
    { id: 'scoring-leaderboards', number: '03', title: 'Scoring & Leaderboards' },
    { id: 'reward-eligibility', number: '04', title: 'Reward Eligibility' },
    { id: 'claims-payments', number: '05', title: 'Claims & Payments' },
    { id: 'risk-disclaimer', number: '06', title: 'Risk & Token Disclaimer' },
    { id: 'rule-updates-contact', number: '07', title: 'Rule Updates & Contact' },
  ];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* Page Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-xs text-amber-300 font-mono-arcade uppercase tracking-widest mb-3">
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Official Platform Rules · Policy & Disclaimers</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight">
          GAME RULES &amp; REWARDS
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto mt-3 leading-relaxed">
          Official gameplay standards, score validation procedures, leaderboard governance, reward
          eligibility conditions, and risk disclosures for PINN Arcade.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-400 font-mono-arcade mt-4">
          <span>Platform: {PINN_CONFIG.PROJECT_NAME}</span>
          <span aria-hidden="true">·</span>
          <span>Effective Date: {placeholders.EFFECTIVE_DATE}</span>
          <span aria-hidden="true">·</span>
          <span>Policy Status: Unconfirmed schedule &amp; reward parameters marked &ldquo;Details to be announced.&rdquo;</span>
        </div>
      </div>

      {/* Quick Section Jump Navigation (Mobile-Responsive) */}
      <nav
        aria-label="Game Rules Sections"
        className="w-full mb-10 p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-gold-subtle/40 shadow-lg"
      >
        <div className="text-[11px] font-mono-arcade uppercase tracking-wider text-zinc-400 mb-3">
          Document Sections
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToSection(s.id)}
              className="text-left px-3 py-2 rounded-xl bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800 hover:border-gold-subtle/50 transition-colors flex items-center gap-2 cursor-pointer group"
            >
              <span className="text-[11px] font-mono-arcade font-bold text-amber-400 shrink-0">
                {s.number}.
              </span>
              <span className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">
                {s.title}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content Container */}
      <div className="space-y-8 text-zinc-300 text-xs sm:text-sm leading-relaxed">
        {/* SECTION 1: PURPOSE */}
        <section
          id="purpose"
          className="scroll-mt-24 bg-zinc-950 border border-gold-subtle/40 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4"
        >
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-900">
            <div className="w-9 h-9 rounded-xl bg-gold-gradient text-black flex items-center justify-center font-mono-arcade font-black text-xs shrink-0">
              01
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white uppercase font-serif tracking-wide">
                1. Purpose
              </h2>
              <p className="text-xs text-zinc-400">
                Overview of PINN Arcade features and platform scope
              </p>
            </div>
          </div>

          <p>
            <strong>PINN Arcade</strong> offers browser-based arcade games, player score tracking,
            leaderboard features, and reward features where available. Players can access and play
            our four arcade titles—<strong>PINN Coin Rush</strong>,{' '}
            <strong>PINN Treasure Hunt</strong>, <strong>PINN Puzzle Master</strong>, and{' '}
            <strong>PINN Speed Tap</strong>—across desktop and mobile browsers.
          </p>
          <p>
            These Game Rules &amp; Rewards govern how gameplay sessions, score submissions, public
            leaderboards, community tournaments, and optional reward or withdrawal requests operate
            across the platform. Where specific competition or reward parameters have not yet been
            finalized by project administration, they are clearly marked below as{' '}
            <span className="text-amber-300 font-semibold">&ldquo;Details to be announced.&rdquo;</span>
          </p>
        </section>

        {/* SECTION 2: FAIR PLAY */}
        <section
          id="fair-play"
          className="scroll-mt-24 bg-zinc-950 border border-gold-subtle/40 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4"
        >
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-900">
            <div className="w-9 h-9 rounded-xl bg-gold-gradient text-black flex items-center justify-center font-mono-arcade font-black text-xs shrink-0">
              02
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white uppercase font-serif tracking-wide">
                2. Fair Play
              </h2>
              <p className="text-xs text-zinc-400">
                Anti-cheat enforcement, prohibited conduct, and administrative review
              </p>
            </div>
          </div>

          <p>
            All gameplay and leaderboard participation on PINN Arcade must reflect genuine human
            gameplay inside an unmodified web browser. We strictly prohibit:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800">
              <div className="font-bold text-white text-xs uppercase font-serif mb-1">
                Score Manipulation &amp; Client Tampering
              </div>
              <p className="text-xs text-zinc-400">
                Falsifying score payloads, altering client memory, modifying JavaScript execution,
                or tampering with browser storage or network requests.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800">
              <div className="font-bold text-white text-xs uppercase font-serif mb-1">
                Exploiting Bugs or Glitches
              </div>
              <p className="text-xs text-zinc-400">
                Intentionally abusing unintended game mechanics, collision glitches, timer anomalies,
                or scoring defects to inflate scores or coin totals.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800">
              <div className="font-bold text-white text-xs uppercase font-serif mb-1">
                Unauthorized Automation &amp; Scripting
              </div>
              <p className="text-xs text-zinc-400">
                Using bots, macros, auto-clickers, simulated input drivers, headless browsers, or
                assisted play tools of any kind.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800">
              <div className="font-bold text-white text-xs uppercase font-serif mb-1">
                Transaction Replay &amp; Limit Bypass
              </div>
              <p className="text-xs text-zinc-400">
                Replaying session identifiers or blockchain transaction signatures, multi-accounting
                (Sybil behavior), or attempting to bypass account, rate, or reward limits.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-xs text-zinc-300 flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              <strong>Review &amp; Enforcement:</strong> Suspicious activity, anomalous score
              trajectories, or irregular session durations may be flagged and reviewed by automated
              validation routines and platform administrators. Invalid scores, unverified runs, or
              improper claims may be rejected, removed from leaderboards, or disqualified under the
              published rules.
            </p>
          </div>
        </section>

        {/* SECTION 3: SCORING AND LEADERBOARDS */}
        <section
          id="scoring-leaderboards"
          className="scroll-mt-24 bg-zinc-950 border border-gold-subtle/40 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4"
        >
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-900">
            <div className="w-9 h-9 rounded-xl bg-gold-gradient text-black flex items-center justify-center font-mono-arcade font-black text-xs shrink-0">
              03
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white uppercase font-serif tracking-wide">
                3. Scoring and Leaderboards
              </h2>
              <p className="text-xs text-zinc-400">
                Score validation, ranking adjustments, and schedule placeholders
              </p>
            </div>
          </div>

          <p>
            Scores and in-game coin counts submitted during gameplay are subject to server-side and
            administrative validation. Displayed rankings may be audited and corrected at any time
            to account for technical errors, synchronization delays, duplicate submissions, or fair
            play violations.
          </p>
          <p>
            Browser local storage is used strictly for personal convenience and offline continuity;
            authoritative leaderboard standings and eligible coin ledgers rely on verified backend
            records.
          </p>

          {/* Editable Placeholders for Section 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase text-white font-serif">
                  Leaderboard Reset Schedule
                </span>
                <span className="text-[11px] font-mono-arcade text-amber-300">
                  Policy Placeholder
                </span>
              </div>
              <p className="text-xs text-amber-200/90 font-mono-arcade">
                {placeholders.LEADERBOARD_RESET_SCHEDULE}
              </p>
              <p className="text-[11px] text-zinc-400">
                Official cadence for weekly, seasonal, or event leaderboard resets will be published
                here once confirmed by administration.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase text-white font-serif">
                  Leaderboard Tie-Break Rules
                </span>
                <span className="text-[11px] font-mono-arcade text-amber-300">
                  Policy Placeholder
                </span>
              </div>
              <p className="text-xs text-amber-200/90 font-mono-arcade">
                {placeholders.LEADERBOARD_TIE_BREAK_RULES}
              </p>
              <p className="text-[11px] text-zinc-400">
                Definitive tie-breaking criteria (such as earliest verified timestamp or run
                duration) will be confirmed prior to official prize events.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: REWARD ELIGIBILITY */}
        <section
          id="reward-eligibility"
          className="scroll-mt-24 bg-zinc-950 border border-gold-subtle/40 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5"
        >
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-900">
            <div className="w-9 h-9 rounded-xl bg-gold-gradient text-black flex items-center justify-center font-mono-arcade font-black text-xs shrink-0">
              04
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white uppercase font-serif tracking-wide">
                4. Reward Eligibility
              </h2>
              <p className="text-xs text-zinc-400">
                Conditions for reward qualification and unconfirmed policy placeholders
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-gold-subtle/40 text-xs sm:text-sm text-zinc-200">
            <strong className="text-amber-300 block uppercase font-serif tracking-wide mb-1">
              No Automatic Entitlement
            </strong>
            Playing PINN Arcade games, accumulating virtual in-game coins, or achieving a
            leaderboard position <strong>does not automatically guarantee a token reward</strong>{' '}
            unless the applicable published competition or reward rules explicitly provide one and
            all verification requirements are satisfied.
          </div>

          <p className="text-xs text-zinc-400">
            The following reward policy items are editable placeholders awaiting final confirmation
            before publication. Items marked{' '}
            <span className="text-amber-300 font-mono-arcade">&ldquo;Details to be announced.&rdquo;</span>{' '}
            are not yet established policy commitments:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                label: 'Eligible Players & Regions',
                value: placeholders.ELIGIBLE_PLAYERS_AND_REGIONS,
                note: 'Age of majority, jurisdictional restrictions, and regional compliance criteria.',
              },
              {
                label: 'Minimum Eligibility Requirements',
                value: placeholders.MINIMUM_ELIGIBILITY_REQUIREMENTS,
                note: 'Account verification, wallet authentication, and minimum verified coin or score thresholds.',
              },
              {
                label: 'Reward Amounts or Prize Pool',
                value: placeholders.REWARD_AMOUNTS_OR_PRIZE_POOL,
                note: 'Specific token allocations, conversion rates, or event prize pool distributions.',
              },
              {
                label: 'Claim Limits & Claim Windows',
                value: placeholders.CLAIM_LIMITS_AND_CLAIM_WINDOWS,
                note: 'Per-player frequency caps, maximum claim amounts, and submission deadlines.',
              },
              {
                label: 'Reward Review & Processing Times',
                value: placeholders.REWARD_REVIEW_AND_PROCESSING_TIMES,
                note: 'Expected administrative review windows for manual verification and settlement.',
              },
              {
                label: 'Tie-Break & Dispute Rules',
                value: placeholders.TIE_BREAK_AND_DISPUTE_RULES,
                note: 'Procedures for resolving tied rankings, score challenges, or claim disputes.',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-xs font-bold uppercase text-white font-serif">
                      {item.label}
                    </h3>
                    <span className="text-[10px] font-mono-arcade text-amber-300">
                      Unconfirmed Placeholder
                    </span>
                  </div>
                  <div className="text-xs font-mono-arcade font-bold text-amber-300 py-1">
                    {item.value}
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{item.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5: CLAIMS AND PAYMENTS */}
        <section
          id="claims-payments"
          className="scroll-mt-24 bg-zinc-950 border border-gold-subtle/40 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4"
        >
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-900">
            <div className="w-9 h-9 rounded-xl bg-gold-gradient text-black flex items-center justify-center font-mono-arcade font-black text-xs shrink-0">
              05
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white uppercase font-serif tracking-wide">
                5. Claims and Payments
              </h2>
              <p className="text-xs text-zinc-400">
                Verification workflow, wallet accuracy responsibility, and Solana network finality
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p>
              <strong>No Guarantee of Immediate Approval or Payment:</strong> Submitting a reward
              claim or withdrawal request on PINN Arcade places the request into a manual review
              queue and does not guarantee approval or immediate payment. All claims are subject to
              anti-cheat audit, balance verification, and compliance with active competition or
              reward rules.
            </p>
            <p>
              <strong>Player Wallet Responsibility:</strong> Where a reward or withdrawal is settled
              on the Solana blockchain, players are solely responsible for providing an accurate,
              valid, non-custodial Solana wallet address capable of receiving SPL tokens.
            </p>
            <p>
              <strong>Irreversibility &amp; Network Conditions:</strong> On-chain transfers on the
              Solana network are irreversible once confirmed. PINN Arcade cannot recover tokens sent
              to an incorrect or inaccessible wallet address provided by a player. Blockchain
              network congestion, validator delays, RPC outages, and network transaction fees are
              outside PINN Arcade&apos;s direct control.
            </p>
          </div>
        </section>

        {/* SECTION 6: EXISTING RISK DISCLAIMER */}
        <section
          id="risk-disclaimer"
          className="scroll-mt-24 bg-zinc-950 border border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4"
        >
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-900">
            <div className="w-9 h-9 rounded-xl bg-gold-gradient text-black flex items-center justify-center font-mono-arcade font-black text-xs shrink-0">
              06
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white uppercase font-serif tracking-wide">
                6. Risk &amp; Token Disclaimer
              </h2>
              <p className="text-xs text-amber-300/90">
                Mandatory risk disclosure and entertainment-only notice
              </p>
            </div>
          </div>

          {/* Preserved Existing Website Disclaimer Verbatim */}
          <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Risk &amp; Gameplay Disclaimer</span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
              {PINN_CONFIG.WEBSITE_DISCLAIMER}
            </p>
          </div>

          {/* Preserved HomePage / TermsPage Risk Context + Non-Advice Notice */}
          <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-2 text-xs sm:text-sm text-zinc-300">
            <p>
              <strong>Entertainment Purpose &amp; No Professional Advice:</strong> PINN Arcade is
              designed strictly for gaming and entertainment. Nothing on this website—including game
              scores, virtual coin balances, leaderboards, tournament announcements, or token
              references—constitutes financial, investment, legal, or tax advice, nor a solicitation
              to buy, sell, or hold any digital asset.
            </p>
            <p className="text-xs text-zinc-400">
              Cryptocurrency prices can fluctuate substantially and participation does not guarantee
              profits. Always conduct your own independent research and consult qualified
              professionals before making any financial, legal, or tax decisions.
            </p>
          </div>
        </section>

        {/* SECTION 7: RULE UPDATES AND CONTACT */}
        <section
          id="rule-updates-contact"
          className="scroll-mt-24 bg-zinc-950 border border-gold-subtle/40 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4"
        >
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-900">
            <div className="w-9 h-9 rounded-xl bg-gold-gradient text-black flex items-center justify-center font-mono-arcade font-black text-xs shrink-0">
              07
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white uppercase font-serif tracking-wide">
                7. Rule Updates and Contact
              </h2>
              <p className="text-xs text-zinc-400">
                Prospective application of rule changes and official support channels
              </p>
            </div>
          </div>

          <p>
            PINN Arcade may update or refine these Game Rules &amp; Rewards as new features,
            tournaments, or compliance requirements are introduced. Updated rules apply{' '}
            <strong>prospectively</strong> from their published effective date and do not
            retroactively cancel valid rewards that have already been earned and verified under
            prior published rules, except where fraud, fair-play abuse, technical error, or legal
            and regulatory compliance requires review or adjustment.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase text-white font-serif">
                  Official Support / Contact Details
                </span>
                <span className="text-[10px] font-mono-arcade text-amber-300">
                  Policy Placeholder
                </span>
              </div>
              <p className="text-xs font-mono-arcade font-bold text-amber-300">
                {placeholders.OFFICIAL_SUPPORT_CONTACT}
              </p>
              <p className="text-[11px] text-zinc-400">
                Dedicated support email or ticket desk contact details will be published here once
                confirmed.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold uppercase text-white font-serif block mb-1">
                  Official Community Channel
                </span>
                <p className="text-[11px] text-zinc-400">
                  Follow official tournament announcements, rule updates, and community notices in
                  the PINN Telegram group.
                </p>
              </div>
              <a
                href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-95 transition-opacity w-full sm:w-auto self-start"
              >
                <Send className="w-3.5 h-3.5 fill-current" />
                <span>Official Telegram Community</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </section>

        {/* Bottom Navigation Bar */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('games')}
              className="px-5 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-95 transition-opacity cursor-pointer"
            >
              Explore Arcade Games
            </button>
            <button
              type="button"
              onClick={() => onNavigate('rewards')}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-gold-subtle/40 text-amber-300 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Player Dashboard &amp; Rewards
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <button
              type="button"
              onClick={() => onNavigate('terms')}
              className="hover:text-amber-300 transition-colors cursor-pointer"
            >
              Terms of Use
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onNavigate('privacy')}
              className="hover:text-amber-300 transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
