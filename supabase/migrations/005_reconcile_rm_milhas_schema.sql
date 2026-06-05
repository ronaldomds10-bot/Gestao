create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  full_name text,
  email text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  joined_at date,
  plan text not null default '',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists name text not null default '',
  add column if not exists full_name text,
  add column if not exists email text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.clients
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists name text not null default '',
  add column if not exists email text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists joined_at date,
  add column if not exists plan text not null default '',
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  bank text,
  brand text,
  last_four text,
  closing_day int,
  due_day int,
  annual_fee numeric(12,2),
  points_multiplier numeric(10,4),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.points_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  balance int default 0,
  expiration_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.miles_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  airline text,
  balance int default 0,
  expiration_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bonus_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  points_program_id uuid references public.points_programs(id) on delete set null,
  miles_program_id uuid references public.miles_programs(id) on delete set null,
  transferred_points int not null default 0,
  bonus_percentage numeric(7,4) default 0,
  received_miles int not null default 0,
  transfer_date date,
  status text default 'pending',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.flight_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  miles_program_id uuid references public.miles_programs(id) on delete set null,
  origin text,
  destination text,
  departure_date date,
  return_date date,
  miles_used int not null default 0,
  cash_cost numeric(12,2) default 0,
  taxes numeric(12,2) default 0,
  sale_price numeric(12,2) default 0,
  status text default 'planned',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_value numeric(14,2),
  current_value numeric(14,2) default 0,
  due_date date,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists profiles_user_id_idx on public.profiles(user_id);
create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists credit_cards_user_id_idx on public.credit_cards(user_id);
create index if not exists points_programs_user_id_idx on public.points_programs(user_id);
create index if not exists miles_programs_user_id_idx on public.miles_programs(user_id);
create index if not exists bonus_transfers_user_id_idx on public.bonus_transfers(user_id);
create index if not exists flight_redemptions_user_id_idx on public.flight_redemptions(user_id);
create index if not exists goals_user_id_idx on public.goals(user_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
drop trigger if exists set_clients_updated_at on public.clients;
drop trigger if exists set_credit_cards_updated_at on public.credit_cards;
drop trigger if exists set_points_programs_updated_at on public.points_programs;
drop trigger if exists set_miles_programs_updated_at on public.miles_programs;
drop trigger if exists set_bonus_transfers_updated_at on public.bonus_transfers;
drop trigger if exists set_flight_redemptions_updated_at on public.flight_redemptions;
drop trigger if exists set_goals_updated_at on public.goals;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_set_updated_at' and tgrelid = 'public.profiles'::regclass) then
    create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'clients_set_updated_at' and tgrelid = 'public.clients'::regclass) then
    create trigger clients_set_updated_at
    before update on public.clients
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'credit_cards_set_updated_at' and tgrelid = 'public.credit_cards'::regclass) then
    create trigger credit_cards_set_updated_at
    before update on public.credit_cards
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'points_programs_set_updated_at' and tgrelid = 'public.points_programs'::regclass) then
    create trigger points_programs_set_updated_at
    before update on public.points_programs
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'miles_programs_set_updated_at' and tgrelid = 'public.miles_programs'::regclass) then
    create trigger miles_programs_set_updated_at
    before update on public.miles_programs
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'bonus_transfers_set_updated_at' and tgrelid = 'public.bonus_transfers'::regclass) then
    create trigger bonus_transfers_set_updated_at
    before update on public.bonus_transfers
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'flight_redemptions_set_updated_at' and tgrelid = 'public.flight_redemptions'::regclass) then
    create trigger flight_redemptions_set_updated_at
    before update on public.flight_redemptions
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'goals_set_updated_at' and tgrelid = 'public.goals'::regclass) then
    create trigger goals_set_updated_at
    before update on public.goals
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.credit_cards enable row level security;
alter table public.points_programs enable row level security;
alter table public.miles_programs enable row level security;
alter table public.bonus_transfers enable row level security;
alter table public.flight_redemptions enable row level security;
alter table public.goals enable row level security;

drop policy if exists "Users can select own profiles" on public.profiles;
drop policy if exists "Users can insert own profiles" on public.profiles;
drop policy if exists "Users can update own profiles" on public.profiles;
drop policy if exists "Users can delete own profiles" on public.profiles;
drop policy if exists "Users can select own clients" on public.clients;
drop policy if exists "Users can insert own clients" on public.clients;
drop policy if exists "Users can update own clients" on public.clients;
drop policy if exists "Users can delete own clients" on public.clients;
drop policy if exists "Users can select own credit cards" on public.credit_cards;
drop policy if exists "Users can insert own credit cards" on public.credit_cards;
drop policy if exists "Users can update own credit cards" on public.credit_cards;
drop policy if exists "Users can delete own credit cards" on public.credit_cards;
drop policy if exists "Users can select own points programs" on public.points_programs;
drop policy if exists "Users can insert own points programs" on public.points_programs;
drop policy if exists "Users can update own points programs" on public.points_programs;
drop policy if exists "Users can delete own points programs" on public.points_programs;
drop policy if exists "Users can select own miles programs" on public.miles_programs;
drop policy if exists "Users can insert own miles programs" on public.miles_programs;
drop policy if exists "Users can update own miles programs" on public.miles_programs;
drop policy if exists "Users can delete own miles programs" on public.miles_programs;
drop policy if exists "Users can select own bonus transfers" on public.bonus_transfers;
drop policy if exists "Users can insert own bonus transfers" on public.bonus_transfers;
drop policy if exists "Users can update own bonus transfers" on public.bonus_transfers;
drop policy if exists "Users can delete own bonus transfers" on public.bonus_transfers;
drop policy if exists "Users can select own flight redemptions" on public.flight_redemptions;
drop policy if exists "Users can insert own flight redemptions" on public.flight_redemptions;
drop policy if exists "Users can update own flight redemptions" on public.flight_redemptions;
drop policy if exists "Users can delete own flight redemptions" on public.flight_redemptions;
drop policy if exists "Users can select own goals" on public.goals;
drop policy if exists "Users can insert own goals" on public.goals;
drop policy if exists "Users can update own goals" on public.goals;
drop policy if exists "Users can delete own goals" on public.goals;

drop policy if exists profiles_select_own_user_id on public.profiles;
create policy profiles_select_own_user_id on public.profiles
for select to authenticated
using (user_id = auth.uid());

drop policy if exists profiles_insert_own_user_id on public.profiles;
create policy profiles_insert_own_user_id on public.profiles
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists profiles_update_own_user_id on public.profiles;
create policy profiles_update_own_user_id on public.profiles
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists profiles_delete_own_user_id on public.profiles;
create policy profiles_delete_own_user_id on public.profiles
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists clients_select_own_user_id on public.clients;
create policy clients_select_own_user_id on public.clients
for select to authenticated
using (user_id = auth.uid());

drop policy if exists clients_insert_own_user_id on public.clients;
create policy clients_insert_own_user_id on public.clients
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists clients_update_own_user_id on public.clients;
create policy clients_update_own_user_id on public.clients
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists clients_delete_own_user_id on public.clients;
create policy clients_delete_own_user_id on public.clients
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists credit_cards_select_own_user_id on public.credit_cards;
create policy credit_cards_select_own_user_id on public.credit_cards
for select to authenticated
using (user_id = auth.uid());

drop policy if exists credit_cards_insert_own_user_id on public.credit_cards;
create policy credit_cards_insert_own_user_id on public.credit_cards
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists credit_cards_update_own_user_id on public.credit_cards;
create policy credit_cards_update_own_user_id on public.credit_cards
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists credit_cards_delete_own_user_id on public.credit_cards;
create policy credit_cards_delete_own_user_id on public.credit_cards
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists points_programs_select_own_user_id on public.points_programs;
create policy points_programs_select_own_user_id on public.points_programs
for select to authenticated
using (user_id = auth.uid());

drop policy if exists points_programs_insert_own_user_id on public.points_programs;
create policy points_programs_insert_own_user_id on public.points_programs
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists points_programs_update_own_user_id on public.points_programs;
create policy points_programs_update_own_user_id on public.points_programs
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists points_programs_delete_own_user_id on public.points_programs;
create policy points_programs_delete_own_user_id on public.points_programs
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists miles_programs_select_own_user_id on public.miles_programs;
create policy miles_programs_select_own_user_id on public.miles_programs
for select to authenticated
using (user_id = auth.uid());

drop policy if exists miles_programs_insert_own_user_id on public.miles_programs;
create policy miles_programs_insert_own_user_id on public.miles_programs
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists miles_programs_update_own_user_id on public.miles_programs;
create policy miles_programs_update_own_user_id on public.miles_programs
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists miles_programs_delete_own_user_id on public.miles_programs;
create policy miles_programs_delete_own_user_id on public.miles_programs
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists bonus_transfers_select_own_user_id on public.bonus_transfers;
create policy bonus_transfers_select_own_user_id on public.bonus_transfers
for select to authenticated
using (user_id = auth.uid());

drop policy if exists bonus_transfers_insert_own_user_id on public.bonus_transfers;
create policy bonus_transfers_insert_own_user_id on public.bonus_transfers
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists bonus_transfers_update_own_user_id on public.bonus_transfers;
create policy bonus_transfers_update_own_user_id on public.bonus_transfers
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists bonus_transfers_delete_own_user_id on public.bonus_transfers;
create policy bonus_transfers_delete_own_user_id on public.bonus_transfers
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists flight_redemptions_select_own_user_id on public.flight_redemptions;
create policy flight_redemptions_select_own_user_id on public.flight_redemptions
for select to authenticated
using (user_id = auth.uid());

drop policy if exists flight_redemptions_insert_own_user_id on public.flight_redemptions;
create policy flight_redemptions_insert_own_user_id on public.flight_redemptions
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists flight_redemptions_update_own_user_id on public.flight_redemptions;
create policy flight_redemptions_update_own_user_id on public.flight_redemptions
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists flight_redemptions_delete_own_user_id on public.flight_redemptions;
create policy flight_redemptions_delete_own_user_id on public.flight_redemptions
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists goals_select_own_user_id on public.goals;
create policy goals_select_own_user_id on public.goals
for select to authenticated
using (user_id = auth.uid());

drop policy if exists goals_insert_own_user_id on public.goals;
create policy goals_insert_own_user_id on public.goals
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists goals_update_own_user_id on public.goals;
create policy goals_update_own_user_id on public.goals
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists goals_delete_own_user_id on public.goals;
create policy goals_delete_own_user_id on public.goals
for delete to authenticated
using (user_id = auth.uid());
