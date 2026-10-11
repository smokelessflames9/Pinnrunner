import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { WalletModal } from './components/WalletModal';
import { AuthModal } from './components/AuthModal';
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
import { PageNav, WalletState } from './types';
import { walletService } from './services/walletService';
import { soundService } from './services/soundService';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageNav>('home');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [walletState, setWalletState] = useState<WalletState>(walletService.getState());

  useEffect(() => {
    const unsubscribe = walletService.subscribe((state) => {
      setWalletState(state);
    });

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
      window.removeEventListener('click', unlock);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const handleNavigate = (page: PageNav) => {
    setCurrentPage(page);
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
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col">
        {currentPage === 'home' && <HomePage onNavigate={handleNavigate} />}
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
        {currentPage === 'token' && <TokenPage onNavigate={handleNavigate} />}
        {currentPage === 'leaderboard' && <LeaderboardPage onNavigate={handleNavigate} />}
        {currentPage === 'rewards' && <RewardsPage onNavigate={handleNavigate} />}
        {currentPage === 'about' && <AboutPage onNavigate={handleNavigate} />}
        {currentPage === 'terms' && <TermsPage onNavigate={handleNavigate} />}
        {currentPage === 'privacy' && <PrivacyPage onNavigate={handleNavigate} />}
      </main>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />

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
