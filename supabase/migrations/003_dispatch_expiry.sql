-- ============================================================
-- DISPATCH EXPIRY JOB
-- Runs every minute via pg_cron.
-- Expires unanswered dispatch offers, then either routes to
-- the next nearest available provider or cancels the booking.
-- ============================================================

-- Enable pg_cron (safe to run even if already enabled)
create extension if not exists pg_cron;

-- ── Core function ────────────────────────────────────────────

create or replace function process_expired_dispatches()
returns void
language plpgsql
security definer
as $$
declare
  expired_rec record;
  bk          record;
  next_prov   uuid;
begin
  for expired_rec in
    select id, booking_id
    from dispatch_queue
    where expires_at < now()
      and response is null
  loop
    -- Mark this offer expired
    update dispatch_queue
    set response     = 'expired',
        responded_at = now()
    where id = expired_rec.id;

    -- Get the booking only if it is still pending
    select id, patient_lat, patient_lng
    into bk
    from bookings
    where id = expired_rec.booking_id
      and status = 'pending';

    if bk.id is null then
      continue; -- already accepted or cancelled by another path
    end if;

    -- Find the next nearest verified + available provider
    -- who has not already been tried for this booking
    select p.id into next_prov
    from providers p
    where p.verification_status = 'verified'
      and p.available = true
      and p.id not in (
        select dq.provider_id
        from dispatch_queue dq
        where dq.booking_id = expired_rec.booking_id
      )
      and ST_DWithin(
        p.location,
        ST_SetSRID(ST_MakePoint(bk.patient_lng, bk.patient_lat), 4326)::geography,
        15000  -- 15 km radius
      )
    order by
      p.location <-> ST_SetSRID(ST_MakePoint(bk.patient_lng, bk.patient_lat), 4326)::geography
    limit 1;

    if next_prov is not null then
      -- Route to next provider (Realtime will notify their app)
      insert into dispatch_queue (booking_id, provider_id, expires_at)
      values (expired_rec.booking_id, next_prov, now() + interval '2 minutes');
    else
      -- No providers left in range — cancel the booking
      update bookings
      set status = 'cancelled'
      where id = expired_rec.booking_id;
    end if;

  end loop;
end;
$$;

-- ── Schedule: run every minute ───────────────────────────────

select cron.schedule(
  'expire-dispatch-queue',   -- job name (unique)
  '* * * * *',               -- every minute
  'select process_expired_dispatches()'
);