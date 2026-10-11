-- =========================================================================
-- PINN Arcade Secure Score Submission & Anti-Cheat Database Migration
-- Table: public.scores
-- =========================================================================

-- 1. Create or update public.scores table
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid, -- legacy/synonym
  player_name text not null default 'Anonymous Player',
  game_id text not null,
  score integer not null,
  coins integer not null default 0,
  wallet_address text,
  session_id text not null,
  duration_ms integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  validation_reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure player_id syncs with user_id
update public.scores set player_id = user_id where player_id is null;

-- Add indexes
create index if not exists idx_scores_user_id on public.scores (user_id);
create index if not exists idx_scores_game_id on public.scores (game_id);
create index if not exists idx_scores_status on public.scores (status);
create index if not exists idx_scores_session_id on public.scores (session_id);
create index if not exists idx_scores_leaderboard on public.scores (game_id, score desc) where (status = 'verified');
create unique index if not exists idx_scores_unique_session on public.scores (session_id);

-- 2. Create game_sessions table to track authoritative active sessions & prevent replay
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

-- 3. Enable RLS on both tables
alter table public.scores enable row level security;
alter table public.game_sessions enable row level security;

-- Drop prior permissive or conflicting policies
drop policy if exists "Allow public read game_scores" on public.scores;
drop policy if exists "Allow public insert game_scores" on public.scores;
drop policy if exists "Public can read verified scores" on public.scores;
drop policy if exists "Users can read own scores" on public.scores;
drop policy if exists "Users can insert pending scores" on public.scores;
drop policy if exists "Deny user updates on scores" on public.scores;

-- 4. Secure RLS Policies for public.scores:
-- A. Verified scores are publicly readable for leaderboards
create policy "Public can read verified scores"
  on public.scores
  for select
  using (status = 'verified');

-- B. Authenticated users can also read their own scores (even if pending or rejected)
create policy "Users can read own scores"
  on public.scores
  for select
  to authenticated
  using (auth.uid() = user_id);

-- C. Normal players cannot update scores directly (prevents changing pending to verified)
-- Only service_role can update score status
create policy "Prevent client updates on scores"
  on public.scores
  for update
  using (false);

-- D. Normal players cannot delete scores directly
create policy "Prevent client delete on scores"
  on public.scores
  for delete
  using (false);

-- 5. Secure RLS Policies for public.game_sessions:
create policy "Users can view own game sessions"
  on public.game_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own game sessions"
  on public.game_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 6. Also sync with existing legacy game_scores table if needed
create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null default 'coin-rush',
  player_name text not null,
  wallet_address text,
  score integer not null default 0,
  coins integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.game_scores enable row level security;

create policy "Allow read on game_scores"
  on public.game_scores
  for select
  using (true);
