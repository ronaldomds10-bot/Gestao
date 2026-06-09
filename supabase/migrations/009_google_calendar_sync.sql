create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_email text null,
  refresh_token_encrypted text not null,
  access_token_encrypted text null,
  access_token_expires_at timestamptz null,
  calendar_id text not null default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.points_programs
  add column if not exists google_event_id text null,
  add column if not exists calendar_synced_at timestamptz null,
  add column if not exists calendar_sync_enabled boolean not null default false;

alter table public.miles_programs
  add column if not exists google_event_id text null,
  add column if not exists calendar_synced_at timestamptz null,
  add column if not exists calendar_sync_enabled boolean not null default false;

create index if not exists points_programs_google_event_id_idx
  on public.points_programs(google_event_id)
  where google_event_id is not null;

create index if not exists miles_programs_google_event_id_idx
  on public.miles_programs(google_event_id)
  where google_event_id is not null;

create index if not exists google_calendar_connections_user_id_idx
  on public.google_calendar_connections(user_id);

drop trigger if exists google_calendar_connections_set_updated_at on public.google_calendar_connections;
create trigger google_calendar_connections_set_updated_at
before update on public.google_calendar_connections
for each row execute function public.set_updated_at();

alter table public.google_calendar_connections enable row level security;

drop policy if exists google_calendar_connections_select_own_user_id on public.google_calendar_connections;
create policy google_calendar_connections_select_own_user_id on public.google_calendar_connections
for select using (auth.uid() = user_id);

drop policy if exists google_calendar_connections_delete_own_user_id on public.google_calendar_connections;
create policy google_calendar_connections_delete_own_user_id on public.google_calendar_connections
for delete using (auth.uid() = user_id);
