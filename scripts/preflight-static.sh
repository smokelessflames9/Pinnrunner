#!/usr/bin/env bash
# Save as scripts/preflight-static.sh, chmod +x, run it.
set -uo pipefail
P=programs/pinn_achievements/src/lib.rs
M=src/solana/achievementMinter.ts
S=tests/pinn-achievements.devnet.spec.ts
C=programs/pinn_achievements/Cargo.toml
fail=0
chk() { local msg="$1"; shift; if eval "$@"; then echo "✅ $msg"; else echo "❌ $msg"; fail=1; fi; }

# ── Rust ─────────────────────────────────────────────────────────────────
chk "UnlockAchievementArgs has exactly 3 fields (no metadata_uri)" \
  '[ "$(grep -c "    pub " <<< "$(grep -A10 "pub struct UnlockAchievementArgs" $P)")" = "3" ]'
chk "Rust: collection_authority_record account present" \
  "grep -q 'pub collection_authority_record' $P"
chk "Rust: CPI uses Some(record) not None" \
  "grep -q 'collection_authority_record_pda(Some' $P && ! grep -q 'collection_authority_record_pda(None' $P"
chk "Rust: oracle is mut (H1 payer)" \
  "grep -B1 'pub achievement_oracle' $P | grep -q 'mut'"
chk "Rust: length guards before CPI" \
  "grep -q 'NameTooLong' $P && grep -q 'UriTooLong' $P"
chk "Rust: bit_index guard" \
  "grep -q 'InvalidBitIndex' $P"
chk "Rust: 4 program-ID address constraints (C2)" \
  '[ "$(grep -c "address = .*ID @" $P)" -ge 4 ]'
chk "Rust: config PDA + UnauthorizedOracle check" \
  "grep -q 'seeds = \[b\"config\"\]' $P && grep -q 'UnauthorizedOracle' $P"

# ── Minter ───────────────────────────────────────────────────────────────
chk "Minter: routes through program.methods.unlockAchievement" \
  "grep -q 'program.methods' $M && grep -q '\.unlockAchievement' $M"
chk "Minter: does NOT call mintToCollectionV1" \
  "! grep -q 'mintToCollectionV1' $M"
chk "Minter: passes collectionAuthorityRecord in accounts map" \
  "grep -q 'collectionAuthorityRecord' $M"
chk "Minter: pre-flight checks config.oracle_authority" \
  "grep -q 'config.oracle_authority\|cfg.oracleAuthority' $M"

# ── Spec ─────────────────────────────────────────────────────────────────
chk "Spec: uses waitForDasAssetByName (not waitForDasAsset)" \
  "grep -q 'waitForDasAssetByName' $S && ! grep -qE '\bwaitForDasAsset\(' $S"
chk "Spec: call sites use playerSigner (not playerWalletAddress)" \
  "grep -q 'playerSigner:' $S && ! grep -q 'playerWalletAddress:' $S"
chk "Spec: asserts res.signature" \
  "grep -q 'res.signature' $S"
chk "Spec: ensureTree sets treeDelegate = achvAuthority" \
  "grep -q 'treeDelegate' $S"
chk "Spec: ensureCollection calls approveCollectionAuthority" \
  "grep -q 'approveCollectionAuthority' $S"
chk "Spec: idempotency checks record PDA existence" \
  "grep -qE 'recordPda|recordAcct|collectionAuthorityRecord' $S"
chk "Spec: refuses public devnet RPC" \
  "grep -q 'api.devnet.solana.com' $S"

# ── Cargo & gitignore ────────────────────────────────────────────────────
chk "Cargo: mpl-bubblegum has cpi feature" \
  "grep -q 'mpl-bubblegum.*features.*cpi' $C"
chk "Cargo: spl-account-compression has cpi feature" \
  "grep -q 'spl-account-compression.*features.*cpi' $C"
chk "Cargo: mpl-token-metadata has cpi feature" \
  "grep -q 'mpl-token-metadata.*features.*cpi' $C"
chk "Cargo: anchor-lang has init-if-needed" \
  "grep -q 'anchor-lang.*init-if-needed' $C"
chk ".gitignore: tests/.fixtures/ ignored" \
  "grep -q '^tests/\.fixtures/' .gitignore"
chk ".gitignore: .env ignored" \
  "grep -q '^\.env' .gitignore"

echo
[[ $fail = 0 ]] && echo "🎉 All static checks pass — safe to leave the container." \
               || echo "⚠️  Fix the ❌ items above before running locally."
exit $fail
