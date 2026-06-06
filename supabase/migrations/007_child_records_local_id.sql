alter table public.credit_cards
  add column if not exists local_id text;

alter table public.points_programs
  add column if not exists local_id text;

alter table public.miles_programs
  add column if not exists local_id text;

alter table public.bonus_transfers
  add column if not exists local_id text;

alter table public.flight_redemptions
  add column if not exists local_id text;

alter table public.goals
  add column if not exists local_id text;

update public.credit_cards
set local_id = id::text
where local_id is null;

update public.points_programs
set local_id = id::text
where local_id is null;

update public.miles_programs
set local_id = id::text
where local_id is null;

update public.bonus_transfers
set local_id = id::text
where local_id is null;

update public.flight_redemptions
set local_id = id::text
where local_id is null;

update public.goals
set local_id = id::text
where local_id is null;

alter table public.credit_cards
  alter column local_id set not null;

alter table public.points_programs
  alter column local_id set not null;

alter table public.miles_programs
  alter column local_id set not null;

alter table public.bonus_transfers
  alter column local_id set not null;

alter table public.flight_redemptions
  alter column local_id set not null;

alter table public.goals
  alter column local_id set not null;

create unique index if not exists credit_cards_user_local_id_key
  on public.credit_cards(user_id, local_id);

create unique index if not exists points_programs_user_local_id_key
  on public.points_programs(user_id, local_id);

create unique index if not exists miles_programs_user_local_id_key
  on public.miles_programs(user_id, local_id);

create unique index if not exists bonus_transfers_user_local_id_key
  on public.bonus_transfers(user_id, local_id);

create unique index if not exists flight_redemptions_user_local_id_key
  on public.flight_redemptions(user_id, local_id);

create unique index if not exists goals_user_local_id_key
  on public.goals(user_id, local_id);
