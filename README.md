# PINN Arcade ($PINN) — Solana Meme Coin Gaming Ecosystem

**TAGLINE:** PLAY. COMPETE. EARN PINN.  
**OFFICIAL COMMUNITY:** [https://t.me/pinnja9](https://t.me/pinnja9)  
**BLOCKCHAIN:** Solana  
**TOKEN NAME:** The Pinnacle Montego Bay ($PINN)  
**MINT ADDRESS:** `6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump`  

---

## 1. Project Overview

PINN Arcade is a complete, responsive browser-based gaming ecosystem connected to **The Pinnacle Montego Bay ($PINN)** on the Solana blockchain. It combines luxury Jamaican resort aesthetics (black obsidian, metallic gold accents, Caribbean sunset backdrops, tropical palms) with a fast-paced 2D arcade runner game called **PINN Coin Rush**, competitive leaderboards, community tournament modules, and future token utility roadmaps.

---

## 2. Features Working Immediately

- **Playable 2D HTML5 Canvas Arcade Game (PINN Coin Rush):**
  - Smooth parallax background (Caribbean twilight sky, Jamaican mountains, luxury resort penthouses, ocean promenade).
  - Controllable player character with running animations, jumping, mid-air double jump, and crouching slide.
  - Collectible gold $PINN medallion coins with 3D rotation, sparkle particles, and +50 score rewards.
  - Multiple obstacle hazards (sharp reef spikes, tropical coconut crates, overhead sun awnings).
  - Progressive difficulty scaling: speed increases as distance accumulates.
  - Native Web Audio synthesizer for arcade sound effects (jump whoosh, coin chime, collision sound, game over fanfare, click).
  - Persistent audio mute/unmute toggle.
  - Comprehensive collision detection and game-over breakdown.
  - Celebration confetti on setting a new personal best score.
  - Pause and resume controls with overlay.
  - Desktop keyboard controls (Arrow Keys, WASD, Spacebar, P/Esc).
  - Mobile touch controls (Large on-screen Jump and Slide buttons, canvas swipe gestures, and scroll prevention).
- **Local High-Score System:**
  - Persists player's personal best, session high score, total games played, and total coins in `localStorage`.
  - Player display name customization with real-time saving.
- **Global Leaderboard Interface:**
  - Top 10 rankings with Gold, Silver, Bronze emblems.
  - All-Time and Weekly sprint filters.
  - Clear labeling of demonstration benchmark entries (`DEMO BENCHMARK`) vs player's verified local record.
  - Pluggable backend service interface ready for external database integration.
- **Rewards System:**
  - Section A: How to Participate (5-step guide).
  - Section B: Community Competitions (Active competition cards, rules, eligibility).
  - Section C: Reward Pool details.
  - Section D: Verified Winners section with demonstration records.
  - Section E: Solscan Transaction Signature lookup and verification link.
  - Section F: Reward Rules and financial risk disclaimers.
- **Solana Wallet Connection:**
  - Optional connection module detecting Phantom or Solflare browser extensions.
  - Built-in Demo Solana wallet mode for testing without requiring extensions.
  - Display and one-click copy of connected public address.
  - Disconnect action.
  - Zero-trust security guarantee: never requests private keys, passwords, or seed phrases.
  - 100% free-to-play: wallet is never required to play the game.
- **Token Contract Section:**
  - Verified SPL token details for The Pinnacle Montego Bay ($PINN).
  - One-click copy for the exact mint address (`6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump`).
  - Direct explorer link to Solscan.
- **Official Telegram Integration:**
  - Centralized official group URL: `https://t.me/pinnja9` integrated in Header, Hero, Game page, Leaderboard page, Rewards page, About page, and Footer.
- **About, Terms of Use, and Privacy Policy Pages:**
  - Project vision and Montego Bay background.
  - Comprehensive Game Rules, anti-cheating policy, and cryptocurrency volatility disclaimers.
  - Non-custodial transparency and local storage disclosure.
- **Centralized Project Configuration:**
  - `src/config/pinnConfig.ts` controls all addresses, links, competition dates, and disclaimers in a single location.

---

## 3. Features Requiring Additional Configuration for Production

1. **Production Global Leaderboard Backend:**
   - The current build stores player scores in browser `localStorage` and provides a modular service in `src/services/leaderboardService.ts`.
   - In production, configure an authenticated server (e.g. Node.js/Express, Firebase Firestore, or Cloud SQL) to validate signed telemetry and prevent local score manipulation.
2. **Automated Tournament Reward Distribution:**
   - Initial tournament prizes are distributed manually by administrators via Solana transactions. Automated smart-contract prize vaults or escrow accounts require audited Solana programs (Anchor / Rust).
3. **Future $PINN Token Utility:**
   - Features such as NFT skin minting, cosmetic upgrades, and token staking are marked as `PLANNED` in the roadmap.

---

## 4. Setup & Running the Application

### Development Server:
```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev
```

### Production Build:
```bash
npm run build
npm run preview
```

---

## 5. Instructions for Testing the Game on Mobile Phones

1. **Local Network Testing:**
   - Start the Vite development server: `npm run dev -- --host`.
   - Note the Network URL printed in your terminal (e.g., `http://192.168.1.X:3000`).
   - Open that URL on your mobile browser (Safari on iPhone, Chrome on Android).
2. **Touch Controls Verification:**
   - Launch PINN Coin Rush by tapping **PLAY NOW**.
   - Tap the on-screen **JUMP (2X)** button to leap over low coral spikes.
   - Tap **JUMP** a second time while in the air to test double jumping.
   - Tap the on-screen **SLIDE** button to duck under overhead resort awnings.
   - Test swipe gestures: swipe upward directly on the canvas to jump; swipe downward to slide.
   - Verify that touch interactions do not trigger unwanted page scrolling or zoom gestures.

---

## 6. Instructions for Publishing the Application

1. **Vercel / Netlify / Cloudflare Pages:**
   - Connect your GitHub repository to your hosting provider.
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Node.js version: `18.x` or `20.x`
2. **Google Cloud Run (Full-Stack / Containerized):**
   - Build Docker container using Node 20 alpine image.
   - Expose port `3000` (or `PORT` environment variable).
   - Deploy container to Cloud Run with standard autoscaling.

---

## 7. Connecting a Real Backend Leaderboard Later

To replace the demonstration scores with a tamper-proof backend database:

1. **Step 1: Set up the API Endpoint**
   - Create an endpoint `POST /api/scores` that accepts `{ displayName, score, coins, signature, telemetry }`.
2. **Step 2: Implement Anti-Cheat Telemetry Validation**
   - In `PinnCoinRush.tsx`, package the game session log (run time, obstacle spawn seed, collision verification timestamps) and send it with the score.
   - On the backend, re-calculate the theoretical maximum score possible for that run time and speed curve before accepting it into the database.
3. **Step 3: Update `src/services/leaderboardService.ts`**
   - In `getLeaderboard()`, replace the demo array return with a `fetch('/api/leaderboard?period=' + period)`.
   - In `submitScoreToBackend()`, execute `fetch('/api/scores', { method: 'POST', body: JSON.stringify(...) })`.
