-- StreetdocMD Initial Schema
-- Run this in your Supabase SQL editor

-- Enable PostGIS for geospatial queries
create extension if not exists postgis;

-- ============================================================
-- USERS
-- ============================================================
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  name text not null,
  dob date,
  gender text check (gender in ('male', 'female', 'other')),
  address text,
  lat double precision,
  lng double precision,
  location geography(point, 4326),
  photo_url text,
  blood_group text,
  known_conditions text[] default '{}',
  current_medications text[] default '{}',
  allergies text[] default '{}',
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  role text not null default 'patient' check (role in ('patient', 'provider', 'admin')),
  ndpr_consent boolean not null default false,
  ndpr_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update location point when lat/lng change
create or replace function update_user_location()
returns trigger as $$
begin
  if new.lat is not null and new.lng is not null then
    new.location = st_makepoint(new.lng, new.lat)::geography;
  end if;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_update_location
  before insert or update on users
  for each row execute function update_user_location();

-- ============================================================
-- FAMILY MEMBERS
-- ============================================================
create table family_members (
  id uuid primary key default gen_random_uuid(),
  account_holder_id uuid not null references users(id) on delete cascade,
  name text not null,
  dob date,
  gender text check (gender in ('male', 'female', 'other')),
  relationship text not null,
  blood_group text,
  known_conditions text[] default '{}',
  current_medications text[] default '{}',
  allergies text[] default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- PROVIDERS
-- ============================================================
create table providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references users(id) on delete cascade,
  phone text not null,
  name text not null,
  photo_url text,
  specialty text not null,
  credentials text not null,
  mdcn_number text,
  nmcn_number text,
  years_experience int not null default 0,
  bio text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'under_review', 'verified', 'rejected')),
  badge_issued boolean not null default false,
  rejection_reason text,
  rating numeric(3,2) not null default 0,
  total_visits int not null default 0,
  response_rate numeric(5,2) not null default 0,
  completion_rate numeric(5,2) not null default 0,
  available boolean not null default false,
  working_hours_start time,
  working_hours_end time,
  service_radius_km int not null default 10,
  lat double precision,
  lng double precision,
  location geography(point, 4326),
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  wallet_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function update_provider_location()
returns trigger as $$
begin
  if new.lat is not null and new.lng is not null then
    new.location = st_makepoint(new.lng, new.lat)::geography;
  end if;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger providers_update_location
  before insert or update on providers
  for each row execute function update_provider_location();

-- ============================================================
-- PROVIDER DOCUMENTS
-- ============================================================
create table provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id) on delete cascade,
  document_type text not null
    check (document_type in ('mdcn_licence', 'nmcn_licence', 'nin', 'passport', 'certificate')),
  file_url text not null,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references users(id)
);

-- ============================================================
-- BOOKINGS
-- ============================================================
create table bookings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references users(id),
  family_member_id uuid references family_members(id),
  provider_id uuid references providers(id),
  service_type text not null check (service_type in (
    'general_consultation', 'blood_pressure_check', 'malaria_typhoid_test',
    'wound_care', 'elderly_review', 'nursing_care', 'custom_request'
  )),
  status text not null default 'pending' check (status in (
    'pending', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled'
  )),
  patient_lat double precision not null,
  patient_lng double precision not null,
  patient_location geography(point, 4326),
  patient_address text not null,
  notes text,
  scheduled_at timestamptz,
  accepted_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  fee numeric(12,2) not null,
  commission numeric(12,2) not null,
  net_payout numeric(12,2) not null,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'successful', 'failed', 'refunded')),
  dispatch_attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function update_booking()
returns trigger as $$
begin
  new.patient_location = st_makepoint(new.patient_lng, new.patient_lat)::geography;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger bookings_update
  before insert or update on bookings
  for each row execute function update_booking();

-- Find available providers near a location (used for dispatch)
create or replace function get_nearby_providers(
  booking_lat double precision,
  booking_lng double precision,
  radius_km int default 15
)
returns table (
  provider_id uuid,
  distance_km double precision
) as $$
begin
  return query
  select
    p.id,
    st_distance(p.location, st_makepoint(booking_lng, booking_lat)::geography) / 1000 as distance_km
  from providers p
  where
    p.available = true
    and p.verification_status = 'verified'
    and p.badge_issued = true
    and p.location is not null
    and st_dwithin(
      p.location,
      st_makepoint(booking_lng, booking_lat)::geography,
      radius_km * 1000
    )
  order by distance_km asc;
end;
$$ language plpgsql;

-- ============================================================
-- DISPATCH QUEUE (2-minute acceptance window)
-- ============================================================
create table dispatch_queue (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  provider_id uuid not null references providers(id),
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 minutes',
  response text check (response in ('accepted', 'declined', 'expired')),
  responded_at timestamptz
);

-- ============================================================
-- VISITS (clinical record)
-- ============================================================
create table visits (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references bookings(id),
  chief_complaint text,
  history text,
  examination_findings text,
  diagnosis text,
  treatment text,
  follow_up_plan text,
  follow_up_date date,
  prescription_url text,
  referral_url text,
  photos text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PRESCRIPTIONS
-- ============================================================
create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id),
  booking_id uuid not null references bookings(id),
  provider_id uuid not null references providers(id),
  patient_id uuid not null references users(id),
  drugs jsonb not null default '[]',
  notes text,
  pdf_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- LAB PARTNERS + ORDERS
-- ============================================================
create table lab_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text not null,
  email text,
  referral_fee numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table lab_orders (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id),
  booking_id uuid not null references bookings(id),
  patient_id uuid not null references users(id),
  provider_id uuid not null references providers(id),
  lab_partner_id uuid not null references lab_partners(id),
  tests text[] not null,
  status text not null default 'ordered'
    check (status in ('ordered', 'sample_collected', 'processing', 'ready')),
  results_url text,
  ordered_at timestamptz not null default now(),
  results_at timestamptz
);

-- ============================================================
-- PAYMENTS
-- ============================================================
create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  patient_id uuid not null references users(id),
  amount numeric(12,2) not null,
  method text not null check (method in ('card', 'bank_transfer', 'ussd', 'subscription_credit')),
  paystack_reference text unique,
  status text not null default 'pending'
    check (status in ('pending', 'successful', 'failed', 'refunded')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- REVIEWS
-- ============================================================
create table reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique not null references bookings(id),
  patient_id uuid not null references users(id),
  provider_id uuid not null references providers(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- Auto-update provider rating when a review is submitted
create or replace function update_provider_rating()
returns trigger as $$
begin
  update providers
  set rating = (
    select round(avg(rating)::numeric, 2)
    from reviews
    where provider_id = new.provider_id
  )
  where id = new.provider_id;
  return new;
end;
$$ language plpgsql;

create trigger reviews_update_rating
  after insert or update on reviews
  for each row execute function update_provider_rating();

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references users(id),
  plan text not null check (plan in ('basic', 'standard', 'premium', 'family')),
  start_date date not null,
  end_date date not null,
  visits_remaining int not null,
  status text not null default 'active'
    check (status in ('active', 'expired', 'cancelled', 'paused')),
  paystack_subscription_code text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PROVIDER WITHDRAWALS
-- ============================================================
create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id),
  amount numeric(12,2) not null,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'processed', 'failed')),
  processed_by uuid references users(id),
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ============================================================
-- VERIFICATION LOGS
-- ============================================================
create table verification_logs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id),
  admin_id uuid not null references users(id),
  action text not null check (action in ('approved', 'rejected', 'suspended', 'reinstated')),
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table users enable row level security;
alter table family_members enable row level security;
alter table providers enable row level security;
alter table provider_documents enable row level security;
alter table bookings enable row level security;
alter table dispatch_queue enable row level security;
alter table visits enable row level security;
alter table prescriptions enable row level security;
alter table payments enable row level security;
alter table reviews enable row level security;
alter table subscriptions enable row level security;
alter table withdrawals enable row level security;
alter table verification_logs enable row level security;
alter table lab_orders enable row level security;

-- Helper function: get current user's role
create or replace function get_user_role()
returns text as $$
  select role from users where id = auth.uid();
$$ language sql security definer;

-- USERS: patients see only themselves; providers see only themselves; admins see all
create policy "users_self_read" on users
  for select using (auth.uid() = id or get_user_role() = 'admin');

create policy "users_self_write" on users
  for update using (auth.uid() = id);

create policy "users_insert_own" on users
  for insert with check (auth.uid() = id);

-- FAMILY MEMBERS: only the account holder
create policy "family_members_owner" on family_members
  for all using (account_holder_id = auth.uid() or get_user_role() = 'admin');

-- PROVIDERS: verified providers are publicly readable for booking; private fields restricted
create policy "providers_public_read" on providers
  for select using (
    verification_status = 'verified'
    or user_id = auth.uid()
    or get_user_role() = 'admin'
  );

create policy "providers_self_write" on providers
  for update using (user_id = auth.uid() or get_user_role() = 'admin');

create policy "providers_insert_own" on providers
  for insert with check (user_id = auth.uid());

-- PROVIDER DOCUMENTS: only the provider and admins
create policy "provider_documents_access" on provider_documents
  for all using (
    provider_id in (select id from providers where user_id = auth.uid())
    or get_user_role() = 'admin'
  );

-- BOOKINGS: patient sees own bookings; provider sees assigned bookings; admin sees all
create policy "bookings_patient_read" on bookings
  for select using (
    patient_id = auth.uid()
    or provider_id in (select id from providers where user_id = auth.uid())
    or get_user_role() = 'admin'
  );

create policy "bookings_patient_insert" on bookings
  for insert with check (patient_id = auth.uid());

create policy "bookings_update" on bookings
  for update using (
    patient_id = auth.uid()
    or provider_id in (select id from providers where user_id = auth.uid())
    or get_user_role() = 'admin'
  );

-- VISITS: patient sees own; provider sees visits they conducted; admin sees all
create policy "visits_access" on visits
  for all using (
    booking_id in (
      select id from bookings
      where patient_id = auth.uid()
        or provider_id in (select id from providers where user_id = auth.uid())
    )
    or get_user_role() = 'admin'
  );

-- PRESCRIPTIONS: same as visits
create policy "prescriptions_access" on prescriptions
  for all using (
    patient_id = auth.uid()
    or provider_id in (select id from providers where user_id = auth.uid())
    or get_user_role() = 'admin'
  );

-- PAYMENTS: patient sees own; admin sees all
create policy "payments_access" on payments
  for select using (patient_id = auth.uid() or get_user_role() = 'admin');

create policy "payments_insert" on payments
  for insert with check (patient_id = auth.uid());

-- REVIEWS: public reads; patient inserts own
create policy "reviews_public_read" on reviews for select using (true);
create policy "reviews_patient_insert" on reviews
  for insert with check (patient_id = auth.uid());

-- SUBSCRIPTIONS: patient sees own; admin sees all
create policy "subscriptions_access" on subscriptions
  for all using (patient_id = auth.uid() or get_user_role() = 'admin');

-- WITHDRAWALS: provider sees own; admin sees all
create policy "withdrawals_access" on withdrawals
  for all using (
    provider_id in (select id from providers where user_id = auth.uid())
    or get_user_role() = 'admin'
  );

-- VERIFICATION LOGS: admin only
create policy "verification_logs_admin" on verification_logs
  for all using (get_user_role() = 'admin');

-- LAB ORDERS: patient and provider involved; admin sees all
create policy "lab_orders_access" on lab_orders
  for all using (
    patient_id = auth.uid()
    or provider_id in (select id from providers where user_id = auth.uid())
    or get_user_role() = 'admin'
  );

-- Lab partners: public read
alter table lab_partners enable row level security;
create policy "lab_partners_public_read" on lab_partners for select using (active = true);
create policy "lab_partners_admin_write" on lab_partners
  for all using (get_user_role() = 'admin');

-- ============================================================
-- REALTIME (enable for live tracking & dispatch)
-- ============================================================
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table providers;
alter publication supabase_realtime add table dispatch_queue;

-- ============================================================
-- INDEXES
-- ============================================================
create index providers_location_idx on providers using gist (location);
create index bookings_patient_idx on bookings (patient_id);
create index bookings_provider_idx on bookings (provider_id);
create index bookings_status_idx on bookings (status);
create index dispatch_queue_booking_idx on dispatch_queue (booking_id);
create index dispatch_queue_expires_idx on dispatch_queue (expires_at);
