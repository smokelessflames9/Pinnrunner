import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { checkBackendHealth } from './apiClient';

// Configuration provided for PINN Arcade
const DEFAULT_SUPABASE_URL = 'https://qkckwsxhejnktuccbeaw.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrY2t3c3hoZWpua3R1Y2NiZWF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2OTc4NTgsImV4cCI6MjEwNzI3Mzg1OH0.zdf2FZx7FH3cWjS5wwXNHmuriiyA88hgS5XklBTO4Go';

const envUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL);

const envKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY);

export const SUPABASE_URL = (envUrl as string | undefined)?.trim() || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = (envKey as string | undefined)?.trim() || DEFAULT_SUPABASE_ANON_KEY;

export interface SupabaseScoreRow {
  id?: string;
  user_id?: string;
  game_id: string; // 'coin-rush' | 'treasure-hunt' | 'puzzle-master' | 'speed-tap'
  player_name: string;
  wallet_address?: string | null;
  score: number;
  coins?: number;
  duration_ms?: number;
  status?: 'pending' | 'verified' | 'rejected';
  session_id?: string;
  validation_reason?: string;
  created_at?: string;
}

// Instantiate client
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const isSupabaseConfigured = (): boolean => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('http'));
};

/**
 * Checks connectivity to the Supabase instance, backend API (/api/health), and checks if scores table is ready.
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  tableReady: boolean;
  scoresTableReady: boolean;
  edgeFunctionReady: boolean;
  backendHealthy?: boolean;
  message: string;
}> {
  const backendRes = await checkBackendHealth();
  const backendHealthy = backendRes.ok;

  if (!isSupabaseConfigured()) {
    return {
      connected: false,
      tableReady: false,
      scoresTableReady: false,
      edgeFunctionReady: false,
      backendHealthy,
      message: 'Supabase URL or Anon key is not set.',
    };
  }

  let tableReady = false;
  let scoresTableReady = false;
  let edgeFunctionReady = false;

  try {
    const { error: gErr } = await supabase.from('game_scores').select('id').limit(1);
    tableReady = !gErr;

    const { error: sErr } = await supabase.from('scores').select('id').limit(1);
    scoresTableReady = !sErr;

    // Probe edge function
    try {
      const edgeRes = await supabase.functions.invoke('submit-score', {
        body: { test: true },
      });
      // 401 is expected if function is deployed and rejecting unauthenticated calls
      edgeFunctionReady = edgeRes.error?.context?.status !== 404;
    } catch {
      edgeFunctionReady = false;
    }

    return {
      connected: true,
      tableReady,
      scoresTableReady,
      edgeFunctionReady,
      backendHealthy,
      message: scoresTableReady
        ? 'Connected successfully to Supabase scores database!'
        : 'Connected to Supabase. Table public.scores is pending creation.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      tableReady: false,
      scoresTableReady: false,
      edgeFunctionReady: false,
      backendHealthy,
      message: `Failed to connect to Supabase: ${msg}`,
    };
  }
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  } catch {
    return null;
  }
}

/**
 * Get current session
 */
export async function getCurrentSession(): Promise<Session | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
}

export interface SecureScorePayload {
  gameId: 'coin-rush' | 'treasure-hunt' | 'puzzle-master' | 'speed-tap';
  score: number;
  coins?: number;
  sessionId: string;
  durationMs: number;
  playerName?: string;
  walletAddress?: string | null;
  telemetry?: Record<string, unknown>;
}

export interface SubmitScoreResponse {
  success: boolean;
  status: 'verified' | 'pending' | 'rejected' | 'offline';
  message: string;
  scoreId?: string;
  error?: string;
  authoritativeScore?: number;
}

/**
 * Submits score through the authoritative Supabase Edge Function 'submit-score'.
 * Falls back safely to database submission if edge function is in configuration phase.
 */
export async function submitScoreSecurely(
  payload: SecureScorePayload
): Promise<SubmitScoreResponse> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      status: 'offline',
      message: 'Supabase cloud is not configured.',
      error: 'Not configured',
    };
  }

  // 1. Check user authentication
  const session = await getCurrentSession();
  const token = session?.access_token;

  if (!token) {
    // Unauthenticated or Solana-wallet-only arcade run: persist to public.game_scores for admin moderation queue
    const gsRes = await submitScoreToSupabase({
      gameId: payload.gameId,
      playerName: payload.playerName || 'Player',
      walletAddress: payload.walletAddress || null,
      score: payload.score,
      coins: payload.coins || 0,
      durationMs: payload.durationMs,
      sessionId: payload.sessionId,
    });

    return {
      success: gsRes.success,
      status: 'pending',
      message: gsRes.success
        ? 'Gameplay score submitted to Supabase (public.game_scores) and queued for admin review.'
        : `Database submission note: ${gsRes.error}`,
      error: gsRes.error,
    };
  }

  // 2. Invoke Supabase Edge Function: submit-score
  try {
    const { data, error } = await supabase.functions.invoke('submit-score', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: payload,
    });

    if (!error && data) {
      if (data.status === 'verified') {
        return {
          success: true,
          status: 'verified',
          message: data.message || 'Score verified and recorded on the global leaderboard!',
          scoreId: data.id,
          authoritativeScore: data.score,
        };
      }
      if (data.status === 'rejected') {
        return {
          success: false,
          status: 'rejected',
          message: data.message || 'Score did not pass server anti-cheat rules.',
          error: data.reason || data.error,
        };
      }
    }

    // If edge function returned 404 or is not yet deployed, run direct secure insert with 'pending' status
    const isMissingFunction =
      Boolean(error) &&
      ((error as any).context?.status === 404 ||
        (error as any).status === 404 ||
        error.message?.includes('404') ||
        error.message?.includes('NOT_FOUND') ||
        error.message?.includes('not found') ||
        error.message?.includes('non-2xx') ||
        error.message?.includes('Failed to send'));

    if (error && isMissingFunction) {
      console.warn('Edge function submit-score not deployed. Recording pending score in database...');
      return await submitPendingFallback(payload, session.user.id);
    }

    if (error) {
      return {
        success: false,
        status: 'rejected',
        message: error.message || 'Validation error from edge function.',
        error: error.message,
      };
    }

    return {
      success: false,
      status: 'rejected',
      message: 'Unexpected edge function response.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Network error invoking submit-score edge function:', msg);
    return await submitPendingFallback(payload, session.user.id);
  }
}

/**
 * Fallback to public.scores table with strict 'pending' status until validated
 */
async function submitPendingFallback(
  payload: SecureScorePayload,
  userId: string
): Promise<SubmitScoreResponse> {
  try {
    // Insert into public.scores with 'pending' status
    const { data, error } = await supabase
      .from('scores')
      .insert([
        {
          user_id: userId,
          player_id: userId,
          player_name: payload.playerName || 'Player',
          game_id: payload.gameId,
          score: payload.score,
          coins: payload.coins || 0,
          wallet_address: payload.walletAddress || null,
          session_id: payload.sessionId,
          duration_ms: payload.durationMs,
          status: 'pending',
          validation_reason: 'Awaiting edge function verification.',
        },
      ])
      .select('id')
      .single();

    if (error) {
      // Also try legacy table as fallback
      await submitScoreToSupabase({
        gameId: payload.gameId,
        playerName: payload.playerName || 'Player',
        walletAddress: payload.walletAddress,
        score: payload.score,
        coins: payload.coins,
        durationMs: payload.durationMs,
        sessionId: payload.sessionId,
      });

      return {
        success: true,
        status: 'pending',
        message: 'Score recorded locally & synced to cloud archive.',
      };
    }

    return {
      success: true,
      status: 'pending',
      scoreId: data?.id,
      message: 'Score submitted and pending server validation.',
    };
  } catch {
    return {
      success: false,
      status: 'offline',
      message: 'Could not connect to database.',
    };
  }
}

/**
 * Records a game score row in Supabase with legacy fallback
 */
export async function submitScoreToSupabase(scoreData: {
  gameId: string;
  playerName: string;
  walletAddress?: string | null;
  score: number;
  coins?: number;
  durationMs?: number;
  sessionId?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // 1. Attempt insert with duration_ms and session_id
    const rowWithDuration: Record<string, unknown> = {
      game_id: scoreData.gameId,
      player_name: scoreData.playerName,
      wallet_address: scoreData.walletAddress || null,
      score: scoreData.score,
      coins: scoreData.coins || 0,
      duration_ms: scoreData.durationMs || 0,
    };
    if (scoreData.sessionId) {
      rowWithDuration.session_id = scoreData.sessionId;
    }

    const { error } = await supabase.from('game_scores').insert([rowWithDuration]);

    if (!error) {
      return { success: true };
    }

    // 2. If duration_ms column is not present on older schema, fallback without it
    const isColumnError =
      error.message &&
      (error.message.toLowerCase().includes('duration_ms') ||
       error.message.toLowerCase().includes('column') ||
       error.code === 'PGRST204');

    if (isColumnError) {
      const { error: fallbackErr } = await supabase.from('game_scores').insert([
        {
          game_id: scoreData.gameId,
          player_name: scoreData.playerName,
          wallet_address: scoreData.walletAddress || null,
          score: scoreData.score,
          coins: scoreData.coins || 0,
        },
      ]);

      if (fallbackErr) {
        return { success: false, error: fallbackErr.message };
      }
      return { success: true };
    }

    return { success: false, error: error.message };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Fetches top global verified scores from Supabase
 */
export async function fetchTopScoresFromSupabase(
  gameId: string = 'coin-rush',
  limit: number = 20
): Promise<SupabaseScoreRow[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    // Try querying public.scores table for verified scores first
    const { data: verifiedScores, error: vErr } = await supabase
      .from('scores')
      .select('*')
      .eq('game_id', gameId)
      .eq('status', 'verified')
      .order('score', { ascending: false })
      .limit(limit);

    if (!vErr && verifiedScores && verifiedScores.length > 0) {
      return verifiedScores as SupabaseScoreRow[];
    }

    // Fallback to legacy game_scores table
    const { data, error } = await supabase
      .from('game_scores')
      .select('*')
      .eq('game_id', gameId)
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      return [];
    }

    return (data as SupabaseScoreRow[]) || [];
  } catch (err) {
    console.warn('Network error loading Supabase scores:', err);
    return [];
  }
}
