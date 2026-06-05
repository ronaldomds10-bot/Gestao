CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  telefone text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank text NOT NULL,
  card_name text NOT NULL,
  limit_value numeric(12, 2) NOT NULL DEFAULT 0,
  points_balance integer NOT NULL DEFAULT 0,
  points_per_dollar numeric(8, 2) NOT NULL DEFAULT 0,
  due_day integer NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  program_name text NOT NULL,
  balance integer NOT NULL DEFAULT 0,
  expiration_date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flight_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  origin text NOT NULL,
  destination text NOT NULL,
  airline text NOT NULL,
  regular_price numeric(12, 2) NOT NULL DEFAULT 0,
  paid_price numeric(12, 2) NOT NULL DEFAULT 0,
  miles_used integer NOT NULL DEFAULT 0,
  economy_generated numeric(12, 2) GENERATED ALWAYS AS (regular_price - paid_price) STORED,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  destination text NOT NULL,
  required_miles integer NOT NULL CHECK (required_miles > 0),
  deadline date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_can_manage_own_profile" ON public.users;
CREATE POLICY "users_can_manage_own_profile"
ON public.users
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "credit_cards_owner_only" ON public.credit_cards;
CREATE POLICY "credit_cards_owner_only"
ON public.credit_cards
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "loyalty_programs_owner_only" ON public.loyalty_programs;
CREATE POLICY "loyalty_programs_owner_only"
ON public.loyalty_programs
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "flight_redemptions_owner_only" ON public.flight_redemptions;
CREATE POLICY "flight_redemptions_owner_only"
ON public.flight_redemptions
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "goals_owner_only" ON public.goals;
CREATE POLICY "goals_owner_only"
ON public.goals
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE VIEW public.rm_miles_dashboard
WITH (security_invoker = true) AS
SELECT
  u.id AS user_id,
  COALESCE((SELECT SUM(balance) FROM public.loyalty_programs WHERE user_id = u.id), 0)
    + COALESCE((SELECT SUM(points_balance) FROM public.credit_cards WHERE user_id = u.id), 0) AS total_miles,
  COALESCE((SELECT SUM(economy_generated) FROM public.flight_redemptions WHERE user_id = u.id), 0) AS total_economy,
  COALESCE((SELECT SUM(balance) FROM public.loyalty_programs WHERE user_id = u.id), 0) AS program_miles,
  COALESCE((SELECT SUM(points_balance) FROM public.credit_cards WHERE user_id = u.id), 0) AS card_points
FROM public.users u;

-- Demo data for local development.
-- Replace this UUID with an auth.users id when seeding a real Supabase project.
DO $$
DECLARE
  demo_user uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.users (id, nome, email, telefone)
  VALUES (demo_user, 'Cliente Demo RM', 'cliente@rmpartiu.com.br', '(11) 98888-1234')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.credit_cards (user_id, bank, card_name, limit_value, points_balance, points_per_dollar, due_day)
  VALUES
    (demo_user, 'Banco BRB', 'DUX Visa Infinite', 85000, 76000, 4.00, 10),
    (demo_user, 'Itau', 'Azul Visa Infinite', 42000, 54000, 3.50, 18),
    (demo_user, 'Santander', 'Unlimited Black', 62000, 37000, 2.60, 25)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.loyalty_programs (user_id, program_name, balance, expiration_date)
  VALUES
    (demo_user, 'Livelo', 180000, '2027-05-12'),
    (demo_user, 'Smiles', 145000, '2026-12-01'),
    (demo_user, 'LATAM Pass', 128000, '2027-02-20'),
    (demo_user, 'Azul Fidelidade', 116000, '2026-10-30'),
    (demo_user, 'Esfera', 81000, '2027-08-15')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.goals (user_id, title, destination, required_miles, deadline)
  VALUES
    (demo_user, 'Ferias em Orlando', 'Orlando', 1000000, '2026-12-20'),
    (demo_user, 'Europa em familia', 'Lisboa e Paris', 780000, '2027-04-15')
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.flight_redemptions WHERE user_id = demo_user) THEN
    INSERT INTO public.flight_redemptions (
      user_id,
      origin,
      destination,
      airline,
      regular_price,
      paid_price,
      miles_used,
      created_at
    )
    VALUES
      (demo_user, 'GRU', 'MCO', 'LATAM', 6400, 1980, 92000, '2026-01-08'),
      (demo_user, 'VCP', 'LIS', 'Azul', 7200, 2410, 110000, '2026-01-22'),
      (demo_user, 'CGH', 'SDU', 'GOL', 1320, 380, 14500, '2026-02-11'),
      (demo_user, 'GRU', 'SCL', 'LATAM', 2880, 820, 36000, '2026-02-26'),
      (demo_user, 'BSB', 'FOR', 'GOL', 1880, 510, 22000, '2026-03-05'),
      (demo_user, 'GRU', 'CDG', 'Air France', 8900, 2860, 132000, '2026-03-18'),
      (demo_user, 'CNF', 'SSA', 'Azul', 1640, 450, 18000, '2026-04-03'),
      (demo_user, 'GRU', 'JFK', 'American', 7800, 2350, 118000, '2026-04-16'),
      (demo_user, 'POA', 'REC', 'LATAM', 2150, 690, 26000, '2026-05-04'),
      (demo_user, 'GRU', 'MAD', 'Iberia', 8350, 2730, 126000, '2026-05-25');
  END IF;
END $$;
