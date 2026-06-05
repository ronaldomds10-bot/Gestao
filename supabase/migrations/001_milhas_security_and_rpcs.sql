-- Security and business RPCs for the milhas SaaS.
-- Run after creating the base tables described in the product schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname
  INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.transacoes_saida'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%tipo_saida%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.transacoes_saida DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.transacoes_saida
  ADD CONSTRAINT transacoes_saida_tipo_saida_check
  CHECK (tipo_saida IN ('emissao_viagem', 'venda_milhas', 'transferencia_milhas'));
END $$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.perfis
  WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() = 'admin', false)
$$;

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programas_fidelidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartoes_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_milhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes_saida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfis_select_own_or_admin" ON public.perfis;
CREATE POLICY "perfis_select_own_or_admin"
ON public.perfis
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "perfis_insert_own" ON public.perfis;
CREATE POLICY "perfis_insert_own"
ON public.perfis
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "perfis_update_own_limited_or_admin" ON public.perfis;
CREATE POLICY "perfis_update_own_limited_or_admin"
ON public.perfis
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (
  public.is_admin()
  OR (
    id = auth.uid()
    AND role = public.current_user_role()
  )
);

DROP POLICY IF EXISTS "programas_select_authenticated" ON public.programas_fidelidade;
CREATE POLICY "programas_select_authenticated"
ON public.programas_fidelidade
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "programas_admin_write" ON public.programas_fidelidade;
CREATE POLICY "programas_admin_write"
ON public.programas_fidelidade
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "cartoes_owner_or_admin" ON public.cartoes_credito;
CREATE POLICY "cartoes_owner_or_admin"
ON public.cartoes_credito
FOR ALL
TO authenticated
USING (cliente_id = auth.uid() OR public.is_admin())
WITH CHECK (cliente_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "lotes_owner_or_admin" ON public.lotes_milhas;
CREATE POLICY "lotes_owner_or_admin"
ON public.lotes_milhas
FOR ALL
TO authenticated
USING (cliente_id = auth.uid() OR public.is_admin())
WITH CHECK (cliente_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "saidas_owner_or_admin" ON public.transacoes_saida;
CREATE POLICY "saidas_owner_or_admin"
ON public.transacoes_saida
FOR ALL
TO authenticated
USING (cliente_id = auth.uid() OR public.is_admin())
WITH CHECK (cliente_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE VIEW public.saldos_programa
WITH (security_invoker = true) AS
SELECT
  p.id AS cliente_id,
  pf.id AS programa_id,
  pf.nome AS programa_nome,
  COALESCE(SUM(lm.quantidade), 0)::integer
    - COALESCE((
      SELECT SUM(ts.milhas_utilizadas)
      FROM public.transacoes_saida ts
      WHERE ts.cliente_id = p.id
        AND ts.programa_id = pf.id
    ), 0)::integer AS saldo_milhas,
  COALESCE(
    ROUND(SUM(lm.custo_total) / NULLIF(SUM(lm.quantidade)::numeric / 1000, 0), 2),
    0
  ) AS cpm_medio
FROM public.perfis p
CROSS JOIN public.programas_fidelidade pf
LEFT JOIN public.lotes_milhas lm
  ON lm.cliente_id = p.id
 AND lm.programa_id = pf.id
GROUP BY p.id, pf.id, pf.nome;

CREATE OR REPLACE FUNCTION public.registrar_transferencia_bonificada(
  p_cliente_id uuid,
  p_programa_origem int,
  p_programa_destino int,
  p_milhas_debitadas int,
  p_bonus_percentual numeric,
  p_taxas_pagas numeric DEFAULT 0,
  p_data_vencimento date DEFAULT NULL,
  p_descricao text DEFAULT NULL
)
RETURNS TABLE (
  saida_id uuid,
  lote_destino_id uuid,
  milhas_creditadas int,
  cpm_origem numeric,
  custo_total_destino numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_origem int;
  v_cpm_origem numeric;
  v_custo_destino numeric;
BEGIN
  IF NOT (p_cliente_id = auth.uid() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Acesso negado para este cliente';
  END IF;

  IF p_milhas_debitadas <= 0 THEN
    RAISE EXCEPTION 'Milhas debitadas devem ser maiores que zero';
  END IF;

  IF p_bonus_percentual < 0 THEN
    RAISE EXCEPTION 'Bonus percentual nao pode ser negativo';
  END IF;

  SELECT sp.saldo_milhas, sp.cpm_medio
  INTO v_saldo_origem, v_cpm_origem
  FROM public.saldos_programa sp
  WHERE sp.cliente_id = p_cliente_id
    AND sp.programa_id = p_programa_origem;

  IF COALESCE(v_saldo_origem, 0) < p_milhas_debitadas THEN
    RAISE EXCEPTION 'Saldo insuficiente no programa de origem';
  END IF;

  milhas_creditadas := ROUND(p_milhas_debitadas * (1 + (p_bonus_percentual / 100)))::int;
  cpm_origem := COALESCE(v_cpm_origem, 0);
  custo_total_destino := ROUND(((p_milhas_debitadas::numeric * cpm_origem) / 1000) + COALESCE(p_taxas_pagas, 0), 2);

  INSERT INTO public.transacoes_saida (
    cliente_id,
    programa_id,
    tipo_saida,
    milhas_utilizadas,
    taxas_pagas,
    cpm_medio_referencia,
    data_saida,
    passageiro_ou_comprador
  )
  VALUES (
    p_cliente_id,
    p_programa_origem,
    'transferencia_milhas',
    p_milhas_debitadas,
    COALESCE(p_taxas_pagas, 0),
    cpm_origem,
    CURRENT_DATE,
    'Transferencia bonificada'
  )
  RETURNING id INTO saida_id;

  INSERT INTO public.lotes_milhas (
    cliente_id,
    programa_id,
    quantidade,
    custo_total,
    data_transacao,
    data_vencimento,
    tipo_origem,
    descricao
  )
  VALUES (
    p_cliente_id,
    p_programa_destino,
    milhas_creditadas,
    custo_total_destino,
    CURRENT_DATE,
    p_data_vencimento,
    'transferencia',
    COALESCE(p_descricao, 'Transferencia bonificada')
  )
  RETURNING id INTO lote_destino_id;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_admin() THEN
      jsonb_build_object('alunos', '[]'::jsonb, 'patrimonioTotalMilhas', 0, 'ranking', '[]'::jsonb)
    ELSE
      jsonb_build_object(
        'patrimonioTotalMilhas',
        COALESCE((SELECT SUM(GREATEST(saldo_milhas, 0)) FROM public.saldos_programa), 0),
        'alunos',
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'nome', p.nome,
              'email', p.email,
              'grupoMentoria', p.grupo_mentoria,
              'saldoTotalMilhas', COALESCE(sp.saldo_total, 0),
              'lucroEconomiaTotal', COALESCE(r.lucro_total, 0)
            )
            ORDER BY p.nome
          )
          FROM public.perfis p
          LEFT JOIN (
            SELECT cliente_id, SUM(GREATEST(saldo_milhas, 0)) AS saldo_total
            FROM public.saldos_programa
            GROUP BY cliente_id
          ) sp ON sp.cliente_id = p.id
          LEFT JOIN (
            SELECT
              cliente_id,
              SUM(
                CASE
                  WHEN tipo_saida = 'venda_milhas' THEN COALESCE(receita_gerada, 0) - ((milhas_utilizadas::numeric * cpm_medio_referencia) / 1000) - COALESCE(taxas_pagas, 0)
                  WHEN tipo_saida = 'emissao_viagem' THEN COALESCE(custo_pagante, 0) - (COALESCE(taxas_pagas, 0) + ((milhas_utilizadas::numeric * cpm_medio_referencia) / 1000))
                  ELSE 0
                END
              ) AS lucro_total
            FROM public.transacoes_saida
            GROUP BY cliente_id
          ) r ON r.cliente_id = p.id
          WHERE p.role IN ('aluno', 'cliente')
        ), '[]'::jsonb),
        'ranking',
        COALESCE((
          SELECT jsonb_agg(row_to_json(rank_rows))
          FROM (
            SELECT
              p.id,
              p.nome,
              SUM(
                CASE
                  WHEN ts.tipo_saida = 'venda_milhas' THEN COALESCE(ts.receita_gerada, 0) - ((ts.milhas_utilizadas::numeric * ts.cpm_medio_referencia) / 1000) - COALESCE(ts.taxas_pagas, 0)
                  WHEN ts.tipo_saida = 'emissao_viagem' THEN COALESCE(ts.custo_pagante, 0) - (COALESCE(ts.taxas_pagas, 0) + ((ts.milhas_utilizadas::numeric * ts.cpm_medio_referencia) / 1000))
                  ELSE 0
                END
              ) AS lucro_economia_total
            FROM public.perfis p
            JOIN public.transacoes_saida ts ON ts.cliente_id = p.id
            WHERE p.role IN ('aluno', 'cliente')
            GROUP BY p.id, p.nome
            ORDER BY lucro_economia_total DESC
            LIMIT 10
          ) rank_rows
        ), '[]'::jsonb)
      )
  END
$$;

CREATE OR REPLACE FUNCTION public.get_aluno_dashboard(p_cliente_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT (p_cliente_id = auth.uid() OR public.is_admin()) THEN
      jsonb_build_object('vencimentos', '[]'::jsonb, 'saldos', '[]'::jsonb, 'roiVendas', '[]'::jsonb)
    ELSE
      jsonb_build_object(
        'vencimentos',
        COALESCE((
          SELECT jsonb_agg(row_to_json(v))
          FROM (
            SELECT
              bucket,
              SUM(quantidade) AS milhas
            FROM (
              SELECT
                CASE
                  WHEN data_vencimento <= CURRENT_DATE + INTERVAL '30 days' THEN '30 dias'
                  WHEN data_vencimento <= CURRENT_DATE + INTERVAL '60 days' THEN '60 dias'
                  WHEN data_vencimento <= CURRENT_DATE + INTERVAL '90 days' THEN '90 dias'
                  ELSE '+90 dias'
                END AS bucket,
                quantidade
              FROM public.lotes_milhas
              WHERE cliente_id = p_cliente_id
                AND data_vencimento IS NOT NULL
                AND data_vencimento >= CURRENT_DATE
            ) buckets
            GROUP BY bucket
            ORDER BY MIN(
              CASE bucket
                WHEN '30 dias' THEN 1
                WHEN '60 dias' THEN 2
                WHEN '90 dias' THEN 3
                ELSE 4
              END
            )
          ) v
        ), '[]'::jsonb),
        'saldos',
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'programaId', programa_id,
              'programaNome', programa_nome,
              'saldoMilhas', GREATEST(saldo_milhas, 0),
              'cpmMedio', cpm_medio
            )
            ORDER BY programa_nome
          )
          FROM public.saldos_programa
          WHERE cliente_id = p_cliente_id
            AND saldo_milhas <> 0
        ), '[]'::jsonb),
        'roiVendas',
        COALESCE((
          SELECT jsonb_agg(row_to_json(r))
          FROM (
            SELECT
              date_trunc('month', data_saida)::date AS mes,
              SUM(COALESCE(receita_gerada, 0)) AS receita,
              SUM(((milhas_utilizadas::numeric * cpm_medio_referencia) / 1000) + COALESCE(taxas_pagas, 0)) AS custo,
              ROUND(
                (
                  SUM(COALESCE(receita_gerada, 0))
                  - SUM(((milhas_utilizadas::numeric * cpm_medio_referencia) / 1000) + COALESCE(taxas_pagas, 0))
                )
                / NULLIF(SUM(((milhas_utilizadas::numeric * cpm_medio_referencia) / 1000) + COALESCE(taxas_pagas, 0)), 0)
                * 100,
                2
              ) AS roi
            FROM public.transacoes_saida
            WHERE cliente_id = p_cliente_id
              AND tipo_saida = 'venda_milhas'
            GROUP BY date_trunc('month', data_saida)
            ORDER BY mes
          ) r
        ), '[]'::jsonb)
      )
  END
$$;

GRANT EXECUTE ON FUNCTION public.registrar_transferencia_bonificada(uuid, int, int, int, numeric, numeric, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_aluno_dashboard(uuid) TO authenticated;
