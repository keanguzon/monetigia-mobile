-- Run this in the Supabase SQL Editor to create the delete_transaction_atomic RPC.
-- This function deletes a transaction and atomically updates the linked account balances.
-- It features deterministic locking order by UUID comparison to prevent deadlocks on concurrent opposed transfers.

CREATE OR REPLACE FUNCTION delete_transaction_atomic(
  p_transaction_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_amount NUMERIC;
  v_type VARCHAR;
  v_account_id UUID;
  v_transfer_to_account_id UUID;
  v_account_type VARCHAR;
  v_transfer_to_account_type VARCHAR;
BEGIN
  -- 1. Fetch transaction details and lock the row
  SELECT amount, type, account_id, transfer_to_account_id
  INTO v_amount, v_type, v_account_id, v_transfer_to_account_id
  FROM transactions
  WHERE id = p_transaction_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or unauthorized';
  END IF;

  -- 2. Fetch account types with deterministic locking order to prevent deadlocks
  IF v_transfer_to_account_id IS NULL THEN
    SELECT type INTO v_account_type FROM accounts WHERE id = v_account_id FOR UPDATE;
  ELSE
    IF v_account_id < v_transfer_to_account_id THEN
      SELECT type INTO v_account_type FROM accounts WHERE id = v_account_id FOR UPDATE;
      SELECT type INTO v_transfer_to_account_type FROM accounts WHERE id = v_transfer_to_account_id FOR UPDATE;
    ELSE
      SELECT type INTO v_transfer_to_account_type FROM accounts WHERE id = v_transfer_to_account_id FOR UPDATE;
      SELECT type INTO v_account_type FROM accounts WHERE id = v_account_id FOR UPDATE;
    END IF;
  END IF;

  -- 3. Delete the transaction
  DELETE FROM transactions WHERE id = p_transaction_id AND user_id = p_user_id;

  -- 4. Revert balances
  IF v_type = 'income' THEN
    UPDATE accounts
    SET balance = CASE WHEN v_account_type = 'credit_card' THEN balance + v_amount ELSE balance - v_amount END
    WHERE id = v_account_id;
  ELSIF v_type = 'expense' THEN
    UPDATE accounts
    SET balance = CASE WHEN v_account_type = 'credit_card' THEN balance - v_amount ELSE balance + v_amount END
    WHERE id = v_account_id;
  ELSIF v_type = 'transfer' THEN
    -- Revert source (transfer withdrew money, so revert adds it back)
    UPDATE accounts
    SET balance = CASE WHEN v_account_type = 'credit_card' THEN balance - v_amount ELSE balance + v_amount END
    WHERE id = v_account_id;
    -- Revert destination (transfer deposited money, so revert subtracts it)
    UPDATE accounts
    SET balance = CASE WHEN v_transfer_to_account_type = 'credit_card' THEN balance + v_amount ELSE balance - v_amount END
    WHERE id = v_transfer_to_account_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
