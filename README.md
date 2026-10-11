# PINN Arcade ($PINN) — Multi-Game Solana Gaming Ecosystem

**TAGLINE:** PLAY. COMPETE. EARN PINN.  
**OFFICIAL COMMUNITY:** [https://t.me/pinnja9](https://t.me/pinnja9)  
**BLOCKCHAIN:** Solana  
**TOKEN NAME:** The Pinnacle Montego Bay ($PINN)  
**MINT ADDRESS:** `6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump`  

---

## 1. Project Overview

PINN Arcade is a multi-game browser arcade ecosystem connected to **The Pinnacle Montego Bay ($PINN)** on Solana. Styled in luxury Montego Bay Jamaican aesthetics (obsidian black, metallic gold trims, Caribbean sunsets, swaying palms), it features **four fully playable arcade games**, an interactive game selection catalog, competitive leaderboards, community tournament modules, and future token utility roadmaps.

---

## 2. Playable Games Suite

### Game 1: PINN Coin Rush
- **Genre:** 2D Endless Action Runner.
- **Mechanics:** Running, double jumping, and crouching/sliding along the Montego Bay promenade.
- **Collectibles:** Gold $PINN medallion coins (+50 points each).
- **Hazards:** Coastal reef spikes, coconut crates, and overhead resort sunshades.
- **Controls:** Desktop keyboard (`Space`, `Arrows`, `WASD`) + Large on-screen mobile touch buttons and swipe gestures.
- **Scoring:** Local storage persistence for personal best, session high, coins, and distance.

### Game 2: PINN Treasure Hunt
- **Genre:** 2D Island Exploration & Maze Adventure.
- **Levels:** 10 progressively designed island levels (Doctor's Cave Key, Palm Key, Reef Runner, Corsair Labyrinth, The Pinnacle Vault, etc.).
- **Collectibles:** Gold coins (+25 pts) and locked treasure chests (+100 pts).
- **Hazards:** Spiked beach traps and patrolling island crabs.
- **Objective:** Gather all treasure chests on each island to unlock the escape yacht and advance to the next level.
- **Controls:** Virtual mobile D-pad + Desktop keyboard (`Arrows`, `WASD`).
- **Scoring:** Level completion bonuses, health bonuses, and local personal best saving.

### Game 3: PINN Puzzle Master
- **Genre:** Logic, Math & Pattern Recognition Challenge.
- **Question Pool:** 33 verified original questions across 4 categories (Number Sequences, Pattern Logic, Lateral Deduction, Crypto Math).
- **Tiers:** Easy (+100 pts), Medium (+200 pts), and Hard (+350 pts).
- **Mechanics:** 10 randomized questions per round, answer timer, streak multiplier (+25 pts per streak level), hint assistance, and speed completion bonus.
- **Scoring:** Detailed breakdown (accuracy, time, score) with local personal best tracking.

### Game 4: PINN Speed Tap
- **Genre:** 30-Second Reflex & Precision Sprint.
- **Mechanics:** 30-second rapid target arena.
- **Targets:** Gold Coins (+100 pts), Rare Diamonds (+250 pts), and Danger Skull Traps (-150 pts penalty).
- **Combo System:** Consecutive hits build combos up to 3x multiplier.
- **Controls:** Responsive touch and mouse tap input.
- **Scoring:** Hits, misses, traps hit, accuracy percentage, and local personal best storage.

---

## 3. Game Selection Hub (Games Page)

A dedicated game selection catalog (`/games`) featuring luxury Montego Bay cards for all four games with:
- Game title, category, and tagline.
- Custom artwork and illustration iconography.
- Difficulty indicators (Adaptive, Progressive, Multi-tier, Reflex Sprint).
- Real-time personal best scores loaded from browser `localStorage`.
- Direct "Play Now" action buttons.

---

## 4. Ecosystem & Platform Features

- **Token Information Section & Page:**
  - Token Name: The Pinnacle Montego Bay ($PINN) on Solana.
  - One-click copy for the official mint address: `6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump`.
  - Direct explorer verification via Solscan.
- **Official Telegram Integration:**
  - All community actions across Navbar, Hero, Games catalog, Leaderboard, Rewards, and Footer strictly point to `https://t.me/pinnja9`.
- **Global Leaderboard:**
  - Top 10 rankings, All-Time vs. Weekly filters, verified badges, and local score comparison.
- **Tournament Rewards:**
  - Sections A through F: How to Participate (5 steps), active competitions, reward pool disclosures, verified winner records, and a live Solscan transaction signature validator.
- **Solana Wallet Connection:**
  - Non-custodial connection supporting Phantom and Solflare with an instant demonstration mode. All four games remain 100% free-to-play without connecting a wallet.
- **Audio Synthesizer:**
  - Native Web Audio API synthesizer for retro arcade chimes, coins, steps, and hits (zero external audio file dependencies).

---

## 5. Running & Testing

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Run TypeScript check and production build
npm run build
npm run preview
```

### Mobile Testing Instructions
1. Run `npm run dev -- --host`.
2. Connect to the displayed network IP address on your smartphone.
3. Test all 4 games:
   - **Coin Rush:** Tap `JUMP (2X)` and `SLIDE` buttons or swipe vertically on canvas.
   - **Treasure Hunt:** Use the virtual on-screen D-Pad to move your explorer across island levels.
   - **Puzzle Master:** Tap multiple-choice options with instant feedback and answer explanations.
   - **Speed Tap:** Tap spawning coins and diamonds across the 30-second arena.
