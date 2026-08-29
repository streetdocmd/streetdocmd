-- ============================================================
-- Migration 025: Link provider_services to a bookable service_type
--
-- provider_services (added in 023) was a free-text catalogue — a provider
-- could name a service "Wound Care Visit" but nothing connected that row
-- to the `wound_care` service_type patients actually book, so the booking
-- flow had no way to look up a provider's own price for a given service
-- and fell back to the global SERVICE_PRICES map for everyone.
--
-- Adds a nullable service_type column so a provider can optionally tag a
-- service with the booking type it corresponds to. Nullable because a
-- provider can still list something purely informational (e.g. a package
-- description) that isn't meant to override a specific booking price.
-- Additive only.
-- ============================================================

alter table provider_services add column if not exists service_type text;

do $$ begin
  alter table provider_services add constraint provider_services_service_type_check check (
    service_type is null or service_type in (
      'general_consultation', 'wellness_check', 'wound_care', 'elderly_review',
      'nursing_care', 'custom_request', 'physiotherapy_assessment', 'physiotherapy_session'
    )
  );
exception when duplicate_object then null; end $$;

-- A provider shouldn't have two active services mapped to the same
-- booking type — that would make "the" price ambiguous for a lookup.
create unique index if not exists provider_services_provider_service_type_idx
  on provider_services(provider_id, service_type)
  where active = true and service_type is not null;
