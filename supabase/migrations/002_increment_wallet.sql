-- Atomically add to a provider's wallet balance.
-- Called from the Paystack webhook handler after charge.success.
create or replace function increment_wallet(p_provider_id uuid, p_amount numeric)
returns void
language sql
security definer
as $$
  update providers
  set wallet_balance = wallet_balance + p_amount
  where id = p_provider_id;
$$;