import React, { useState, useEffect } from 'react';
import { Menu, X, Wallet, Send, ShieldCheck, Volume2, VolumeX, User, LogOut, Lock } from 'lucide-react';
import { PageNav, WalletState } from '../types';
import { PINN_CONFIG } from '../config/pinnConfig';
import { soundService } from '../services/soundService';
import { supabase, getCurrentUser } from '../services/supabaseClient';

interface NavbarProps {
  currentPage: PageNav;
  onNavigate: (page: PageNav) => void;
  walletState: WalletState;
  onOpenWalletModal: () => void;
  onOpenAuthModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  walletState,
  onOpenWalletModal,
  onOpenAuthModal,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(soundService.getIsMuted());
  const [authUser, setAuthUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    getCurrentUser().then((u) => setAuthUser(u ? { id: u.id, email: u.email } : null));

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsub = soundService.subscribe((muted) => {
      setIsMuted(muted);
    });
    return unsub;
  }, []);

  const navItems: { label: string; page: PageNav; matches?: PageNav[] }[] = [
    { label: 'Home', page: 'home' },
    {
      label: 'Games',
      page: 'games',
      matches: ['games', 'play', 'play-treasure', 'play-puzzle', 'play-speedtap'],
    },
    { label: 'Tournaments', page: 'tournaments' },
    { label: 'Leaderboard', page: 'leaderboard' },
    { label: 'Rewards', page: 'rewards' },
    { label: '$PINN Token', page: 'token' },
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
              const isActive = item.matches ? item.matches.includes(currentPage) : currentPage === item.page;
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

        {/* DESKTOP ACTIONS: AUDIO, WALLET & TELEGRAM */}
        <div className="hidden lg:flex items-center gap-3">
          {/* AUDIO SFX TOGGLE BUTTON */}
          <button
            onClick={() => soundService.toggleMute()}
            title={isMuted ? 'Arcade sound is muted. Click to turn sound ON.' : 'Arcade sound is ON. Click to mute.'}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
              isMuted
                ? 'bg-amber-950/40 border border-amber-500/60 text-amber-300 hover:bg-amber-900/50 shadow-md shadow-amber-500/10'
                : 'bg-zinc-900 border border-gold-subtle/50 text-amber-400 hover:border-gold-glow hover:bg-zinc-800'
            }`}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4 text-amber-300 animate-pulse" />
                <span className="text-amber-300">SFX Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-amber-400" />
                <span>SFX On</span>
              </>
            )}
          </button>

          {/* PLAYER ACCOUNT / AUTH STATUS BUTTON */}
          {authUser ? (
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-emerald-500/50 rounded-xl px-3 py-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-semibold max-w-[100px] truncate">
                {authUser.email?.split('@')[0] || 'Player'}
              </span>
              <button
                onClick={() => supabase.auth.signOut()}
                title="Sign out of Arcade account"
                className="text-zinc-400 hover:text-red-400 ml-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-zinc-900 text-zinc-300 border border-zinc-700 hover:border-amber-400 hover:text-white transition-all cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Player Sign In</span>
            </button>
          )}

          {/* ADMIN PORTAL BUTTON */}
          <button
            onClick={() => handleNavClick('admin')}
            title="Administrator Portal"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              currentPage === 'admin'
                ? 'bg-amber-400 text-black border border-amber-300'
                : 'bg-zinc-950 text-zinc-400 hover:text-amber-300 border border-gold-subtle/30 hover:border-gold-subtle'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>

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

        {/* MOBILE ACTIONS */}
        <div className="flex items-center gap-2 lg:hidden">
          {/* Mobile Sound Toggle */}
          <button
            onClick={() => soundService.toggleMute()}
            aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            title={isMuted ? 'Sound Muted - Tap to Unmute' : 'Sound On - Tap to Mute'}
            className={`p-2.5 rounded-lg border transition-all ${
              isMuted
                ? 'bg-amber-950/50 border-amber-500/70 text-amber-300'
                : 'bg-zinc-900 border-zinc-800 text-amber-400'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-amber-300" /> : <Volume2 className="w-4 h-4" />}
          </button>

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
            {/* Audio Toggle in Mobile Menu */}
            <button
              onClick={() => soundService.toggleMute()}
              className={`w-full py-2.5 px-3 rounded-lg text-sm font-semibold flex items-center justify-between transition-colors border ${
                isMuted
                  ? 'bg-amber-950/30 border-amber-500/50 text-amber-200'
                  : 'bg-zinc-900/80 border-gold-subtle/40 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {isMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                <span>Arcade Audio Effects</span>
              </div>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                isMuted ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-black/60 text-emerald-400'
              }`}>
                {isMuted ? 'Tap to Unmute' : 'Active'}
              </span>
            </button>

            {navItems.map((item) => {
                const isActive = item.matches ? item.matches.includes(currentPage) : currentPage === item.page;
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

            {/* Mobile Admin Portal Link */}
            <button
              onClick={() => handleNavClick('admin')}
              className={`text-left py-2.5 px-3 rounded-lg text-base font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                currentPage === 'admin'
                  ? 'bg-zinc-900 text-amber-400 border border-gold-subtle/50'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
              }`}
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Admin Portal</span>
            </button>
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
