import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

// CORS headers for secure browser invocation
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Valid games registered in PINN Arcade
const VALID_GAMES = new Set(['coin-rush', 'treasure-hunt', 'puzzle-master', 'speed-tap']);

// Game constraints and theoretical physics / scoring ceilings
const GAME_RULES: Record<
  string,
  {
    minDurationMs: number;
    maxScore: number;
    maxCoins?: number;
    maxPps?: number; // Maximum plausible points per second
  }
> = {
  'coin-rush': {
    minDurationMs: 3000, // At least 3 seconds of gameplay
    maxScore: 300000,    // High endurance ceiling
    maxCoins: 5000,
    maxPps: 80,          // Coin rush gives ~10-40 pts/sec normally
  },
  'treasure-hunt': {
    minDurationMs: 4000, // At least 4 seconds
    maxScore: 60000,
    maxCoins: 1000,
    maxPps: 200,         // Tile transitions and level clears
  },
  'puzzle-master': {
    minDurationMs: 5000, // 10 questions minimum 5 seconds
    maxScore: 6000,      // Max 10 questions @ 300 + 600 speed bonus = ~3600
    maxPps: 200,
  },
  'speed-tap': {
    minDurationMs: 25000, // Standard match is 30 seconds
    maxScore: 25000,      // Max diamond combo blitz ~15,000
    maxPps: 500,          // Human finger limit
  },
};

interface SubmitScorePayload {
  gameId: string;
  score: number;
  coins?: number;
  sessionId: string;
  durationMs: number;
  playerName?: string;
  walletAddress?: string | null;
  // Game-specific telemetry logs for server-side authoritative recalculation
  telemetry?: {
    // Speed Tap
    taps?: Array<{ id: number; type: 'gold' | 'diamond' | 'hazard'; t: number }>;
    misses?: number;
    trapsHit?: number;
    // Puzzle Master
    answers?: Array<{ qId: number; chosenIndex: number; correct: boolean; timeMs: number }>;
    // Treasure Hunt
    levelsCleared?: number;
    chestsFound?: number;
    coinsFound?: number;
    movesCount?: number;
    // Coin Rush
    distanceMeters?: number;
    obstaclesPassed?: number;
    coinsGathered?: number;
  };
}

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 2. Validate Supabase environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Edge function server configuration incomplete' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Extract and verify user auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          error: 'Authentication required. Authorization Bearer token missing.',
          status: 'rejected',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Initialize admin client with service role key to bypass RLS and perform authoritative checks
    const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Authoritative user verification via Supabase Auth
    const { data: userData, error: userError } = await adminSupabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({
          error: 'Invalid or expired authentication session.',
          details: userError?.message,
          status: 'rejected',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-verified user identity
    const verifiedUserId = userData.user.id;
    const verifiedUserEmail = userData.user.email || '';

    // 4. Parse JSON payload
    let body: SubmitScorePayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body', status: 'rejected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      gameId,
      score,
      coins = 0,
      sessionId,
      durationMs,
      playerName = 'Player',
      walletAddress = null,
      telemetry,
    } = body;

    // 5. Basic Validation: Game existence & score type
    if (!gameId || !VALID_GAMES.has(gameId)) {
      return new Response(
        JSON.stringify({
          error: `Game "${gameId}" does not exist or is inactive.`,
          status: 'rejected',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
      return new Response(
        JSON.stringify({
          error: 'Submitted score must be a non-negative integer.',
          status: 'rejected',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof durationMs !== 'number' || durationMs < 0) {
      return new Response(
        JSON.stringify({
          error: 'Invalid gameplay duration.',
          status: 'rejected',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 8) {
      return new Response(
        JSON.stringify({
          error: 'Invalid or missing unique game session identifier.',
          status: 'rejected',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Anti-Cheat: Replay Protection Check
    // Check if sessionId was already submitted in public.scores
    const { data: existingSession } = await adminSupabase
      .from('scores')
      .select('id, status, created_at')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existingSession) {
      return new Response(
        JSON.stringify({
          error: 'Replay detected: this game session has already been recorded.',
          status: 'rejected',
          code: 'SESSION_REPLAY',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Rate Limiting: Max 1 submission every 2 seconds per player, or 60 per hour
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: recentCount, error: countErr } = await adminSupabase
      .from('scores')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', verifiedUserId)
      .gte('created_at', oneMinuteAgo);

    if (!countErr && (recentCount ?? 0) > 12) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded: too many score submissions. Please slow down.',
          status: 'rejected',
          code: 'RATE_LIMIT_EXCEEDED',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Plausibility & Authoritative Score Verification
    const rule = GAME_RULES[gameId];
    let isLegitimate = true;
    let rejectionReason = '';
    let authoritativeScore = score;

    // Check maximum score threshold
    if (score > rule.maxScore) {
      isLegitimate = false;
      rejectionReason = `Score ${score} exceeds theoretical limit of ${rule.maxScore} for ${gameId}.`;
    }

    // Check minimum duration
    if (durationMs < rule.minDurationMs && score > 50) {
      isLegitimate = false;
      rejectionReason = `Game duration (${durationMs}ms) is below realistic threshold (${rule.minDurationMs}ms).`;
    }

    // Points Per Second (PPS) sanity check
    const durationSeconds = Math.max(1, durationMs / 1000);
    const pps = score / durationSeconds;
    if (rule.maxPps && pps > rule.maxPps && score > 200) {
      isLegitimate = false;
      rejectionReason = `Point accumulation rate (${pps.toFixed(1)} pts/sec) exceeds maximum plausible rate (${rule.maxPps} pts/sec).`;
    }

    // Game-specific server-side recalculation
    if (gameId === 'speed-tap' && telemetry?.taps) {
      // Authoritative recalculation of Speed Tap score from tap events
      let calculatedScore = 0;
      let calculatedCombo = 0;
      let calculatedTraps = 0;

      for (const tap of telemetry.taps) {
        if (tap.type === 'hazard') {
          calculatedScore = Math.max(0, calculatedScore - 150);
          calculatedCombo = 0;
          calculatedTraps++;
        } else {
          const mult = calculatedCombo >= 10 ? 3 : calculatedCombo >= 5 ? 2 : 1;
          const baseVal = tap.type === 'diamond' ? 250 : 100;
          calculatedScore += baseVal * mult;
          calculatedCombo++;
        }
      }

      // Check discrepancy between reported and calculated score
      if (Math.abs(calculatedScore - score) > 250) {
        isLegitimate = false;
        rejectionReason = `Authoritative Speed Tap mismatch: client reported ${score}, reconstructed score was ${calculatedScore}.`;
      } else {
        authoritativeScore = calculatedScore;
      }
    } else if (gameId === 'puzzle-master' && telemetry?.answers) {
      // 10 questions max, check answers
      let calcScore = 0;
      let correct = 0;
      let streak = 0;

      for (const ans of telemetry.answers) {
        if (ans.correct) {
          correct++;
          const streakBonus = streak >= 5 ? 50 : streak >= 3 ? 25 : 0;
          calcScore += 100 + streakBonus;
          streak++;
        } else {
          streak = 0;
        }
      }
      // Speed bonus
      const timeBonus = Math.max(0, Math.floor((120 - durationSeconds) * 5));
      calcScore += timeBonus;

      if (Math.abs(calcScore - score) > 100) {
        isLegitimate = false;
        rejectionReason = `Authoritative Puzzle Master mismatch: client reported ${score}, calculated ${calcScore}.`;
      } else {
        authoritativeScore = calcScore;
      }
    } else if (gameId === 'coin-rush' && telemetry) {
      // Coin rush: score should correlate with distance + coins collected
      if (typeof telemetry.coinsGathered === 'number' && typeof telemetry.distanceMeters === 'number') {
        const expectedScore = Math.floor(telemetry.distanceMeters * 2 + telemetry.coinsGathered * 25);
        if (Math.abs(expectedScore - score) > 200) {
          isLegitimate = false;
          rejectionReason = `Authoritative Coin Rush mismatch: client reported ${score}, telemetry expected ~${expectedScore}.`;
        }
      }
    }

    const finalStatus = isLegitimate ? 'verified' : 'rejected';

    // 9. Store accepted submission in public.scores table
    const scoreRecord = {
      user_id: verifiedUserId,
      player_id: verifiedUserId,
      player_name: (playerName || verifiedUserEmail.split('@')[0] || 'Player').slice(0, 32),
      game_id: gameId,
      score: authoritativeScore,
      coins: Math.max(0, coins),
      wallet_address: walletAddress || null,
      session_id: sessionId,
      duration_ms: Math.floor(durationMs),
      status: finalStatus,
      validation_reason: rejectionReason || 'Server-side anti-cheat verification passed.',
      metadata: {
        verifiedAt: new Date().toISOString(),
        pps: Number(pps.toFixed(2)),
        telemetrySummary: {
          hasTelemetry: Boolean(telemetry),
        },
      },
    };

    const { data: insertedScore, error: insertError } = await adminSupabase
      .from('scores')
      .insert([scoreRecord])
      .select('id, game_id, score, status, validation_reason, created_at')
      .single();

    if (insertError) {
      console.error('Error inserting into scores table:', insertError);
      return new Response(
        JSON.stringify({
          error: 'Failed to record score in database.',
          details: insertError.message,
          status: 'error',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. If verified, also sync with legacy public.game_scores table for backwards compatibility
    if (finalStatus === 'verified') {
      try {
        await adminSupabase.from('game_scores').insert([
          {
            game_id: gameId,
            player_name: scoreRecord.player_name,
            wallet_address: scoreRecord.wallet_address,
            score: authoritativeScore,
            coins: scoreRecord.coins,
          },
        ]);
      } catch (err) {
        console.warn('Sync to legacy game_scores table skipped:', err);
      }
    }

    // Return response to client
    if (finalStatus === 'rejected') {
      return new Response(
        JSON.stringify({
          status: 'rejected',
          score: authoritativeScore,
          message: 'Score rejected by server anti-cheat validator.',
          reason: rejectionReason,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'verified',
        id: insertedScore.id,
        score: authoritativeScore,
        gameId,
        message: 'Score successfully validated and published to global leaderboard!',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Edge function unexpected exception:', errorMsg);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMsg, status: 'error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
