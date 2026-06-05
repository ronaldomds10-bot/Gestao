CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  joined_at date,
  plan text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  bank text NOT NULL DEFAULT '',
  card_name text NOT NULL DEFAULT '',
  limit_value numeric(14, 2) NOT NULL DEFAULT 0,
  points_balance integer NOT NULL DEFAULT 0,
  points_per_dollar numeric(10, 2) NOT NULL DEFAULT 0,
  due_day integer NOT NULL DEFAULT 1 CHECK (due_day BETWEEN 1 AND 31),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.points_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'loyalty_points' CHECK (type IN ('loyalty_points', 'bank_points')),
  program_name text NOT NULL DEFAULT '',
  balance integer NOT NULL DEFAULT 0,
  cpm numeric(12, 6) NOT NULL DEFAULT 0,
  expiration_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.miles_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  airline text NOT NULL DEFAULT '',
  balance integer NOT NULL DEFAULT 0,
  cpm numeric(12, 6) NOT NULL DEFAULT 0,
  bonus_percentage numeric(8, 2) NOT NULL DEFAULT 0,
  expiration_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bonus_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  origin_program_id uuid REFERENCES public.points_programs(id) ON DELETE SET NULL,
  destination_program_id uuid REFERENCES public.miles_programs(id) ON DELETE SET NULL,
  origin_program_name text NOT NULL DEFAULT '',
  destination_program_name text NOT NULL DEFAULT '',
  sent_amount integer NOT NULL DEFAULT 0 CHECK (sent_amount >= 0),
  bonus_percentage numeric(8, 2) NOT NULL DEFAULT 0,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flight_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  redemption_date date NOT NULL DEFAULT CURRENT_DATE,
  origin text NOT NULL DEFAULT '',
  destination text NOT NULL DEFAULT '',
  airline text NOT NULL DEFAULT '',
  regular_price numeric(14, 2) NOT NULL DEFAULT 0,
  paid_price numeric(14, 2) NOT NULL DEFAULT 0,
  miles_used integer NOT NULL DEFAULT 0,
  cpm numeric(12, 6),
  airport_fee numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  destination text NOT NULL DEFAULT '',
  required_miles integer NOT NULL DEFAULT 0 CHECK (required_miles >= 0),
  deadline date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS clients_user_id_idx ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS credit_cards_user_client_idx ON public.credit_cards(user_id, client_id);
CREATE INDEX IF NOT EXISTS points_programs_user_client_idx ON public.points_programs(user_id, client_id);
CREATE INDEX IF NOT EXISTS miles_programs_user_client_idx ON public.miles_programs(user_id, client_id);
CREATE INDEX IF NOT EXISTS bonus_transfers_user_client_idx ON public.bonus_transfers(user_id, client_id);
CREATE INDEX IF NOT EXISTS flight_redemptions_user_client_idx ON public.flight_redemptions(user_id, client_id);
CREATE INDEX IF NOT EXISTS goals_user_client_idx ON public.goals(user_id, client_id);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS clients_set_updated_at ON public.clients;
CREATE TRIGGER clients_set_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS credit_cards_set_updated_at ON public.credit_cards;
CREATE TRIGGER credit_cards_set_updated_at
BEFORE UPDATE ON public.credit_cards
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS points_programs_set_updated_at ON public.points_programs;
CREATE TRIGGER points_programs_set_updated_at
BEFORE UPDATE ON public.points_programs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS miles_programs_set_updated_at ON public.miles_programs;
CREATE TRIGGER miles_programs_set_updated_at
BEFORE UPDATE ON public.miles_programs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS bonus_transfers_set_updated_at ON public.bonus_transfers;
CREATE TRIGGER bonus_transfers_set_updated_at
BEFORE UPDATE ON public.bonus_transfers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS flight_redemptions_set_updated_at ON public.flight_redemptions;
CREATE TRIGGER flight_redemptions_set_updated_at
BEFORE UPDATE ON public.flight_redemptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS goals_set_updated_at ON public.goals;
CREATE TRIGGER goals_set_updated_at
BEFORE UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miles_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own_user_id ON public.profiles;
CREATE POLICY profiles_select_own_user_id ON public.profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_insert_own_user_id ON public.profiles;
CREATE POLICY profiles_insert_own_user_id ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own_user_id ON public.profiles;
CREATE POLICY profiles_update_own_user_id ON public.profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_delete_own_user_id ON public.profiles;
CREATE POLICY profiles_delete_own_user_id ON public.profiles
FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS clients_select_own_user_id ON public.clients;
CREATE POLICY clients_select_own_user_id ON public.clients
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS clients_insert_own_user_id ON public.clients;
CREATE POLICY clients_insert_own_user_id ON public.clients
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS clients_update_own_user_id ON public.clients;
CREATE POLICY clients_update_own_user_id ON public.clients
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS clients_delete_own_user_id ON public.clients;
CREATE POLICY clients_delete_own_user_id ON public.clients
FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS credit_cards_select_own_user_id ON public.credit_cards;
CREATE POLICY credit_cards_select_own_user_id ON public.credit_cards
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS credit_cards_insert_own_user_id ON public.credit_cards;
CREATE POLICY credit_cards_insert_own_user_id ON public.credit_cards
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS credit_cards_update_own_user_id ON public.credit_cards;
CREATE POLICY credit_cards_update_own_user_id ON public.credit_cards
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS credit_cards_delete_own_user_id ON public.credit_cards;
CREATE POLICY credit_cards_delete_own_user_id ON public.credit_cards
FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS points_programs_select_own_user_id ON public.points_programs;
CREATE POLICY points_programs_select_own_user_id ON public.points_programs
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS points_programs_insert_own_user_id ON public.points_programs;
CREATE POLICY points_programs_insert_own_user_id ON public.points_programs
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS points_programs_update_own_user_id ON public.points_programs;
CREATE POLICY points_programs_update_own_user_id ON public.points_programs
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS points_programs_delete_own_user_id ON public.points_programs;
CREATE POLICY points_programs_delete_own_user_id ON public.points_programs
FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS miles_programs_select_own_user_id ON public.miles_programs;
CREATE POLICY miles_programs_select_own_user_id ON public.miles_programs
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS miles_programs_insert_own_user_id ON public.miles_programs;
CREATE POLICY miles_programs_insert_own_user_id ON public.miles_programs
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS miles_programs_update_own_user_id ON public.miles_programs;
CREATE POLICY miles_programs_update_own_user_id ON public.miles_programs
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS miles_programs_delete_own_user_id ON public.miles_programs;
CREATE POLICY miles_programs_delete_own_user_id ON public.miles_programs
FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS bonus_transfers_select_own_user_id ON public.bonus_transfers;
CREATE POLICY bonus_transfers_select_own_user_id ON public.bonus_transfers
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS bonus_transfers_insert_own_user_id ON public.bonus_transfers;
CREATE POLICY bonus_transfers_insert_own_user_id ON public.bonus_transfers
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS bonus_transfers_update_own_user_id ON public.bonus_transfers;
CREATE POLICY bonus_transfers_update_own_user_id ON public.bonus_transfers
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS bonus_transfers_delete_own_user_id ON public.bonus_transfers;
CREATE POLICY bonus_transfers_delete_own_user_id ON public.bonus_transfers
FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS flight_redemptions_select_own_user_id ON public.flight_redemptions;
CREATE POLICY flight_redemptions_select_own_user_id ON public.flight_redemptions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS flight_redemptions_insert_own_user_id ON public.flight_redemptions;
CREATE POLICY flight_redemptions_insert_own_user_id ON public.flight_redemptions
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS flight_redemptions_update_own_user_id ON public.flight_redemptions;
CREATE POLICY flight_redemptions_update_own_user_id ON public.flight_redemptions
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS flight_redemptions_delete_own_user_id ON public.flight_redemptions;
CREATE POLICY flight_redemptions_delete_own_user_id ON public.flight_redemptions
FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS goals_select_own_user_id ON public.goals;
CREATE POLICY goals_select_own_user_id ON public.goals
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS goals_insert_own_user_id ON public.goals;
CREATE POLICY goals_insert_own_user_id ON public.goals
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS goals_update_own_user_id ON public.goals;
CREATE POLICY goals_update_own_user_id ON public.goals
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS goals_delete_own_user_id ON public.goals;
CREATE POLICY goals_delete_own_user_id ON public.goals
FOR DELETE TO authenticated
USING (user_id = auth.uid());
