import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Zap,
  Timer,
  Trophy,
  RotateCcw,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Target,
  Sparkles,
  Flame,
  Award,
} from 'lucide-react';
import { soundService } from '../../services/soundService';
import { leaderboardService } from '../../services/leaderboardService';

interface PinnSpeedTapProps {
  onBackToHub?: () => void;
  onNavigateToLeaderboard?: () => void;
}

interface TargetItem {
  id: number;
  x: number; // percentage 5% to 85%
  y: number; // percentage 10% to 80%
  size: number;
  type: 'gold' | 'diamond' | 'hazard';
  value: number;
  createdAt: number;
  lifespan: number;
}

export const PinnSpeedTap: React.FC<PinnSpeedTapProps> = ({
  onBackToHub,
  onNavigateToLeaderboard,
}) => {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [score, setScore] = useState<number>(0);
  const [hits, setHits] = useState<number>(0);
  const [misses, setMisses] = useState<number>(0);
  const [trapsHit, setTrapsHit] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(soundService.getIsMuted());
  const [personalBest, setPersonalBest] = useState<number>(leaderboardService.getGameBest('speed-tap'));

  useEffect(() => {
    const unsub = soundService.subscribe((muted) => {
      setIsMuted(muted);
    });
    return unsub;
  }, []);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const spawnerIntervalRef = useRef<number | null>(null);
  const targetIdCounter = useRef<number>(0);
  const matchSessionId = useRef<string>('');
  const matchStartTime = useRef<number>(0);
  const tapTelemetry = useRef<Array<{ id: number; type: 'gold' | 'diamond' | 'hazard'; t: number }>>([]);

  const handleToggleMute = () => {
    soundService.toggleMute();
  };

  // Start Fresh 30-Second Match
  const startMatch = useCallback(() => {
    soundService.unlockAudio();
    soundService.playClick();

    matchSessionId.current = `st_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    matchStartTime.current = Date.now();
    tapTelemetry.current = [];

    setTimeLeft(30);
    setScore(0);
    setHits(0);
    setMisses(0);
    setTrapsHit(0);
    setCombo(0);
    setMaxCombo(0);
    setTargets([]);
    setGameState('playing');
  }, []);

  // Main 30-Second Countdown
  useEffect(() => {
    if (gameState === 'playing') {
      timerIntervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Match Ends!
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [gameState]);

  // When timer hits 0, trigger Game Over
  useEffect(() => {
    if (timeLeft === 0 && gameState === 'playing') {
      setGameState('gameover');
      soundService.playGameOver();

      const elapsedMs =
        matchStartTime.current > 0
          ? Math.max(5000, Math.min(35000, Date.now() - matchStartTime.current))
          : 30000;
      const { pb, isNewPb } = leaderboardService.recordGameBest('speed-tap', score, {
        coins: hits,
        sessionId: matchSessionId.current,
        durationMs: elapsedMs,
        telemetry: {
          taps: tapTelemetry.current,
          misses,
          trapsHit,
        },
      });
      setPersonalBest(pb);

      if (isNewPb || score > 2000) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ffd700', '#d4af37', '#ffffff'],
        });
      }
    }
  }, [timeLeft, gameState, score, hits, misses, trapsHit]);

  // Spawn Targets with dynamic difficulty escalation
  useEffect(() => {
    if (gameState === 'playing') {
      // As time ticks down, targets spawn faster!
      // Start at 650ms, decreases to 380ms towards end
      const spawnInterval = Math.max(380, 650 - (30 - timeLeft) * 10);

      spawnerIntervalRef.current = window.setInterval(() => {
        setTargets((currentList) => {
          // Clean up expired targets
          const now = Date.now();
          const activeList = currentList.filter((t) => {
            const isAlive = now - t.createdAt < t.lifespan;
            if (!isAlive && t.type !== 'hazard') {
              // Missed target!
              setMisses((m) => m + 1);
              setCombo(0);
            }
            return isAlive;
          });

          // Cap maximum simultaneous targets to 5
          if (activeList.length >= 5) return activeList;

          targetIdCounter.current += 1;
          const randType = Math.random();
          let type: 'gold' | 'diamond' | 'hazard' = 'gold';
          let val = 100;
          let lifespan = Math.max(1200, 2200 - (30 - timeLeft) * 35);
          let size = 64;

          if (randType < 0.2) {
            // Rare Diamond (+250)
            type = 'diamond';
            val = 250;
            lifespan = 1300;
            size = 54;
          } else if (randType > 0.8) {
            // Trap Skull (-150)
            type = 'hazard';
            val = -150;
            lifespan = 2000;
            size = 60;
          }

          const newTarget: TargetItem = {
            id: targetIdCounter.current,
            x: Math.floor(Math.random() * 75) + 8,
            y: Math.floor(Math.random() * 70) + 12,
            size,
            type,
            value: val,
            createdAt: now,
            lifespan,
          };

          return [...activeList, newTarget];
        });
      }, spawnInterval);
    }

    return () => {
      if (spawnerIntervalRef.current) clearInterval(spawnerIntervalRef.current);
    };
  }, [gameState, timeLeft]);

  // Target Tap Handler
  const handleTapTarget = (e: React.MouseEvent | React.TouchEvent, target: TargetItem) => {
    e.stopPropagation();
    if (gameState !== 'playing') return;
    soundService.unlockAudio();

    // Remove tapped target
    setTargets((prev) => prev.filter((t) => t.id !== target.id));

    // Record anti-cheat tap event telemetry
    tapTelemetry.current.push({
      id: target.id,
      type: target.type,
      t: Date.now() - matchStartTime.current,
    });

    if (target.type === 'hazard') {
      // Hit penalty hazard!
      soundService.playCrash();
      setScore((s) => Math.max(0, s - 150));
      setTrapsHit((t) => t + 1);
      setCombo(0);
    } else {
      // Successful tap!
      if (target.type === 'diamond') {
        soundService.playCoin();
      } else {
        soundService.playTap();
      }
      const comboMult = combo >= 10 ? 3 : combo >= 5 ? 2 : 1;
      const pts = target.value * comboMult;

      setScore((s) => s + pts);
      setHits((h) => h + 1);
      setCombo((c) => {
        const next = c + 1;
        if (next > maxCombo) setMaxCombo(next);
        return next;
      });
    }
  };

  // Background Arena Miss Tap Handler
  const handleArenaMissClick = () => {
    if (gameState !== 'playing') return;
    soundService.unlockAudio();
    soundService.playMiss();
    setScore((s) => Math.max(0, s - 25));
    setMisses((m) => m + 1);
    setCombo(0);
  };

  // Toggle Pause
  const handleTogglePause = () => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
    soundService.playClick();
  };

  const totalTaps = hits + misses + trapsHit;
  const accuracy = totalTaps > 0 ? Math.round((hits / totalTaps) * 100) : 100;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center select-none">
      {/* Top HUD Bar */}
      <div className="w-full flex items-center justify-between bg-zinc-950/90 border border-gold-subtle/40 rounded-t-xl px-4 py-3 text-sm backdrop-blur-sm shadow-lg">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <Timer className={`w-5 h-5 ${timeLeft <= 5 ? 'text-red-500 animate-ping' : 'text-amber-400'}`} />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-mono-arcade">
                Time
              </span>
              <span className={`text-xl font-black font-mono-arcade ${timeLeft <= 5 ? 'text-red-400' : 'text-white'}`}>
                {timeLeft}s
              </span>
            </div>
          </div>

          <div className="border-l border-zinc-800 pl-4 sm:pl-6">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-mono-arcade">
              Score
            </span>
            <span className="text-xl font-bold font-mono-arcade text-gold-gradient">{score}</span>
          </div>

          <div className="hidden sm:block border-l border-zinc-800 pl-6">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-mono-arcade">
              Combo
            </span>
            <div className="flex items-center gap-1">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-base font-bold font-mono-arcade text-amber-300">{combo}x</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-lg border border-gold-subtle/30 text-xs font-mono-arcade text-amber-300">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Best: {Math.max(personalBest, score)}</span>
          </div>

          <button
            onClick={handleToggleMute}
            aria-label="Toggle sound"
            className="p-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-amber-400 border border-zinc-800"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-zinc-500" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>

          {gameState === 'playing' && (
            <button
              onClick={handleTogglePause}
              aria-label="Pause game"
              className="p-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-amber-400 border border-zinc-800"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}

          {gameState === 'paused' && (
            <button
              onClick={handleTogglePause}
              aria-label="Resume game"
              className="p-2 rounded-lg bg-amber-500 text-black font-bold"
            >
              <Play className="w-4 h-4 fill-current" />
            </button>
          )}

          {onBackToHub && (
            <button
              onClick={onBackToHub}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold cursor-pointer"
            >
              Games Hub
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Tap Arena */}
      <div
        ref={arenaRef}
        onClick={handleArenaMissClick}
        className="relative w-full aspect-[16/10] bg-gradient-to-b from-zinc-950 via-[#0d0f17] to-black border-x border-b border-gold-subtle/40 rounded-b-xl overflow-hidden shadow-2xl cursor-crosshair touch-game-canvas"
      >
        {/* Luxury Montego Grid Pattern */}
        <div className="absolute inset-0 bg-montegobay-grid opacity-30 pointer-events-none" />

        {/* Ambient Center Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/5 blur-[90px] rounded-full pointer-events-none" />

        {/* TARGETS RENDERING */}
        {gameState === 'playing' &&
          targets.map((tgt) => (
            <button
              key={tgt.id}
              onClick={(e) => handleTapTarget(e, tgt)}
              onTouchStart={(e) => handleTapTarget(e, tgt)}
              style={{
                left: `${tgt.x}%`,
                top: `${tgt.y}%`,
                width: `${tgt.size}px`,
                height: `${tgt.size}px`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 transform transition-transform active:scale-90 hover:scale-110 cursor-pointer focus:outline-none"
            >
              {tgt.type === 'gold' && (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-[#fff2b2] via-[#ffd700] to-[#b45309] p-1 shadow-lg shadow-amber-500/40 flex items-center justify-center animate-pulse">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-[#ffd700] to-[#92400e] border-2 border-[#fff] flex items-center justify-center text-black font-black text-lg">
                    $
                  </div>
                </div>
              )}

              {tgt.type === 'diamond' && (
                <div className="w-full h-full rounded-2xl rotate-45 bg-gradient-to-br from-cyan-200 via-sky-400 to-blue-600 p-1 shadow-lg shadow-sky-400/50 flex items-center justify-center animate-bounce">
                  <div className="w-full h-full rounded-xl bg-sky-900 border border-white flex items-center justify-center -rotate-45 text-white font-black text-xs">
                    ✦250
                  </div>
                </div>
              )}

              {tgt.type === 'hazard' && (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-red-500 to-red-950 p-1 shadow-lg shadow-red-500/50 flex items-center justify-center animate-ping">
                  <div className="w-full h-full rounded-full bg-black border-2 border-red-500 flex items-center justify-center text-red-500 font-black text-sm">
                    ☠
                  </div>
                </div>
              )}
            </button>
          ))}

        {/* START SCREEN OVERLAY */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs uppercase tracking-widest mb-3">
              <Zap className="w-3.5 h-3.5" />
              <span>30-Second Reflex Challenge</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight text-gold-gradient mb-2">
              PINN SPEED TAP
            </h1>
            <p className="text-zinc-300 text-xs sm:text-sm max-w-md mb-6 leading-relaxed">
              Tap gold coins ($100) and rare diamonds (✦250) as fast as you can in 30 seconds. Avoid skull traps (-150) and build combo multipliers!
            </p>

            <button
              onClick={startMatch}
              className="px-8 py-3.5 rounded-xl bg-gold-gradient text-black font-extrabold text-sm uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Target className="w-5 h-5" />
              <span>START 30S SPRINT</span>
            </button>

            <span className="text-[11px] text-zinc-500 mt-4">
              Touch or mouse click anywhere on the target. Missing taps docks 25 pts.
            </span>
          </div>
        )}

        {/* PAUSE OVERLAY */}
        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <h3 className="text-3xl font-extrabold text-amber-400 uppercase font-serif mb-4">
              PAUSED
            </h3>
            <button
              onClick={handleTogglePause}
              className="px-6 py-2.5 rounded-lg bg-gold-gradient text-black font-bold uppercase tracking-wider"
            >
              Resume
            </button>
          </div>
        )}

        {/* GAME OVER SCREEN */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-gold-gradient text-black flex items-center justify-center font-bold mb-3 shadow-lg shadow-amber-500/20">
              <Award className="w-7 h-7" />
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-serif uppercase tracking-tight mb-1">
              TIME&apos;S UP!
            </h2>
            <p className="text-xs text-amber-300 mb-6 font-mono-arcade">
              Accuracy: {accuracy}% · Max Combo: {maxCombo}x
            </p>

            {/* Stats Breakdown */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-md w-full bg-zinc-900 border border-gold-subtle/40 rounded-xl p-3 sm:p-4 mb-6">
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block font-mono-arcade">Score</span>
                <span className="text-xl font-bold font-mono-arcade text-gold-gradient">{score}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block font-mono-arcade">Hits</span>
                <span className="text-xl font-bold font-mono-arcade text-emerald-400">{hits}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block font-mono-arcade">Misses</span>
                <span className="text-xl font-bold font-mono-arcade text-zinc-400">{misses}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block font-mono-arcade">Traps</span>
                <span className="text-xl font-bold font-mono-arcade text-red-400">{trapsHit}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={startMatch}
                className="px-6 py-3 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>

              {onBackToHub && (
                <button
                  onClick={onBackToHub}
                  className="px-6 py-3 rounded-xl bg-zinc-900 text-zinc-200 border border-zinc-700 font-bold text-xs uppercase cursor-pointer"
                >
                  Games Hub
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Target Legend */}
      <div className="w-full mt-3 p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl flex flex-wrap items-center justify-around gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-[10px] text-black font-bold">
            $
          </div>
          <span className="text-zinc-300">Gold Coin: +100 pts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded rotate-45 bg-cyan-400"></div>
          <span className="text-zinc-300">Diamond: +250 pts</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-500 font-bold">☠</span>
          <span className="text-zinc-300">Skull Trap: -150 pts</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span>Combos grant up to 3x multiplier</span>
        </div>
      </div>
    </div>
  );
};
