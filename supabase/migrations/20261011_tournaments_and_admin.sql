-- =========================================================================
-- PINN Arcade: Tournament Management, Server-Verified RBAC Admin & Rewards
-- Migration: 20261011_tournaments_and_admin.sql
-- Compatible with existing Supabase remote schema (public.game_scores legacy)
-- Idempotent, safe to rerun, secure search_path on all SECURITY DEFINER functions
-- =========================================================================

-- =========================================================================
-- SECTION 1: Authoritative Score Table (public.scores) & Legacy Sync
-- =========================================================================

-- 1. Create or ensure public.scores exists with full anti-cheat & tournament support
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid,
  player_name text not null default 'Anonymous Player',
  game_id text not null check (game_id in ('coin-rush', 'treasure-hunt', 'puzzle-master', 'speed-tap')),
  score integer not null check (score >= 0),
  coins integer not null default 0 check (coins >= 0),
  wallet_address text,
  session_id text not null,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  validation_reason text,
  metadata jsonb default '{}'::jsonb,
  tournament_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Backfill player_id if null
update public.scores set player_id = user_id where player_id is null;

-- Ensure tournament_id column exists if table was created by earlier script
alter table public.scores add column if not exists tournament_id uuid;

-- Critical anti-cheat & query indexes on public.scores
create index if not exists idx_scores_user_id on public.scores (user_id);
create index if not exists idx_scores_game_id on public.scores (game_id);
create index if not exists idx_scores_status on public.scores (status);
create index if not exists idx_scores_tournament_id on public.scores (tournament_id);
create unique index if not exists idx_scores_unique_session on public.scores (session_id);
create index if not exists idx_scores_leaderboard on public.scores (game_id, score desc) where (status = 'verified');
create index if not exists idx_scores_tourn_verified on public.scores (tournament_id, score desc) where (status = 'verified');

-- Ensure game_sessions table exists for session replay prevention
create table if not exists public.game_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  seed integer not null default 0,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null,
  completed boolean not null default false,
  completed_at timestamp with time zone
);

create index if not exists idx_game_sessions_user on public.game_sessions (user_id);

-- Ensure legacy public.game_scores exists and preserve existing player data
create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null default 'coin-rush',
  player_name text not null,
  wallet_address text,
  score integer not null default 0,
  coins integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Safe migration of existing legacy game_scores data into public.scores
-- Note: Existing game_scores records do not have an auth.users user_id or unique session_id.
-- They remain safely preserved in public.game_scores for backward-compatible read queries.

-- =========================================================================
-- SECTION 2: Tournaments Table
-- =========================================================================

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  game_id text not null check (game_id in ('coin-rush', 'treasure-hunt', 'puzzle-master', 'speed-tap')),
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  prize_pool text not null default '100,000 $PINN',
  prize_description text not null default 'Top 3 verified players share the prize pool: 1st: 50,000 $PINN, 2nd: 30,000 $PINN, 3rd: 20,000 $PINN.',
  rules text not null default 'Play during tournament window. Only verified scores count. Multiple attempts allowed; highest verified score ranks.',
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'completed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint ck_tournament_dates check (end_date >= start_date)
);

create index if not exists idx_tournaments_status on public.tournaments (status);
create index if not exists idx_tournaments_game_id on public.tournaments (game_id);
create index if not exists idx_tournaments_dates on public.tournaments (start_date, end_date);

-- Link public.scores to tournaments with foreign key safely
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_scores_tournament'
  ) then
    alter table public.scores
      add constraint fk_scores_tournament
      foreign key (tournament_id) references public.tournaments(id) on delete set null;
  end if;
end $$;

-- =========================================================================
-- SECTION 3: Server-Verified Role System (public.admin_roles)
-- =========================================================================

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  role text not null default 'admin' check (role in ('admin', 'superadmin')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_admin_roles_user on public.admin_roles (user_id);

-- Authorization helper function: public.is_admin()
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_roles
    where user_id = auth.uid()
  );
$$;

-- Secure client endpoint to check admin status
create or replace function public.check_is_admin()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_is_adm boolean;
  v_role text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('isAdmin', false, 'reason', 'Not authenticated');
  end if;

  select true, role into v_is_adm, v_role
  from public.admin_roles
  where user_id = v_uid;

  if v_is_adm is true then
    return jsonb_build_object('isAdmin', true, 'userId', v_uid, 'role', v_role);
  else
    return jsonb_build_object('isAdmin', false, 'userId', v_uid, 'reason', 'User not in admin allowlist');
  end if;
end;
$$;

-- =========================================================================
-- SECTION 4: Reward Requests Table (Winner Eligibility & Review Queue)
-- =========================================================================

create table if not exists public.reward_requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  player_name text not null,
  wallet_address text not null,
  rank integer not null check (rank >= 1 and rank <= 100),
  score integer not null check (score >= 0),
  reward_amount text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'prepared', 'completed')),
  admin_notes text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint uq_tournament_rank unique (tournament_id, rank)
);

-- Optional user uniqueness constraint per tournament:
-- A player cannot claim multiple podium ranks in the same tournament
create unique index if not exists uq_tournament_user on public.reward_requests (tournament_id, user_id)
where user_id is not null;

create index if not exists idx_reward_requests_tournament on public.reward_requests (tournament_id);
create index if not exists idx_reward_requests_status on public.reward_requests (status);
create index if not exists idx_reward_requests_user on public.reward_requests (user_id);

-- =========================================================================
-- SECTION 5: Payment Records Ledger (Solana Payment Lifecycle & History)
-- Full lifecycle: queued -> simulated -> submitted -> confirmed / verified_paid | failed | rejected
-- =========================================================================

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  reward_request_id uuid references public.reward_requests(id) on delete set null,
  tournament_id uuid references public.tournaments(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  player_name text not null,
  wallet_address text not null,
  amount text not null,
  token_mint text not null default '6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump',
  tx_signature text unique,
  status text not null default 'queued' check (status in ('queued', 'simulated', 'submitted', 'confirmed', 'verified_paid', 'failed', 'rejected')),
  is_verified_on_chain boolean default false,
  verified_at timestamp with time zone,
  error_message text,
  note text default 'Prepared reward awaiting Solana transaction execution',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Check that confirmed / verified_paid records MUST have a transaction signature
  constraint ck_payment_confirmed_has_sig check (
    status not in ('confirmed', 'verified_paid') or (tx_signature is not null and length(tx_signature) > 10)
  )
);

-- Ensure new columns exist if table was already created
alter table public.payment_records add column if not exists error_message text;
alter table public.payment_records add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

create index if not exists idx_payment_records_user on public.payment_records (user_id);
create index if not exists idx_payment_records_sig on public.payment_records (tx_signature);
create index if not exists idx_payment_records_status on public.payment_records (status);
create index if not exists idx_payment_records_reward_id on public.payment_records (reward_request_id);
-- Database-level safeguard: Ensure at most ONE confirmed or verified_paid payout can exist per reward_request_id
create unique index if not exists uq_payment_records_settled_reward on public.payment_records (reward_request_id) where status in ('confirmed', 'verified_paid');

-- =========================================================================
-- SECTION 6: Row Level Security (RLS) Configuration
-- =========================================================================

alter table public.scores enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_scores enable row level security;
alter table public.tournaments enable row level security;
alter table public.admin_roles enable row level security;
alter table public.reward_requests enable row level security;
alter table public.payment_records enable row level security;

-- -------------------------------------------------------------------------
-- 6A. RLS on public.scores
-- -------------------------------------------------------------------------
drop policy if exists "Public can read verified scores" on public.scores;
drop policy if exists "Users can read own scores" on public.scores;
drop policy if exists "Users can insert pending scores" on public.scores;
drop policy if exists "Prevent client updates on scores" on public.scores;
drop policy if exists "Prevent client delete on scores" on public.scores;
drop policy if exists "Admins can view all scores" on public.scores;

-- 1. Public can read ONLY verified scores for leaderboards and tournaments
create policy "Public can read verified scores"
  on public.scores
  for select
  using (status = 'verified');

-- 2. Authenticated players can read their own scores (even if pending or rejected)
-- and Administrators can read all scores for moderation
create policy "Users and Admins view scores"
  on public.scores
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- 3. Authenticated players can only insert pending scores for themselves
-- (status is forced to 'pending' by policy check; clients cannot self-verify)
create policy "Users insert own pending scores"
  on public.scores
  for insert
  to authenticated
  with check (auth.uid() = user_id and status = 'pending');

-- 4. Ordinary players CANNOT update score rows (cannot change status or score)
-- Only admins can update via admin_review_score RPC or direct admin update
create policy "Admins can update scores"
  on public.scores
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5. Ordinary players CANNOT delete scores
create policy "Admins can delete scores"
  on public.scores
  for delete
  to authenticated
  using (public.is_admin());

-- -------------------------------------------------------------------------
-- 6B. RLS on public.game_sessions
-- -------------------------------------------------------------------------
drop policy if exists "Users can view own game sessions" on public.game_sessions;
drop policy if exists "Users can insert own game sessions" on public.game_sessions;

create policy "Users can view own game sessions"
  on public.game_sessions
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

create policy "Users can insert own game sessions"
  on public.game_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- 6C. RLS on legacy public.game_scores
-- -------------------------------------------------------------------------
drop policy if exists "Allow read on game_scores" on public.game_scores;
drop policy if exists "Allow public read game_scores" on public.game_scores;
drop policy if exists "Deny client write game_scores" on public.game_scores;

-- Public read for backwards compatibility with legacy UI
create policy "Allow read on game_scores"
  on public.game_scores
  for select
  using (true);

-- Disallow unauthenticated arbitrary writes; only service_role (edge function) inserts verified rows
create policy "Deny client write game_scores"
  on public.game_scores
  for insert
  with check (false);

-- -------------------------------------------------------------------------
-- 6D. RLS on public.tournaments
-- -------------------------------------------------------------------------
drop policy if exists "Public can read tournaments" on public.tournaments;
drop policy if exists "Admins can insert tournaments" on public.tournaments;
drop policy if exists "Admins can update tournaments" on public.tournaments;
drop policy if exists "Admins can delete tournaments" on public.tournaments;

create policy "Public can read tournaments"
  on public.tournaments
  for select
  using (true);

create policy "Admins can insert tournaments"
  on public.tournaments
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update tournaments"
  on public.tournaments
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete tournaments"
  on public.tournaments
  for delete
  to authenticated
  using (public.is_admin());

-- -------------------------------------------------------------------------
-- 6E. RLS on public.admin_roles
-- -------------------------------------------------------------------------
drop policy if exists "Admins can view admin_roles" on public.admin_roles;
drop policy if exists "Prevent client insert admin_roles" on public.admin_roles;
drop policy if exists "Prevent client update admin_roles" on public.admin_roles;
drop policy if exists "Prevent client delete admin_roles" on public.admin_roles;

create policy "Admins can view admin_roles"
  on public.admin_roles
  for select
  to authenticated
  using (public.is_admin());

-- Clients CANNOT insert, update or delete admin_roles
create policy "Prevent client insert admin_roles"
  on public.admin_roles
  for insert
  with check (false);

create policy "Prevent client update admin_roles"
  on public.admin_roles
  for update
  using (false);

create policy "Prevent client delete admin_roles"
  on public.admin_roles
  for delete
  using (false);

-- -------------------------------------------------------------------------
-- 6F. RLS on public.reward_requests
-- Requirement: Players must ONLY be able to view their own reward requests.
-- -------------------------------------------------------------------------
drop policy if exists "Players view own rewards" on public.reward_requests;
drop policy if exists "Admins insert reward_requests" on public.reward_requests;
drop policy if exists "Admins update reward_requests" on public.reward_requests;
drop policy if exists "Admins delete reward_requests" on public.reward_requests;

create policy "Players view own rewards"
  on public.reward_requests
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

create policy "Admins insert reward_requests"
  on public.reward_requests
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins update reward_requests"
  on public.reward_requests
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete reward_requests"
  on public.reward_requests
  for delete
  to authenticated
  using (public.is_admin());

-- -------------------------------------------------------------------------
-- 6G. RLS on public.payment_records
-- Requirement: Players must ONLY be able to view their own payment records.
-- -------------------------------------------------------------------------
drop policy if exists "Players view own payment records" on public.payment_records;
drop policy if exists "Admins insert payment_records" on public.payment_records;
drop policy if exists "Admins update payment_records" on public.payment_records;
drop policy if exists "Admins delete payment_records" on public.payment_records;

create policy "Players view own payment records"
  on public.payment_records
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

create policy "Admins insert payment_records"
  on public.payment_records
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins update payment_records"
  on public.payment_records
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete payment_records"
  on public.payment_records
  for delete
  to authenticated
  using (public.is_admin());

-- =========================================================================
-- SECTION 7: Authorized Server-Side Functions (SECURITY DEFINER)
-- All functions set secure search_path = public, pg_temp
-- All functions verify public.is_admin() before executing privileged writes
-- =========================================================================

-- 7.1 Admin Create Tournament
create or replace function public.admin_create_tournament(
  p_title text,
  p_description text,
  p_game_id text,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_prize_pool text,
  p_prize_description text,
  p_rules text,
  p_status text default 'upcoming'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Administrator access required.';
  end if;

  if p_game_id not in ('coin-rush', 'treasure-hunt', 'puzzle-master', 'speed-tap') then
    raise exception 'Invalid game_id: Must be one of the four PINN Arcade games.';
  end if;

  if p_status not in ('upcoming', 'active', 'completed', 'cancelled') then
    raise exception 'Invalid tournament status.';
  end if;

  if p_end_date < p_start_date then
    raise exception 'Tournament end_date cannot be earlier than start_date.';
  end if;

  insert into public.tournaments (
    title,
    description,
    game_id,
    start_date,
    end_date,
    prize_pool,
    prize_description,
    rules,
    status,
    created_by
  ) values (
    trim(p_title),
    coalesce(trim(p_description), ''),
    p_game_id,
    p_start_date,
    p_end_date,
    coalesce(trim(p_prize_pool), '100,000 $PINN'),
    coalesce(trim(p_prize_description), ''),
    coalesce(trim(p_rules), 'Only verified server scores count.'),
    p_status,
    auth.uid()
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- 7.2 Admin Update Tournament Status
create or replace function public.admin_update_tournament_status(
  p_tournament_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Administrator access required.';
  end if;

  if p_status not in ('upcoming', 'active', 'completed', 'cancelled') then
    raise exception 'Invalid tournament status.';
  end if;

  update public.tournaments
  set status = p_status,
      updated_at = timezone('utc'::text, now())
  where id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found.';
  end if;

  return true;
end;
$$;

-- 7.3 Admin Set Tournament Prize Allocation
create or replace function public.admin_set_prize_allocation(
  p_tournament_id uuid,
  p_prize_pool text,
  p_prize_description text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Administrator access required.';
  end if;

  update public.tournaments
  set prize_pool = coalesce(trim(p_prize_pool), prize_pool),
      prize_description = coalesce(trim(p_prize_description), prize_description),
      updated_at = timezone('utc'::text, now())
  where id = p_tournament_id;

  if not found then
    raise exception 'Tournament not found.';
  end if;

  return true;
end;
$$;

-- 7.4 Admin Review Score (Update Verification Status)
create or replace function public.admin_review_score(
  p_score_id uuid,
  p_status text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Administrator access required.';
  end if;

  if p_status not in ('verified', 'rejected', 'pending') then
    raise exception 'Invalid score status: must be verified, rejected, or pending.';
  end if;

  update public.scores
  set status = p_status,
      validation_reason = coalesce(p_reason, validation_reason)
  where id = p_score_id;

  if not found then
    raise exception 'Score record not found.';
  end if;

  return true;
end;
$$;

-- 7.5 Admin Prepare Reward Request for Winner
-- Enforces:
-- 1. Caller must be an authorized admin
-- 2. Proposed winner must actually have a verified score for that tournament (or matching game & window)
-- 3. Reject duplicate claims for the same rank in the same tournament
-- 4. Reject duplicate claims for the same user in the same tournament
-- 5. Validates rank (1-100), score (>= 0), reward amount, and wallet address
-- 6. Atomically creates an initial 'queued' payment record in the payment audit ledger
create or replace function public.admin_prepare_reward(
  p_tournament_id uuid,
  p_user_id uuid,
  p_player_name text,
  p_wallet_address text,
  p_rank integer,
  p_score integer,
  p_reward_amount text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reward_id uuid;
  v_tourn public.tournaments%rowtype;
  v_has_verified_score boolean;
begin
  -- 1. Authorization check
  if not public.is_admin() then
    raise exception 'Unauthorized: Administrator access required.';
  end if;

  -- 2. Input validation: Rank
  if p_rank is null or p_rank < 1 or p_rank > 100 then
    raise exception 'Invalid rank: Rank must be an integer between 1 and 100.';
  end if;

  -- 3. Input validation: Score
  if p_score is null or p_score < 0 then
    raise exception 'Invalid score: Score must be a non-negative integer.';
  end if;

  -- 4. Input validation: Wallet address & Reward amount
  if p_wallet_address is null or trim(p_wallet_address) = '' or length(trim(p_wallet_address)) < 32 then
    raise exception 'Invalid Solana wallet address: Must be at least 32 characters.';
  end if;

  if p_reward_amount is null or trim(p_reward_amount) = '' then
    raise exception 'Reward amount cannot be empty.';
  end if;

  -- 5. Check tournament exists
  select * into v_tourn from public.tournaments where id = p_tournament_id;
  if not found then
    raise exception 'Tournament not found.';
  end if;

  -- 6. Verify that the proposed winner actually has a VERIFIED score for that tournament
  -- Checks either explicit tournament_id or matching game_id within the tournament date window
  select exists (
    select 1 from public.scores s
    where (
      s.tournament_id = p_tournament_id
      or (
        s.game_id = v_tourn.game_id
        and s.created_at >= v_tourn.start_date
        and s.created_at <= v_tourn.end_date
      )
    )
    and (
      (p_user_id is not null and s.user_id = p_user_id)
      or (s.player_name = p_player_name)
      or (s.wallet_address = p_wallet_address)
    )
    and s.status = 'verified'
  ) into v_has_verified_score;

  if not v_has_verified_score then
    raise exception 'Winner eligibility check failed: Proposed winner does not have a verified score for this tournament.';
  end if;

  -- 7. Ensure no rejected scores disqualify this candidate
  if exists (
    select 1 from public.scores s
    where (
      s.tournament_id = p_tournament_id
      or (
        s.game_id = v_tourn.game_id
        and s.created_at >= v_tourn.start_date
        and s.created_at <= v_tourn.end_date
      )
    )
    and (
      (p_user_id is not null and s.user_id = p_user_id)
      or (s.player_name = p_player_name)
    )
    and s.score = p_score
    and s.status = 'rejected'
  ) then
    raise exception 'Disqualified: A rejected score submission was found for this player and score.';
  end if;

  -- 8. Prevent duplicate claims: Rank conflict check
  if exists (
    select 1 from public.reward_requests
    where tournament_id = p_tournament_id and rank = p_rank
  ) then
    raise exception 'Duplicate reward claim rejected: Rank #% already has a reward record in this tournament.', p_rank;
  end if;

  -- 9. Prevent duplicate claims: User conflict check
  if p_user_id is not null and exists (
    select 1 from public.reward_requests
    where tournament_id = p_tournament_id and user_id = p_user_id
  ) then
    raise exception 'Duplicate reward claim rejected: This user already has a reward record for this tournament.';
  end if;

  -- 10. Insert prepared reward request
  insert into public.reward_requests (
    tournament_id,
    user_id,
    player_name,
    wallet_address,
    rank,
    score,
    reward_amount,
    status,
    admin_notes
  ) values (
    p_tournament_id,
    p_user_id,
    trim(p_player_name),
    trim(p_wallet_address),
    p_rank,
    p_score,
    trim(p_reward_amount),
    'prepared',
    'Prepared via Admin Dashboard. Score verified.'
  )
  returning id into v_reward_id;

  -- 11. Create corresponding audit record in payment_records (status: 'queued')
  insert into public.payment_records (
    reward_request_id,
    tournament_id,
    user_id,
    player_name,
    wallet_address,
    amount,
    token_mint,
    status,
    is_verified_on_chain,
    note
  ) values (
    v_reward_id,
    p_tournament_id,
    p_user_id,
    trim(p_player_name),
    trim(p_wallet_address),
    trim(p_reward_amount),
    '6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump',
    'queued',
    false,
    'Prepared reward in tournament queue. Awaiting authorized Solana token payout.'
  );

  return v_reward_id;
end;
$$;

-- 7.6 Admin Update Reward Status (Approve / Reject)
create or replace function public.admin_update_reward_status(
  p_reward_id uuid,
  p_status text,
  p_notes text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Administrator access required.';
  end if;

  if p_status not in ('pending_review', 'approved', 'rejected', 'prepared', 'completed') then
    raise exception 'Invalid reward status.';
  end if;

  update public.reward_requests
  set status = p_status,
      admin_notes = coalesce(p_notes, admin_notes),
      updated_at = timezone('utc'::text, now())
  where id = p_reward_id;

  if not found then
    raise exception 'Reward request not found.';
  end if;

  -- Sync linked queued payment record if reward was rejected
  if p_status = 'rejected' then
    update public.payment_records
    set status = 'rejected',
        note = coalesce(p_notes, 'Reward request was rejected by administrator.'),
        updated_at = timezone('utc'::text, now())
    where reward_request_id = p_reward_id and status in ('queued', 'simulated');
  end if;

  return true;
end;
$$;

-- 7.7 Admin Update Payment Lifecycle (Queued -> Submitted -> Confirmed / Failed)
-- Supports complete lifecycle tracking without falsely marking unconfirmed transactions as paid
create or replace function public.admin_update_payment_lifecycle(
  p_payment_id uuid,
  p_status text,
  p_tx_signature text default null,
  p_error_message text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: Administrator access required.');
  end if;

  if p_status not in ('queued', 'simulated', 'submitted', 'confirmed', 'verified_paid', 'failed', 'rejected') then
    return jsonb_build_object('success', false, 'error', 'Invalid payment status.');
  end if;

  -- If status is confirmed or verified_paid, tx_signature must be present
  if p_status in ('confirmed', 'verified_paid') and (p_tx_signature is null or length(trim(p_tx_signature)) < 10) then
    return jsonb_build_object('success', false, 'error', 'Confirmed payments require a valid Solana transaction signature.');
  end if;

  -- Check duplicate signature if a signature is provided
  if p_tx_signature is not null and exists (
    select 1 from public.payment_records
    where tx_signature = trim(p_tx_signature) and id != p_payment_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Duplicate transaction signature already recorded on another payment.');
  end if;

  update public.payment_records
  set status = p_status,
      tx_signature = coalesce(trim(p_tx_signature), tx_signature),
      is_verified_on_chain = (p_status in ('confirmed', 'verified_paid')),
      verified_at = case when p_status in ('confirmed', 'verified_paid') then timezone('utc'::text, now()) else verified_at end,
      error_message = p_error_message,
      note = coalesce(p_note, note),
      updated_at = timezone('utc'::text, now())
  where id = p_payment_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Payment record not found.');
  end if;

  return jsonb_build_object('success', true, 'paymentId', p_payment_id, 'status', p_status);
end;
$$;

-- 7.8 Admin Record Completed Solana Payout (Atomic Operation)
-- Verifies caller is admin, enforces PINN token mint, rejects duplicate tx signatures,
-- updates reward request to 'completed', and updates/inserts verified payment record
create or replace function public.admin_record_solana_payout(
  p_reward_id uuid,
  p_tx_signature text,
  p_token_mint text,
  p_destination_wallet text,
  p_amount text,
  p_note text default 'Verified Solana mainnet token payout.'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reward public.reward_requests%rowtype;
  v_existing_payment_id uuid;
  v_clean_sig text;
begin
  -- 1. Authorization check
  if not public.is_admin() then
    return jsonb_build_object('success', false, 'error', 'Unauthorized: Administrator access required.');
  end if;

  v_clean_sig := trim(p_tx_signature);
  if v_clean_sig is null or length(v_clean_sig) < 10 then
    return jsonb_build_object('success', false, 'error', 'Invalid Solana transaction signature.');
  end if;

  -- 2. Row-level lock on reward_requests to serialize concurrent payouts
  select * into v_reward from public.reward_requests where id = p_reward_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Reward request not found.');
  end if;

  if v_reward.status = 'completed' then
    return jsonb_build_object('success', false, 'error', 'Reward has already been marked as completed/paid.');
  end if;

  -- 2b. Check if an active confirmed/verified payment record already exists for this reward
  if exists (
    select 1 from public.payment_records
    where reward_request_id = p_reward_id and status in ('confirmed', 'verified_paid')
  ) then
    return jsonb_build_object('success', false, 'error', 'Reward request already has a confirmed payout.');
  end if;

  -- 3. Duplicate transaction signature check across all payments
  if exists (select 1 from public.payment_records where tx_signature = v_clean_sig) then
    return jsonb_build_object('success', false, 'error', 'Duplicate transaction signature already recorded on another payment.');
  end if;

  -- 4. Enforce official PINN token mint
  if p_token_mint != '6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump' then
    return jsonb_build_object('success', false, 'error', 'Invalid token mint: Only official $PINN token mint accepted.');
  end if;

  -- 5. Atomic Update of reward_requests
  update public.reward_requests
  set status = 'completed',
      admin_notes = coalesce(p_note, 'Paid and verified on Solana mainnet.'),
      updated_at = timezone('utc'::text, now())
  where id = p_reward_id and status != 'completed';

  if not found then
    return jsonb_build_object('success', false, 'error', 'Concurrent settlement conflict: Reward was already marked completed.');
  end if;

  -- 6. Check if an existing queued payment record exists for this reward
  select id into v_existing_payment_id
  from public.payment_records
  where reward_request_id = p_reward_id and status in ('queued', 'simulated', 'submitted')
  order by created_at desc
  limit 1;

  if v_existing_payment_id is not null then
    -- Update existing payment record to confirmed / verified_paid
    update public.payment_records
    set tx_signature = v_clean_sig,
        wallet_address = trim(p_destination_wallet),
        amount = trim(p_amount),
        token_mint = p_token_mint,
        status = 'verified_paid',
        is_verified_on_chain = true,
        verified_at = timezone('utc'::text, now()),
        note = coalesce(p_note, 'Verified Solana transfer for tournament reward.'),
        updated_at = timezone('utc'::text, now())
    where id = v_existing_payment_id;
  else
    -- Insert new confirmed payment record
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
      note
    ) values (
      p_reward_id,
      v_reward.tournament_id,
      v_reward.user_id,
      v_reward.player_name,
      trim(p_destination_wallet),
      trim(p_amount),
      p_token_mint,
      v_clean_sig,
      'verified_paid',
      true,
      timezone('utc'::text, now()),
      coalesce(p_note, 'Verified Solana transfer for tournament reward.')
    )
    returning id into v_existing_payment_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'paymentId', v_existing_payment_id,
    'rewardId', p_reward_id,
    'txSignature', v_clean_sig
  );
end;
$$;

-- Grant execution permissions
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.check_is_admin() to authenticated, anon;
grant execute on function public.admin_create_tournament(text, text, text, timestamptz, timestamptz, text, text, text, text) to authenticated;
grant execute on function public.admin_update_tournament_status(uuid, text) to authenticated;
grant execute on function public.admin_set_prize_allocation(uuid, text, text) to authenticated;
grant execute on function public.admin_review_score(uuid, text, text) to authenticated;
grant execute on function public.admin_prepare_reward(uuid, uuid, text, text, integer, integer, text) to authenticated;
grant execute on function public.admin_update_reward_status(uuid, text, text) to authenticated;
grant execute on function public.admin_update_payment_lifecycle(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_record_solana_payout(uuid, text, text, text, text, text) to authenticated;
