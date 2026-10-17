-- =========================================================================
-- PINN ARCADE: Solana Wallet Automatic Authentication & Player Profiles
-- =========================================================================

-- 1. Create player_profiles table with stable internal UUID and unique normalized wallet address
create table if not exists public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  display_name text not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  coins_balance integer not null default 0 check (coins_balance >= 0),
  coins_withdrawn integer not null default 0 check (coins_withdrawn >= 0),
  total_games_played integer not null default 0 check (total_games_played >= 0),
  total_play_time_ms bigint not null default 0 check (total_play_time_ms >= 0),
  last_run_duration_ms integer not null default 0 check (last_run_duration_ms >= 0),
  is_verified boolean not null default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure case-insensitive unique constraint on wallet_address
create unique index if not exists idx_player_profiles_wallet_lower
  on public.player_profiles (lower(wallet_address));

-- Ensure case-insensitive unique constraint on display_name
create unique index if not exists idx_player_profiles_name_lower
  on public.player_profiles (lower(display_name));

-- Fast lookup index on auth_user_id
create index if not exists idx_player_profiles_auth_user
  on public.player_profiles (auth_user_id);

-- 2. Create coin_ledger table for audit trails and verifiable balance movements
create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player_profiles(id) on delete cascade,
  wallet_address text not null,
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  entry_type text not null check (entry_type in ('game_reward', 'tournament_prize', 'withdrawal', 'adjustment')),
  reference_id text,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_coin_ledger_player on public.coin_ledger (player_id);
create index if not exists idx_coin_ledger_wallet on public.coin_ledger (lower(wallet_address));

-- 3. Create wallet_auth_nonces table for replay-proof server verification
create table if not exists public.wallet_auth_nonces (
  nonce text primary key,
  wallet_address text not null,
  domain text not null,
  issued_at timestamp with time zone not null default timezone('utc'::text, now()),
  expires_at timestamp with time zone not null,
  consumed boolean not null default false,
  consumed_at timestamp with time zone
);

create index if not exists idx_nonces_wallet on public.wallet_auth_nonces (lower(wallet_address), expires_at);

-- 4. Atomic Profile Reconcile & Creation Function
-- Ensures atomic, concurrency-safe profile retrieval or creation with themed username
create or replace function public.get_or_create_wallet_profile(
  p_wallet_address text,
  p_desired_name text default null,
  p_auth_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_normalized_wallet text;
  v_profile record;
  v_name text;
  v_coins integer := 0;
  v_games integer := 0;
  v_time bigint := 0;
begin
  if p_wallet_address is null or length(trim(p_wallet_address)) < 30 then
    raise exception 'Invalid Solana wallet address provided.';
  end if;

  v_normalized_wallet := trim(p_wallet_address);

  -- 1. Check if profile already exists for this wallet
  select * into v_profile
  from public.player_profiles
  where lower(wallet_address) = lower(v_normalized_wallet)
  limit 1;

  if found then
    -- If auth_user_id is now provided and was null, link it
    if p_auth_user_id is not null and v_profile.auth_user_id is null then
      update public.player_profiles
      set auth_user_id = p_auth_user_id,
          updated_at = timezone('utc'::text, now())
      where id = v_profile.id;
      v_profile.auth_user_id := p_auth_user_id;
    end if;

    return to_jsonb(v_profile);
  end if;

  -- 2. Safely reconcile existing records from public.scores & public.game_scores
  select coalesce(sum(coins), 0), count(*), coalesce(sum(duration_ms), 0)
  into v_coins, v_games, v_time
  from public.scores
  where lower(wallet_address) = lower(v_normalized_wallet);

  if v_coins = 0 and v_games = 0 then
    select coalesce(sum(coins), 0), count(*)
    into v_coins, v_games
    from public.game_scores
    where lower(wallet_address) = lower(v_normalized_wallet);
  end if;

  -- 3. Determine unique username
  v_name := coalesce(nullif(trim(p_desired_name), ''), 'PinnRunner' || floor(random() * 900 + 100)::text);

  -- Retry collision if name exists
  if exists (select 1 from public.player_profiles where lower(display_name) = lower(v_name)) then
    v_name := v_name || floor(random() * 9000 + 1000)::text;
  end if;

  -- 4. Atomic insert
  insert into public.player_profiles (
    wallet_address,
    display_name,
    auth_user_id,
    coins_balance,
    total_games_played,
    total_play_time_ms
  )
  values (
    v_normalized_wallet,
    v_name,
    p_auth_user_id,
    v_coins,
    v_games,
    v_time
  )
  on conflict do nothing
  returning * into v_profile;

  -- Handle rare concurrency conflict
  if v_profile is null then
    select * into v_profile
    from public.player_profiles
    where lower(wallet_address) = lower(v_normalized_wallet)
    limit 1;
  end if;

  return to_jsonb(v_profile);
end;
$$;

-- 5. Row Level Security Policies
alter table public.player_profiles enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.wallet_auth_nonces enable row level security;

-- Public can read profiles (for leaderboards and player lookups)
drop policy if exists "Allow public read player_profiles" on public.player_profiles;
create policy "Allow public read player_profiles"
  on public.player_profiles
  for select
  using (true);

-- Only authenticated player or server-side functions can update display name
drop policy if exists "Allow player update own profile" on public.player_profiles;
create policy "Allow player update own profile"
  on public.player_profiles
  for update
  using (
    auth.uid() is not null and auth_user_id = auth.uid()
  )
  with check (
    auth.uid() is not null and auth_user_id = auth.uid()
  );

-- Ledger read: public or owner
drop policy if exists "Allow read coin_ledger" on public.coin_ledger;
create policy "Allow read coin_ledger"
  on public.coin_ledger
  for select
  using (true);
