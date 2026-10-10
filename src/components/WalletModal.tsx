import React, { useState } from 'react';
import { X, Wallet, Copy, Check, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';
import { WalletState } from '../types';
import { walletService } from '../services/walletService';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletState: WalletState;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  walletState,
}) => {
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyAddress = () => {
    if (walletState.address) {
      navigator.clipboard.writeText(walletState.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = async (type: 'phantom' | 'solflare' | 'demo') => {
    setConnecting(true);
    setErrorMsg(null);
    try {
      await walletService.connect(type);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message || 'Connection failed.');
      } else {
        setErrorMsg('Wallet connection cancelled or rejected.');
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await walletService.disconnect();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-950 border border-gold-glow rounded-2xl p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg bg-zinc-900 border border-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center text-black font-bold">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider font-serif">
              Solana Wallet
            </h3>
            <span className="text-xs text-zinc-400">
              Optional wallet connection for $PINN Arcade
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        {/* CONNECTED STATE */}
        {walletState.isConnected && walletState.address ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-zinc-900 border border-gold-subtle/50 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Connection Status</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Connected ({walletState.walletName || 'Solana'})
                </span>
              </div>

              <div>
                <span className="text-[11px] text-zinc-400 block font-mono-arcade">Public Address</span>
                <span className="text-xs font-mono-arcade text-amber-300 break-all select-all font-semibold">
                  {walletState.address}
                </span>
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  onClick={handleCopyAddress}
                  className="flex-1 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied to Clipboard' : 'Copy Address'}</span>
                </button>

                <button
                  onClick={handleDisconnect}
                  className="py-2 px-4 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-start gap-2 text-xs text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Your wallet is securely linked for viewing. All games remain free-to-play without spending tokens.
              </span>
            </div>
          </div>
        ) : (
          /* DISCONNECTED STATE */
          <div className="space-y-4">
            <p className="text-xs text-zinc-300 leading-relaxed">
              Connect your Solana wallet to link your address with community leaderboards and future tournament payouts.
            </p>

            <div className="space-y-2.5">
              {/* Phantom Button */}
              <button
                onClick={() => handleConnect('phantom')}
                disabled={connecting}
                className="w-full p-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 hover:border-amber-400/60 border border-zinc-800 flex items-center justify-between transition-all group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ab9ff2]/20 border border-[#ab9ff2]/40 flex items-center justify-center text-sm font-bold text-[#ab9ff2]">
                    👻
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                      Phantom Wallet
                    </h4>
                    <span className="text-[11px] text-zinc-400">
                      Detect installed extension or mobile browser
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-400">Connect</span>
              </button>

              {/* Solflare Button */}
              <button
                onClick={() => handleConnect('solflare')}
                disabled={connecting}
                className="w-full p-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 hover:border-amber-400/60 border border-zinc-800 flex items-center justify-between transition-all group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#f3841e]/20 border border-[#f3841e]/40 flex items-center justify-center text-sm font-bold text-[#f3841e]">
                    🔥
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                      Solflare Wallet
                    </h4>
                    <span className="text-[11px] text-zinc-400">
                      Standard Solana wallet adapter
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-400">Connect</span>
              </button>

              {/* Demo Solana Wallet (Instant simulation for testing on any device) */}
              <button
                onClick={() => handleConnect('demo')}
                disabled={connecting}
                className="w-full p-3.5 rounded-xl bg-zinc-900/70 hover:bg-zinc-850 hover:border-gold-subtle border border-gold-subtle/30 flex items-center justify-between transition-all group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center text-black font-bold text-xs">
                    SOL
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-300 group-hover:text-amber-200 transition-colors">
                      Demo Solana Address
                    </h4>
                    <span className="text-[11px] text-zinc-400">
                      Test wallet-linked UI without browser extensions
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-zinc-400 group-hover:text-amber-300">Test Mode</span>
              </button>
            </div>

            {/* Strict Security Guarantees */}
            <div className="pt-3 border-t border-zinc-900 space-y-2 text-[11px] text-zinc-400">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Security:</strong> We will never ask for your seed phrase, private key, or passwords.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  No automatic transactions. Free arcade play never requires connecting a wallet.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
