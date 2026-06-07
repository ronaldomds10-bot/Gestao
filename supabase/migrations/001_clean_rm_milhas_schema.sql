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
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  name text,
  full_name text,
  phone text,
  role text default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  email text,
  phone text,
  plan text default 'free',
  joined_at date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank text,
  card_name text,
  limit_value numeric default 0,
  points_balance numeric default 0,
  points_per_dollar numeric default 0,
  due_day integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.points_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text,
  program_name text,
  balance numeric default 0,
  cpm numeric default 0,
  expiration_date date,
  destination_program text,
  bonus_percentage numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.miles_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  airline text,
  balance numeric default 0,
  cpm numeric default 0,
  expiration_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bonus_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origin_program text,
  destination_program text,
  sent_amount numeric default 0,
  bonus_percentage numeric default 0,
  bonus_miles numeric default 0,
  credited_miles numeric default 0,
  transfer_date date,
  generated_value numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.flight_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  redemption_date date,
  origin text,
  destination text,
  airline text,
  regular_price numeric default 0,
  miles_used numeric default 0,
  cpm numeric default 0,
  airport_fee numeric default 0,
  total_cost numeric default 0,
  savings numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  destination text,
  required_miles numeric default 0,
  deadline date,
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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists credit_cards_set_updated_at on public.credit_cards;
create trigger credit_cards_set_updated_at
before update on public.credit_cards
for each row execute function public.set_updated_at();

drop trigger if exists points_programs_set_updated_at on public.points_programs;
create trigger points_programs_set_updated_at
before update on public.points_programs
for each row execute function public.set_updated_at();

drop trigger if exists miles_programs_set_updated_at on public.miles_programs;
create trigger miles_programs_set_updated_at
before update on public.miles_programs
for each row execute function public.set_updated_at();

drop trigger if exists bonus_transfers_set_updated_at on public.bonus_transfers;
create trigger bonus_transfers_set_updated_at
before update on public.bonus_transfers
for each row execute function public.set_updated_at();

drop trigger if exists flight_redemptions_set_updated_at on public.flight_redemptions;
create trigger flight_redemptions_set_updated_at
before update on public.flight_redemptions
for each row execute function public.set_updated_at();

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.credit_cards enable row level security;
alter table public.points_programs enable row level security;
alter table public.miles_programs enable row level security;
alter table public.bonus_transfers enable row level security;
alter table public.flight_redemptions enable row level security;
alter table public.goals enable row level security;

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
