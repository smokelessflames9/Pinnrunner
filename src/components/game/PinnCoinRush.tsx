import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Volume2, VolumeX, Pause, Play, RotateCcw, Trophy, Award, Sparkles, ArrowUp, ArrowDown } from 'lucide-react';
import { soundService } from '../../services/soundService';
import { leaderboardService } from '../../services/leaderboardService';
import { PINN_CONFIG } from '../../config/pinnConfig';
import { PlayerStats } from '../../types';

interface PinnCoinRushProps {
  onNavigateToLeaderboard?: () => void;
}

// Particle for gold sparkle effects
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

// Obstacle definition
interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'ground_spikes' | 'coconut_crate' | 'overhead_barrier' | 'luxury_pillar';
  passed: boolean;
}

// Coin definition
interface Coin {
  x: number;
  y: number;
  radius: number;
  rotation: number;
  collected: boolean;
  value: number;
}

export const PinnCoinRush: React.FC<PinnCoinRushProps> = ({ onNavigateToLeaderboard }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // React State for UI & Overlays
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [score, setScore] = useState<number>(0);
  const [coinsCollected, setCoinsCollected] = useState<number>(0);
  const [distanceMeters, setDistanceMeters] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(soundService.getIsMuted());
  const [playerStats, setPlayerStats] = useState<PlayerStats>(leaderboardService.getPlayerStats());
  const [displayNameInput, setDisplayNameInput] = useState<string>(playerStats.displayName);
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);
  const [nameSavedFeedback, setNameSavedFeedback] = useState<boolean>(false);

  // Core Game Loop References
  const animationFrameId = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Logical Game Dimensions (16:9)
  const GAME_WIDTH = 960;
  const GAME_HEIGHT = 540;
  const GROUND_Y = 440;

  // Game Engine Internal Variables
  const gameVars = useRef({
    state: 'idle' as 'idle' | 'playing' | 'paused' | 'gameover',
    score: 0,
    coins: 0,
    distance: 0,
    gameSpeed: 6.0,
    baseSpeed: 6.0,
    elapsedTime: 0,

    // Player
    player: {
      x: 120,
      y: GROUND_Y - 70,
      width: 44,
      height: 70,
      baseHeight: 70,
      slideHeight: 38,
      vy: 0,
      isGrounded: true,
      isJumping: false,
      isSliding: false,
      jumpCount: 0,
      maxJumps: 2,
      runAnimFrame: 0,
      slideTimer: 0,
      gravity: 0.98,
      jumpStrength: -15.5,
    },

    // Parallax background offsets
    bgDistantX: 0,
    bgMidX: 0,
    bgNearX: 0,
    bgGroundX: 0,

    // Entities
    obstacles: [] as Obstacle[],
    coinsList: [] as Coin[],
    particles: [] as Particle[],
    floatingTexts: [] as { x: number; y: number; text: string; alpha: number; vy: number }[],

    // Spawners
    nextObstacleDist: 400,
    nextCoinDist: 200,
    distSinceLastObstacle: 0,
    distSinceLastCoin: 0,
  });

  // Sound Mute Toggle
  const handleToggleMute = useCallback(() => {
    const muted = soundService.toggleMute();
    setIsMuted(muted);
    soundService.playClick();
  }, []);

  // Update display name
  const handleSaveDisplayName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayNameInput.trim()) return;
    const updated = leaderboardService.updateDisplayName(displayNameInput);
    setPlayerStats(updated);
    setNameSavedFeedback(true);
    soundService.playClick();
    setTimeout(() => setNameSavedFeedback(false), 2500);
  };

  // Trigger Jump
  const handleJump = useCallback(() => {
    const { player, state } = gameVars.current;
    if (state !== 'playing') return;

    if (player.isSliding) {
      // Cancel slide on jump
      player.isSliding = false;
      player.height = player.baseHeight;
    }

    if (player.jumpCount < player.maxJumps) {
      player.vy = player.jumpStrength;
      player.isGrounded = false;
      player.isJumping = true;
      player.jumpCount += 1;
      soundService.playJump();

      // Jump dust/golden sparkle
      for (let i = 0; i < 8; i++) {
        gameVars.current.particles.push({
          x: player.x + player.width / 2,
          y: player.y + player.height,
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 2 + 1,
          size: Math.random() * 4 + 2,
          color: '#d4af37',
          alpha: 1,
          decay: 0.05,
        });
      }
    }
  }, []);

  // Trigger Slide
  const handleSlide = useCallback(() => {
    const { player, state } = gameVars.current;
    if (state !== 'playing') return;

    if (player.isGrounded && !player.isSliding) {
      player.isSliding = true;
      player.height = player.slideHeight;
      player.y = GROUND_Y - player.slideHeight;
      player.slideTimer = 35; // ~0.6 seconds at 60fps
      soundService.playSlide();

      // Slide sparks
      for (let i = 0; i < 6; i++) {
        gameVars.current.particles.push({
          x: player.x,
          y: GROUND_Y - 2,
          vx: -(Math.random() * 5 + 2),
          vy: -(Math.random() * 2),
          size: Math.random() * 3 + 2,
          color: '#f6e082',
          alpha: 1,
          decay: 0.07,
        });
      }
    }
  }, []);

  // Pause / Resume
  const handleTogglePause = useCallback(() => {
    if (gameVars.current.state === 'playing') {
      gameVars.current.state = 'paused';
      setGameState('paused');
      soundService.playClick();
    } else if (gameVars.current.state === 'paused') {
      gameVars.current.state = 'playing';
      setGameState('playing');
      lastTimeRef.current = performance.now();
      soundService.playClick();
    }
  }, []);

  // Reset Game
  const startNewGame = useCallback(() => {
    soundService.playClick();
    const g = gameVars.current;
    g.state = 'playing';
    g.score = 0;
    g.coins = 0;
    g.distance = 0;
    g.gameSpeed = g.baseSpeed;
    g.elapsedTime = 0;

    g.player.x = 120;
    g.player.y = GROUND_Y - g.player.baseHeight;
    g.player.width = 44;
    g.player.height = g.player.baseHeight;
    g.player.vy = 0;
    g.player.isGrounded = true;
    g.player.isJumping = false;
    g.player.isSliding = false;
    g.player.jumpCount = 0;
    g.player.runAnimFrame = 0;

    g.obstacles = [];
    g.coinsList = [];
    g.particles = [];
    g.floatingTexts = [];
    g.distSinceLastObstacle = 0;
    g.distSinceLastCoin = 0;
    g.nextObstacleDist = 450;
    g.nextCoinDist = 200;

    setScore(0);
    setCoinsCollected(0);
    setDistanceMeters(0);
    setIsNewHighScore(false);
    setGameState('playing');
    lastTimeRef.current = performance.now();
  }, []);

  // Handle Game Over
  const triggerGameOver = useCallback(() => {
    const g = gameVars.current;
    g.state = 'gameover';
    setGameState('gameover');
    soundService.playCrash();
    setTimeout(() => soundService.playGameOver(), 200);

    // Save score to local leaderboard service
    const result = leaderboardService.recordGameResult(g.score, g.coins);
    setPlayerStats(result.stats);
    if (result.isNewPersonalBest) {
      setIsNewHighScore(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#d4af37', '#f6e082', '#ffffff', '#aa771c'],
      });
    }
  }, []);

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (gameVars.current.state === 'idle' || gameVars.current.state === 'gameover') {
          startNewGame();
        } else if (gameVars.current.state === 'playing') {
          handleJump();
        }
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (gameVars.current.state === 'playing') {
          handleJump();
        }
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        if (gameVars.current.state === 'playing') {
          handleSlide();
        }
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        handleTogglePause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleJump, handleSlide, handleTogglePause, startNewGame]);

  // Touch Swipe Handling on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let touchStartY = 0;
    let touchStartX = 0;
    let touchStartTime = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        touchStartTime = Date.now();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length > 0) {
        const touchEndY = e.changedTouches[0].clientY;
        const touchEndX = e.changedTouches[0].clientX;
        const deltaY = touchEndY - touchStartY;
        const deltaX = touchEndX - touchStartX;
        const deltaTime = Date.now() - touchStartTime;

        // Quick swipe detection
        if (deltaTime < 350) {
          if (deltaY < -30 && Math.abs(deltaY) > Math.abs(deltaX)) {
            // Swipe Up -> Jump
            handleJump();
          } else if (deltaY > 30 && Math.abs(deltaY) > Math.abs(deltaX)) {
            // Swipe Down -> Slide
            handleSlide();
          } else if (Math.abs(deltaY) < 20 && Math.abs(deltaX) < 20) {
            // Tap -> Jump if in game
            if (gameVars.current.state === 'playing') {
              handleJump();
            }
          }
        }
      }
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleJump, handleSlide]);

  // Main Canvas Render & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameCount = 0;

    const render = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05); // Cap dt
      lastTimeRef.current = time;
      frameCount++;

      const g = gameVars.current;

      // 1. UPDATE GAME STATE IF PLAYING
      if (g.state === 'playing') {
        g.elapsedTime += dt;

        // Gradually increase speed over time (capped at 12)
        g.gameSpeed = Math.min(12.5, g.baseSpeed + (g.distance / 1200) * 1.5);

        // Player physics
        const p = g.player;
        p.vy += p.gravity;
        p.y += p.vy;

        // Ground collision
        const currentTargetY = GROUND_Y - p.height;
        if (p.y >= currentTargetY) {
          p.y = currentTargetY;
          p.vy = 0;
          p.isGrounded = true;
          p.isJumping = false;
          p.jumpCount = 0;
        }

        // Sliding timer
        if (p.isSliding) {
          p.slideTimer -= 1;
          if (p.slideTimer <= 0) {
            p.isSliding = false;
            p.height = p.baseHeight;
            p.y = GROUND_Y - p.baseHeight;
          }
        }

        // Running animation frame counter
        if (p.isGrounded && !p.isSliding) {
          p.runAnimFrame += g.gameSpeed * 0.12;
        }

        // Parallax offsets
        g.bgDistantX = (g.bgDistantX + g.gameSpeed * 0.15) % GAME_WIDTH;
        g.bgMidX = (g.bgMidX + g.gameSpeed * 0.4) % GAME_WIDTH;
        g.bgNearX = (g.bgNearX + g.gameSpeed * 0.8) % GAME_WIDTH;
        g.bgGroundX = (g.bgGroundX + g.gameSpeed) % 40;

        // Distance & Base Score
        const distanceStep = g.gameSpeed * 0.15;
        g.distance += distanceStep;
        g.score += Math.floor(g.gameSpeed * 0.2);

        // Sync React UI values periodically
        if (frameCount % 6 === 0) {
          setScore(g.score);
          setDistanceMeters(Math.floor(g.distance));
        }

        // SPAWN OBSTACLES
        g.distSinceLastObstacle += g.gameSpeed;
        if (g.distSinceLastObstacle >= g.nextObstacleDist) {
          g.distSinceLastObstacle = 0;
          // Randomize next distance based on speed
          g.nextObstacleDist = Math.max(280, 520 - g.gameSpeed * 15 + Math.random() * 200);

          // Choose obstacle type
          const rand = Math.random();
          if (rand < 0.45) {
            // Low barrier: Reef Spikes
            g.obstacles.push({
              x: GAME_WIDTH + 20,
              y: GROUND_Y - 42,
              width: 36,
              height: 42,
              type: 'ground_spikes',
              passed: false,
            });
          } else if (rand < 0.75) {
            // Low block: Coconut Crate
            g.obstacles.push({
              x: GAME_WIDTH + 20,
              y: GROUND_Y - 50,
              width: 48,
              height: 50,
              type: 'coconut_crate',
              passed: false,
            });
          } else {
            // High overhead obstacle requiring slide: Montego Bay Resort Sun Shade / Laser beam
            g.obstacles.push({
              x: GAME_WIDTH + 20,
              y: GROUND_Y - 100,
              width: 60,
              height: 54, // Clears sliding height of 38, hits standing height of 70
              type: 'overhead_barrier',
              passed: false,
            });
          }
        }

        // SPAWN COINS
        g.distSinceLastCoin += g.gameSpeed;
        if (g.distSinceLastCoin >= g.nextCoinDist) {
          g.distSinceLastCoin = 0;
          g.nextCoinDist = 180 + Math.random() * 180;

          // Coins appear in arc, low, or high
          const coinPattern = Math.random();
          const coinCount = Math.floor(Math.random() * 3) + 2;
          const baseY = coinPattern > 0.5 ? GROUND_Y - 110 : GROUND_Y - 45;

          for (let i = 0; i < coinCount; i++) {
            g.coinsList.push({
              x: GAME_WIDTH + 30 + i * 42,
              y: baseY - Math.sin((i / (coinCount - 1 || 1)) * Math.PI) * 25,
              radius: 14,
              rotation: 0,
              collected: false,
              value: 50,
            });
          }
        }

        // UPDATE OBSTACLES & CHECK COLLISIONS
        for (let i = g.obstacles.length - 1; i >= 0; i--) {
          const obs = g.obstacles[i];
          obs.x -= g.gameSpeed;

          // Collision detection with player bounding box (forgiving padding)
          const padX = 8;
          const padY = 6;
          const playerLeft = p.x + padX;
          const playerRight = p.x + p.width - padX;
          const playerTop = p.y + padY;
          const playerBottom = p.y + p.height;

          const obsLeft = obs.x;
          const obsRight = obs.x + obs.width;
          const obsTop = obs.y;
          const obsBottom = obs.y + obs.height;

          const isColliding =
            playerRight > obsLeft &&
            playerLeft < obsRight &&
            playerBottom > obsTop &&
            playerTop < obsBottom;

          if (isColliding) {
            triggerGameOver();
            break;
          }

          if (obs.x + obs.width < -50) {
            g.obstacles.splice(i, 1);
          }
        }

        // UPDATE COINS & CHECK COLLECTION
        for (let i = g.coinsList.length - 1; i >= 0; i--) {
          const coin = g.coinsList[i];
          coin.x -= g.gameSpeed;
          coin.rotation += 0.08;

          // Check collection
          const coinCenterX = coin.x;
          const coinCenterY = coin.y;
          const playerCenterX = p.x + p.width / 2;
          const playerCenterY = p.y + p.height / 2;

          const dist = Math.hypot(coinCenterX - playerCenterX, coinCenterY - playerCenterY);
          if (dist < coin.radius + p.width / 2 + 6) {
            // Collected!
            soundService.playCoin();
            g.coins += 1;
            g.score += coin.value;
            setCoinsCollected(g.coins);
            setScore(g.score);

            // Spawn golden particles
            for (let k = 0; k < 12; k++) {
              g.particles.push({
                x: coin.x,
                y: coin.y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6 - 1.5,
                size: Math.random() * 4 + 2,
                color: '#ffd700',
                alpha: 1,
                decay: 0.04,
              });
            }

            // Floating score text
            g.floatingTexts.push({
              x: coin.x,
              y: coin.y - 10,
              text: '+50',
              alpha: 1,
              vy: -1.8,
            });

            g.coinsList.splice(i, 1);
            continue;
          }

          if (coin.x < -40) {
            g.coinsList.splice(i, 1);
          }
        }

        // UPDATE PARTICLES
        for (let i = g.particles.length - 1; i >= 0; i--) {
          const pt = g.particles[i];
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.alpha -= pt.decay;
          if (pt.alpha <= 0) {
            g.particles.splice(i, 1);
          }
        }

        // UPDATE FLOATING TEXTS
        for (let i = g.floatingTexts.length - 1; i >= 0; i--) {
          const ft = g.floatingTexts[i];
          ft.y += ft.vy;
          ft.alpha -= 0.025;
          if (ft.alpha <= 0) {
            g.floatingTexts.splice(i, 1);
          }
        }
      }

      // 2. RENDER GRAPHICS
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // --- LAYER A: Montego Bay Caribbean Twilight Sky ---
      const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      skyGrad.addColorStop(0, '#040711'); // Deep navy night
      skyGrad.addColorStop(0.35, '#0b162c'); // Tropical dusk indigo
      skyGrad.addColorStop(0.7, '#241a2e'); // Warm Montego Bay twilight purple
      skyGrad.addColorStop(0.9, '#4a261a'); // Amber horizon glow
      skyGrad.addColorStop(1, '#663b15'); // Gold dusk haze
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, GAME_WIDTH, GROUND_Y);

      // Distant stars / sparkles in upper sky
      ctx.fillStyle = 'rgba(255, 243, 205, 0.4)';
      for (let s = 0; s < 25; s++) {
        const sx = ((s * 73 + frameCount * 0.02) % GAME_WIDTH);
        const sy = (s * 31) % (GROUND_Y * 0.4);
        const sr = (s % 3 === 0) ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Golden Caribbean Full Moon / Sun on the horizon
      ctx.save();
      const moonGrad = ctx.createRadialGradient(720, 160, 10, 720, 160, 65);
      moonGrad.addColorStop(0, '#fff4cc');
      moonGrad.addColorStop(0.5, '#e5c158');
      moonGrad.addColorStop(0.9, 'rgba(212, 175, 55, 0.2)');
      moonGrad.addColorStop(1, 'rgba(212, 175, 55, 0)');
      ctx.fillStyle = moonGrad;
      ctx.beginPath();
      ctx.arc(720, 160, 65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // --- LAYER B: Distant Jamaican Mountains / Hills ---
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y - 80);
      for (let x = 0; x <= GAME_WIDTH + 60; x += 60) {
        const hillOffset = (x + g.bgDistantX) * 0.006;
        const hy = GROUND_Y - 110 - Math.sin(hillOffset) * 45 - Math.cos(hillOffset * 2.1) * 25;
        ctx.lineTo(x, hy);
      }
      ctx.lineTo(GAME_WIDTH, GROUND_Y);
      ctx.lineTo(0, GROUND_Y);
      ctx.closePath();
      ctx.fill();

      // --- LAYER C: Montego Bay Luxury Resort Pavilions & Skyline ---
      ctx.fillStyle = '#111827';
      const bldgWidth = 85;
      for (let bx = -bldgWidth; bx < GAME_WIDTH + bldgWidth * 2; bx += bldgWidth + 25) {
        const screenBx = (bx - g.bgMidX) % (GAME_WIDTH + bldgWidth * 3) - bldgWidth;
        const bHeight = 110 + (Math.abs(Math.sin(bx * 0.05)) * 65);
        const by = GROUND_Y - bHeight;

        // Modern luxury villa structure
        ctx.fillRect(screenBx, by, bldgWidth, bHeight);

        // Gold penthouse trim
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(screenBx, by, bldgWidth, 3);
        ctx.fillStyle = '#111827';

        // Warm ambient villa windows
        ctx.fillStyle = 'rgba(246, 224, 130, 0.45)';
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            ctx.fillRect(screenBx + 12 + col * 22, by + 18 + row * 26, 12, 14);
          }
        }
        ctx.fillStyle = '#111827';
      }

      // --- LAYER D: Tropical Montego Bay Palm Trees & Coastal Shrubbery ---
      ctx.fillStyle = '#0a0f1d';
      const palmSpacing = 280;
      for (let px = 0; px < GAME_WIDTH + palmSpacing * 2; px += palmSpacing) {
        const screenPx = (px - g.bgNearX) % (GAME_WIDTH + palmSpacing * 2) - 100;
        const trunkBaseY = GROUND_Y;
        const trunkTopY = GROUND_Y - 170;
        const trunkTopX = screenPx + 25;

        // Curved palm trunk
        ctx.beginPath();
        ctx.strokeStyle = '#1e1b18';
        ctx.lineWidth = 9;
        ctx.moveTo(screenPx, trunkBaseY);
        ctx.quadraticCurveTo(screenPx + 10, trunkBaseY - 90, trunkTopX, trunkTopY);
        ctx.stroke();

        // Palm fronds
        ctx.fillStyle = '#0c1a16';
        const frondAngles = [-2.4, -1.8, -1.2, -0.6, 0.1, 0.6, 1.2];
        frondAngles.forEach((angle) => {
          ctx.beginPath();
          ctx.moveTo(trunkTopX, trunkTopY);
          const endX = trunkTopX + Math.cos(angle) * 75;
          const endY = trunkTopY + Math.sin(angle) * 45;
          ctx.quadraticCurveTo(
            trunkTopX + Math.cos(angle) * 40,
            trunkTopY + Math.sin(angle) * 15 - 15,
            endX,
            endY
          );
          ctx.quadraticCurveTo(
            trunkTopX + Math.cos(angle) * 45,
            trunkTopY + Math.sin(angle) * 35,
            trunkTopX,
            trunkTopY
          );
          ctx.fill();
        });
      }

      // --- LAYER E: Luxury Montego Bay Promenade / Ground Deck ---
      // Ground body
      const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, GAME_HEIGHT);
      groundGrad.addColorStop(0, '#1c1917'); // Dark obsidian stone
      groundGrad.addColorStop(0.3, '#141210');
      groundGrad.addColorStop(1, '#080808');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);

      // Metallic Gold Promenade Railing / Curb
      const goldTrim = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 7);
      goldTrim.addColorStop(0, '#f6e082');
      goldTrim.addColorStop(0.5, '#d4af37');
      goldTrim.addColorStop(1, '#996515');
      ctx.fillStyle = goldTrim;
      ctx.fillRect(0, GROUND_Y, GAME_WIDTH, 6);

      // Deck plank / stone paving lines
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
      ctx.lineWidth = 1.5;
      for (let gx = -40; gx < GAME_WIDTH + 40; gx += 35) {
        const curGx = (gx - g.bgGroundX) % (GAME_WIDTH + 80);
        ctx.beginPath();
        ctx.moveTo(curGx, GROUND_Y + 6);
        ctx.lineTo(curGx - 20, GAME_HEIGHT);
        ctx.stroke();
      }

      // --- LAYER F: OBSTACLES ---
      g.obstacles.forEach((obs) => {
        if (obs.type === 'ground_spikes') {
          // Sharp tropical coral / reef hazard
          ctx.fillStyle = '#dc2626'; // Alert crimson with gold highlights
          ctx.beginPath();
          ctx.moveTo(obs.x, obs.y + obs.height);
          ctx.lineTo(obs.x + obs.width * 0.25, obs.y);
          ctx.lineTo(obs.x + obs.width * 0.5, obs.y + obs.height * 0.4);
          ctx.lineTo(obs.x + obs.width * 0.75, obs.y);
          ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (obs.type === 'coconut_crate') {
          // Luxury Cargo / Tropical Crate
          ctx.fillStyle = '#78350f';
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

          // Gold metal bracket trim
          ctx.strokeStyle = '#d4af37';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(obs.x + 2, obs.y + 2, obs.width - 4, obs.height - 4);

          // Cross brace
          ctx.beginPath();
          ctx.moveTo(obs.x + 4, obs.y + 4);
          ctx.lineTo(obs.x + obs.width - 4, obs.y + obs.height - 4);
          ctx.moveTo(obs.x + obs.width - 4, obs.y + 4);
          ctx.lineTo(obs.x + 4, obs.y + obs.height - 4);
          ctx.stroke();
        } else if (obs.type === 'overhead_barrier') {
          // Luxury resort overhead awning / barrier that must be slid under
          ctx.fillStyle = '#1e1b18';
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

          // Glowing gold warning beacon
          ctx.fillStyle = '#eab308';
          ctx.fillRect(obs.x, obs.y + obs.height - 6, obs.width, 6);

          // Danger stripes
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          for (let sx = 0; sx < obs.width; sx += 12) {
            ctx.beginPath();
            ctx.moveTo(obs.x + sx, obs.y);
            ctx.lineTo(obs.x + sx + 6, obs.y);
            ctx.lineTo(obs.x + sx, obs.y + obs.height);
            ctx.lineTo(obs.x + sx - 6, obs.y + obs.height);
            ctx.fill();
          }

          // Overhead suspension wire
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(obs.x + 10, 0);
          ctx.lineTo(obs.x + 10, obs.y);
          ctx.moveTo(obs.x + obs.width - 10, 0);
          ctx.lineTo(obs.x + obs.width - 10, obs.y);
          ctx.stroke();
        }
      });

      // --- LAYER G: GOLD COINS ($PINN Medallions) ---
      g.coinsList.forEach((coin) => {
        ctx.save();
        ctx.translate(coin.x, coin.y);

        // 3D spinning coin effect using scaleX of cosine
        const scaleX = Math.cos(coin.rotation);
        ctx.scale(Math.abs(scaleX) < 0.15 ? 0.15 : scaleX, 1);

        // Outer rim
        const coinGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, coin.radius);
        coinGrad.addColorStop(0, '#fff4cc');
        coinGrad.addColorStop(0.4, '#ffd700');
        coinGrad.addColorStop(0.85, '#d4af37');
        coinGrad.addColorStop(1, '#996515');

        ctx.fillStyle = coinGrad;
        ctx.beginPath();
        ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
        ctx.fill();

        // Edge ridge
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Embossed PINN '$' or 'P' emblem
        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('P', 0, 1);

        ctx.restore();
      });

      // --- LAYER H: PARTICLES ---
      g.particles.forEach((pt) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // --- LAYER I: FLOATING SCORE TEXTS ---
      g.floatingTexts.forEach((ft) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 15px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });

      // --- LAYER J: PLAYER CHARACTER (Luxury Montego Bay Runner) ---
      const p = g.player;
      ctx.save();
      ctx.translate(p.x, p.y);

      if (p.isSliding) {
        // SLIDING POSE: Low sleek profile
        // Sliding gold speed dust
        ctx.fillStyle = 'rgba(212, 175, 55, 0.25)';
        ctx.fillRect(-15, p.height - 8, p.width + 20, 8);

        // Body leaning flat
        ctx.fillStyle = '#0f172a'; // Obsidian racing suit
        ctx.beginPath();
        ctx.roundRect(0, 6, p.width + 10, p.height - 6, 6);
        ctx.fill();

        // Gold chest sash
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(10, 10, 14, p.height - 14);

        // Head/Helmet
        ctx.fillStyle = '#f6e082';
        ctx.beginPath();
        ctx.arc(p.width - 4, 12, 11, 0, Math.PI * 2);
        ctx.fill();

        // Visor
        ctx.fillStyle = '#090d16';
        ctx.fillRect(p.width - 2, 8, 8, 7);
      } else {
        // STANDING / RUNNING / JUMPING POSE
        const legCycle = Math.sin(p.runAnimFrame);

        // Shadow when grounded
        if (p.isGrounded) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.beginPath();
          ctx.ellipse(p.width / 2, p.height + 2, 20, 4, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Legs (Animated Run Cycle or Jump Extension)
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';

        if (p.isGrounded) {
          // Back leg
          ctx.strokeStyle = '#090d16';
          ctx.beginPath();
          ctx.moveTo(p.width / 2, p.height - 22);
          ctx.lineTo(p.width / 2 - legCycle * 14, p.height - 10);
          ctx.lineTo(p.width / 2 - legCycle * 16, p.height);
          ctx.stroke();

          // Front leg
          ctx.strokeStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(p.width / 2, p.height - 22);
          ctx.lineTo(p.width / 2 + legCycle * 14, p.height - 10);
          ctx.lineTo(p.width / 2 + legCycle * 16, p.height);
          ctx.stroke();

          // Gold sneakers
          ctx.fillStyle = '#d4af37';
          ctx.fillRect(p.width / 2 + legCycle * 16 - 3, p.height - 4, 10, 4);
          ctx.fillRect(p.width / 2 - legCycle * 16 - 3, p.height - 4, 10, 4);
        } else {
          // Jump pose (tucked legs)
          ctx.strokeStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(p.width / 2 - 4, p.height - 22);
          ctx.lineTo(p.width / 2 - 12, p.height - 12);
          ctx.lineTo(p.width / 2 - 4, p.height - 4);
          ctx.stroke();

          ctx.strokeStyle = '#090d16';
          ctx.beginPath();
          ctx.moveTo(p.width / 2 + 4, p.height - 22);
          ctx.lineTo(p.width / 2 + 10, p.height - 14);
          ctx.lineTo(p.width / 2 + 14, p.height - 6);
          ctx.stroke();
        }

        // Torso / Jacket (Luxury Montego Bay Obsidian & Gold Trim)
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.roundRect(8, 18, p.width - 16, 32, 4);
        ctx.fill();

        // Metallic Gold V-lapel / Crest
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(12, 20);
        ctx.lineTo(p.width / 2, 38);
        ctx.lineTo(p.width - 12, 20);
        ctx.stroke();

        // Head / Luxury Visor Helmet
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(p.width / 2, 11, 12, 0, Math.PI * 2);
        ctx.fill();

        // Gold Crown / Headband Accent
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(p.width / 2 - 11, 4, 22, 4);

        // Sleek Amber Visor
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(p.width / 2, 8, 11, 6);

        // Arms
        const armCycle = -Math.sin(p.runAnimFrame);
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(p.width / 2, 24);
        ctx.lineTo(p.width / 2 + (p.isGrounded ? armCycle * 14 : 10), 34);
        ctx.stroke();
      }

      ctx.restore();

      // Request next frame
      animationFrameId.current = requestAnimationFrame(render);
    };

    animationFrameId.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [triggerGameOver]);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center select-none" ref={containerRef}>
      {/* Top Game HUD Bar */}
      <div className="w-full flex items-center justify-between bg-zinc-950/90 border border-gold-subtle/40 rounded-t-xl px-4 py-3 text-sm backdrop-blur-sm shadow-lg">
        {/* Score & Coins */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div>
            <span className="text-xs uppercase tracking-wider text-zinc-400 block font-mono-arcade">Score</span>
            <span className="text-xl sm:text-2xl font-bold font-mono-arcade text-gold-gradient">{score}</span>
          </div>
          <div className="flex items-center gap-2 border-l border-zinc-800 pl-4 sm:pl-6">
            <div className="w-6 h-6 rounded-full bg-gold-gradient flex items-center justify-center text-black font-bold text-xs shadow-sm">
              $
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-zinc-400 block font-mono-arcade">Coins</span>
              <span className="text-lg sm:text-xl font-bold font-mono-arcade text-white">{coinsCollected}</span>
            </div>
          </div>
          <div className="hidden sm:block border-l border-zinc-800 pl-6">
            <span className="text-xs uppercase tracking-wider text-zinc-400 block font-mono-arcade">Distance</span>
            <span className="text-lg font-bold font-mono-arcade text-zinc-300">{distanceMeters}m</span>
          </div>
        </div>

        {/* High Score & Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-gold-subtle/30">
            <Trophy className="w-4 h-4 text-amber-400" />
            <div className="text-xs">
              <span className="text-zinc-400">Best: </span>
              <span className="font-bold font-mono-arcade text-amber-300">
                {Math.max(playerStats.personalBest, score)}
              </span>
            </div>
          </div>

          {/* Audio Mute Button */}
          <button
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Unmute game audio' : 'Mute game audio'}
            className="p-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-amber-400 hover:bg-zinc-800 border border-zinc-700/60 transition-colors"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-zinc-500" /> : <Volume2 className="w-5 h-5 text-amber-400" />}
          </button>

          {/* Pause / Resume Button */}
          {gameState === 'playing' && (
            <button
              onClick={handleTogglePause}
              aria-label="Pause game"
              className="p-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-amber-400 hover:bg-zinc-800 border border-zinc-700/60 transition-colors"
            >
              <Pause className="w-5 h-5" />
            </button>
          )}

          {gameState === 'paused' && (
            <button
              onClick={handleTogglePause}
              aria-label="Resume game"
              className="p-2 rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-colors font-semibold"
            >
              <Play className="w-5 h-5 fill-current" />
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Container */}
      <div className="relative w-full aspect-[16/9] bg-black border-x border-b border-gold-subtle/40 rounded-b-xl overflow-hidden shadow-2xl">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="w-full h-full block touch-game-canvas object-cover"
        />

        {/* OVERLAY: START SCREEN (Idle State) */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs uppercase tracking-widest mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Official 2D Arcade Rush</span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-gold-gradient uppercase mb-2">
              PINN COIN RUSH
            </h1>
            <p className="text-zinc-300 text-sm sm:text-base max-w-lg mb-6">
              Collect gold coins. Avoid obstacles. Build your score. Challenge the leaderboard.
            </p>

            {/* Controls Guide Box */}
            <div className="grid grid-cols-2 gap-3 max-w-md w-full mb-6 text-xs text-zinc-300 bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-lg">
              <div className="flex flex-col items-center gap-1.5 p-2 bg-black/40 rounded border border-zinc-800/80">
                <span className="font-bold text-amber-400 uppercase tracking-wider">Desktop Controls</span>
                <span>Space / ↑ / W : Jump (2x)</span>
                <span>↓ / S : Duck & Slide</span>
                <span>P / Esc : Pause</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-2 bg-black/40 rounded border border-zinc-800/80">
                <span className="font-bold text-amber-400 uppercase tracking-wider">Mobile Controls</span>
                <span>Tap Buttons Below Screen</span>
                <span>Swipe Up : Jump</span>
                <span>Swipe Down : Slide</span>
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={startNewGame}
              className="px-8 py-3.5 rounded-xl bg-gold-gradient text-black font-extrabold text-base uppercase tracking-wider shadow-lg hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>START RUN</span>
            </button>

            <span className="text-[11px] text-zinc-500 mt-4 max-w-md">
              Virtual game coins are not real cryptocurrency. Free to play. No wallet required.
            </span>
          </div>
        )}

        {/* OVERLAY: PAUSED STATE */}
        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <h2 className="text-3xl font-extrabold tracking-wider text-amber-400 uppercase mb-4">
              GAME PAUSED
            </h2>
            <div className="flex gap-4">
              <button
                onClick={handleTogglePause}
                className="px-6 py-2.5 rounded-lg bg-gold-gradient text-black font-bold uppercase tracking-wider hover:opacity-95 transition-opacity"
              >
                Resume Run
              </button>
              <button
                onClick={startNewGame}
                className="px-6 py-2.5 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold uppercase tracking-wider hover:bg-zinc-700 transition-colors"
              >
                Restart
              </button>
            </div>
          </div>
        )}

        {/* OVERLAY: GAME OVER STATE */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center z-20 overflow-y-auto">
            {isNewHighScore && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2 animate-bounce">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>NEW PERSONAL BEST!</span>
              </div>
            )}

            <h2 className="text-3xl sm:text-4xl font-extrabold text-red-500 tracking-tight uppercase mb-1">
              RUN OVER
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mb-4">
              Watch out for obstacles on the Montego Bay promenade!
            </p>

            {/* Score Summary Box */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-md w-full bg-zinc-900/90 border border-gold-subtle/50 rounded-xl p-3 sm:p-4 mb-4">
              <div className="text-center">
                <span className="text-[11px] text-zinc-400 uppercase block font-mono-arcade">Final Score</span>
                <span className="text-xl sm:text-2xl font-bold font-mono-arcade text-gold-gradient">{score}</span>
              </div>
              <div className="text-center border-x border-zinc-800">
                <span className="text-[11px] text-zinc-400 uppercase block font-mono-arcade">Coins</span>
                <span className="text-xl sm:text-2xl font-bold font-mono-arcade text-amber-300">{coinsCollected}</span>
              </div>
              <div className="text-center">
                <span className="text-[11px] text-zinc-400 uppercase block font-mono-arcade">Distance</span>
                <span className="text-xl sm:text-2xl font-bold font-mono-arcade text-zinc-200">{distanceMeters}m</span>
              </div>
            </div>

            {/* Player Display Name Input for Local Best */}
            <form onSubmit={handleSaveDisplayName} className="max-w-md w-full mb-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={20}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Enter Player Name"
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-amber-300 border border-zinc-700 rounded-lg transition-colors cursor-pointer"
                >
                  Save Name
                </button>
              </div>
              {nameSavedFeedback && (
                <span className="text-xs text-emerald-400 mt-1 block">Player name updated!</span>
              )}
            </form>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={startNewGame}
                className="px-7 py-3 rounded-xl bg-gold-gradient text-black font-extrabold text-sm uppercase tracking-wider shadow-lg hover:shadow-amber-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>PLAY AGAIN</span>
              </button>

              {onNavigateToLeaderboard && (
                <button
                  onClick={onNavigateToLeaderboard}
                  className="px-6 py-3 rounded-xl bg-zinc-900 text-amber-300 border border-gold-subtle font-bold text-sm uppercase tracking-wider hover:bg-zinc-800 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>VIEW LEADERBOARD</span>
                </button>
              )}
            </div>

            <span className="text-[10px] text-zinc-500 mt-3 max-w-sm">
              Scores stored in this session are for personal local record-keeping and convenience.
            </span>
          </div>
        )}
      </div>

      {/* MOBILE ON-SCREEN CONTROLS (Always available, highlighted for mobile/touch screens) */}
      <div className="w-full mt-3 p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Award className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="hidden sm:inline">Touch or Keyboard controls active. Prevented screen scroll.</span>
          <span className="sm:hidden">Touch buttons:</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* SLIDE BUTTON */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              handleSlide();
            }}
            onClick={handleSlide}
            aria-label="Slide player"
            className="flex items-center justify-center gap-1.5 px-5 sm:px-6 py-3.5 bg-zinc-900 active:bg-zinc-800 border-2 border-zinc-700 active:border-amber-400 rounded-xl text-white font-bold text-sm select-none shadow-md"
          >
            <ArrowDown className="w-5 h-5 text-amber-400" />
            <span>SLIDE</span>
          </button>

          {/* JUMP BUTTON */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              handleJump();
            }}
            onClick={handleJump}
            aria-label="Jump player"
            className="flex items-center justify-center gap-1.5 px-7 sm:px-9 py-3.5 bg-gold-gradient active:opacity-90 rounded-xl text-black font-extrabold text-sm select-none shadow-lg shadow-amber-500/20"
          >
            <ArrowUp className="w-5 h-5 stroke-[3]" />
            <span>JUMP (2X)</span>
          </button>
        </div>
      </div>

      {/* Community Invite Note */}
      <div className="w-full mt-4 p-4 rounded-xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-gold-subtle/30 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-center sm:text-left">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
            JOIN OUR TELEGRAM
          </h4>
          <p className="text-xs text-zinc-400">
            Join the community to follow game updates and learn about upcoming competitions.
          </p>
        </div>
        <a
          href={PINN_CONFIG.OFFICIAL_TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-gold-subtle text-xs font-bold tracking-wider uppercase transition-colors shrink-0"
        >
          JOIN TELEGRAM
        </a>
      </div>
    </div>
  );
};
