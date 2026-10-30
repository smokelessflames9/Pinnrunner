import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { WalletModal } from './components/WalletModal';
import { AuthModal } from './components/AuthModal';
import { JupiterSwapModal } from './components/JupiterSwapModal';
import { HomePage } from './pages/HomePage';
import { GamesPage } from './pages/GamesPage';
import { GamePage } from './pages/GamePage';
import { TreasureHuntPage } from './pages/TreasureHuntPage';
import { PuzzleMasterPage } from './pages/PuzzleMasterPage';
import { SpeedTapPage } from './pages/SpeedTapPage';
import { TournamentsPage } from './pages/TournamentsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { TokenPage } from './pages/TokenPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { RewardsPage } from './pages/RewardsPage';
import { AboutPage } from './pages/AboutPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { GameRulesPage } from './pages/GameRulesPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { PageNav, WalletState } from './types';
import { walletService } from './services/walletService';
import { soundService } from './services/soundService';
import { trackPinnEvent } from './services/analyticsService';

const PAGE_TO_PATH: Record<PageNav, string> = {
  home: '/',
  games: '/games',
  play: '/play',
  'play-treasure': '/play-treasure',
  'play-puzzle': '/play-puzzle',
  'play-speedtap': '/play-speedtap',
  tournaments: '/tournaments',
  admin: '/admin',
  token: '/token',
  leaderboard: '/leaderboard',
  rewards: '/rewards',
  about: '/about',
  terms: '/terms',
  privacy: '/privacy',
  'game-rules': '/game-rules',
  roadmap: '/roadmap',
};

function getInitialPageFromUrl(): PageNav {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');
  if (path === '/roadmap' || hash === 'roadmap') {
    return 'roadmap';
  }
  if (
    path === '/rules' ||
    path === '/game-rules' ||
    path === '/game-rules-and-rewards' ||
    hash === 'rules' ||
    hash === 'game-rules'
  ) {
    return 'game-rules';
  }
  const matchedEntry = (Object.entries(PAGE_TO_PATH) as [PageNav, string][]).find(
    ([, routePath]) => routePath !== '/' && (path === routePath || hash === routePath.slice(1))
  );
  if (matchedEntry) {
    return matchedEntry[0];
  }
  return 'home';
}

function shouldOpenSwapFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');
  const params = new URLSearchParams(window.location.search);
  return path === '/swap' || hash === 'swap' || params.get('swap') === '1';
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageNav>(getInitialPageFromUrl);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState<boolean>(shouldOpenSwapFromUrl);
  const [walletState, setWalletState] = useState<WalletState>(walletService.getState());

  const handleOpenSwapModal = useCallback(() => {
    trackPinnEvent('pinn_swap_opened', {
      section: currentPage,
    });
    setIsSwapModalOpen(true);
  }, [currentPage]);

  useEffect(() => {
    const unsubscribe = walletService.subscribe((state) => {
      setWalletState(state);
    });

    const handlePopState = () => {
      setCurrentPage(getInitialPageFromUrl());
      if (shouldOpenSwapFromUrl()) {
        setIsSwapModalOpen(true);
      }
    };
    window.addEventListener('popstate', handlePopState);

    // Delegated listener so any button or link labeled "SWAP NOW" or with href="#swap" opens Jupiter Swap
    const handleDelegatedSwapClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const actionable = target.closest('button, a') as HTMLElement | null;
      if (!actionable) return;

      const dataAction = actionable.getAttribute('data-action');
      const href = actionable.getAttribute('href');
      const label = (actionable.textContent || '').trim().toUpperCase();

      if (
        dataAction === 'swap-pinn' ||
        href === '#swap' ||
        href === '/swap' ||
        label === 'SWAP NOW'
      ) {
        e.preventDefault();
        setIsSwapModalOpen(true);
      }
    };
    document.addEventListener('click', handleDelegatedSwapClick);

    const unlock = () => {
      soundService.unlockAudio();
      if (soundService.getAudioContextState() === 'running') {
        window.removeEventListener('click', unlock);
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      }
    };

    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });

    return () => {
      unsubscribe();
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleDelegatedSwapClick);
      window.removeEventListener('click', unlock);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const handleNavigate = (page: PageNav) => {
    setCurrentPage(page);
    try {
      const targetPath = PAGE_TO_PATH[page] || '/';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ page }, '', targetPath);
      }
    } catch {
      // Ignore history pushState restrictions in sandboxed environments
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-slate-100 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navigation */}
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        walletState={walletState}
        onOpenWalletModal={() => setIsWalletModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenSwapModal={handleOpenSwapModal}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col">
        {currentPage === 'home' && (
          <HomePage onNavigate={handleNavigate} onOpenSwapModal={handleOpenSwapModal} />
        )}
        {currentPage === 'games' && <GamesPage onNavigate={handleNavigate} />}
        {currentPage === 'play' && <GamePage onNavigate={handleNavigate} />}
        {currentPage === 'play-treasure' && <TreasureHuntPage onNavigate={handleNavigate} />}
        {currentPage === 'play-puzzle' && <PuzzleMasterPage onNavigate={handleNavigate} />}
        {currentPage === 'play-speedtap' && <SpeedTapPage onNavigate={handleNavigate} />}
        {currentPage === 'tournaments' && (
          <TournamentsPage onNavigate={handleNavigate} onOpenAuthModal={() => setIsAuthModalOpen(true)} />
        )}
        {currentPage === 'admin' && (
          <AdminDashboardPage onNavigate={handleNavigate} onOpenAuthModal={() => setIsAuthModalOpen(true)} />
        )}
        {currentPage === 'token' && (
          <TokenPage onNavigate={handleNavigate} onOpenSwapModal={handleOpenSwapModal} />
        )}
        {currentPage === 'leaderboard' && <LeaderboardPage onNavigate={handleNavigate} />}
        {currentPage === 'rewards' && <RewardsPage onNavigate={handleNavigate} />}
        {currentPage === 'about' && <AboutPage onNavigate={handleNavigate} />}
        {currentPage === 'terms' && <TermsPage onNavigate={handleNavigate} />}
        {currentPage === 'privacy' && <PrivacyPage onNavigate={handleNavigate} />}
        {currentPage === 'game-rules' && <GameRulesPage onNavigate={handleNavigate} />}
        {currentPage === 'roadmap' && <RoadmapPage />}
      </main>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />

      {/* Jupiter Swap Modal */}
      <JupiterSwapModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        walletState={walletState}
        onOpenWalletModal={() => setIsWalletModalOpen(true)}
      />

      {/* Solana Wallet Modal */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        walletState={walletState}
      />

      {/* Supabase Player Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
