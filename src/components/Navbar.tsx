import React, { useState } from 'react';
import { Menu, X, Wallet, Send, ShieldCheck } from 'lucide-react';
import { PageNav, WalletState } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';

interface NavbarProps {
  currentPage: PageNav;
  onNavigate: (page: PageNav) => void;
  walletState: WalletState;
  onOpenWalletModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  walletState,
  onOpenWalletModal,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems: { label: string; page: PageNav }[] = [
    { label: 'Home', page: 'home' },
    { label: 'Play', page: 'play' },
    { label: 'Leaderboard', page: 'leaderboard' },
    { label: 'Rewards', page: 'rewards' },
    { label: 'About', page: 'about' },
  ];

  const handleNavClick = (page: PageNav) => {
    onNavigate(page);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-md border-b border-gold-subtle/30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* LOGO */}
        <button
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
        >
          {/* Gold Coin / Palm Arcade Emblem */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#ffd700] via-[#d4af37] to-[#8c5e14] flex items-center justify-center p-0.5 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-black rounded-[10px] flex items-center justify-center">
              <span className="font-extrabold text-lg text-gold-gradient font-serif tracking-wider">
                P
              </span>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-white font-serif uppercase">
                PINN <span className="text-gold-gradient">ARCADE</span>
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-mono-arcade">
              MONTEGO BAY · $PINN
            </span>
          </div>
        </button>

        {/* DESKTOP NAVIGATION LINKS */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = currentPage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => handleNavClick(item.page)}
                className={`transition-colors py-1 cursor-pointer font-semibold ${
                  isActive
                    ? 'text-amber-400 border-b-2 border-amber-400'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}

          {/* TELEGRAM LINK IN MAIN NAVIGATION */}
          <a
            href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-zinc-300 hover:text-amber-300 transition-colors py-1 font-semibold"
          >
            <Send className="w-4 h-4 text-amber-400" />
            <span>Join Telegram</span>
          </a>
        </nav>

        {/* DESKTOP ACTIONS: WALLET & TELEGRAM */}
        <div className="hidden lg:flex items-center gap-3">
          {/* CONNECT WALLET BUTTON */}
          <button
            onClick={onOpenWalletModal}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
              walletState.isConnected
                ? 'bg-zinc-900 text-amber-300 border border-gold-glow hover:bg-zinc-800'
                : 'bg-gold-gradient text-black hover:opacity-95 shadow-md shadow-amber-500/20'
            }`}
          >
            <Wallet className="w-4 h-4" />
            {walletState.isConnected && walletState.address ? (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{truncateAddress(walletState.address)}</span>
              </div>
            ) : (
              <span>Connect Wallet</span>
            )}
          </button>
        </div>

        {/* MOBILE MENU TOGGLE BUTTON */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={onOpenWalletModal}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
              walletState.isConnected
                ? 'bg-zinc-900 text-amber-300 border border-gold-subtle'
                : 'bg-gold-gradient text-black'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>{walletState.isConnected && walletState.address ? truncateAddress(walletState.address) : 'Wallet'}</span>
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* MOBILE COLLAPSIBLE MENU */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-zinc-950 border-b border-gold-subtle/30 px-6 py-6 flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => {
              const isActive = currentPage === item.page;
              return (
                <button
                  key={item.page}
                  onClick={() => handleNavClick(item.page)}
                  className={`text-left py-2.5 px-3 rounded-lg text-base font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-zinc-900 text-amber-400 border border-gold-subtle/50'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-900/50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            {/* Mobile Telegram Link */}
            <a
              href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-2.5 px-3 rounded-lg text-base font-semibold text-amber-300 bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800"
            >
              <Send className="w-4 h-4 text-amber-400" />
              <span>Join Telegram Community</span>
            </a>
          </div>

          <div className="pt-4 border-t border-zinc-800 flex flex-col gap-3">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenWalletModal();
              }}
              className="w-full py-3 rounded-xl bg-gold-gradient text-black font-extrabold text-sm uppercase tracking-wider text-center shadow-md flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              <span>{walletState.isConnected && walletState.address ? `Connected: ${truncateAddress(walletState.address)}` : 'Connect Solana Wallet'}</span>
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Free to play · No wallet mandatory</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
