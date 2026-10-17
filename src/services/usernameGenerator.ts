/**
 * PINN Arcade Themed Username Generator
 * Produces distinctive, memorable player names inspired by:
 * - PINN Arcade & $PINN ($PINN token mint 6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump)
 * - Montego Bay, Caribbean & Jamaican vibes
 * - Arcade speed, runner, and treasure themes
 * 
 * Formats:
 * - 2 or 3 combined words + optional 2-3 digit numeric suffix
 * - Examples: PinnRunner482, MobayCoinChaser, GoldenPinnRider, PinnacleTurboAce,
 *   JamaicaPixelRunner, MontegoTreasureHunter, RoyalMobayRacer, NeonPinnChampion,
 *   PinnRushLegend, BayBlazer731
 */

const PREFIX_WORDS = [
  'Pinn',
  'Pinnacle',
  'Mobay',
  'Montego',
  'Jamaica',
  'Bay',
  'Reggae',
  'Golden',
  'Royal',
  'Neon',
  'Turbo',
  'Cosmic',
  'Shadow',
  'Rapid',
  'Lucky',
  'Elite',
  'Island',
  'Caribbean',
  'Solana',
  'Coral',
];

const CORE_WORDS = [
  'Runner',
  'Rider',
  'Coin',
  'Blazer',
  'Racer',
  'Treasure',
  'Hunter',
  'Chaser',
  'Pixel',
  'Rush',
  'Sprint',
  'Tap',
  'Puzzle',
  'Champion',
  'Legend',
  'Ace',
  'Strike',
  'Falcon',
  'Storm',
  'Wave',
];

const SUFFIX_WORDS = [
  'Runner',
  'Rider',
  'Chaser',
  'Blazer',
  'Hunter',
  'Champion',
  'Legend',
  'Ace',
  'Racer',
  'Master',
  'Captain',
  'Hero',
  'Speed',
  'Pro',
  'Star',
];

// Curated high-prestige combination templates
const SIGNATURE_COMBOS = [
  'PinnRunner',
  'MobayCoinChaser',
  'GoldenPinnRider',
  'PinnacleTurboAce',
  'JamaicaPixelRunner',
  'MontegoTreasureHunter',
  'RoyalMobayRacer',
  'NeonPinnChampion',
  'PinnRushLegend',
  'BayBlazer',
  'MobayRunner',
  'TurboRunner',
  'PixelRunner',
  'ReggaeRunner',
  'GoldenRunner',
  'TreasureHunter',
  'CoinRunner',
  'CosmicPinnRacer',
  'RapidBayBlazer',
  'LuckyMobayPro',
  'ElitePinnStriker',
  'ShadowPinnAce',
  'IslandCoinChaser',
];

/**
 * Deterministically seed random number generator from wallet address
 * so initial generated name is stable even before database persistence.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generate a themed username for a Solana wallet address.
 * Optionally uses numeric suffix (e.g. 482, 731).
 */
export function generateThemedUsername(walletAddress?: string, attemptIndex: number = 0): string {
  const seed = walletAddress ? hashString(walletAddress) + attemptIndex * 1337 : Math.floor(Math.random() * 1000000);
  
  // Choose format strategy
  const strategy = (seed + attemptIndex) % 4;

  let baseName = '';

  if (strategy === 0 && attemptIndex === 0) {
    // Curated signature combo
    const combo = SIGNATURE_COMBOS[seed % SIGNATURE_COMBOS.length];
    const num = ((seed * 7) % 899) + 100;
    baseName = `${combo}${num}`;
  } else if (strategy === 1) {
    // Prefix + Core + Suffix
    const p = PREFIX_WORDS[(seed + attemptIndex) % PREFIX_WORDS.length];
    const c = CORE_WORDS[(seed * 3 + attemptIndex) % CORE_WORDS.length];
    const s = SUFFIX_WORDS[(seed * 5 + attemptIndex) % SUFFIX_WORDS.length];
    // Avoid double words like RunnerRunner
    const finalSuffix = s === c ? 'Ace' : s;
    baseName = `${p}${c}${finalSuffix}`;
  } else if (strategy === 2) {
    // Prefix + Core + 2-3 digit number
    const p = PREFIX_WORDS[(seed + attemptIndex) % PREFIX_WORDS.length];
    const c = CORE_WORDS[(seed * 2 + attemptIndex) % CORE_WORDS.length];
    const num = ((seed + attemptIndex * 97) % 899) + 100;
    baseName = `${p}${c}${num}`;
  } else {
    // Signature combo with custom number
    const combo = SIGNATURE_COMBOS[(seed + attemptIndex) % SIGNATURE_COMBOS.length];
    if (attemptIndex > 0) {
      const num = ((seed + attemptIndex * 313) % 8999) + 1000;
      baseName = `${combo}${num}`;
    } else {
      const num = (seed % 2 === 0) ? `${((seed * 3) % 899) + 100}` : '';
      baseName = `${combo}${num}`;
    }
  }

  // Ensure clean alphanumeric, max 24 chars
  return baseName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
}
