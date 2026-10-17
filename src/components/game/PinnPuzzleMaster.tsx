import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Brain,
  Timer,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  Award,
  Sparkles,
  Zap,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { soundService } from '../../services/soundService';
import { leaderboardService } from '../../services/leaderboardService';

interface PinnPuzzleMasterProps {
  onBackToHub?: () => void;
  onNavigateToLeaderboard?: () => void;
}

export type PuzzleDifficulty = 'easy' | 'medium' | 'hard' | 'all';

export interface PuzzleQuestion {
  id: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'Number Sequence' | 'Pattern Logic' | 'Lateral Deduction' | 'Crypto Math';
  question: string;
  hint?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

// 33 Verified Original Logic & Pattern Questions
const PUZZLE_BANK: PuzzleQuestion[] = [
  // --- EASY (11 Questions) ---
  {
    id: 1,
    difficulty: 'easy',
    category: 'Number Sequence',
    question: 'Find the next number in the sequence: 2, 4, 8, 16, ?',
    hint: 'Each number is multiplied by 2.',
    options: ['24', '30', '32', '64'],
    correctIndex: 2,
    explanation: 'Each term doubles: 16 × 2 = 32.',
  },
  {
    id: 2,
    difficulty: 'easy',
    category: 'Number Sequence',
    question: 'What comes next in the progression: 5, 10, 15, 20, ?',
    hint: 'A steady addition.',
    options: ['22', '25', '30', '35'],
    correctIndex: 1,
    explanation: 'Arithmetic progression with step +5: 20 + 5 = 25.',
  },
  {
    id: 3,
    difficulty: 'easy',
    category: 'Pattern Logic',
    question: 'Identify the next square number: 1, 4, 9, 16, ?',
    hint: '1², 2², 3², 4²...',
    options: ['20', '24', '25', '36'],
    correctIndex: 2,
    explanation: '5² = 25.',
  },
  {
    id: 4,
    difficulty: 'easy',
    category: 'Lateral Deduction',
    question: 'If all Palms are Trees, and all Trees have green leaves, do all Palms have green leaves?',
    hint: 'Classic categorical syllogism.',
    options: ['Yes, definitely', 'No, never', 'Only in winter', 'Cannot be determined'],
    correctIndex: 0,
    explanation: 'By transitive property: Palm → Tree → Green Leaves.',
  },
  {
    id: 5,
    difficulty: 'easy',
    category: 'Pattern Logic',
    question: 'What is the next letter: O, T, T, F, F, S, S, ?',
    hint: 'Count from one onwards.',
    options: ['N', 'T', 'E', 'O'],
    correctIndex: 2,
    explanation: 'First letters of numbers: One, Two, Three, Four, Five, Six, Seven, Eight (E).',
  },
  {
    id: 6,
    difficulty: 'easy',
    category: 'Lateral Deduction',
    question: 'A chest has 30 gold $PINN coins. You take 12 coins. How many coins do you have?',
    hint: 'Read carefully: how many do *you* have?',
    options: ['18 coins', '12 coins', '30 coins', '0 coins'],
    correctIndex: 1,
    explanation: 'You took 12 coins, so you have 12 coins.',
  },
  {
    id: 7,
    difficulty: 'easy',
    category: 'Number Sequence',
    question: 'Continue the countdown: 100, 90, 80, 70, ?',
    hint: 'Subtract 10 each step.',
    options: ['50', '55', '60', '65'],
    correctIndex: 2,
    explanation: '70 - 10 = 60.',
  },
  {
    id: 8,
    difficulty: 'easy',
    category: 'Lateral Deduction',
    question: 'During a beach sprint, you overtake the runner in 2nd place. What position are you in?',
    hint: 'You replaced the 2nd place runner.',
    options: ['1st place', '2nd place', '3rd place', 'Tied for 1st'],
    correctIndex: 1,
    explanation: 'By overtaking the person in 2nd place, you take their spot in 2nd place.',
  },
  {
    id: 9,
    difficulty: 'easy',
    category: 'Crypto Math',
    question: 'Calculate following order of operations: 7 + 7 / 7 + 7 * 7 - 7 = ?',
    hint: 'Remember PEMDAS: division and multiplication first.',
    options: ['50', '56', '49', '0'],
    correctIndex: 0,
    explanation: '7/7 = 1; 7*7 = 49. Expression: 7 + 1 + 49 - 7 = 50.',
  },
  {
    id: 10,
    difficulty: 'easy',
    category: 'Number Sequence',
    question: 'What is the missing term: 3, 6, 12, 24, ?',
    hint: 'Each number is twice the previous.',
    options: ['36', '42', '48', '52'],
    correctIndex: 2,
    explanation: '24 × 2 = 48.',
  },
  {
    id: 11,
    difficulty: 'easy',
    category: 'Pattern Logic',
    question: 'If letter values are A=1, B=2, C=3, what is the sum of CAB?',
    hint: 'Add 3 + 1 + 2.',
    options: ['5', '6', '7', '8'],
    correctIndex: 1,
    explanation: 'C(3) + A(1) + B(2) = 6.',
  },

  // --- MEDIUM (11 Questions) ---
  {
    id: 12,
    difficulty: 'medium',
    category: 'Number Sequence',
    question: 'Find the next prime number: 2, 3, 5, 7, 11, ?',
    hint: 'Only divisible by 1 and itself.',
    options: ['12', '13', '14', '15'],
    correctIndex: 1,
    explanation: '13 is the next prime number after 11.',
  },
  {
    id: 13,
    difficulty: 'medium',
    category: 'Number Sequence',
    question: 'Find the Fibonacci number: 1, 1, 2, 3, 5, 8, 13, ?',
    hint: 'Sum of previous two numbers.',
    options: ['18', '20', '21', '24'],
    correctIndex: 2,
    explanation: '8 + 13 = 21.',
  },
  {
    id: 14,
    difficulty: 'medium',
    category: 'Lateral Deduction',
    question: 'If 3 workers build 3 resort cabanas in 3 days, how many days do 6 workers take to build 6 cabanas?',
    hint: 'Calculate rate per worker.',
    options: ['1 day', '3 days', '6 days', '9 days'],
    correctIndex: 1,
    explanation: 'Each worker builds 1 cabana in 3 days. 6 workers will build 6 cabanas in 3 days.',
  },
  {
    id: 15,
    difficulty: 'medium',
    category: 'Pattern Logic',
    question: 'What number completes the series: 3, 5, 9, 17, 33, ?',
    hint: 'Differences are +2, +4, +8, +16...',
    options: ['49', '55', '65', '67'],
    correctIndex: 2,
    explanation: 'Differences double each step: 33 + 32 = 65.',
  },
  {
    id: 16,
    difficulty: 'medium',
    category: 'Pattern Logic',
    question: 'How many diagonals can be drawn inside a regular pentagon?',
    hint: 'Formula is n(n-3)/2.',
    options: ['3', '4', '5', '10'],
    correctIndex: 2,
    explanation: '5(5-3)/2 = 5 diagonals.',
  },
  {
    id: 17,
    difficulty: 'medium',
    category: 'Lateral Deduction',
    question: 'If tomorrow was yesterday, today would be Friday. What day is today actually?',
    hint: 'Work backwards from Friday.',
    options: ['Wednesday', 'Thursday', 'Saturday', 'Sunday'],
    correctIndex: 3,
    explanation: 'If yesterday was Saturday, tomorrow would be Sunday. To make yesterday Friday, today is Sunday.',
  },
  {
    id: 18,
    difficulty: 'medium',
    category: 'Crypto Math',
    question: 'Complete the grid sum to 10: Row 1: [2, 3, 5], Row 2: [4, 1, 5], Row 3: [6, 2, ?]',
    hint: 'Sum of Row 3 must equal 10.',
    options: ['1', '2', '3', '4'],
    correctIndex: 1,
    explanation: '6 + 2 + 2 = 10.',
  },
  {
    id: 19,
    difficulty: 'medium',
    category: 'Number Sequence',
    question: 'What is the next cube number: 1, 8, 27, 64, ?',
    hint: '1³, 2³, 3³, 4³, 5³...',
    options: ['100', '125', '144', '216'],
    correctIndex: 1,
    explanation: '5³ = 5 × 5 × 5 = 125.',
  },
  {
    id: 20,
    difficulty: 'medium',
    category: 'Lateral Deduction',
    question: '5 minting machines take 5 minutes to forge 5 $PINN medals. How long do 100 machines take to forge 100 medals?',
    hint: 'Think about each machine working concurrently.',
    options: ['1 minute', '5 minutes', '20 minutes', '100 minutes'],
    correctIndex: 1,
    explanation: 'Each machine takes 5 minutes to forge 1 medal. 100 machines running simultaneously forge 100 medals in 5 minutes.',
  },
  {
    id: 21,
    difficulty: 'medium',
    category: 'Crypto Math',
    question: 'Two wallet balances total 50 SOL and have a difference of 20 SOL. What is the larger balance?',
    hint: 'x + y = 50, x - y = 20.',
    options: ['30 SOL', '35 SOL', '40 SOL', '25 SOL'],
    correctIndex: 1,
    explanation: '2x = 70 → x = 35 SOL, y = 15 SOL.',
  },
  {
    id: 22,
    difficulty: 'medium',
    category: 'Pattern Logic',
    question: 'At 3:15, what is the exact angle between the hour hand and the minute hand of a clock?',
    hint: 'The hour hand moves 0.5 degrees per minute.',
    options: ['0°', '5°', '7.5°', '12°'],
    correctIndex: 2,
    explanation: 'At 3:15, the minute hand is at 90°, and the hour hand is at 90° + (15 × 0.5°) = 97.5°. Difference = 7.5°.',
  },

  // --- HARD (11 Questions) ---
  {
    id: 23,
    difficulty: 'hard',
    category: 'Number Sequence',
    question: 'Find the next term: 2, 6, 12, 20, 30, 42, ?',
    hint: 'Expressed as n × (n + 1).',
    options: ['52', '56', '60', '64'],
    correctIndex: 1,
    explanation: 'Pattern is n(n+1): 1×2=2, 2×3=6, 3×4=12, 4×5=20, 5×6=30, 6×7=42, 7×8=56.',
  },
  {
    id: 24,
    difficulty: 'hard',
    category: 'Crypto Math',
    question: 'A chest has 4 Gold, 5 Silver, and 6 Bronze coins. Minimum coins drawn blind to guarantee at least two coins of the SAME type?',
    hint: 'Pigeonhole principle with 3 colors.',
    options: ['2', '3', '4', '7'],
    correctIndex: 2,
    explanation: 'There are 3 coin varieties. By Pigeonhole principle, drawing 3 + 1 = 4 coins guarantees at least one matching pair.',
  },
  {
    id: 25,
    difficulty: 'hard',
    category: 'Pattern Logic',
    question: 'Decipher the sequence: 61, 52, 63, 94, 46, ?',
    hint: 'Look at famous numbers written backwards.',
    options: ['18', '29', '36', '81'],
    correctIndex: 0,
    explanation: 'Reversed squares: 16 (4²), 25 (5²), 36 (6²), 49 (7²), 64 (8²), and 81 (9²) reversed is 18.',
  },
  {
    id: 26,
    difficulty: 'hard',
    category: 'Lateral Deduction',
    question: 'You have a 3L jug and a 5L jug. What is the minimum steps to measure exactly 4L of tropical water?',
    hint: 'Fill 5L, pour to 3L (2L left), dump 3L, pour 2L into 3L, fill 5L, top up 3L.',
    options: ['4 steps', '5 steps', '6 steps', '8 steps'],
    correctIndex: 2,
    explanation: 'Classic water pouring puzzle: 6 distinct pouring/filling steps.',
  },
  {
    id: 27,
    difficulty: 'hard',
    category: 'Lateral Deduction',
    question: 'Three witnesses: A says "B is lying." B says "C is lying." C says "Both A and B are lying." Exactly ONE tells the truth. Who is it?',
    hint: 'Test who can be true without contradictions.',
    options: ['Witness A', 'Witness B', 'Witness C', 'None of them'],
    correctIndex: 1,
    explanation: 'If B tells truth: A is lying (true) and C is lying (true). Exactly one truth-teller. Consistent!',
  },
  {
    id: 28,
    difficulty: 'hard',
    category: 'Crypto Math',
    question: 'What is binary 101101 in decimal base-10?',
    hint: 'Powers of 2: 32 + 8 + 4 + 1.',
    options: ['41', '43', '45', '47'],
    correctIndex: 2,
    explanation: '32 + 0 + 8 + 4 + 0 + 1 = 45.',
  },
  {
    id: 29,
    difficulty: 'hard',
    category: 'Pattern Logic',
    question: 'Look-and-say sequence: 1, 11, 21, 1211, 111221, ?',
    hint: 'Describe the digits of the previous number.',
    options: ['312211', '132211', '311221', '112233'],
    correctIndex: 0,
    explanation: '111221 has: "three 1s, two 2s, one 1" → 312211.',
  },
  {
    id: 30,
    difficulty: 'hard',
    category: 'Crypto Math',
    question: 'How many trailing zeroes are at the end of 25! (25 factorial)?',
    hint: 'Count factors of 5: floor(25/5) + floor(25/25).',
    options: ['4 zeroes', '5 zeroes', '6 zeroes', '7 zeroes'],
    correctIndex: 2,
    explanation: 'Number of factors of 5: 25/5 = 5, and 25/25 = 1. Total = 5 + 1 = 6 zeroes.',
  },
  {
    id: 31,
    difficulty: 'hard',
    category: 'Crypto Math',
    question: 'Caesar Cipher: What does "SLQQ" decrypt to with a shift of -3 in the alphabet?',
    hint: 'S-3, L-3, Q-3, Q-3.',
    options: ['SOLA', 'PLAY', 'PINN', 'GOLD'],
    correctIndex: 2,
    explanation: 'S(-3)=P, L(-3)=I, Q(-3)=N, Q(-3)=N → PINN.',
  },
  {
    id: 32,
    difficulty: 'hard',
    category: 'Lateral Deduction',
    question: 'In a single-elimination tournament with 64 players, how many total matches must be played to crown 1 champion?',
    hint: 'Each match eliminates exactly 1 player.',
    options: ['32 matches', '63 matches', '64 matches', '128 matches'],
    correctIndex: 1,
    explanation: 'To eliminate 63 players down to 1 winner, exactly 63 matches must be played.',
  },
  {
    id: 33,
    difficulty: 'hard',
    category: 'Crypto Math',
    question: 'A fair coin is flipped 3 times. What is the probability of getting at least two heads?',
    hint: 'Count outcomes: HHH, HHT, HTH, THH out of 8.',
    options: ['1/4 (25%)', '3/8 (37.5%)', '1/2 (50%)', '5/8 (62.5%)'],
    correctIndex: 2,
    explanation: '4 out of 8 outcomes have ≥2 heads: 4/8 = 1/2 (50%).',
  },
];

export const PinnPuzzleMaster: React.FC<PinnPuzzleMasterProps> = ({
  onBackToHub,
  onNavigateToLeaderboard,
}) => {
  // Settings & State
  const [selectedDifficulty, setSelectedDifficulty] = useState<PuzzleDifficulty>('medium');
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'results'>('idle');
  const [questions, setQuestions] = useState<PuzzleQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [incorrectCount, setIncorrectCount] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [personalBest, setPersonalBest] = useState<number>(leaderboardService.getGameBest('puzzle-master'));
  const [isMuted, setIsMuted] = useState<boolean>(soundService.getIsMuted());

  useEffect(() => {
    const unsub = soundService.subscribe((muted) => {
      setIsMuted(muted);
    });
    return unsub;
  }, []);

  const timerRef = useRef<number | null>(null);
  const quizSessionId = useRef<string>('');
  const quizStartTime = useRef<number>(0);
  const answersTelemetry = useRef<Array<{ qId: number; chosenIndex: number; correct: boolean; timeMs: number }>>([]);

  // Filter and randomize question set
  const startQuiz = useCallback((diff: PuzzleDifficulty) => {
    soundService.unlockAudio();
    soundService.playClick();

    quizSessionId.current = `pm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    quizStartTime.current = Date.now();
    answersTelemetry.current = [];

    let pool = [...PUZZLE_BANK];
    if (diff !== 'all') {
      pool = pool.filter((q) => q.difficulty === diff);
    }

    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Pick 10 questions for a concise, intense round
    const selected = pool.slice(0, 10);
    setQuestions(selected);
    setCurrentIndex(0);
    setScore(0);
    setCorrectCount(0);
    setIncorrectCount(0);
    setStreak(0);
    setTimeElapsed(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setShowHint(false);
    setGameState('playing');
  }, []);

  // Timer Tick
  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = window.setInterval(() => {
        setTimeElapsed((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  // Handle Answer Selection
  const handleSelectOption = (idx: number) => {
    if (isAnswered) return;
    soundService.unlockAudio();

    const currentQ = questions[currentIndex];
    const correct = idx === currentQ.correctIndex;

    setSelectedOption(idx);
    setIsAnswered(true);
    setIsCorrect(correct);

    // Record anti-cheat question answer telemetry
    answersTelemetry.current.push({
      qId: currentQ.id,
      chosenIndex: idx,
      correct,
      timeMs: Date.now() - quizStartTime.current,
    });

    if (correct) {
      soundService.playCoin();
      const basePoints = currentQ.difficulty === 'hard' ? 350 : currentQ.difficulty === 'medium' ? 200 : 100;
      const streakBonus = streak * 25;
      const pts = basePoints + streakBonus;

      setScore((s) => s + pts);
      setCorrectCount((c) => c + 1);
      setStreak((st) => st + 1);
    } else {
      soundService.playCrash();
      setIncorrectCount((inc) => inc + 1);
      setStreak(0);
    }
  };

  // Next Question or Finish
  const handleNext = () => {
    soundService.playClick();
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setShowHint(false);
    } else {
      // Finished all 10 questions!
      if (timerRef.current) clearInterval(timerRef.current);
      setGameState('results');

      // Add speed bonus: +5 pts for each second remaining under 120s
      const timeBonus = Math.max(0, (120 - timeElapsed) * 5);
      const finalScore = score + timeBonus;
      setScore(finalScore);

      const elapsedMs = quizStartTime.current > 0
        ? Math.max(5000, Date.now() - quizStartTime.current)
        : Math.max(5000, timeElapsed * 1000);
      const { pb, isNewPb } = leaderboardService.recordGameBest('puzzle-master', finalScore, {
        sessionId: quizSessionId.current,
        durationMs: elapsedMs,
        telemetry: {
          answers: answersTelemetry.current,
        },
      });
      setPersonalBest(pb);

      if (isNewPb || correctCount >= 7) {
        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#d4af37', '#ffd700', '#ffffff'],
        });
      }
    }
  };

  const currentQ = questions[currentIndex];

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center select-none">
      {/* Top Header Card */}
      <div className="w-full flex items-center justify-between bg-zinc-950/90 border border-gold-subtle/40 rounded-t-xl px-4 py-3 text-sm backdrop-blur-sm shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center text-black font-bold">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-serif uppercase tracking-wider">
              PINN PUZZLE MASTER
            </h2>
            <span className="text-[10px] text-zinc-400 font-mono-arcade">
              30+ Logic Challenges · Multi-Tier
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-lg border border-gold-subtle/30 text-xs font-mono-arcade text-amber-300">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Best: {personalBest}</span>
          </div>

          <button
            onClick={() => soundService.toggleMute()}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isMuted
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                : 'bg-zinc-900 border-zinc-700 text-amber-400 hover:text-white'
            }`}
            title={isMuted ? 'Sound Muted - Click to Unmute' : 'Sound On - Click to Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

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

      {/* Main Container */}
      <div className="w-full bg-zinc-950 border-x border-b border-gold-subtle/40 rounded-b-xl p-5 sm:p-8 shadow-2xl min-h-[460px] flex flex-col justify-between">
        {/* IDLE / START SCREEN */}
        {gameState === 'idle' && (
          <div className="flex flex-col items-center justify-center text-center my-auto py-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs uppercase tracking-widest mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Logic & Pattern IQ Arena</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white font-serif uppercase tracking-tight text-gold-gradient mb-3">
              PINN PUZZLE MASTER
            </h1>
            <p className="text-zinc-300 text-xs sm:text-sm max-w-md mb-8 leading-relaxed">
              Test your logic, mathematical sequences, spatial patterns, and crypto deduction across 30+ original questions. Choose a difficulty level to begin!
            </p>

            {/* Difficulty Selector */}
            <div className="w-full max-w-md grid grid-cols-3 gap-2.5 mb-8">
              {(['easy', 'medium', 'hard'] as PuzzleDifficulty[]).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`py-3 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    selectedDifficulty === diff
                      ? 'bg-gold-gradient text-black border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-xs font-black">{diff}</div>
                  <span className="text-[10px] block opacity-80 mt-0.5">
                    {diff === 'easy' ? '+100 pts' : diff === 'medium' ? '+200 pts' : '+350 pts'}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => startQuiz(selectedDifficulty)}
              className="px-8 py-3.5 rounded-xl bg-gold-gradient text-black font-extrabold text-sm uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>START PUZZLE CHALLENGE</span>
            </button>
          </div>
        )}

        {/* PLAYING SCREEN */}
        {gameState === 'playing' && currentQ && (
          <div className="flex flex-col flex-1 justify-between">
            {/* Top Stats Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-850 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-mono-arcade font-bold text-amber-300">
                  Question {currentIndex + 1} / {questions.length}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase font-mono-arcade">
                  {currentQ.category}
                </span>
              </div>

              <div className="flex items-center gap-4 font-mono-arcade">
                <div className="flex items-center gap-1 text-zinc-400">
                  <Timer className="w-3.5 h-3.5 text-amber-400" />
                  <span>{timeElapsed}s</span>
                </div>
                <div className="text-gold-gradient font-bold text-sm">
                  Score: {score}
                </div>
              </div>
            </div>

            {/* Question Text */}
            <div className="py-6 sm:py-8">
              <h3 className="text-base sm:text-xl font-bold text-white leading-relaxed mb-4">
                {currentQ.question}
              </h3>

              {/* Hint Accordion */}
              {currentQ.hint && (
                <div className="mb-4">
                  {!showHint ? (
                    <button
                      onClick={() => setShowHint(true)}
                      className="inline-flex items-center gap-1.5 text-xs text-amber-400/90 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Need a hint?</span>
                    </button>
                  ) : (
                    <div className="p-3 rounded-lg bg-zinc-900/80 border border-gold-subtle/30 text-xs text-amber-200/90 flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{currentQ.hint}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQ.options.map((opt, idx) => {
                  let btnStyle = 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-zinc-700';

                  if (isAnswered) {
                    if (idx === currentQ.correctIndex) {
                      btnStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-200';
                    } else if (idx === selectedOption) {
                      btnStyle = 'bg-red-950/80 border-red-500 text-red-200';
                    } else {
                      btnStyle = 'bg-zinc-900/40 border-zinc-850 text-zinc-500';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={isAnswered}
                      onClick={() => handleSelectOption(idx)}
                      className={`p-4 rounded-xl border text-left font-semibold text-sm transition-all flex items-center justify-between cursor-pointer ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {isAnswered && idx === currentQ.correctIndex && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                      )}
                      {isAnswered && idx === selectedOption && idx !== currentQ.correctIndex && (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Answer Feedback & Next Button */}
            {isAnswered && (
              <div className="pt-4 border-t border-zinc-850 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
                <div className="text-xs">
                  <span className={`font-bold block ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isCorrect ? '✓ Correct Solution!' : '✗ Incorrect!'}
                  </span>
                  <span className="text-zinc-400">{currentQ.explanation}</span>
                </div>

                <button
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-95 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span>{currentIndex < questions.length - 1 ? 'Next Question' : 'View Results'}</span>
                  <ChevronRight className="w-4 h-4 stroke-[3]" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* RESULTS SCREEN */}
        {gameState === 'results' && (
          <div className="flex flex-col items-center justify-center text-center my-auto py-6">
            <div className="w-14 h-14 rounded-2xl bg-gold-gradient text-black flex items-center justify-center font-bold mb-3 shadow-lg shadow-amber-500/20">
              <Award className="w-7 h-7" />
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-serif uppercase tracking-tight mb-1">
              CHALLENGE COMPLETE!
            </h2>
            <p className="text-xs text-amber-300 mb-6 font-mono-arcade">
              Finished in {timeElapsed} seconds · Accuracy: {Math.round((correctCount / questions.length) * 100)}%
            </p>

            <div className="grid grid-cols-3 gap-3 max-w-md w-full bg-zinc-900 border border-gold-subtle/40 rounded-xl p-4 mb-6">
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block font-mono-arcade">Final Score</span>
                <span className="text-xl font-bold font-mono-arcade text-gold-gradient">{score}</span>
              </div>
              <div className="border-x border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase block font-mono-arcade">Correct</span>
                <span className="text-xl font-bold font-mono-arcade text-emerald-400">{correctCount} / 10</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 uppercase block font-mono-arcade">Time Taken</span>
                <span className="text-xl font-bold font-mono-arcade text-zinc-200">{timeElapsed}s</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => startQuiz(selectedDifficulty)}
                className="px-6 py-3 rounded-xl bg-gold-gradient text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Replay Puzzles</span>
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
    </div>
  );
};
