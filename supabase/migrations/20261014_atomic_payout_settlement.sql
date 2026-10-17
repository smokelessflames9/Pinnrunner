-- =========================================================================
-- PINN Arcade: Atomic Payout Settlement & Duplicate Prevention
-- Migration: 20261014_atomic_payout_settlement.sql
-- =========================================================================

-- 1. Enforce unique active/completed payout record per reward request
-- This database-level constraint makes it physically impossible for two concurrent
-- payment requests (even with different transaction signatures) to settle the same reward twice.
create unique index if not exists uq_payment_records_settled_reward
  on public.payment_records (reward_request_id)
  where status in ('confirmed', 'verified_paid');

-- 2. Hardened Atomic Settlement Function with Row-Level Locking (FOR UPDATE)
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

  -- 2. Row-Level Lock on reward_requests to serialize concurrent settlement attempts
  select * into v_reward
  from public.reward_requests
  where id = p_reward_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Reward request not found.');
  end if;

  if v_reward.status = 'completed' then
    return jsonb_build_object('success', false, 'error', 'Reward has already been marked as completed/paid.');
  end if;

  -- 3. Check for existing settled payment record for this reward
  if exists (
    select 1 from public.payment_records
    where reward_request_id = p_reward_id and status in ('confirmed', 'verified_paid')
  ) then
    return jsonb_build_object('success', false, 'error', 'Reward request already has a verified payment record.');
  end if;

  -- 4. Duplicate transaction signature check across all payments
  if exists (select 1 from public.payment_records where tx_signature = v_clean_sig) then
    return jsonb_build_object('success', false, 'error', 'Duplicate transaction signature already recorded on another payment.');
  end if;

  -- 5. Enforce official PINN token mint
  if p_token_mint != '6n2dDvako6nWp2zeKabf2UFxBta8xjvcqgFfZwsNpump' then
    return jsonb_build_object('success', false, 'error', 'Invalid token mint: Only official $PINN token mint accepted.');
  end if;

  -- 6. Atomic Update of reward_requests status
  update public.reward_requests
  set status = 'completed',
      admin_notes = coalesce(p_note, 'Paid and verified on Solana mainnet.'),
      updated_at = timezone('utc'::text, now())
  where id = p_reward_id and status != 'completed';

  if not found then
    return jsonb_build_object('success', false, 'error', 'Concurrent update conflict: Reward was already settled.');
  end if;

  -- 7. Check if an existing queued/simulated payment record exists for this reward
  select id into v_existing_payment_id
  from public.payment_records
  where reward_request_id = p_reward_id and status in ('queued', 'simulated', 'submitted')
  order by created_at desc
  limit 1;

  if v_existing_payment_id is not null then
    -- Update existing record to verified_paid
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
