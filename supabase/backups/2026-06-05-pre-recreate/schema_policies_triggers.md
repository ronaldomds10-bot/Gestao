# Supabase Backup Report - Pre Recreate

Project ref: `fiwwnsgjyukgeqstxbdd`

## Tables

### bonus_transfers

```text
id uuid not null default gen_random_uuid()
user_id uuid not null
points_program_id uuid null
miles_program_id uuid null
transferred_points integer not null default 0
bonus_percentage numeric null default 0
received_miles integer not null default 0
transfer_date date null
status text null default 'pending'
notes text null
created_at timestamp with time zone null default now()
updated_at timestamp with time zone null default now()
client_id uuid null
origin_program_name text not null default ''
destination_program_name text not null default ''
```

### clients

```text
id uuid not null default gen_random_uuid()
user_id uuid not null
name text not null
email text null
phone text null
notes text null
created_at timestamp with time zone null default now()
updated_at timestamp with time zone null default now()
joined_at date null
plan text not null default ''
```

### credit_cards

```text
id uuid not null default gen_random_uuid()
user_id uuid not null
name text not null
bank text null
brand text null
last_four text null
closing_day integer null
due_day integer null
annual_fee numeric null
points_multiplier numeric null
created_at timestamp with time zone null default now()
updated_at timestamp with time zone null default now()
client_id uuid null
limit_value numeric not null default 0
points_balance integer not null default 0
```

### flight_redemptions

```text
id uuid not null default gen_random_uuid()
user_id uuid not null
client_id uuid null
miles_program_id uuid null
origin text null
destination text null
departure_date date null
return_date date null
miles_used integer not null default 0
cash_cost numeric null default 0
taxes numeric null default 0
sale_price numeric null default 0
status text null default 'planned'
notes text null
created_at timestamp with time zone null default now()
updated_at timestamp with time zone null default now()
redemption_date date null
airline text not null default ''
regular_price numeric not null default 0
paid_price numeric not null default 0
cpm numeric null
airport_fee numeric not null default 0
```

### goals

```text
id uuid not null default gen_random_uuid()
user_id uuid not null
title text not null
description text null
target_value numeric null
current_value numeric null default 0
due_date date null
status text null default 'active'
created_at timestamp with time zone null default now()
updated_at timestamp with time zone null default now()
client_id uuid null
destination text not null default ''
required_miles integer not null default 0
deadline date null
```

### miles_programs

```text
id uuid not null default gen_random_uuid()
user_id uuid not null
name text not null
airline text null
balance integer null default 0
expiration_date date null
notes text null
created_at timestamp with time zone null default now()
updated_at timestamp with time zone null default now()
client_id uuid null
cpm numeric not null default 0
bonus_percentage numeric not null default 0
```

### points_programs

```text
id uuid not null default gen_random_uuid()
user_id uuid not null
name text not null
balance integer null default 0
expiration_date date null
notes text null
created_at timestamp with time zone null default now()
updated_at timestamp with time zone null default now()
client_id uuid null
type text not null default 'loyalty_points'
cpm numeric not null default 0
```

### profiles

```text
id uuid not null default gen_random_uuid()
user_id uuid not null
full_name text null
email text null
created_at timestamp with time zone null default now()
updated_at timestamp with time zone null default now()
name text not null default ''
phone text not null default ''
```

## RLS Policies

Every requested table has authenticated-only own-row policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` using `user_id = auth.uid()`.

Tables checked:

- `profiles`
- `clients`
- `credit_cards`
- `points_programs`
- `miles_programs`
- `bonus_transfers`
- `flight_redemptions`
- `goals`

## Triggers

Each requested table has a `BEFORE UPDATE` trigger executing `set_updated_at()`:

- `profiles_set_updated_at`
- `clients_set_updated_at`
- `credit_cards_set_updated_at`
- `points_programs_set_updated_at`
- `miles_programs_set_updated_at`
- `bonus_transfers_set_updated_at`
- `flight_redemptions_set_updated_at`
- `goals_set_updated_at`
