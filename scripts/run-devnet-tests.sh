#!/usr/bin/env bash
set -euo pipefail

# Load .env if present
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# 1. Verify environment variables (ANCHOR_PROVIDER_URL and DEVNET_DAS_RPC_URL)
if [ -z "${ANCHOR_PROVIDER_URL:-}" ]; then
  if [ -n "${HELIUS_API_KEY:-}" ]; then
    export ANCHOR_PROVIDER_URL="https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}"
  else
    echo "Error: ANCHOR_PROVIDER_URL (or HELIUS_API_KEY) is not set." >&2
    exit 1
  fi
fi

export DEVNET_DAS_RPC_URL="${DEVNET_DAS_RPC_URL:-$ANCHOR_PROVIDER_URL}"
export ANCHOR_WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"

if [[ "$DEVNET_DAS_RPC_URL" == *"api.devnet.solana.com"* ]]; then
  echo "Error: DAS-enabled RPC required (e.g. Helius Devnet). Public api.devnet.solana.com does not support DAS." >&2
  exit 1
fi

echo "=== 1. Environment Check ==="
echo "ANCHOR_PROVIDER_URL configured (DAS RPC active)"
solana config get

# 2. Verify wallet is funded (>= 5 SOL)
echo "=== 2. Wallet Balance Check ==="
MIN_SOL=5
if [ ! -f "$ANCHOR_WALLET" ]; then
  echo "Error: Anchor wallet keypair not found at $ANCHOR_WALLET" >&2
  exit 1
fi

BALANCE=$(solana balance --keypair "$ANCHOR_WALLET" --url "$ANCHOR_PROVIDER_URL" | awk '{print $1}')
echo "Wallet: $(solana address -k "$ANCHOR_WALLET") | Balance: ${BALANCE} SOL"

if awk "BEGIN {exit !($BALANCE < $MIN_SOL)}"; then
  echo "Error: Insufficient Devnet SOL (${BALANCE} SOL < ${MIN_SOL} SOL)." >&2
  echo "Top up with: solana airdrop 2 --url \"\$ANCHOR_PROVIDER_URL\" or https://faucet.solana.com/" >&2
  exit 1
fi

# 3. Sync and verify program IDs
echo "=== 3. Syncing Program Keys ==="
anchor keys sync
anchor keys list
grep 'declare_id' programs/pinn_achievements/src/lib.rs

# 4. Verify Cargo.toml has CPI features enabled
echo "=== 4. Checking Cargo.toml CPI Features ==="
grep -A2 'mpl-bubblegum' programs/pinn_achievements/Cargo.toml

# 5. Verify test file exists with polling helpers
echo "=== 5. Checking Test Spec ==="
ls -la tests/pinn-achievements.devnet.spec.ts

# 6. Verify .gitignore protects secrets and test artifacts
echo "=== 6. Checking .gitignore ==="
grep -E '^(\.env|tests/\.fixtures/)' .gitignore

# 7. Build, verify IDL instructions, deploy, and run Devnet test suite
echo "=== 7. Building, Deploying & Running Devnet Tests ==="
anchor build

if [ -f target/idl/pinn_achievements.json ]; then
  echo "IDL Instructions:"
  jq '.instructions[].name' target/idl/pinn_achievements.json
fi

anchor deploy \
  --provider.cluster devnet \
  --provider.url "$ANCHOR_PROVIDER_URL" \
  --provider.wallet "$ANCHOR_WALLET"

npx ts-mocha -p ./tsconfig.json -t 120000 tests/pinn-achievements.devnet.spec.ts
