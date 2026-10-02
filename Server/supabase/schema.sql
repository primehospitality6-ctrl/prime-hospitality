-- Prime Hospitality CMS schema — applied automatically by the API on startup (DATABASE_URL),
-- or manually with `npm run seed`.
-- Inventory layering: destinations → compounds (properties) → units (unit types).
-- Photos: Cloudinary URLs for slideshow/destinations/properties; Google Drive URLs for unit galleries.
-- Safe to re-run: "add column if not exists" migrates older databases.

create extension if not exists "pgcrypto";

create table if not exists destinations (
  id text primary key,
  name text not null,
  description text not null default '',
  image text not null default '',
  sort_order integer not null default 0,
  show_on_home boolean not null default true,
  published boolean not null default true,
  kwentra_destination_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists compounds (
  id text primary key,
  name text not null,
  region text not null default '',
  destination_id text not null default '',
  unit_count integer not null default 0,
  image text not null default '',
  sort_order integer not null default 0,
  show_on_home boolean not null default true,
  published boolean not null default true,
  kwentra_project_id text not null default '',
  kwentra_destination_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists units (
  id text primary key,
  slug text not null unique,
  title text not null,
  compound_id text references compounds (id) on delete set null,
  compound text not null default '',
  region text not null default '',
  city text not null default '',
  property_type text not null default 'Apartment',
  bedrooms integer not null default 1,
  bathrooms integer not null default 1,
  area_sqm numeric not null default 0,
  max_guests integer not null default 2,
  price_per_night numeric not null default 0,
  currency text not null default 'EGP',
  featured boolean not null default false,
  available boolean not null default true,
  published boolean not null default true,
  amenities jsonb not null default '[]'::jsonb,
  facilities jsonb not null default '[]'::jsonb,
  description text not null default '',
  images jsonb not null default '[]'::jsonb,
  drive_folder_url text not null default '',
  kwentra_room_type_id text not null default '',
  home_order integer not null default 999,
  search_order integer not null default 0,
  average_rating numeric not null default 0,
  review_count integer not null default 0,
  reviews jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table compounds add column if not exists brand text not null default '';
alter table compounds add column if not exists city text not null default '';

alter table units add column if not exists unit_type text not null default '';
alter table units add column if not exists brand text not null default '';
alter table units add column if not exists destination_id text not null default '';
alter table units add column if not exists destination text not null default '';

-- Property fact-sheet attributes (synced from Kwentra / imported from the inventory sheets)
alter table compounds add column if not exists description text not null default '';
alter table compounds add column if not exists address text not null default '';
alter table compounds add column if not exists maps_url text not null default '';
alter table compounds add column if not exists latitude double precision;
alter table compounds add column if not exists longitude double precision;
alter table compounds add column if not exists building_number text not null default '';
alter table compounds add column if not exists phone text not null default '';
alter table compounds add column if not exists facilities jsonb not null default '[]'::jsonb;
alter table compounds add column if not exists drive_folder_url text not null default '';
alter table compounds add column if not exists fact_sheet_url text not null default '';

-- Unit-type attributes: how many physical units, their numbers, floor, bed setup
alter table units add column if not exists room_count integer;
alter table units add column if not exists unit_numbers jsonb not null default '[]'::jsonb;
alter table units add column if not exists floor text not null default '';
alter table units add column if not exists bed_type text not null default '';

-- Last values pulled from Kwentra (lets the sync tell PMS changes apart from admin edits)
alter table compounds add column if not exists kwentra_snapshot jsonb;
alter table units add column if not exists kwentra_snapshot jsonb;

-- Kwentra tenant (hotel) each property lives in — every PMS call for its units uses this tenant_id
alter table compounds add column if not exists kwentra_tenant_id text not null default '';

create index if not exists compounds_destination_idx on compounds (destination_id);
create index if not exists units_destination_idx on units (destination_id);
create index if not exists units_unit_type_idx on units (unit_type);
create index if not exists units_published_idx on units (published);
create index if not exists units_featured_idx on units (featured);
create index if not exists units_search_order_idx on units (search_order);
create index if not exists units_home_order_idx on units (home_order);

create table if not exists slideshow_slides (
  id text primary key,
  image text not null,
  alt text not null default '',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists site_settings (
  id text primary key default 'default',
  meta_pixel_id text not null default '',
  facebook_pixel_id text not null default '',
  google_ads_id text not null default '',
  gtm_id text not null default '',
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Website content: business info, announcement bar, homepage layout, pages, SEO, text overrides
alter table site_settings add column if not exists site jsonb not null default '{}'::jsonb;

insert into site_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'requested',
  slug text not null,
  listing_id text,
  listing_title text,
  name text not null,
  email text not null,
  phone text,
  guests integer,
  check_in date,
  check_out date,
  notes text,
  price_per_night numeric,
  currency text default 'EGP',
  created_at timestamptz not null default now()
);

-- PMS data fields captured by the website booking engine
alter table bookings add column if not exists voucher_number text unique;
alter table bookings add column if not exists channel text;
alter table bookings add column if not exists payment_status text;
alter table bookings add column if not exists destination_id text;
alter table bookings add column if not exists destination text;
alter table bookings add column if not exists property_id text;
alter table bookings add column if not exists property text;
alter table bookings add column if not exists brand text;
alter table bookings add column if not exists room_type text;
alter table bookings add column if not exists kwentra_room_type_id text;
alter table bookings add column if not exists primary_guest_name text;
alter table bookings add column if not exists other_guest_names jsonb not null default '[]'::jsonb;
alter table bookings add column if not exists nationality text;
alter table bookings add column if not exists reservation_country text;
alter table bookings add column if not exists adults integer;
alter table bookings add column if not exists children integer;
alter table bookings add column if not exists nights integer;
alter table bookings add column if not exists check_in_time text;
alter table bookings add column if not exists check_out_time text;
alter table bookings add column if not exists rate_plan_code text;
alter table bookings add column if not exists rate_plan_name text;
alter table bookings add column if not exists rate_amount numeric;
alter table bookings add column if not exists average_nightly_rate numeric;
alter table bookings add column if not exists external_ref text;
alter table bookings add column if not exists kwentra_reservation_id text;
alter table bookings add column if not exists kwentra_profile_id text;

create index if not exists bookings_external_ref_idx on bookings (external_ref);

-- Serial behind website voucher numbers (PHW-YYYY-000001)
create sequence if not exists booking_voucher_seq;

create or replace function next_voucher_serial()
returns bigint
language sql
as $$ select nextval('booking_voucher_seq') $$;

-- Guests book without accounts; the old guest-login table stored plain-text passwords.
drop table if exists guests;

-- The API connects as the table owner (bypasses RLS); RLS keeps Supabase's public anon key read-only.
alter table destinations enable row level security;
alter table compounds enable row level security;
alter table units enable row level security;
alter table slideshow_slides enable row level security;
alter table site_settings enable row level security;
alter table bookings enable row level security;
-- Public read for published content (optional; server uses service role)
drop policy if exists "Public read destinations" on destinations;
create policy "Public read destinations"
  on destinations for select
  using (published = true);

drop policy if exists "Public read compounds" on compounds;
create policy "Public read compounds"
  on compounds for select
  using (published = true);

drop policy if exists "Public read units" on units;
create policy "Public read units"
  on units for select
  using (published = true);

drop policy if exists "Public read slides" on slideshow_slides;
create policy "Public read slides"
  on slideshow_slides for select
  using (enabled = true);

drop policy if exists "Public read settings" on site_settings;
create policy "Public read settings"
  on site_settings for select
  using (true);
