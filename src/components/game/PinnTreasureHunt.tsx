import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Trophy,
  Play,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Award,
  Heart,
  ChevronRight,
  Compass,
} from 'lucide-react';
import { soundService } from '../../services/soundService';
import { leaderboardService } from '../../services/leaderboardService';
import { PINN_CONFIG } from '../../config/pinnConfig';

interface PinnTreasureHuntProps {
  onBackToHub?: () => void;
  onNavigateToLeaderboard?: () => void;
}

// Tile types for grid maps
// 0: Sand (Walkable)
// 1: Palm / Rock Wall (Solid obstacle)
// 2: Water (Solid ocean boundary)
// 3: Spikes Trap (Hurts player)
// 4: Quicksand (Slows player / hazard)
type TileType = 0 | 1 | 2 | 3 | 4;

interface LevelConfig {
  name: string;
  theme: string;
  grid: number[][]; // 14 cols x 9 rows
  playerStart: { x: number; y: number };
  exitBoat: { x: number; y: number };
  coins: { x: number; y: number; collected: boolean }[];
  chests: { x: number; y: number; collected: boolean }[];
  crabs: { x: number; y: number; dirX: number; dirY: number; range: number; originX: number; originY: number }[];
}

// 10 Progressively Harder Island Levels
const LEVELS: LevelConfig[] = [
  // Level 1: Doctor's Cave Key (Gentle intro)
  {
    name: "Doctor's Cave Key",
    theme: 'Calm Tropical Shore',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 2],
      [2, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 2],
      [2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 2],
      [2, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    playerStart: { x: 1, y: 7 },
    exitBoat: { x: 12, y: 1 },
    coins: [
      { x: 3, y: 3, collected: false },
      { x: 6, y: 2, collected: false },
      { x: 7, y: 5, collected: false },
      { x: 10, y: 6, collected: false },
    ],
    chests: [{ x: 11, y: 3, collected: false }],
    crabs: [],
  },

  // Level 2: Palm Key Sandbar
  {
    name: 'Palm Key Sandbar',
    theme: 'Coastal Dunes',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 2],
      [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2],
      [2, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2],
      [2, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2],
      [2, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    playerStart: { x: 1, y: 1 },
    exitBoat: { x: 12, y: 7 },
    coins: [
      { x: 4, y: 1, collected: false },
      { x: 3, y: 5, collected: false },
      { x: 9, y: 3, collected: false },
      { x: 7, y: 7, collected: false },
    ],
    chests: [
      { x: 6, y: 3, collected: false },
      { x: 11, y: 5, collected: false },
    ],
    crabs: [{ x: 7, y: 5, dirX: 1, dirY: 0, range: 3, originX: 7, originY: 5 }],
  },

  // Level 3: Reef Runner Atoll
  {
    name: 'Reef Runner Atoll',
    theme: 'Coral Spikes & Tides',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0, 2],
      [2, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 2],
      [2, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 2],
      [2, 0, 0, 0, 3, 1, 0, 3, 0, 1, 0, 0, 0, 2],
      [2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 3, 0, 2],
      [2, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    playerStart: { x: 1, y: 7 },
    exitBoat: { x: 12, y: 1 },
    coins: [
      { x: 3, y: 3, collected: false },
      { x: 6, y: 4, collected: false },
      { x: 8, y: 6, collected: false },
      { x: 11, y: 2, collected: false },
    ],
    chests: [
      { x: 3, y: 1, collected: false },
      { x: 10, y: 4, collected: false },
    ],
    crabs: [{ x: 3, y: 6, dirX: 1, dirY: 0, range: 4, originX: 3, originY: 6 }],
  },

  // Level 4: Hidden Pirate Grotto
  {
    name: 'Hidden Pirate Grotto',
    theme: 'Ancient Smuggler Paths',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2],
      [2, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 2],
      [2, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 2],
      [2, 1, 1, 3, 1, 0, 1, 1, 3, 1, 1, 1, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2],
      [2, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    playerStart: { x: 1, y: 1 },
    exitBoat: { x: 12, y: 7 },
    coins: [
      { x: 5, y: 1, collected: false },
      { x: 5, y: 5, collected: false },
      { x: 8, y: 3, collected: false },
      { x: 3, y: 7, collected: false },
      { x: 10, y: 5, collected: false },
    ],
    chests: [
      { x: 3, y: 3, collected: false },
      { x: 12, y: 1, collected: false },
    ],
    crabs: [
      { x: 2, y: 7, dirX: 1, dirY: 0, range: 4, originX: 2, originY: 7 },
      { x: 9, y: 5, dirX: 1, dirY: 0, range: 3, originX: 9, originY: 5 },
    ],
  },

  // Level 5: Montego Bay Cove
  {
    name: 'Montego Bay Cove',
    theme: 'Resort Archipelago',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 2],
      [2, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2],
      [2, 0, 1, 3, 0, 0, 0, 3, 0, 0, 0, 1, 0, 2],
      [2, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 2],
      [2, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    playerStart: { x: 1, y: 7 },
    exitBoat: { x: 12, y: 1 },
    coins: [
      { x: 3, y: 1, collected: false },
      { x: 5, y: 3, collected: false },
      { x: 9, y: 3, collected: false },
      { x: 6, y: 5, collected: false },
      { x: 11, y: 7, collected: false },
    ],
    chests: [
      { x: 1, y: 3, collected: false },
      { x: 7, y: 1, collected: false },
      { x: 12, y: 5, collected: false },
    ],
    crabs: [
      { x: 3, y: 5, dirX: 1, dirY: 0, range: 4, originX: 3, originY: 5 },
      { x: 8, y: 5, dirX: 1, dirY: 0, range: 3, originX: 8, originY: 5 },
    ],
  },

  // Level 6: Ruins of Falmouth
  {
    name: 'Ruins of Falmouth',
    theme: 'Ancient Stone Mazes',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2],
      [2, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 2],
      [2, 0, 0, 0, 1, 3, 0, 0, 1, 3, 0, 0, 0, 2],
      [2, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 1, 3, 1, 0, 1, 3, 1, 0, 1, 3, 1, 2],
      [2, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    playerStart: { x: 1, y: 1 },
    exitBoat: { x: 12, y: 7 },
    coins: [
      { x: 3, y: 2, collected: false },
      { x: 7, y: 2, collected: false },
      { x: 11, y: 2, collected: false },
      { x: 5, y: 5, collected: false },
      { x: 9, y: 5, collected: false },
    ],
    chests: [
      { x: 5, y: 1, collected: false },
      { x: 9, y: 1, collected: false },
      { x: 12, y: 3, collected: false },
    ],
    crabs: [
      { x: 2, y: 5, dirX: 1, dirY: 0, range: 4, originX: 2, originY: 5 },
      { x: 7, y: 5, dirX: 1, dirY: 0, range: 4, originX: 7, originY: 5 },
    ],
  },

  // Level 7: Skull Rock Shoals
  {
    name: 'Skull Rock Shoals',
    theme: 'Danger Coast',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 0, 0, 3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 2],
      [2, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 2],
      [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 2],
      [2, 3, 1, 0, 0, 3, 1, 0, 0, 3, 0, 0, 3, 2],
      [2, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2],
      [2, 0, 1, 1, 3, 0, 0, 1, 1, 3, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    playerStart: { x: 1, y: 7 },
    exitBoat: { x: 12, y: 1 },
    coins: [
      { x: 2, y: 1, collected: false },
      { x: 7, y: 3, collected: false },
      { x: 11, y: 3, collected: false },
      { x: 5, y: 6, collected: false },
      { x: 9, y: 6, collected: false },
    ],
    chests: [
      { x: 5, y: 1, collected: false },
      { x: 10, y: 1, collected: false },
      { x: 1, y: 3, collected: false },
    ],
    crabs: [
      { x: 3, y: 6, dirX: 1, dirY: 0, range: 4, originX: 3, originY: 6 },
      { x: 3, y: 3, dirX: 0, dirY: 1, range: 2, originX: 3, originY: 3 },
    ],
  },

  // Level 8: Sunken Galleon Sandbar
  {
    name: 'Sunken Galleon Sandbar',
    theme: 'Treasure Fleet Wreck',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 2],
      [2, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 2],
      [2, 0, 0, 0, 1, 1, 3, 3, 1, 1, 0, 0, 0, 2],
      [2, 1, 3, 1, 1, 0, 0, 0, 0, 1, 1, 3, 1, 2],
      [2, 0, 0, 0, 1, 1, 3, 3, 1, 1, 0, 0, 0, 2],
      [2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2],
      [2, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    playerStart: { x: 1, y: 1 },
    exitBoat: { x: 12, y: 7 },
    coins: [
      { x: 3, y: 1, collected: false },
      { x: 10, y: 1, collected: false },
      { x: 6, y: 4, collected: false },
      { x: 7, y: 4, collected: false },
      { x: 3, y: 7, collected: false },
      { x: 10, y: 7, collected: false },
    ],
    chests: [
      { x: 6, y: 1, collected: false },
      { x: 7, y: 1, collected: false },
      { x: 1, y: 4, collected: false },
      { x: 12, y: 4, collected: false },
    ],
    crabs: [
      { x: 2, y: 3, dirX: 1, dirY: 0, range: 3, originX: 2, originY: 3 },
      { x: 9, y: 5, dirX: 1, dirY: 0, range: 3, originX: 9, originY: 5 },
      { x: 6, y: 6, dirX: 1, dirY: 0, range: 2, originX: 6, originY: 6 },
    ],
  },

  // Level 9: Caribbean Corsair Labyrinth
  {
    name: 'Corsair Labyrinth',
    theme: 'Fortified Smugglers Island',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 2],
      [2, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 2],
      [2, 0, 3, 0, 0, 0, 1, 0, 0, 0, 3, 1, 0, 2],
      [2, 0, 1, 1, 1, 3, 1, 3, 1, 1, 0, 1, 0, 2],
      [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 2],
      [2, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 2],
      [2, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    playerStart: { x: 1, y: 7 },
    exitBoat: { x: 12, y: 1 },
    coins: [
      { x: 2, y: 1, collected: false },
      { x: 6, y: 1, collected: false },
      { x: 10, y: 1, collected: false },
      { x: 5, y: 4, collected: false },
      { x: 7, y: 4, collected: false },
      { x: 3, y: 7, collected: false },
    ],
    chests: [
      { x: 7, y: 1, collected: false },
      { x: 1, y: 3, collected: false },
      { x: 12, y: 5, collected: false },
      { x: 7, y: 7, collected: false },
    ],
    crabs: [
      { x: 2, y: 5, dirX: 1, dirY: 0, range: 4, originX: 2, originY: 5 },
      { x: 8, y: 5, dirX: 1, dirY: 0, range: 4, originX: 8, originY: 5 },
      { x: 5, y: 2, dirX: 0, dirY: 1, range: 2, originX: 5, originY: 2 },
    ],
  },

  // Level 10: The Pinnacle Vault Island (The Grand Finale)
  {
    name: 'The Pinnacle Vault Island',
    theme: 'Imperial Montego Fortress',
    grid: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2],
      [2, 1, 0, 0, 1, 1, 3, 3, 1, 1, 0, 0, 1, 2],
      [2, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 2],
      [2, 0, 3, 1, 0, 0, 1, 1, 0, 0, 1, 3, 0, 2],
      [2, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 2],
      [2, 1, 0, 0, 1, 1, 3, 3, 1, 1, 0, 0, 1, 2],
      [2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ],
    playerStart: { x: 6, y: 7 },
    exitBoat: { x: 7, y: 1 },
    coins: [
      { x: 4, y: 1, collected: false },
      { x: 9, y: 1, collected: false },
      { x: 2, y: 3, collected: false },
      { x: 11, y: 3, collected: false },
      { x: 2, y: 5, collected: false },
      { x: 11, y: 5, collected: false },
      { x: 4, y: 7, collected: false },
      { x: 9, y: 7, collected: false },
    ],
    chests: [
      { x: 5, y: 3, collected: false },
      { x: 8, y: 3, collected: false },
      { x: 5, y: 5, collected: false },
      { x: 8, y: 5, collected: false },
      { x: 6, y: 4, collected: false },
    ],
    crabs: [
      { x: 4, y: 2, dirX: 1, dirY: 0, range: 4, originX: 4, originY: 2 },
      { x: 4, y: 6, dirX: 1, dirY: 0, range: 4, originX: 4, originY: 6 },
      { x: 1, y: 4, dirX: 0, dirY: 1, range: 2, originX: 1, originY: 4 },
      { x: 12, y: 4, dirX: 0, dirY: 1, range: 2, originX: 12, originY: 4 },
    ],
  },
];

export const PinnTreasureHunt: React.FC<PinnTreasureHuntProps> = ({
  onBackToHub,
  onNavigateToLeaderboard,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game UI State
  const [currentLevelIdx, setCurrentLevelIdx] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [health, setHealth] = useState<number>(3);
  const [coinsFound, setCoinsFound] = useState<number>(0);
  const [chestsFound, setChestsFound] = useState<number>(0);
  const [totalChestsInLevel, setTotalChestsInLevel] = useState<number>(1);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'level_cleared' | 'gameover' | 'victory'>('idle');
  const [isMuted, setIsMuted] = useState<boolean>(soundService.getIsMuted());
  const [personalBest, setPersonalBest] = useState<number>(leaderboardService.getGameBest('treasure-hunt'));

  useEffect(() => {
    const unsub = soundService.subscribe((muted) => {
      setIsMuted(muted);
    });
    return unsub;
  }, []);

  // Logical grid coordinates (14 cols x 9 rows)
  const COLS = 14;
  const ROWS = 9;
  const TILE_SIZE = 60; // 840 x 540 canvas size

  // Mutable Simulation Refs
  const sim = useRef({
    player: { x: 1, y: 1, px: 60, py: 60, moving: false, dir: 'down' as 'up' | 'down' | 'left' | 'right' },
    levelData: JSON.parse(JSON.stringify(LEVELS[0])) as LevelConfig,
    crabTick: 0,
    animFrame: null as number | null,
    score: 0,
    health: 3,
    invincibleTimer: 0,
    sessionId: '',
    startTime: 0,
    movesCount: 0,
    levelsCleared: 0,
    chestsFound: 0,
    coinsFound: 0,
  });

  const handleToggleMute = () => {
    soundService.toggleMute();
  };

  // Load specific level
  const loadLevel = useCallback((lvlIndex: number, currentAccumulatedScore: number) => {
    const freshLevel = JSON.parse(JSON.stringify(LEVELS[lvlIndex])) as LevelConfig;
    sim.current.levelData = freshLevel;
    sim.current.player.x = freshLevel.playerStart.x;
    sim.current.player.y = freshLevel.playerStart.y;
    sim.current.player.px = freshLevel.playerStart.x * TILE_SIZE;
    sim.current.player.py = freshLevel.playerStart.y * TILE_SIZE;
    sim.current.health = 3;
    sim.current.score = currentAccumulatedScore;
    sim.current.invincibleTimer = 0;

    setCurrentLevelIdx(lvlIndex);
    setHealth(3);
    setScore(currentAccumulatedScore);
    setCoinsFound(0);
    setChestsFound(0);
    setTotalChestsInLevel(freshLevel.chests.length);
    setGameState('playing');
  }, [TILE_SIZE]);

  // Start fresh game
  const handleStartGame = useCallback(() => {
    soundService.unlockAudio();
    soundService.playClick();
    sim.current.sessionId = `th_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sim.current.startTime = Date.now();
    sim.current.movesCount = 0;
    sim.current.levelsCleared = 0;
    sim.current.chestsFound = 0;
    sim.current.coinsFound = 0;
    loadLevel(0, 0);
  }, [loadLevel]);

  // Handle Movement
  const movePlayer = useCallback((dx: number, dy: number, dir: 'up' | 'down' | 'left' | 'right') => {
    if (gameState !== 'playing') return;
    soundService.unlockAudio();
    sim.current.movesCount += 1;

    const { player, levelData } = sim.current;
    const targetX = player.x + dx;
    const targetY = player.y + dy;

    player.dir = dir;

    // Check bounds
    if (targetX < 0 || targetX >= COLS || targetY < 0 || targetY >= ROWS) return;

    // Check solid tiles (1: Palm, 2: Water)
    const tile = levelData.grid[targetY][targetX] as TileType;
    if (tile === 1 || tile === 2) return;

    // Execute move
    player.x = targetX;
    player.y = targetY;
    player.px = targetX * TILE_SIZE;
    player.py = targetY * TILE_SIZE;

    // Check spike trap (3)
    if (tile === 3 && sim.current.invincibleTimer <= 0) {
      sim.current.health -= 1;
      sim.current.invincibleTimer = 25;
      setHealth(sim.current.health);
      soundService.playCrash();
      if (sim.current.health <= 0) {
        setGameState('gameover');
        soundService.playGameOver();
        const durationMs = Math.max(4000, Date.now() - sim.current.startTime);
        leaderboardService.recordGameBest('treasure-hunt', sim.current.score, {
          sessionId: sim.current.sessionId,
          durationMs,
          telemetry: {
            levelsCleared: sim.current.levelsCleared,
            movesCount: sim.current.movesCount,
            chestsFound: sim.current.chestsFound,
            coinsFound: sim.current.coinsFound,
          },
        });
        setPersonalBest(leaderboardService.getGameBest('treasure-hunt'));
        return;
      }
    }

    // Check coin collection (+25 pts)
    levelData.coins.forEach((coin) => {
      if (!coin.collected && coin.x === targetX && coin.y === targetY) {
        coin.collected = true;
        sim.current.score += 25;
        sim.current.coinsFound += 1;
        setScore(sim.current.score);
        setCoinsFound((prev) => prev + 1);
        soundService.playCoin();
      }
    });

    // Check chest collection (+100 pts)
    levelData.chests.forEach((chest) => {
      if (!chest.collected && chest.x === targetX && chest.y === targetY) {
        chest.collected = true;
        sim.current.score += 100;
        sim.current.chestsFound += 1;
        setScore(sim.current.score);
        setChestsFound((prev) => prev + 1);
        soundService.playChest();
      }
    });

    // Check Exit Boat
    const allChestsCollected = levelData.chests.every((c) => c.collected);
    if (targetX === levelData.exitBoat.x && targetY === levelData.exitBoat.y) {
      if (allChestsCollected) {
        // Level cleared! Award completion bonus
        sim.current.levelsCleared += 1;
        const levelBonus = 150 * (currentLevelIdx + 1) + sim.current.health * 50;
        sim.current.score += levelBonus;
        setScore(sim.current.score);

        // Update PB
        const durationMs = Math.max(4000, Date.now() - sim.current.startTime);
        const { pb } = leaderboardService.recordGameBest('treasure-hunt', sim.current.score, {
          sessionId: sim.current.sessionId,
          durationMs,
          telemetry: {
            levelsCleared: sim.current.levelsCleared,
            movesCount: sim.current.movesCount,
            chestsFound: sim.current.chestsFound,
            coinsFound: sim.current.coinsFound,
          },
        });
        setPersonalBest(pb);

        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#ffd700', '#d4af37', '#ffffff'],
        });

        soundService.playVictory();

        if (currentLevelIdx >= LEVELS.length - 1) {
          // Final victory!
          setGameState('victory');
        } else {
          setGameState('level_cleared');
        }
      }
    }
  }, [gameState, currentLevelIdx, COLS, ROWS, TILE_SIZE]);

  // Proceed to next level
  const handleNextLevel = () => {
    soundService.playClick();
    if (currentLevelIdx < LEVELS.length - 1) {
      loadLevel(currentLevelIdx + 1, sim.current.score);
    } else {
      setGameState('victory');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        movePlayer(0, -1, 'up');
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        movePlayer(0, 1, 'down');
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        movePlayer(-1, 0, 'left');
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        movePlayer(1, 0, 'right');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [movePlayer]);

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = COLS * TILE_SIZE; // 840
    canvas.height = ROWS * TILE_SIZE; // 540

    let tick = 0;

    const render = () => {
      tick++;
      sim.current.crabTick++;

      if (sim.current.invincibleTimer > 0) {
        sim.current.invincibleTimer--;
      }

      // Update Crabs patrol movement
      const { levelData, player } = sim.current;
      if (gameState === 'playing' && tick % 25 === 0) {
        levelData.crabs.forEach((crab) => {
          crab.x += crab.dirX;
          crab.y += crab.dirY;

          // Check boundary reversal
          if (Math.abs(crab.x - crab.originX) >= crab.range) {
            crab.dirX *= -1;
          }
          if (Math.abs(crab.y - crab.originY) >= crab.range) {
            crab.dirY *= -1;
          }

          // Check player collision
          if (crab.x === player.x && crab.y === player.y && sim.current.invincibleTimer <= 0) {
            sim.current.health -= 1;
            sim.current.invincibleTimer = 30;
            setHealth(sim.current.health);
            soundService.playCrash();
            if (sim.current.health <= 0) {
              setGameState('gameover');
              soundService.playGameOver();
              const durationMs = Math.max(4000, Date.now() - sim.current.startTime);
              leaderboardService.recordGameBest('treasure-hunt', sim.current.score, {
                sessionId: sim.current.sessionId,
                durationMs,
                telemetry: {
                  levelsCleared: sim.current.levelsCleared,
                  movesCount: sim.current.movesCount,
                  chestsFound: sim.current.chestsFound,
                  coinsFound: sim.current.coinsFound,
                },
              });
              setPersonalBest(leaderboardService.getGameBest('treasure-hunt'));
            }
          }
        });
      }

      // DRAW BOARD
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Tiles
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const tile = levelData.grid[r][c] as TileType;
          const x = c * TILE_SIZE;
          const y = r * TILE_SIZE;

          if (tile === 2) {
            // Ocean Water
            const waterGrad = ctx.createLinearGradient(x, y, x, y + TILE_SIZE);
            waterGrad.addColorStop(0, '#0284c7');
            waterGrad.addColorStop(1, '#0369a1');
            ctx.fillStyle = waterGrad;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

            // Wave highlight
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.beginPath();
            ctx.arc(x + 30, y + 25 + Math.sin(tick * 0.05 + c) * 3, 14, 0, Math.PI);
            ctx.stroke();
          } else if (tile === 1) {
            // Palm / Rocky Barrier
            ctx.fillStyle = '#1c1917';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

            // Palm frond crown
            ctx.fillStyle = '#065f46';
            ctx.beginPath();
            ctx.arc(x + 30, y + 26, 20, 0, Math.PI * 2);
            ctx.fill();

            // Gold accent trim
            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          } else {
            // Sandy Beach Base
            ctx.fillStyle = (r + c) % 2 === 0 ? '#1f1e1b' : '#272622';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

            // Subtle sand grid dot
            ctx.fillStyle = 'rgba(212, 175, 55, 0.08)';
            ctx.fillRect(x + 28, y + 28, 4, 4);

            if (tile === 3) {
              // Spike Trap Hazard
              ctx.fillStyle = '#b91c1c';
              ctx.beginPath();
              ctx.moveTo(x + 12, y + 46);
              ctx.lineTo(x + 22, y + 16);
              ctx.lineTo(x + 32, y + 46);
              ctx.lineTo(x + 42, y + 16);
              ctx.lineTo(x + 50, y + 46);
              ctx.closePath();
              ctx.fill();
            }
          }
        }
      }

      // Draw Exit Boat / Portal
      const boat = levelData.exitBoat;
      const bx = boat.x * TILE_SIZE;
      const by = boat.y * TILE_SIZE;
      const allChests = levelData.chests.every((c) => c.collected);

      ctx.save();
      // Boat Glow if ready
      if (allChests) {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15;
      }
      ctx.fillStyle = allChests ? '#d4af37' : '#78350f';
      ctx.beginPath();
      ctx.roundRect(bx + 8, by + 18, 44, 24, 6);
      ctx.fill();

      // Boat Sail
      ctx.fillStyle = allChests ? '#fff' : '#a1a1aa';
      ctx.beginPath();
      ctx.moveTo(bx + 30, by + 8);
      ctx.lineTo(bx + 48, by + 26);
      ctx.lineTo(bx + 30, by + 26);
      ctx.closePath();
      ctx.fill();

      if (!allChests) {
        // Locked indicator
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('LOCKED', bx + 10, by + 52);
      }
      ctx.restore();

      // Draw Gold Coins
      levelData.coins.forEach((c) => {
        if (!c.collected) {
          const cx = c.x * TILE_SIZE + 30;
          const cy = c.y * TILE_SIZE + 30;

          ctx.save();
          const coinGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 11);
          coinGrad.addColorStop(0, '#fff4cc');
          coinGrad.addColorStop(0.5, '#ffd700');
          coinGrad.addColorStop(1, '#b45309');
          ctx.fillStyle = coinGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, 11, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#78350f';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('$', cx, cy);
          ctx.restore();
        }
      });

      // Draw Treasure Chests
      levelData.chests.forEach((ch) => {
        const cx = ch.x * TILE_SIZE + 10;
        const cy = ch.y * TILE_SIZE + 14;

        ctx.save();
        if (!ch.collected) {
          ctx.fillStyle = '#b45309';
          ctx.fillRect(cx, cy, 40, 28);
          // Gold trim & lock
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 3;
          ctx.strokeRect(cx, cy, 40, 28);
          ctx.fillStyle = '#ffd700';
          ctx.fillRect(cx + 17, cy + 10, 6, 8);
        } else {
          // Opened chest
          ctx.fillStyle = '#78350f';
          ctx.fillRect(cx, cy + 8, 40, 20);
          ctx.fillStyle = '#d4af37';
          ctx.fillRect(cx + 5, cy, 30, 8);
        }
        ctx.restore();
      });

      // Draw Enemy Crabs
      levelData.crabs.forEach((cr) => {
        const crx = cr.x * TILE_SIZE + 30;
        const cry = cr.y * TILE_SIZE + 30;

        ctx.save();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(crx, cry, 14, 0, Math.PI * 2);
        ctx.fill();

        // Crab claws
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(crx - 12, cry - 8, 6, 0, Math.PI * 2);
        ctx.arc(crx + 12, cry - 8, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.fillRect(crx - 5, cry - 4, 3, 3);
        ctx.fillRect(crx + 2, cry - 4, 3, 3);
        ctx.restore();
      });

      // Draw Player Character (Island Explorer)
      const px = player.x * TILE_SIZE + 30;
      const py = player.y * TILE_SIZE + 30;

      ctx.save();
      if (sim.current.invincibleTimer > 0 && Math.floor(tick / 4) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(px, py + 18, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body (Montego Explorer gold sash)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(px - 14, py - 16, 28, 30, 6);
      ctx.fill();

      ctx.fillStyle = '#d4af37';
      ctx.fillRect(px - 14, py - 4, 28, 6);

      // Explorer Pith / Crown
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(px, py - 18, 11, 0, Math.PI * 2);
      ctx.fill();

      // Brim
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(px - 15, py - 16, 30, 4);

      ctx.restore();

      sim.current.animFrame = requestAnimationFrame(render);
    };

    sim.current.animFrame = requestAnimationFrame(render);
    return () => {
      if (sim.current.animFrame) cancelAnimationFrame(sim.current.animFrame);
    };
  }, [gameState, COLS, ROWS, TILE_SIZE]);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center select-none">
      {/* Top Controls & Navigation Bar */}
      <div className="w-full flex items-center justify-between bg-zinc-950/90 border border-gold-subtle/40 rounded-t-xl px-4 py-3 text-sm backdrop-blur-sm shadow-lg">
        <div className="flex items-center gap-4 sm:gap-6">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-mono-arcade">
              Level {currentLevelIdx + 1} / {LEVELS.length}
            </span>
            <span className="text-base sm:text-lg font-bold text-white font-serif">
              {LEVELS[currentLevelIdx].name}
            </span>
          </div>

          <div className="flex items-center gap-2 border-l border-zinc-800 pl-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-mono-arcade">
                Score
              </span>
              <span className="text-xl font-bold font-mono-arcade text-gold-gradient">{score}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 border-l border-zinc-800 pl-4">
            {[...Array(3)].map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 ${
                  i < health ? 'text-red-500 fill-red-500' : 'text-zinc-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg border border-gold-subtle/30">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-zinc-400">Best: </span>
            <span className="text-xs font-bold font-mono-arcade text-amber-300">
              {Math.max(personalBest, score)}
            </span>
          </div>

          <button
            onClick={handleToggleMute}
            aria-label="Toggle mute"
            className="p-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-amber-400 border border-zinc-800"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-zinc-500" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>

          {onBackToHub && (
            <button
              onClick={onBackToHub}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold"
            >
              Games Hub
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative w-full aspect-[14/9] bg-black border-x border-b border-gold-subtle/40 rounded-b-xl overflow-hidden shadow-2xl">
        <canvas ref={canvasRef} className="w-full h-full block touch-game-canvas object-cover" />

        {/* START OVERLAY */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs uppercase tracking-widest mb-3">
              <Compass className="w-3.5 h-3.5" />
              <span>Island Adventure · 10 Levels</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight text-gold-gradient mb-2">
              PINN TREASURE HUNT
            </h1>
            <p className="text-zinc-300 text-xs sm:text-sm max-w-md mb-6 leading-relaxed">
              Explore 10 island shores. Collect gold coins and treasure chests. Avoid spikes and crabs, then escape via the boat to unlock the next level!
            </p>

            <button
              onClick={handleStartGame}
              className="px-8 py-3.5 rounded-xl bg-gold-gradient text-black font-extrabold text-sm uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>START EXPEDITION</span>
            </button>

            <span className="text-[11px] text-zinc-500 mt-4">
              Use Arrow keys / WASD on keyboard or the mobile D-Pad below.
            </span>
          </div>
        )}

        {/* LEVEL COMPLETE OVERLAY */}
        {gameState === 'level_cleared' && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-in fade-in">
            <div className="w-12 h-12 rounded-xl bg-gold-gradient text-black flex items-center justify-center font-bold mb-3 shadow-lg shadow-amber-500/20">
              <Award className="w-6 h-6" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-serif uppercase tracking-tight mb-1">
              LEVEL {currentLevelIdx + 1} CLEARED!
            </h2>
            <p className="text-xs text-amber-300 mb-6 font-mono-arcade">
              Bonus awarded · Next: {LEVELS[currentLevelIdx + 1]?.name}
            </p>

            <div className="grid grid-cols-3 gap-2 max-w-xs w-full bg-zinc-900/90 border border-gold-subtle/50 rounded-xl p-3 mb-6">
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block font-mono-arcade">Total Score</span>
                <span className="text-base font-bold font-mono-arcade text-gold-gradient">{score}</span>
              </div>
              <div className="border-x border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase block font-mono-arcade">Chests</span>
                <span className="text-base font-bold font-mono-arcade text-emerald-400">{chestsFound} / {totalChestsInLevel}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block font-mono-arcade">Run Time</span>
                <span className="text-base font-bold font-mono-arcade text-amber-300">
                  {((sim.current.startTime > 0 ? Date.now() - sim.current.startTime : 0) / 1000).toFixed(1)}s
                </span>
              </div>
            </div>

            <button
              onClick={handleNextLevel}
              className="px-7 py-3 rounded-xl bg-gold-gradient text-black font-extrabold text-sm uppercase tracking-wider shadow-lg hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>NEXT LEVEL</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        )}

        {/* GAME OVER OVERLAY */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <h2 className="text-3xl font-extrabold text-red-500 uppercase font-serif mb-1">
              EXPEDITION FAILED
            </h2>
            <p className="text-xs text-zinc-400 mb-4">
              Watch out for spike traps and patrol crabs!
            </p>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800 max-w-xs w-full mb-6 text-center">
              <div>
                <span className="text-[10px] text-zinc-400 block font-mono-arcade uppercase">Final Score</span>
                <span className="text-xl font-bold font-mono-arcade text-gold-gradient">{score}</span>
              </div>
              <div className="border-l border-zinc-800">
                <span className="text-[10px] text-zinc-400 block font-mono-arcade uppercase">Run Time</span>
                <span className="text-xl font-bold font-mono-arcade text-emerald-400">
                  {((sim.current.startTime > 0 ? Date.now() - sim.current.startTime : 0) / 1000).toFixed(1)}s
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStartGame}
                className="px-6 py-3 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RETRY EXPEDITION</span>
              </button>
              {onBackToHub && (
                <button
                  onClick={onBackToHub}
                  className="px-5 py-3 rounded-xl bg-zinc-900 text-zinc-200 border border-zinc-700 font-bold text-xs uppercase cursor-pointer"
                >
                  Games Hub
                </button>
              )}
            </div>
          </div>
        )}

        {/* VICTORY OVERLAY (All 10 Levels Completed) */}
        {gameState === 'victory' && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-14 h-14 rounded-2xl bg-gold-gradient text-black flex items-center justify-center mb-3 shadow-xl shadow-amber-500/30">
              <Trophy className="w-7 h-7" />
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-gold-gradient uppercase font-serif mb-1">
              TREASURE MASTER!
            </h2>
            <p className="text-xs text-amber-300 mb-4 max-w-md">
              Congratulations! You have conquered all 10 island levels and claimed The Pinnacle Vault!
            </p>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-zinc-900 border border-gold-subtle max-w-xs w-full mb-6 text-center">
              <div>
                <span className="text-[10px] text-zinc-400 block font-mono-arcade uppercase">Final Score</span>
                <span className="text-2xl font-black font-mono-arcade text-gold-gradient">{score}</span>
              </div>
              <div className="border-l border-zinc-800">
                <span className="text-[10px] text-zinc-400 block font-mono-arcade uppercase">Total Run Time</span>
                <span className="text-2xl font-bold font-mono-arcade text-emerald-400">
                  {((sim.current.startTime > 0 ? Date.now() - sim.current.startTime : 0) / 1000).toFixed(1)}s
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStartGame}
                className="px-6 py-3 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer"
              >
                Play Again
              </button>
              {onNavigateToLeaderboard && (
                <button
                  onClick={onNavigateToLeaderboard}
                  className="px-6 py-3 rounded-xl bg-zinc-900 text-amber-300 border border-gold-subtle font-bold text-xs uppercase cursor-pointer"
                >
                  Leaderboard
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MOBILE RESPONSIVE D-PAD CONTROLS */}
      <div className="w-full mt-3 p-4 bg-zinc-950/90 border border-zinc-800 rounded-xl flex items-center justify-between gap-4">
        <div className="text-xs text-zinc-400">
          <span className="font-semibold text-amber-400 block">Touch Controls</span>
          <span>Use D-Pad to move your explorer.</span>
        </div>

        {/* Virtual D-Pad */}
        <div className="grid grid-cols-3 gap-1.5 w-36 h-36 shrink-0">
          <div></div>
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              movePlayer(0, -1, 'up');
            }}
            onClick={() => movePlayer(0, -1, 'up')}
            aria-label="Move Up"
            className="flex items-center justify-center bg-zinc-900 active:bg-amber-500 active:text-black border border-zinc-700 rounded-lg text-white font-bold shadow"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
          <div></div>

          <button
            onTouchStart={(e) => {
              e.preventDefault();
              movePlayer(-1, 0, 'left');
            }}
            onClick={() => movePlayer(-1, 0, 'left')}
            aria-label="Move Left"
            className="flex items-center justify-center bg-zinc-900 active:bg-amber-500 active:text-black border border-zinc-700 rounded-lg text-white font-bold shadow"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center justify-center bg-zinc-950 rounded border border-zinc-850">
            <Compass className="w-4 h-4 text-amber-400" />
          </div>

          <button
            onTouchStart={(e) => {
              e.preventDefault();
              movePlayer(1, 0, 'right');
            }}
            onClick={() => movePlayer(1, 0, 'right')}
            aria-label="Move Right"
            className="flex items-center justify-center bg-zinc-900 active:bg-amber-500 active:text-black border border-zinc-700 rounded-lg text-white font-bold shadow"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          <div></div>
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              movePlayer(0, 1, 'down');
            }}
            onClick={() => movePlayer(0, 1, 'down')}
            aria-label="Move Down"
            className="flex items-center justify-center bg-zinc-900 active:bg-amber-500 active:text-black border border-zinc-700 rounded-lg text-white font-bold shadow"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
          <div></div>
        </div>
      </div>
    </div>
  );
};
