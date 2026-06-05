alter table public.credit_cards
  add column if not exists client_id uuid references public.clients(id) on delete cascade,
  add column if not exists limit_value numeric(14, 2) not null default 0,
  add column if not exists points_balance integer not null default 0;

alter table public.points_programs
  add column if not exists client_id uuid references public.clients(id) on delete cascade,
  add column if not exists type text not null default 'loyalty_points',
  add column if not exists cpm numeric(12, 6) not null default 0;

alter table public.miles_programs
  add column if not exists client_id uuid references public.clients(id) on delete cascade,
  add column if not exists cpm numeric(12, 6) not null default 0,
  add column if not exists bonus_percentage numeric(8, 2) not null default 0;

alter table public.bonus_transfers
  add column if not exists client_id uuid references public.clients(id) on delete cascade,
  add column if not exists origin_program_name text not null default '',
  add column if not exists destination_program_name text not null default '';

alter table public.flight_redemptions
  add column if not exists redemption_date date,
  add column if not exists airline text not null default '',
  add column if not exists regular_price numeric(14, 2) not null default 0,
  add column if not exists paid_price numeric(14, 2) not null default 0,
  add column if not exists cpm numeric(12, 6),
  add column if not exists airport_fee numeric(14, 2) not null default 0;

alter table public.goals
  add column if not exists client_id uuid references public.clients(id) on delete cascade,
  add column if not exists destination text not null default '',
  add column if not exists required_miles integer not null default 0,
  add column if not exists deadline date;

create index if not exists credit_cards_user_client_idx on public.credit_cards(user_id, client_id);
create index if not exists points_programs_user_client_idx on public.points_programs(user_id, client_id);
create index if not exists miles_programs_user_client_idx on public.miles_programs(user_id, client_id);
create index if not exists bonus_transfers_user_client_idx on public.bonus_transfers(user_id, client_id);
create index if not exists flight_redemptions_user_client_idx on public.flight_redemptions(user_id, client_id);
create index if not exists goals_user_client_idx on public.goals(user_id, client_id);
