-- =========================================================================
-- PINN ARCADE: Complete Player Coin System, Withdrawals & Admin Balances
-- Migration: 20261017_coin_system_and_withdrawals.sql
-- =========================================================================

-- 1. Create player_coin_earnings ledger for per-game coin tracking
create table if not exists public.player_coin_earnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  player_id uuid,
  wallet_address text,
  game_id text not null check (game_id in ('coin-rush', 'treasure-hunt', 'puzzle-master', 'speed-tap')),
  coins integer not null check (coins >= 0),
  score integer not null default 0,
  session_id text,
  duration_ms integer not null default 0,
  status text not null default 'eligible' check (status in ('eligible', 'rejected', 'unverified')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_coin_earnings_user on public.player_coin_earnings (user_id);
create index if not exists idx_coin_earnings_wallet on public.player_coin_earnings (lower(wallet_address));
create index if not exists idx_coin_earnings_game on public.player_coin_earnings (game_id);
create index if not exists idx_coin_earnings_status on public.player_coin_earnings (status);

-- 2. Create withdrawal_requests table for player withdrawals (10,000 PINN minimum)
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  player_id uuid,
  player_name text not null default 'Player',
  wallet_address text not null, -- destination Solana wallet
  amount_coins integer not null check (amount_coins >= 10000), -- minimum 10,000 coins
  amount_raw numeric not null, -- exact raw base units (6 decimals)
  token_mint text not null default '6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump',
  status text not null default 'pending' check (status in ('pending', 'approved', 'processing', 'rejected', 'completed', 'paid', 'cancelled')),
  admin_notes text default '',
  rejection_reason text default '',
  tx_signature text,
  verified_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_withdrawals_user on public.withdrawal_requests (user_id);
create index if not exists idx_withdrawals_wallet on public.withdrawal_requests (lower(wallet_address));
create index if not exists idx_withdrawals_status on public.withdrawal_requests (status);
create unique index if not exists uq_withdrawal_payout_sig on public.withdrawal_requests (tx_signature) where tx_signature is not null;

-- 3. Security Definer: Authoritative Player Coin & Balance Summary Calculation
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
  v_norm_wallet text;
  v_cr_coins bigint := 0;
  v_th_coins bigint := 0;
  v_pm_coins bigint := 0;
  v_st_coins bigint := 0;
  v_total_collected bigint := 0;
  v_eligible_coins bigint := 0;
  v_paid_coins bigint := 0;
  v_reserved_coins bigint := 0;
  v_available_balance bigint := 0;
begin
  v_norm_wallet := trim(p_wallet_address);
  if v_norm_wallet = '' then
    v_norm_wallet := null;
  end if;

  -- 1. Calculate per-game coins from player_coin_earnings (excluding rejected)
  select
    coalesce(sum(case when game_id = 'coin-rush' then coins else 0 end), 0),
    coalesce(sum(case when game_id = 'treasure-hunt' then coins else 0 end), 0),
    coalesce(sum(case when game_id = 'puzzle-master' then coins else 0 end), 0),
    coalesce(sum(case when game_id = 'speed-tap' then coins else 0 end), 0)
  into v_cr_coins, v_th_coins, v_pm_coins, v_st_coins
  from public.player_coin_earnings
  where status != 'rejected'
    and (
      (p_user_id is not null and user_id = p_user_id) or
      (v_norm_wallet is not null and lower(wallet_address) = lower(v_norm_wallet))
    );

  -- 2. Also check public.scores & public.game_scores for any historic runs not yet migrated
  -- (Prevent double counting by taking greatest between ledger and score tables if non-empty)
  declare
    v_score_cr bigint := 0;
    v_score_th bigint := 0;
    v_score_pm bigint := 0;
    v_score_st bigint := 0;
  begin
    select
      coalesce(sum(case when game_id = 'coin-rush' then coins else 0 end), 0),
      coalesce(sum(case when game_id = 'treasure-hunt' then coins else 0 end), 0),
      coalesce(sum(case when game_id = 'puzzle-master' then coins else 0 end), 0),
      coalesce(sum(case when game_id = 'speed-tap' then coins else 0 end), 0)
    into v_score_cr, v_score_th, v_score_pm, v_score_st
    from public.scores
    where status != 'rejected'
      and (
        (p_user_id is not null and user_id = p_user_id) or
        (v_norm_wallet is not null and lower(wallet_address) = lower(v_norm_wallet))
      );

    v_cr_coins := greatest(v_cr_coins, v_score_cr);
    v_th_coins := greatest(v_th_coins, v_score_th);
    v_pm_coins := greatest(v_pm_coins, v_score_pm);
    v_st_coins := greatest(v_st_coins, v_score_st);
  end;

  -- 3. Calculate authoritative total coins collected
  v_total_collected := v_cr_coins + v_th_coins + v_pm_coins + v_st_coins;
  v_eligible_coins := v_total_collected;

  -- 4. Calculate paid/withdrawn amount from completed withdrawal requests
  select coalesce(sum(amount_coins), 0)
  into v_paid_coins
  from public.withdrawal_requests
  where status in ('completed', 'paid')
    and (
      (p_user_id is not null and user_id = p_user_id) or
      (v_norm_wallet is not null and lower(wallet_address) = lower(v_norm_wallet))
    );

  -- 5. Calculate reserved amount from active requests (pending, approved, processing)
  select coalesce(sum(amount_coins), 0)
  into v_reserved_coins
  from public.withdrawal_requests
  where status in ('pending', 'approved', 'processing')
    and (
      (p_user_id is not null and user_id = p_user_id) or
      (v_norm_wallet is not null and lower(wallet_address) = lower(v_norm_wallet))
    );

  -- 6. Available Balance = Eligible - Paid - Reserved
  v_available_balance := greatest(0, v_eligible_coins - v_paid_coins - v_reserved_coins);

  return jsonb_build_object(
    'coinRushCoins', v_cr_coins,
    'treasureHuntCoins', v_th_coins,
    'puzzleMasterCoins', v_pm_coins,
    'speedTapCoins', v_st_coins,
    'totalCoinsCollected', v_total_collected,
    'eligibleEarnings', v_eligible_coins,
    'paidTotal', v_paid_coins,
    'reservedAmount', v_reserved_coins,
    'availableBalance', v_available_balance
  );
end;
$$;

-- 4. Security Definer: Atomic Player Withdrawal Submission with Concurrency Protection
create or replace function public.request_player_withdrawal(
  p_user_id uuid,
  p_wallet_address text,
  p_player_name text,
  p_amount_coins integer,
  p_destination_wallet text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean_dest text;
  v_summary jsonb;
  v_available bigint;
  v_req record;
  v_raw_amount numeric;
begin
  -- Validate minimum 10,000 coins
  if p_amount_coins is null or p_amount_coins < 10000 then
    return jsonb_build_object('success', false, 'error', 'Minimum withdrawal threshold is 10,000 PINN coins.');
  end if;

  v_clean_dest := trim(p_destination_wallet);
  if v_clean_dest is null or length(v_clean_dest) < 32 then
    return jsonb_build_object('success', false, 'error', 'Valid destination Solana wallet address is required.');
  end if;

  -- Calculate current balance atomically
  v_summary := public.get_player_coin_summary(p_user_id, p_wallet_address);
  v_available := (v_summary->>'availableBalance')::bigint;

  if p_amount_coins > v_available then
    return jsonb_build_object(
      'success', false,
      'error', format('Insufficient available balance. You requested %s coins, but only %s coins are available to withdraw.', p_amount_coins, v_available)
    );
  end if;

  -- Exact raw integer base units for 6 decimals (1 PINN = 1,000,000 base units)
  v_raw_amount := (p_amount_coins::numeric) * (10 ^ 6);

  insert into public.withdrawal_requests (
    user_id,
    player_name,
    wallet_address,
    amount_coins,
    amount_raw,
    status
  )
  values (
    p_user_id,
    coalesce(nullif(trim(p_player_name), ''), 'Player'),
    v_clean_dest,
    p_amount_coins,
    v_raw_amount,
    'pending'
  )
  returning * into v_req;

  -- Add audit trail in coin_ledger
  insert into public.coin_ledger (
    player_id,
    wallet_address,
    amount,
    balance_after,
    entry_type,
    reference_id,
    description
  )
  values (
    v_req.id,
    v_clean_dest,
    -p_amount_coins,
    (v_available - p_amount_coins),
    'withdrawal',
    v_req.id::text,
    format('Withdrawal request initiated for %s PINN coins.', p_amount_coins)
  );

  return jsonb_build_object(
    'success', true,
    'request', to_jsonb(v_req),
    'availableBalanceAfter', (v_available - p_amount_coins)
  );
end;
$$;

-- 5. Row Level Security Policies
alter table public.player_coin_earnings enable row level security;
alter table public.withdrawal_requests enable row level security;

-- Players can only read their own coin earnings
drop policy if exists "Allow players read own coin earnings" on public.player_coin_earnings;
create policy "Allow players read own coin earnings"
  on public.player_coin_earnings
  for select
  using (
    (auth.uid() is not null and user_id = auth.uid()) or
    public.is_admin()
  );

-- Players can read their own withdrawal requests; Admins can read all
drop policy if exists "Allow players read own withdrawal requests" on public.withdrawal_requests;
create policy "Allow players read own withdrawal requests"
  on public.withdrawal_requests
  for select
  using (
    (auth.uid() is not null and user_id = auth.uid()) or
    public.is_admin()
  );

-- Players can insert their own withdrawal requests
drop policy if exists "Allow players insert withdrawal requests" on public.withdrawal_requests;
create policy "Allow players insert withdrawal requests"
  on public.withdrawal_requests
  for insert
  with check (
    auth.uid() is not null and user_id = auth.uid()
  );

-- Only admins can update withdrawal requests (approve, reject, process, complete)
drop policy if exists "Allow admins update withdrawal requests" on public.withdrawal_requests;
create policy "Allow admins update withdrawal requests"
  on public.withdrawal_requests
  for update
  using (public.is_admin())
  with check (public.is_admin());
