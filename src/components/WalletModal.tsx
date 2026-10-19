import React, { useState, useEffect } from 'react';
import { X, Wallet, Copy, Check, LogOut, ShieldAlert, ShieldCheck, User, Coins, RefreshCw, AlertCircle, Edit3 } from 'lucide-react';
import { WalletState, PlayerProfile } from '../types';
import { walletService } from '../services/walletService';
import { playerAuthService, PlayerAuthStatus } from '../services/playerAuthService';

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
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(() => playerAuthService.getProfile());
  const [authStatus, setAuthStatus] = useState<PlayerAuthStatus>(() => playerAuthService.getStatus());
  const [authError, setAuthError] = useState<string | null>(() => playerAuthService.getError());

  const [isEditingName, setIsEditingName] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSaveMsg, setNameSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = playerAuthService.subscribe((profile, status, err) => {
      setPlayerProfile(profile);
      setAuthStatus(status);
      setAuthError(err);
      if (profile && !customNameInput) {
        setCustomNameInput(profile.displayName);
      }
    });
    return unsub;
  }, [customNameInput]);

  if (!isOpen) return null;

  const handleCopyAddress = () => {
    if (walletState.address) {
      navigator.clipboard.writeText(walletState.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = async (type: 'phantom' | 'solflare') => {
    setConnecting(true);
    setErrorMsg(null);
    try {
      await walletService.connect(type);
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

  const handleRetryAuth = async () => {
    if (!walletState.address) return;
    setErrorMsg(null);
    try {
      await playerAuthService.authenticateWallet(walletState.address, walletService.getProvider());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    }
  };

  const handleDisconnect = async () => {
    await walletService.disconnect();
    onClose();
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNameInput.trim()) return;
    setSavingName(true);
    setNameSaveMsg(null);
    try {
      const updated = await playerAuthService.updateDisplayName(customNameInput);
      setIsEditingName(false);
      setNameSaveMsg(`Username updated to ${updated.displayName}!`);
      setTimeout(() => setNameSaveMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNameSaveMsg(`Error: ${msg}`);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-950 border border-gold-glow rounded-3xl p-6 sm:p-7 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-gold-gradient flex items-center justify-center text-black font-black shadow-lg shadow-amber-500/20">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider font-serif">
              Solana Player Account
            </h3>
            <span className="text-xs text-zinc-400">
              Automatic wallet authentication & verified arcade profile
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/70 border border-red-700 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* CONNECTED STATE */}
        {walletState.isConnected && walletState.address ? (
          <div className="space-y-4">
            {/* Player Profile & Identity Card */}
            {playerProfile ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-gold-subtle/50 space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gold-gradient text-black flex items-center justify-center font-black">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-400 font-mono-arcade uppercase">Player Account</div>
                      {isEditingName ? (
                        <form onSubmit={handleSaveUsername} className="flex items-center gap-1.5 mt-0.5">
                          <input
                            type="text"
                            maxLength={24}
                            value={customNameInput}
                            onChange={(e) => setCustomNameInput(e.target.value)}
                            className="bg-black border border-amber-400 rounded-lg px-2 py-0.5 text-xs text-white font-bold focus:outline-none"
                            placeholder="New Username"
                          />
                          <button
                            type="submit"
                            disabled={savingName}
                            className="px-2 py-0.5 rounded-lg bg-amber-400 text-black font-extrabold text-[11px] cursor-pointer"
                          >
                            {savingName ? '...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingName(false)}
                            className="text-zinc-400 text-xs hover:text-white px-1"
                          >
                            ✕
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-white font-serif uppercase tracking-tight">
                            {playerProfile.displayName}
                          </span>
                          <button
                            onClick={() => {
                              setCustomNameInput(playerProfile.displayName);
                              setIsEditingName(true);
                            }}
                            title="Edit Display Name"
                            className="text-zinc-500 hover:text-amber-400 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 font-mono-arcade uppercase block">Verified Coins</span>
                    <span className="text-base font-black font-mono-arcade text-gold-gradient flex items-center justify-end gap-1">
                      <Coins className="w-4 h-4 text-amber-400 inline" />
                      {playerProfile.coinsBalance.toLocaleString()}
                    </span>
                  </div>
                </div>

                {nameSaveMsg && (
                  <div className="text-xs text-amber-300 font-medium bg-amber-950/40 p-2 rounded-lg border border-amber-500/30">
                    {nameSaveMsg}
                  </div>
                )}

                {/* Account Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-zinc-800">
                  <div className="p-2 rounded-xl bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase block font-mono-arcade">Stable Player ID</span>
                    <span className="font-mono text-[11px] text-zinc-300 truncate block">
                      {playerProfile.id}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-black/40 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase block font-mono-arcade">Games Recorded</span>
                    <span className="font-mono text-[11px] text-emerald-400 font-bold block">
                      {playerProfile.totalGamesPlayed} runs completed
                    </span>
                  </div>
                </div>

                {/* Wallet Details */}
                <div className="p-3 rounded-xl bg-black/50 border border-zinc-800">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-400">Normalized Solana Wallet</span>
                    <span className="text-zinc-400 text-[11px]">{walletState.walletName || 'Solana Wallet'}</span>
                  </div>
                  <span className="text-xs font-mono text-amber-300 break-all select-all font-semibold">
                    {playerProfile.walletAddress}
                  </span>
                </div>

                {/* Actions */}
                <div className="pt-1 flex gap-2">
                  <button
                    onClick={handleCopyAddress}
                    className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied' : 'Copy Address'}</span>
                  </button>

                  <button
                    onClick={handleDisconnect}
                    className="py-2 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Authenticating / Error State */
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 text-center">
                {authStatus === 'requesting_signature' || authStatus === 'verifying' ? (
                  <div className="py-4 space-y-3">
                    <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                    <div className="text-sm font-bold text-white">
                      {authStatus === 'requesting_signature'
                        ? 'Requesting cryptographic signature from wallet...'
                        : 'Verifying signature & synchronizing player account...'}
                    </div>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                      Please sign the short-lived authentication challenge in your wallet to confirm ownership.
                    </p>
                  </div>
                ) : (
                  <div className="py-3 space-y-3">
                    <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                    <div className="text-sm font-bold text-white">
                      Signature Authentication Required
                    </div>
                    <p className="text-xs text-zinc-400">
                      {authError || 'Wallet connected. Please sign the proof-of-ownership challenge to link your player account.'}
                    </p>
                    <button
                      onClick={handleRetryAuth}
                      className="px-5 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer shadow-lg hover:scale-105 transition-all"
                    >
                      Authenticate Now
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Cryptographic Security Indicator */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Cryptographic Ownership Verified:</strong> Authentication uses Ed25519 single-use nonces. Free arcade play never spends tokens or transfers funds.
              </span>
            </div>
          </div>
        ) : (
          /* DISCONNECTED STATE */
          <div className="space-y-4">
            <p className="text-xs text-zinc-300 leading-relaxed">
              Connect your Solana wallet to automatically authenticate and generate your unique PINN Arcade player profile. No manual email registration required!
            </p>

            <div className="space-y-2.5">
              {/* Phantom Button */}
              <button
                onClick={() => handleConnect('phantom')}
                disabled={connecting}
                className="w-full p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 hover:border-amber-400/60 border border-zinc-800 flex items-center justify-between transition-all group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#ab9ff2]/20 border border-[#ab9ff2]/40 flex items-center justify-center text-sm font-bold text-[#ab9ff2]">
                    👻
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                      Phantom Wallet
                    </h4>
                    <span className="text-[11px] text-zinc-400">
                      Standard Solana wallet adapter & signature verification
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-400">Connect</span>
              </button>

              {/* Solflare Button */}
              <button
                onClick={() => handleConnect('solflare')}
                disabled={connecting}
                className="w-full p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 hover:border-amber-400/60 border border-zinc-800 flex items-center justify-between transition-all group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#f3841e]/20 border border-[#f3841e]/40 flex items-center justify-center text-sm font-bold text-[#f3841e]">
                    🔥
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                      Solflare Wallet
                    </h4>
                    <span className="text-[11px] text-zinc-400">
                      Solflare extension or mobile in-app browser
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-400">Connect</span>
              </button>
            </div>

            {/* Direct Wallet Entry Information */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400">
              <span className="text-zinc-300 font-semibold block mb-1">Playing without a wallet extension?</span>
              Free arcade play never requires a connected wallet. You can play all games right away and enter your destination Solana address directly when requesting a PINN token withdrawal in your dashboard.
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
                  Zero transactions or gas fees required to play and submit verified scores.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
