-- ============================================================
-- SportNutritionPlanning — Supabase schema + Row Level Security
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query → Paste → Run
-- ============================================================

-- ============================================================
-- 1. PROFILES — one row per authenticated user
-- ============================================================
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  full_name      text,
  age            integer,
  sex            text check (sex in ('male','female')),
  height_cm      numeric,
  weight_kg      numeric,
  country        text,
  city           text,
  units          text default 'metric',
  sport          text,
  training_days  integer,
  intensity      text,
  timing         text,
  goal           text,
  restrictions   text[] default '{}',
  dislikes       text,
  household      text default 'solo',
  language       text default 'en',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_upsert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id);

-- ============================================================
-- 2. FAMILIES — a household group
-- ============================================================
create table if not exists public.families (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text default 'My family',
  created_at    timestamptz default now()
);

alter table public.families enable row level security;

drop policy if exists "families_owner_all" on public.families;
create policy "families_owner_all" on public.families
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ============================================================
-- 3. FAMILY_MEMBERS — members of a family. May or may not have a linked auth user.
-- ============================================================
create table if not exists public.family_members (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families(id) on delete cascade,
  linked_user_id  uuid references auth.users(id) on delete set null,
  invite_email    text,
  display_name    text not null,
  age             integer,
  sex             text check (sex in ('male','female')),
  height_cm       numeric,
  weight_kg       numeric,
  sport           text,
  intensity       text,
  goal            text,
  restrictions    text[] default '{}',
  role            text default 'member', -- 'owner' | 'member'
  invite_status   text default 'pending', -- 'pending' | 'accepted'
  created_at      timestamptz default now()
);

alter table public.family_members enable row level security;

-- The family owner can do anything with members of their family.
drop policy if exists "family_members_owner_all" on public.family_members;
create policy "family_members_owner_all" on public.family_members
  for all using (
    exists (
      select 1 from public.families f
      where f.id = family_members.family_id and f.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.families f
      where f.id = family_members.family_id and f.owner_id = auth.uid()
    )
  );

-- A linked member can read their own row
drop policy if exists "family_members_self_select" on public.family_members;
create policy "family_members_self_select" on public.family_members
  for select using (linked_user_id = auth.uid());

-- ============================================================
-- 4. PLANS — generated weekly nutrition plans
-- ============================================================
create table if not exists public.plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  family_id     uuid references public.families(id) on delete set null,
  data          jsonb not null,  -- the entire plan JSON returned by /generate-plan
  language      text default 'en',
  version       integer default 1,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

create index if not exists plans_user_active_idx on public.plans (user_id, is_active);

alter table public.plans enable row level security;

drop policy if exists "plans_owner_all" on public.plans;
create policy "plans_owner_all" on public.plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Linked family members can read their family's active plan
drop policy if exists "plans_family_member_select" on public.plans;
create policy "plans_family_member_select" on public.plans
  for select using (
    family_id is not null
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = plans.family_id and fm.linked_user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. SUBSCRIPTIONS — synced from Stripe webhooks
-- ============================================================
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text,        -- active, past_due, canceled, trialing, etc.
  price_id               text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean default false,
  updated_at             timestamptz default now()
);

drop trigger if exists trg_subs_touch on public.subscriptions;
create trigger trg_subs_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

alter table public.subscriptions enable row level security;

-- Users can read their own subscription
drop policy if exists "subs_select_own" on public.subscriptions;
create policy "subs_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Inserts/updates only via service role (the Stripe webhook)
-- (default policy: no insert/update from anon/auth users, which is what we want)

-- ============================================================
-- 6. USAGE — track AI calls per user for Free-tier limits
-- ============================================================
create table if not exists public.usage (
  user_id        uuid not null references auth.users(id) on delete cascade,
  month          text not null,        -- 'YYYY-MM'
  ai_regens      integer default 0,
  ai_swaps       integer default 0,
  primary key (user_id, month)
);

alter table public.usage enable row level security;
drop policy if exists "usage_select_own" on public.usage;
create policy "usage_select_own" on public.usage for select using (auth.uid() = user_id);
drop policy if exists "usage_upsert_own" on public.usage;
create policy "usage_upsert_own" on public.usage for insert with check (auth.uid() = user_id);
drop policy if exists "usage_update_own" on public.usage;
create policy "usage_update_own" on public.usage for update using (auth.uid() = user_id);

-- ============================================================
-- 7. Trigger: auto-create a profile row when a new auth user signs up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- DONE!
-- Now go to Authentication → Providers → enable Email and Google.
-- For Google OAuth, follow Supabase docs to create OAuth credentials.
-- ============================================================
