-- Run this in the Supabase SQL Editor to create the add_transfer_atomic RPC.
-- This function transfers money between two accounts atomically and updates their balances.
-- It features deadlock prevention, overdraft protection, and strictly positive amount validation.

CREATE OR REPLACE FUNCTION add_transfer_atomic(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_date TIMESTAMPTZ,
  p_account_id UUID,          -- Source Account
  p_transfer_to_account_id UUID -- Destination Account
) RETURNS VOID AS $$
DECLARE
  v_src_type VARCHAR;
  v_dst_type VARCHAR;
  v_src_bal NUMERIC;
  v_dst_bal NUMERIC;
BEGIN
  -- 0. Validate strictly positive amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be strictly positive';
  END IF;

  -- 1. Validate accounts are different
  IF p_account_id = p_transfer_to_account_id THEN
    RAISE EXCEPTION 'Source and destination accounts must be different';
  END IF;

  -- 2. Lock accounts in deterministic order to prevent deadlocks
  IF p_account_id < p_transfer_to_account_id THEN
    SELECT type, balance INTO v_src_type, v_src_bal FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    SELECT type, balance INTO v_dst_type, v_dst_bal FROM accounts WHERE id = p_transfer_to_account_id AND user_id = p_user_id FOR UPDATE;
  ELSE
    SELECT type, balance INTO v_dst_type, v_dst_bal FROM accounts WHERE id = p_transfer_to_account_id AND user_id = p_user_id FOR UPDATE;
    SELECT type, balance INTO v_src_type, v_src_bal FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
  END IF;

  IF v_src_type IS NULL OR v_dst_type IS NULL THEN
    RAISE EXCEPTION 'One of the accounts was not found or access denied';
  END IF;

  -- 3. Prevent overdraft on source account (only for non-credit accounts)
  IF v_src_type != 'credit_card' AND v_src_bal - p_amount < 0 THEN
    RAISE EXCEPTION 'Insufficient balance in source account';
  END IF;

  -- 4. Prevent negative debt on destination credit card if it is a debt payment
  IF v_dst_type = 'credit_card' AND v_dst_bal - p_amount < 0 THEN
    RAISE EXCEPTION 'Payment exceeds the remaining credit card debt';
  END IF;

  -- 5. Insert the transfer transaction
  INSERT INTO transactions (
    user_id,
    account_id,
    transfer_to_account_id,
    type,
    amount,
    description,
    date,
    category_id
  ) VALUES (
    p_user_id,
    p_account_id,
    p_transfer_to_account_id,
    'transfer',
    p_amount,
    p_description,
    p_date,
    NULL
  );

  -- 6. Update balances
  -- Source account: decreases balance (or increases debt if source is credit card)
  UPDATE accounts
  SET balance = CASE WHEN v_src_type = 'credit_card' THEN balance + p_amount ELSE balance - p_amount END
  WHERE id = p_account_id;

  -- Destination account: increases balance (or decreases debt if destination is credit card)
  UPDATE accounts
  SET balance = CASE WHEN v_dst_type = 'credit_card' THEN balance - p_amount ELSE balance + p_amount END
  WHERE id = p_transfer_to_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
