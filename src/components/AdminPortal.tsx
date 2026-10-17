import React, { useState, useEffect, useCallback } from 'react';
import { supabase, getCurrentUser, isSupabaseConfigured } from '../services/supabaseClient';
import { adminService } from '../services/adminService';
import { AdminCheckResult } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  RefreshCw,
  LogIn,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';

export interface AdminAuthContext {
  userId: string;
  role: 'admin' | 'superadmin';
  email?: string;
}

export interface AdminPortalProps {
  children: React.ReactNode | ((admin: AdminAuthContext) => React.ReactNode);
  onOpenAuthModal?: () => void;
  onNavigate?: (page: any) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  children,
  onOpenAuthModal,
  onNavigate,
}) => {
  const [loading, setLoading] = useState(true);
  const [adminStatus, setAdminStatus] = useState<AdminCheckResult | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date>(new Date());
  const [isRetrying, setIsRetrying] = useState(false);

  const performAdminCheck = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUserEmail(user.email || null);
        setCurrentUserId(user.id);
      } else {
        setCurrentUserEmail(null);
        setCurrentUserId(null);
      }

      const status = await adminService.checkAdminStatus();
      setAdminStatus(status);
      setLastCheckedAt(new Date());
    } catch (err) {
      console.error('Failed to verify admin authorization via Supabase:', err);
      setAdminStatus({
        isAdmin: false,
        reason: 'Network or database error during role verification.',
      });
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    performAdminCheck();

    // Listen to real-time auth changes from Supabase
    if (isSupabaseConfigured()) {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setCurrentUserEmail(session.user.email || null);
          setCurrentUserId(session.user.id);
        } else {
          setCurrentUserEmail(null);
          setCurrentUserId(null);
        }
        performAdminCheck();
      });

      return () => {
        authListener?.subscription?.unsubscribe();
      };
    }
  }, [performAdminCheck]);

  const handleManualRetry = async () => {
    setIsRetrying(true);
    await performAdminCheck();
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center p-8">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-black border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Lock className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black border border-amber-400/60 flex items-center justify-center">
            <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
          </div>
        </div>

        <h2 className="text-xl font-black text-white uppercase tracking-wider font-serif">
          Verifying Server Authorization...
        </h2>
        <p className="text-xs text-zinc-400 mt-2 text-center max-w-md">
          Auditing authenticated credentials against <code className="text-amber-300 font-mono">public.admin_roles</code> and cryptographic policies.
        </p>

        <div className="mt-6 flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Supabase RLS & Server-Side Security Check in Progress</span>
        </div>
      </div>
    );
  }

  // 2. Unauthorized State
  if (!adminStatus?.isAdmin) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center text-center">
        {/* Shield Alert Icon Banner */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-950/80 via-zinc-950 to-amber-950/40 border-2 border-red-500/40 flex items-center justify-center shadow-2xl shadow-red-900/30">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
          <div className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-red-900/80 border border-red-500/50 text-[10px] font-black text-red-200 uppercase tracking-widest">
            403 Denied
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/50 border border-red-500/30 text-red-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <Lock className="w-3.5 h-3.5" />
          <span>Role-Based Access Control (RBAC) Enforced</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-white font-serif uppercase tracking-tight mb-3">
          ADMINISTRATOR ACCESS REQUIRED
        </h1>
        <p className="text-sm text-zinc-400 max-w-xl mb-8 leading-relaxed">
          The PINN Arcade Admin Dashboard is restricted to verified administrators. All administrative actions (score approvals, tournament prize allocations, and Solana payout records) are authorized server-side and recorded in audit logs.
        </p>

        {/* Current Auth Diagnostic Box */}
        <div className="w-full max-w-xl bg-zinc-950/80 border border-gold-subtle/30 rounded-2xl p-5 mb-8 text-left shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
            <span className="text-xs uppercase tracking-wider font-bold text-zinc-400 flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              Current Session Status
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              Checked: {lastCheckedAt.toLocaleTimeString()}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Authentication State:</span>
              <span className={`font-semibold ${currentUserEmail ? 'text-amber-400' : 'text-zinc-400'}`}>
                {currentUserEmail ? 'Authenticated (Active Session)' : 'Not Authenticated (Anonymous)'}
              </span>
            </div>

            {currentUserEmail && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Signed In Account:</span>
                <span className="font-mono text-zinc-200 truncate max-w-[280px]">
                  {currentUserEmail}
                </span>
              </div>
            )}

            {currentUserId && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">User ID (UUID):</span>
                <span className="font-mono text-zinc-400 text-[11px]">
                  {currentUserId.slice(0, 18)}...
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-zinc-500">Admin Role Status:</span>
              <span className="text-red-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                {adminStatus?.reason || 'No admin role found in public.admin_roles'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="px-6 py-3 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{currentUserEmail ? 'Switch to Admin Account' : 'Sign In as Administrator'}</span>
            </button>
          )}

          <button
            onClick={handleManualRetry}
            disabled={isRetrying}
            className="px-5 py-3 rounded-xl bg-zinc-900 border border-gold-subtle/50 text-amber-300 hover:text-white hover:border-gold font-bold text-xs uppercase tracking-wider shadow-md hover:bg-zinc-800 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>Re-Check Role</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('home')}
              className="px-5 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Arcade</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 3. Authorized State -> Render Protected Children
  const context: AdminAuthContext = {
    userId: adminStatus.userId || currentUserId || '',
    role: adminStatus.role || 'admin',
    email: currentUserEmail || undefined,
  };

  return (
    <div className="w-full">
      {typeof children === 'function' ? children(context) : children}
    </div>
  );
};
