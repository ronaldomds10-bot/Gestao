alter table public.clients
  add column if not exists local_id text;

update public.clients
set local_id = id::text
where local_id is null;

alter table public.clients
  alter column local_id set not null;

create unique index if not exists clients_user_local_id_key
  on public.clients(user_id, local_id);
