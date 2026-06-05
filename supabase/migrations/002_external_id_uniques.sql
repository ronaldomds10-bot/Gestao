alter table public.credit_cards
  add column if not exists external_id text;

alter table public.points_programs
  add column if not exists external_id text;

alter table public.miles_programs
  add column if not exists external_id text;

alter table public.bonus_transfers
  add column if not exists external_id text;

alter table public.flight_redemptions
  add column if not exists external_id text;

alter table public.goals
  add column if not exists external_id text;

create unique index if not exists credit_cards_user_external_id_key
  on public.credit_cards(user_id, external_id);

create unique index if not exists points_programs_user_external_id_key
  on public.points_programs(user_id, external_id);

create unique index if not exists miles_programs_user_external_id_key
  on public.miles_programs(user_id, external_id);

create unique index if not exists bonus_transfers_user_external_id_key
  on public.bonus_transfers(user_id, external_id);

create unique index if not exists flight_redemptions_user_external_id_key
  on public.flight_redemptions(user_id, external_id);

create unique index if not exists goals_user_external_id_key
  on public.goals(user_id, external_id);
