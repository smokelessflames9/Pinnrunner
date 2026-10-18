-- =========================================================================
-- PINN ARCADE: AUTHORITATIVE PLAYER COIN SYSTEM & WITHDRAWAL REQUESTS
-- Migration: 20261017_coin_system_and_withdrawals.sql
-- =========================================================================

-- 1. Create or upgrade public.coin_ledger for authoritative per-game coin earnings
create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  player_id uuid references public.player_profiles(id) on delete cascade,
  wallet_address text,
  game_id text not null default 'coin-rush' check (game_id in ('coin-rush', 'treasure-hunt', 'puzzle-master', 'speed-tap')),
  session_id text unique,
  score_id uuid references public.scores(id) on delete set null,
  amount integer not null check (amount >= 0),
  balance_after integer not null default 0,
  entry_type text not null default 'game_reward' check (entry_type in ('game_reward', 'admin_adjustment', 'withdrawal_hold', 'withdrawal_release', 'withdrawal_paid')),
  status text not null default 'eligible' check (status in ('eligible', 'pending', 'rejected', 'void')),
  description text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure columns exist if coin_ledger was created by an earlier migration
alter table public.coin_ledger add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.coin_ledger add column if not exists game_id text not null default 'coin-rush';
alter table public.coin_ledger add column if not exists session_id text;
alter table public.coin_ledger add column if not exists score_id uuid references public.scores(id) on delete set null;
alter table public.coin_ledger add column if not exists status text not null default 'eligible';

create unique index if not exists idx_coin_ledger_session_id on public.coin_ledger (session_id) where session_id is not null;
create index if not exists idx_coin_ledger_user_id on public.coin_ledger (user_id);
create index if not exists idx_coin_ledger_wallet on public.coin_ledger (lower(wallet_address));
create index if not exists idx_coin_ledger_game_status on public.coin_ledger (game_id, status);

-- 2. Create public.withdrawal_requests table for player PINN coin withdrawals
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  player_id uuid references public.player_profiles(id) on delete set null,
  player_name text not null default 'Player',
  wallet_address text not null,
  amount_coins bigint not null check (amount_coins >= 10000),
  amount_raw text not null,
  token_decimals integer not null default 6,
  token_mint text not null default '6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump',
  status text not null default 'pending' check (status in ('pending', 'approved', 'processing', 'rejected', 'completed', 'paid', 'cancelled')),
  admin_notes text default '',
  rejection_reason text default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamp with time zone,
  tx_signature text unique,
  verified_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_withdrawal_requests_user on public.withdrawal_requests (user_id);
create index if not exists idx_withdrawal_requests_wallet on public.withdrawal_requests (lower(wallet_address));
create index if not exists idx_withdrawal_requests_status on public.withdrawal_requests (status);
create unique index if not exists idx_withdrawal_requests_tx_sig on public.withdrawal_requests (tx_signature) where tx_signature is not null;

-- 3. Enable RLS on coin_ledger and withdrawal_requests
alter table public.coin_ledger enable row level security;
alter table public.withdrawal_requests enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "Users can read own coin ledger" on public.coin_ledger;
drop policy if exists "Admins can read all coin ledger" on public.coin_ledger;
drop policy if exists "Users can read own withdrawal requests" on public.withdrawal_requests;
drop policy if exists "Users can insert own withdrawal requests" on public.withdrawal_requests;
drop policy if exists "Admins can read all withdrawal requests" on public.withdrawal_requests;
drop policy if exists "Admins can update withdrawal requests" on public.withdrawal_requests;

-- Coin ledger RLS policies (strictly authenticated owner or admin)
create policy "Users can read own coin ledger"
  on public.coin_ledger
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

create policy "Admins can read all coin ledger"
  on public.coin_ledger
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Withdrawal requests RLS policies (strictly authenticated owner or admin; inserts go through atomic RPC or service_role)
create policy "Users can read own withdrawal requests"
  on public.withdrawal_requests
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

create policy "Admins can read all withdrawal requests"
  on public.withdrawal_requests
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can update withdrawal requests"
  on public.withdrawal_requests
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4. Authoritative RPC Function: Calculate a player's verified per-game & combined coin totals + withdrawal reservations
-- Enforces caller ownership unless invoked by an admin or service_role.
-- Only counts verified scores (status = 'verified') and eligible ledger entries (status = 'eligible'),
-- deduplicated by session_id so the same gameplay run is never counted twice.
create or replace function public.get_player_coin_summary(
  p_user_id uuid default null,
  p_wallet_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_uid uuid := auth.uid();
  v_caller_role text := current_setting('request.jwt.claim.role', true);
  v_uid uuid := coalesce(p_user_id, v_caller_uid);
  v_wallet text := nullif(lower(trim(coalesce(p_wallet_address, ''))), '');
  v_coin_rush bigint := 0;
  v_treasure_hunt bigint := 0;
  v_puzzle_master bigint := 0;
  v_speed_tap bigint := 0;
  v_total_collected bigint := 0;
  v_eligible_earnings bigint := 0;
  v_paid_total bigint := 0;
  v_reserved_amount bigint := 0;
  v_available_balance bigint := 0;
begin
  -- Ownership & authorization check: if called by a regular authenticated user, they can only query their own user_id
  if v_caller_role is distinct from 'service_role' and not public.is_admin() then
    if v_caller_uid is null then
      raise exception 'Authentication required to query player coin summary.';
    end if;
    if p_user_id is not null and p_user_id != v_caller_uid then
      raise exception 'Access denied: cannot query another player''s coin balance.';
    end if;
    v_uid := v_caller_uid;
    -- Resolve linked wallet from player_profiles if not matching
    if v_wallet is not null then
      if not exists (
        select 1 from public.player_profiles
        where auth_user_id = v_caller_uid and lower(wallet_address) = v_wallet
      ) and not exists (
        select 1 from public.scores
        where user_id = v_caller_uid and lower(wallet_address) = v_wallet
      ) then
        v_wallet := null;
      end if;
    end if;
  end if;

  if v_uid is null and v_wallet is null then
    return jsonb_build_object(
      'coinRushCoins', 0,
      'treasureHuntCoins', 0,
      'puzzleMasterCoins', 0,
      'speedTapCoins', 0,
      'totalCoinsCollected', 0,
      'eligibleEarnings', 0,
      'paidTotal', 0,
      'reservedAmount', 0,
      'availableBalance', 0
    );
  end if;

  -- Sum verified/eligible coins per game without double-counting sessions across scores and coin_ledger
  with combined_runs as (
    select
      s.game_id,
      coalesce(nullif(s.session_id, ''), 'score_' || s.id::text) as run_key,
      max(coalesce(s.coins, 0))::bigint as coins
    from public.scores s
    where s.status = 'verified'
      and s.coins > 0
      and (
        (v_uid is not null and s.user_id = v_uid)
        or (v_wallet is not null and lower(s.wallet_address) = v_wallet)
      )
    group by s.game_id, coalesce(nullif(s.session_id, ''), 'score_' || s.id::text)

    union all

    select
      cl.game_id,
      coalesce(nullif(cl.session_id, ''), 'ledger_' || cl.id::text) as run_key,
      max(coalesce(cl.amount, 0))::bigint as coins
    from public.coin_ledger cl
    where cl.entry_type = 'game_reward'
      and cl.status = 'eligible'
      and cl.amount > 0
      and (
        (v_uid is not null and cl.user_id = v_uid)
        or (v_wallet is not null and lower(cl.wallet_address) = v_wallet)
      )
      and not exists (
        select 1
        from public.scores s2
        where s2.status = 'verified'
          and s2.session_id is not null
          and s2.session_id = cl.session_id
      )
    group by cl.game_id, coalesce(nullif(cl.session_id, ''), 'ledger_' || cl.id::text)
  ),
  deduped_runs as (
    select game_id, run_key, max(coins)::bigint as coins
    from combined_runs
    group by game_id, run_key
  )
  select
    coalesce(sum(case when game_id = 'coin-rush' then coins else 0 end), 0)::bigint,
    coalesce(sum(case when game_id = 'treasure-hunt' then coins else 0 end), 0)::bigint,
    coalesce(sum(case when game_id = 'puzzle-master' then coins else 0 end), 0)::bigint,
    coalesce(sum(case when game_id = 'speed-tap' then coins else 0 end), 0)::bigint
  into
    v_coin_rush,
    v_treasure_hunt,
    v_puzzle_master,
    v_speed_tap
  from deduped_runs;

  v_total_collected := v_coin_rush + v_treasure_hunt + v_puzzle_master + v_speed_tap;
  v_eligible_earnings := v_total_collected;

  -- Calculate paid and reserved withdrawal amounts
  select
    coalesce(sum(case when w.status in ('completed', 'paid') then w.amount_coins else 0 end), 0)::bigint,
    coalesce(sum(case when w.status in ('pending', 'approved', 'processing') then w.amount_coins else 0 end), 0)::bigint
  into
    v_paid_total,
    v_reserved_amount
  from public.withdrawal_requests w
  where (v_uid is not null and w.user_id = v_uid)
     or (v_wallet is not null and lower(w.wallet_address) = v_wallet);

  v_available_balance := greatest(0, v_eligible_earnings - v_paid_total - v_reserved_amount);

  return jsonb_build_object(
    'coinRushCoins', v_coin_rush,
    'treasureHuntCoins', v_treasure_hunt,
    'puzzleMasterCoins', v_puzzle_master,
    'speedTapCoins', v_speed_tap,
    'totalCoinsCollected', v_total_collected,
    'eligibleEarnings', v_eligible_earnings,
    'paidTotal', v_paid_total,
    'reservedAmount', v_reserved_amount,
    'availableBalance', v_available_balance
  );
end;
$$;

-- 5. Atomic Concurrency-Safe Withdrawal Submission Function
-- Uses pg_advisory_xact_lock per player identity to prevent overlapping concurrent requests from overdrawing.
create or replace function public.submit_withdrawal_request(
  p_user_id uuid,
  p_player_name text,
  p_wallet_address text,
  p_amount_coins bigint,
  p_token_decimals integer default 6,
  p_token_mint text default '6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_uid uuid := auth.uid();
  v_caller_role text := current_setting('request.jwt.claim.role', true);
  v_uid uuid := coalesce(p_user_id, v_caller_uid);
  v_clean_wallet text := trim(coalesce(p_wallet_address, ''));
  v_summary jsonb;
  v_available bigint;
  v_raw_amount text;
  v_new_id uuid;
  v_lock_key text;
begin
  -- Verify caller ownership unless invoked by service_role
  if v_caller_role is distinct from 'service_role' then
    if v_caller_uid is null then
      return jsonb_build_object('success', false, 'error', 'Authentication required to submit a withdrawal request.');
    end if;
    if p_user_id is not null and p_user_id != v_caller_uid then
      return jsonb_build_object('success', false, 'error', 'Unauthorized: user ID mismatch.');
    end if;
    v_uid := v_caller_uid;
  end if;

  if p_amount_coins is null or p_amount_coins < 10000 then
    return jsonb_build_object(
      'success', false,
      'error', 'Minimum withdrawal is 10,000 eligible available PINN coins.'
    );
  end if;

  if length(v_clean_wallet) < 32 or length(v_clean_wallet) > 44 then
    return jsonb_build_object(
      'success', false,
      'error', 'Invalid destination Solana wallet address.'
    );
  end if;

  -- Acquire transaction-level advisory lock keyed on player identity & wallet to serialize concurrent withdrawal attempts
  v_lock_key := 'pinn_withdraw_' || coalesce(v_uid::text, '') || '_' || lower(v_clean_wallet);
  perform pg_advisory_xact_lock(hashtext(v_lock_key));

  -- Recompute authoritative summary inside the lock
  v_summary := public.get_player_coin_summary(v_uid, v_clean_wallet);
  v_available := (v_summary->>'availableBalance')::bigint;

  if p_amount_coins > v_available then
    return jsonb_build_object(
      'success', false,
      'error', format('Requested amount (%s) exceeds available eligible balance (%s).', p_amount_coins, v_available),
      'availableBalance', v_available
    );
  end if;

  -- Compute exact raw integer units: amount_coins * (10 ^ token_decimals)
  v_raw_amount := (p_amount_coins::numeric * (10::numeric ^ p_token_decimals))::bigint::text;

  insert into public.withdrawal_requests (
    user_id,
    player_name,
    wallet_address,
    amount_coins,
    amount_raw,
    token_decimals,
    token_mint,
    status
  ) values (
    v_uid,
    coalesce(nullif(trim(p_player_name), ''), 'Player'),
    v_clean_wallet,
    p_amount_coins,
    v_raw_amount,
    p_token_decimals,
    p_token_mint,
    'pending'
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'success', true,
    'requestId', v_new_id,
    'amountCoins', p_amount_coins,
    'amountRaw', v_raw_amount,
    'destinationWallet', v_clean_wallet,
    'status', 'pending',
    'newAvailableBalance', (v_available - p_amount_coins)
  );
end;
$$;

-- 6. Atomic Concurrency-Safe Withdrawal Payout Settlement Function
-- Locks the withdrawal_requests row FOR UPDATE, prevents duplicate settlement or signature reuse,
-- marks withdrawal status as 'paid', and inserts the corresponding verified row into public.payment_records.
create or replace function public.admin_settle_withdrawal(
  p_request_id uuid,
  p_tx_signature text,
  p_token_mint text default '6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump',
  p_note text default 'Verified Solana on-chain withdrawal payout.'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_role text := current_setting('request.jwt.claim.role', true);
  v_withdrawal record;
  v_existing_payment_id uuid;
  v_existing_withdrawal_id uuid;
  v_payment_id uuid;
  v_clean_sig text := trim(coalesce(p_tx_signature, ''));
  v_now timestamp with time zone := timezone('utc'::text, now());
begin
  if v_caller_role is distinct from 'service_role' and not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Administrator authorization required.');
  end if;

  if length(v_clean_sig) < 64 then
    return jsonb_build_object('success', false, 'error', 'Invalid Solana transaction signature.');
  end if;

  -- Lock the withdrawal request row FOR UPDATE to prevent concurrent double-settlement
  select *
  into v_withdrawal
  from public.withdrawal_requests
  where id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Withdrawal request not found.');
  end if;

  if v_withdrawal.status in ('paid', 'completed') then
    return jsonb_build_object('success', false, 'error', 'Withdrawal request has already been settled and marked Paid.');
  end if;

  if v_withdrawal.status in ('rejected', 'cancelled') then
    return jsonb_build_object('success', false, 'error', format('Cannot settle a withdrawal request with status "%s".', v_withdrawal.status));
  end if;

  -- Check signature replay in withdrawal_requests
  select id into v_existing_withdrawal_id
  from public.withdrawal_requests
  where tx_signature = v_clean_sig and id != p_request_id
  limit 1;

  if v_existing_withdrawal_id is not null then
    return jsonb_build_object('success', false, 'error', 'DUPLICATE REJECTED: Transaction signature is already associated with another withdrawal request.');
  end if;

  -- Check signature replay in payment_records
  select id into v_existing_payment_id
  from public.payment_records
  where tx_signature = v_clean_sig
  limit 1;

  if v_existing_payment_id is not null then
    return jsonb_build_object('success', false, 'error', 'DUPLICATE REJECTED: Transaction signature has already been recorded in payment_records.');
  end if;

  -- Atomically update withdrawal_requests to 'paid'
  update public.withdrawal_requests
  set
    status = 'paid',
    tx_signature = v_clean_sig,
    verified_at = v_now,
    admin_notes = coalesce(nullif(trim(p_note), ''), admin_notes),
    updated_at = v_now
  where id = p_request_id;

  -- Atomically insert audit record into payment_records
  insert into public.payment_records (
    reward_request_id,
    tournament_id,
    user_id,
    player_name,
    wallet_address,
    amount,
    token_mint,
    tx_signature,
    status,
    is_verified_on_chain,
    verified_at,
    note,
    created_at
  ) values (
    null,
    null,
    v_withdrawal.user_id,
    v_withdrawal.player_name,
    v_withdrawal.wallet_address,
    format('%s $PINN', to_char(v_withdrawal.amount_coins, 'FM999,999,999,999')),
    p_token_mint,
    v_clean_sig,
    'verified_paid',
    true,
    v_now,
    coalesce(nullif(trim(p_note), ''), 'Verified Solana on-chain withdrawal payout.'),
    v_now
  )
  returning id into v_payment_id;

  return jsonb_build_object(
    'success', true,
    'withdrawalId', p_request_id,
    'paymentId', v_payment_id,
    'status', 'paid',
    'txSignature', v_clean_sig,
    'verifiedAt', v_now
  );
end;
$$;
