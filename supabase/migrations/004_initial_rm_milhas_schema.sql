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
  full_name text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger set_credit_cards_updated_at
before update on public.credit_cards
for each row execute function public.set_updated_at();

create trigger set_points_programs_updated_at
before update on public.points_programs
for each row execute function public.set_updated_at();

create trigger set_miles_programs_updated_at
before update on public.miles_programs
for each row execute function public.set_updated_at();

create trigger set_bonus_transfers_updated_at
before update on public.bonus_transfers
for each row execute function public.set_updated_at();

create trigger set_flight_redemptions_updated_at
before update on public.flight_redemptions
for each row execute function public.set_updated_at();

create trigger set_goals_updated_at
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

create policy "Users can select own profiles"
on public.profiles for select
using (user_id = auth.uid());

create policy "Users can insert own profiles"
on public.profiles for insert
with check (user_id = auth.uid());

create policy "Users can update own profiles"
on public.profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own profiles"
on public.profiles for delete
using (user_id = auth.uid());

create policy "Users can select own clients"
on public.clients for select
using (user_id = auth.uid());

create policy "Users can insert own clients"
on public.clients for insert
with check (user_id = auth.uid());

create policy "Users can update own clients"
on public.clients for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own clients"
on public.clients for delete
using (user_id = auth.uid());

create policy "Users can select own credit cards"
on public.credit_cards for select
using (user_id = auth.uid());

create policy "Users can insert own credit cards"
on public.credit_cards for insert
with check (user_id = auth.uid());

create policy "Users can update own credit cards"
on public.credit_cards for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own credit cards"
on public.credit_cards for delete
using (user_id = auth.uid());

create policy "Users can select own points programs"
on public.points_programs for select
using (user_id = auth.uid());

create policy "Users can insert own points programs"
on public.points_programs for insert
with check (user_id = auth.uid());

create policy "Users can update own points programs"
on public.points_programs for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own points programs"
on public.points_programs for delete
using (user_id = auth.uid());

create policy "Users can select own miles programs"
on public.miles_programs for select
using (user_id = auth.uid());

create policy "Users can insert own miles programs"
on public.miles_programs for insert
with check (user_id = auth.uid());

create policy "Users can update own miles programs"
on public.miles_programs for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own miles programs"
on public.miles_programs for delete
using (user_id = auth.uid());

create policy "Users can select own bonus transfers"
on public.bonus_transfers for select
using (user_id = auth.uid());

create policy "Users can insert own bonus transfers"
on public.bonus_transfers for insert
with check (user_id = auth.uid());

create policy "Users can update own bonus transfers"
on public.bonus_transfers for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own bonus transfers"
on public.bonus_transfers for delete
using (user_id = auth.uid());

create policy "Users can select own flight redemptions"
on public.flight_redemptions for select
using (user_id = auth.uid());

create policy "Users can insert own flight redemptions"
on public.flight_redemptions for insert
with check (user_id = auth.uid());

create policy "Users can update own flight redemptions"
on public.flight_redemptions for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own flight redemptions"
on public.flight_redemptions for delete
using (user_id = auth.uid());

create policy "Users can select own goals"
on public.goals for select
using (user_id = auth.uid());

create policy "Users can insert own goals"
on public.goals for insert
with check (user_id = auth.uid());

create policy "Users can update own goals"
on public.goals for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own goals"
on public.goals for delete
using (user_id = auth.uid());
