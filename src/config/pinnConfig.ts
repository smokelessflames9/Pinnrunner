/**
 * Centralized Configuration for PINN Arcade
 * Official project settings connected to The Pinnacle Montego Bay ($PINN) on Solana.
 * All settings are accessible and can be modified without rewriting the application.
 */

export const PINN_CONFIG = {
  // Official Project Identity
  PROJECT_NAME: "PINN Arcade",
  TOKEN_NAME: "The Pinnacle Montego Bay",
  TOKEN_SYMBOL: "PINN",
  BLOCKCHAIN: "Solana",
  TOKEN_MINT_ADDRESS: "6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump",
  OFFICIAL_TELEGRAM_URL: "https://t.me/+B1Wz7pu8zJdlOGYx",
  TAGLINE: "PLAY. COMPETE. EARN PINN.",

  // External Block Explorer URLs
  SOLSCAN_TOKEN_URL: "https://solscan.io/token/6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump",
  SOLSCAN_TX_BASE_URL: "https://solscan.io/tx/",

  // Active / Upcoming Competition Configuration
  // If no competition is active, set IS_ACTIVE to false
  COMPETITION: {
    IS_ACTIVE: true,
    TITLE: "Montego Bay Sprint: Season 1 Open",
    START_DATE: "October 10, 2026",
    END_DATE: "October 24, 2026",
    STATUS: "Active", // "Active" | "Upcoming" | "Completed" | "None"
    RULES: [
      "Play PINN Coin Rush in browser (mobile or desktop).",
      "Only scores achieved during the official competition window qualify.",
      "Scores must be submitted with a valid player display name.",
      "Suspected automated botting or speed-hacking will lead to disqualification.",
      "Top 10 players will be verified and announced in the official Telegram community."
    ],
    ELIGIBILITY_REQUIREMENTS: [
      "Open to all players worldwide free of charge. No entry fee required.",
      "No mandatory token balance required to participate in the game.",
      "Must join the official Telegram community (https://t.me/+B1Wz7pu8zJdlOGYx) to claim prizes if placing top 10.",
      "Players must be at least 18 years of age or the legal age of majority in their jurisdiction."
    ],
    REWARD_POOL_INFORMATION: "Community-sponsored prize pool allocated by project administration for verified top finishers. Detailed prize tier breakdowns are announced inside the official Telegram channel.",
    REWARD_DISTRIBUTION_INFORMATION: "Rewards are distributed manually by authorized project administrators directly to verified winners' Solana addresses. Transaction hashes will be published publicly on Solscan."
  },

  // Future Token Utility items (all marked as PLANNED)
  PLANNED_UTILITIES: [
    {
      title: "Exclusive Montego Bay Cosmetics",
      status: "PLANNED",
      description: "Optional custom runner skins, Caribbean luxury resort outfits, and golden trail animations."
    },
    {
      title: "Digital Arcade Collectibles",
      status: "PLANNED",
      description: "Commemorative milestone trophies and seasonal badges for tournament participants."
    },
    {
      title: "Community Tournament Entry",
      status: "PLANNED",
      description: "Special high-stakes tournaments organized by and for the $PINN community."
    },
    {
      title: "Arcade Expansion Pack",
      status: "PLANNED",
      description: "New mini-games inspired by Jamaican island adventures and Montego Bay watersports."
    }
  ],

  // Disclaimers & Legal Notes
  WEBSITE_DISCLAIMER: "PINN Arcade and the game PINN Coin Rush are free-to-play entertainment experiences. In-game gold coins are virtual game points and do not represent or transfer real cryptocurrency. Cryptocurrency prices are highly volatile and market participation carries substantial risk. Neither playing the game nor holding $PINN guarantees financial profit or returns.",
  LOCAL_SCORE_DISCLAIMER: "Scores stored in this browser session are for personal local record-keeping and convenience. They do not constitute tamper-proof or verified global tournament entries until processed by a future backend validation service.",

  // Editable Policy Placeholders for the "Game Rules & Rewards" Page
  // Unconfirmed policy items are explicitly marked as "Details to be announced."
  GAME_RULES_PLACEHOLDERS: {
    EFFECTIVE_DATE: "Details to be announced.",
    LEADERBOARD_RESET_SCHEDULE: "Details to be announced.",
    LEADERBOARD_TIE_BREAK_RULES: "Details to be announced.",
    ELIGIBLE_PLAYERS_AND_REGIONS: "Details to be announced.",
    MINIMUM_ELIGIBILITY_REQUIREMENTS: "Details to be announced.",
    REWARD_AMOUNTS_OR_PRIZE_POOL: "Details to be announced.",
    CLAIM_LIMITS_AND_CLAIM_WINDOWS: "Details to be announced.",
    REWARD_REVIEW_AND_PROCESSING_TIMES: "Details to be announced.",
    TIE_BREAK_AND_DISPUTE_RULES: "Details to be announced.",
    OFFICIAL_SUPPORT_CONTACT: "Details to be announced."
  }
} as const;

