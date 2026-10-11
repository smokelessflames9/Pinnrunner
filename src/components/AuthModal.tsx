import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { ShieldCheck, Mail, Lock, User, LogOut, Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              player_name: playerName.trim() || email.split('@')[0],
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setSuccessMsg('Account created and signed in! You can now submit verified scores.');
          setTimeout(() => {
            onSuccess?.();
            onClose();
          }, 1200);
        } else {
          setSuccessMsg('Registration submitted! If email confirmation is required, please check your inbox.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        if (data.session) {
          setSuccessMsg('Signed in successfully! Your scores will be verified.');
          setTimeout(() => {
            onSuccess?.();
            onClose();
          }, 1000);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-zinc-950 border border-gold-subtle/50 rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden">
        {/* Top gold bar glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600" />

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gold-gradient p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-serif">
                {isSignUp ? 'Player Registration' : 'Player Sign In'}
              </h3>
              <p className="text-xs text-zinc-400">Required for Verified Leaderboard Ranking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl font-bold cursor-pointer transition-colors p-1"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Arcade Call Sign / Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. MontegoAce"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                placeholder="player@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gold-gradient text-black font-bold text-sm tracking-wide shadow-md shadow-amber-500/20 hover:scale-[1.01] transition-transform flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : isSignUp ? (
              'Create Player Account'
            ) : (
              'Sign In to Arcade'
            )}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-zinc-400 border-t border-zinc-800/80 pt-4">
          {isSignUp ? (
            <p>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-amber-400 font-semibold hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              New challenger?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="text-amber-400 font-semibold hover:underline cursor-pointer"
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
