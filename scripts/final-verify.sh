#!/usr/bin/env bash
# PINN achievements final verification — one shot
set -uo pipefail
echo "════════ RENAME INTEGRITY ════════"
BAD=$(grep -rn 'unlockedAchievementsMask\|unlocked_achievements_mask' tests/ src/ programs/ 2>/dev/null)
[[ -z "$BAD" ]] && echo "✅ no stale mask field names" || { echo "❌ stale refs:"; echo "$BAD"; }

BAD2=$(grep -rn 'playerState\b' tests/ src/ 2>/dev/null | grep -v 'findPlayerStatePda\|playerStatePda')
[[ -z "$BAD2" ]] && echo "✅ no stale playerState account keys" || { echo "⚠️  check:"; echo "$BAD2"; }

echo "════════ PASS 1 (fresh fixtures) ════════"
rm -rf tests/.fixtures
./scripts/run-devnet-tests.sh 2>&1 | tail -3

echo "════════ PASS 2 (cached fixtures — idempotency proof) ════════"
./scripts/run-devnet-tests.sh 2>&1 | tail -3

echo "════════ DONE — paste the two PASS tails above ════════"
