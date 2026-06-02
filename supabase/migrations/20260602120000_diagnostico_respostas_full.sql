-- =============================================================================
-- Tabela principal: public.diagnostico_respostas (já existente desde v5).
-- Esta migration ADICIONA todas as colunas necessárias para rastrear tudo
-- do diagnóstico numa única linha por lead: contato, contexto, respostas,
-- resultado, raio-x, PDF, ações comerciais, eventos.
-- =============================================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função utilitária pra updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- ADD COLUMN IF NOT EXISTS · todas as colunas novas em diagnostico_respostas
-- =============================================================================
ALTER TABLE public.diagnostico_respostas
  -- Identificador único da sessão (vem do front, mesmo do diag_id).
  ADD COLUMN IF NOT EXISTS diag_id            uuid,
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS started_at         timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS status             text DEFAULT 'in_progress',

  -- Lead estendido
  ADD COLUMN IF NOT EXISTS lead_name          text,
  ADD COLUMN IF NOT EXISTS lead_email         text,
  ADD COLUMN IF NOT EXISTS lead_whatsapp      text,
  ADD COLUMN IF NOT EXISTS company_name       text,
  ADD COLUMN IF NOT EXISTS station_name       text,
  ADD COLUMN IF NOT EXISTS city               text,
  ADD COLUMN IF NOT EXISTS lead_state         text,

  -- Origem / UTM
  ADD COLUMN IF NOT EXISTS source             text,
  ADD COLUMN IF NOT EXISTS utm_source         text,
  ADD COLUMN IF NOT EXISTS utm_medium         text,
  ADD COLUMN IF NOT EXISTS utm_campaign       text,
  ADD COLUMN IF NOT EXISTS utm_content        text,
  ADD COLUMN IF NOT EXISTS utm_term           text,
  ADD COLUMN IF NOT EXISTS referrer           text,
  ADD COLUMN IF NOT EXISTS landing_url        text,

  -- Device / contexto
  ADD COLUMN IF NOT EXISTS user_agent         text,
  ADD COLUMN IF NOT EXISTS device_type        text,
  ADD COLUMN IF NOT EXISTS browser            text,
  ADD COLUMN IF NOT EXISTS os                 text,
  ADD COLUMN IF NOT EXISTS screen_width       integer,
  ADD COLUMN IF NOT EXISTS screen_height      integer,
  ADD COLUMN IF NOT EXISTS locale             text,
  ADD COLUMN IF NOT EXISTS ip_address         inet,

  -- Versão / privacidade
  ADD COLUMN IF NOT EXISTS diagnostic_version text DEFAULT 'v6',
  ADD COLUMN IF NOT EXISTS lgpd_consent       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lgpd_consent_at    timestamptz,
  ADD COLUMN IF NOT EXISTS notes_internal     text,

  -- Respostas por question_id (1 coluna por pergunta, texto legível)
  ADD COLUMN IF NOT EXISTS answer_s1  text,
  ADD COLUMN IF NOT EXISTS answer_s2  text,
  ADD COLUMN IF NOT EXISTS answer_s3  text,   -- multi: opções separadas por " | "
  ADD COLUMN IF NOT EXISTS answer_c1  text,
  ADD COLUMN IF NOT EXISTS answer_c2  text,
  ADD COLUMN IF NOT EXISTS answer_c3  text,
  ADD COLUMN IF NOT EXISTS answer_c4  text,
  ADD COLUMN IF NOT EXISTS answer_f1  text,
  ADD COLUMN IF NOT EXISTS answer_f2  text,
  ADD COLUMN IF NOT EXISTS answer_f3  text,
  ADD COLUMN IF NOT EXISTS answer_d1  text,
  ADD COLUMN IF NOT EXISTS answer_d2  text,
  ADD COLUMN IF NOT EXISTS answer_d3  text,
  ADD COLUMN IF NOT EXISTS answer_d4  text,
  ADD COLUMN IF NOT EXISTS answer_m1  text,
  ADD COLUMN IF NOT EXISTS answer_m2  text,
  ADD COLUMN IF NOT EXISTS answer_m3  text,
  ADD COLUMN IF NOT EXISTS answer_p1  text,
  ADD COLUMN IF NOT EXISTS answer_p2  text,
  ADD COLUMN IF NOT EXISTS answer_p3  text,
  ADD COLUMN IF NOT EXISTS answer_r1  text,
  ADD COLUMN IF NOT EXISTS answer_r2  text,
  ADD COLUMN IF NOT EXISTS answer_z1  text,
  ADD COLUMN IF NOT EXISTS answer_z2  text,
  ADD COLUMN IF NOT EXISTS answers_full jsonb,

  -- Resultado consolidado (já existem nome/email/telefone/score/nivel/papel/conhece/interesse na v5)
  ADD COLUMN IF NOT EXISTS overall_score      numeric,
  ADD COLUMN IF NOT EXISTS score_range_label  text,
  ADD COLUMN IF NOT EXISTS urgency_tone       text,
  ADD COLUMN IF NOT EXISTS signal             text,
  ADD COLUMN IF NOT EXISTS readiness          text,

  -- Score por frente: pct + earned + possible por bloco
  ADD COLUMN IF NOT EXISTS pillar_pessoas_pct         numeric,
  ADD COLUMN IF NOT EXISTS pillar_pessoas_earned      numeric,
  ADD COLUMN IF NOT EXISTS pillar_pessoas_possible    numeric,
  ADD COLUMN IF NOT EXISTS pillar_marca_pct           numeric,
  ADD COLUMN IF NOT EXISTS pillar_marca_earned        numeric,
  ADD COLUMN IF NOT EXISTS pillar_marca_possible      numeric,
  ADD COLUMN IF NOT EXISTS pillar_comercial_pct       numeric,
  ADD COLUMN IF NOT EXISTS pillar_comercial_earned    numeric,
  ADD COLUMN IF NOT EXISTS pillar_comercial_possible  numeric,
  ADD COLUMN IF NOT EXISTS pillar_fidelizacao_pct     numeric,
  ADD COLUMN IF NOT EXISTS pillar_fidelizacao_earned  numeric,
  ADD COLUMN IF NOT EXISTS pillar_fidelizacao_possible numeric,
  ADD COLUMN IF NOT EXISTS pillar_dados_pct           numeric,
  ADD COLUMN IF NOT EXISTS pillar_dados_earned        numeric,
  ADD COLUMN IF NOT EXISTS pillar_dados_possible      numeric,
  ADD COLUMN IF NOT EXISTS pillar_resiliencia_pct     numeric,
  ADD COLUMN IF NOT EXISTS pillar_resiliencia_earned  numeric,
  ADD COLUMN IF NOT EXISTS pillar_resiliencia_possible numeric,

  -- Frente forte / fraca
  ADD COLUMN IF NOT EXISTS strongest_dimension_key    text,
  ADD COLUMN IF NOT EXISTS strongest_dimension_label  text,
  ADD COLUMN IF NOT EXISTS strongest_dimension_score  numeric,
  ADD COLUMN IF NOT EXISTS weakest_dimension_key      text,
  ADD COLUMN IF NOT EXISTS weakest_dimension_label    text,
  ADD COLUMN IF NOT EXISTS weakest_dimension_score    numeric,

  -- Dor + leitura + próxima melhoria
  ADD COLUMN IF NOT EXISTS main_pain_title              text,
  ADD COLUMN IF NOT EXISTS main_pain_description        text,
  ADD COLUMN IF NOT EXISTS main_pain_risk               text,
  ADD COLUMN IF NOT EXISTS radar_summary                text,
  ADD COLUMN IF NOT EXISTS radar_summary_extra          text,
  ADD COLUMN IF NOT EXISTS next_improvement_title       text,
  ADD COLUMN IF NOT EXISTS next_improvement_description text,

  -- Recomendações e soluções
  ADD COLUMN IF NOT EXISTS recommendations_open        jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommendations_locked      jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS clubpetro_solutions         jsonb DEFAULT '[]'::jsonb,

  -- Leitura comercial
  ADD COLUMN IF NOT EXISTS commercial_summary          text,
  ADD COLUMN IF NOT EXISTS commercial_reading          jsonb,
  ADD COLUMN IF NOT EXISTS approach_message            text,

  -- PDF / Relatório
  ADD COLUMN IF NOT EXISTS report_status               text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS report_storage_bucket       text DEFAULT 'diagnostic-reports',
  ADD COLUMN IF NOT EXISTS report_storage_path         text,
  ADD COLUMN IF NOT EXISTS report_file_name            text,
  ADD COLUMN IF NOT EXISTS report_file_size            bigint,
  ADD COLUMN IF NOT EXISTS report_generated_at         timestamptz,
  ADD COLUMN IF NOT EXISTS report_generation_error     text,
  ADD COLUMN IF NOT EXISTS report_is_user_unlocked     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_unlocked_at          timestamptz,
  ADD COLUMN IF NOT EXISTS report_unlocked_reason      text,
  ADD COLUMN IF NOT EXISTS report_unlocked_by          text,
  ADD COLUMN IF NOT EXISTS report_user_download_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_commercial_open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_last_user_download_at      timestamptz,
  ADD COLUMN IF NOT EXISTS report_last_commercial_open_at    timestamptz,

  -- Raio-X (toda terça às 19h)
  ADD COLUMN IF NOT EXISTS rayx_status                  text,
  ADD COLUMN IF NOT EXISTS rayx_requested_at            timestamptz,
  ADD COLUMN IF NOT EXISTS rayx_scheduled_for           timestamptz,
  ADD COLUMN IF NOT EXISTS rayx_timezone                text DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS rayx_google_meet_url         text,
  ADD COLUMN IF NOT EXISTS rayx_google_calendar_event_id text,
  ADD COLUMN IF NOT EXISTS rayx_calendar_provider       text DEFAULT 'google',
  ADD COLUMN IF NOT EXISTS rayx_attended                boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rayx_attended_at             timestamptz,
  ADD COLUMN IF NOT EXISTS rayx_no_show                 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rayx_no_show_at              timestamptz,
  ADD COLUMN IF NOT EXISTS rayx_specialist_name         text,
  ADD COLUMN IF NOT EXISTS rayx_specialist_email        text,
  ADD COLUMN IF NOT EXISTS rayx_notes                   text,

  -- Comercial
  ADD COLUMN IF NOT EXISTS commercial_owner             text,
  ADD COLUMN IF NOT EXISTS commercial_status            text DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS commercial_last_contact_at   timestamptz,
  ADD COLUMN IF NOT EXISTS commercial_actions           jsonb DEFAULT '[]'::jsonb,

  -- CTAs
  ADD COLUMN IF NOT EXISTS result_viewed_at             timestamptz,
  ADD COLUMN IF NOT EXISTS specialist_cta_clicked_at    timestamptz,
  ADD COLUMN IF NOT EXISTS specialist_cta_count         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rayx_cta_clicked_at          timestamptz,
  ADD COLUMN IF NOT EXISTS rayx_cta_count               integer NOT NULL DEFAULT 0,

  -- Eventos comportamentais (log compacto)
  ADD COLUMN IF NOT EXISTS events                       jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS event_count                  integer NOT NULL DEFAULT 0;

-- =============================================================================
-- Backfill: linhas antigas têm o diag_id dentro do jsonb `respostas`.
-- Copia pra coluna nova quando possível.
-- =============================================================================
UPDATE public.diagnostico_respostas
   SET diag_id = (respostas->>'diag_id')::uuid
 WHERE diag_id IS NULL
   AND respostas ? 'diag_id'
   AND (respostas->>'diag_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- diag_id único quando preenchido
CREATE UNIQUE INDEX IF NOT EXISTS uq_diagnostico_respostas_diag_id
  ON public.diagnostico_respostas (diag_id)
  WHERE diag_id IS NOT NULL;

-- =============================================================================
-- Índices úteis
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_dr_lead_email     ON public.diagnostico_respostas (lower(lead_email));
CREATE INDEX IF NOT EXISTS idx_dr_lead_whatsapp  ON public.diagnostico_respostas (lead_whatsapp);
CREATE INDEX IF NOT EXISTS idx_dr_status         ON public.diagnostico_respostas (status);
CREATE INDEX IF NOT EXISTS idx_dr_completed_at   ON public.diagnostico_respostas (completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_dr_overall_score  ON public.diagnostico_respostas (overall_score);
CREATE INDEX IF NOT EXISTS idx_dr_weakest        ON public.diagnostico_respostas (weakest_dimension_key);
CREATE INDEX IF NOT EXISTS idx_dr_rayx_status    ON public.diagnostico_respostas (rayx_status);
CREATE INDEX IF NOT EXISTS idx_dr_rayx_scheduled ON public.diagnostico_respostas (rayx_scheduled_for);
CREATE INDEX IF NOT EXISTS idx_dr_report_unlock  ON public.diagnostico_respostas (report_is_user_unlocked);
CREATE INDEX IF NOT EXISTS idx_dr_commercial     ON public.diagnostico_respostas (commercial_status);
CREATE INDEX IF NOT EXISTS idx_dr_utm            ON public.diagnostico_respostas (utm_source, utm_campaign);

-- =============================================================================
-- Trigger updated_at
-- =============================================================================
DROP TRIGGER IF EXISTS trg_diagnostico_respostas_updated_at ON public.diagnostico_respostas;
CREATE TRIGGER trg_diagnostico_respostas_updated_at
BEFORE UPDATE ON public.diagnostico_respostas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- Trigger: ao marcar rayx_attended = true, libera o relatório automaticamente.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.dr_unlock_report_on_rayx_attended()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.rayx_attended = true AND (OLD.rayx_attended IS DISTINCT FROM NEW.rayx_attended) THEN
    IF NEW.report_is_user_unlocked = false THEN
      NEW.report_is_user_unlocked := true;
      NEW.report_unlocked_at      := COALESCE(NEW.report_unlocked_at, now());
      NEW.report_unlocked_reason  := COALESCE(NEW.report_unlocked_reason, 'rayx_attended');
      NEW.report_unlocked_by      := COALESCE(NEW.report_unlocked_by, NEW.rayx_specialist_email);
    END IF;
    NEW.rayx_attended_at := COALESCE(NEW.rayx_attended_at, now());
    NEW.rayx_status      := COALESCE(NEW.rayx_status, 'attended');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dr_rayx_attended_unlock ON public.diagnostico_respostas;
CREATE TRIGGER trg_dr_rayx_attended_unlock
BEFORE UPDATE OF rayx_attended ON public.diagnostico_respostas
FOR EACH ROW EXECUTE FUNCTION public.dr_unlock_report_on_rayx_attended();

-- =============================================================================
-- View consolidada pro painel comercial
-- =============================================================================
CREATE OR REPLACE VIEW public.diagnostic_summary AS
SELECT
  id,
  diag_id,
  created_at,
  completed_at,
  status,
  COALESCE(lead_name, nome)         AS lead_name,
  COALESCE(lead_email, email)       AS lead_email,
  COALESCE(lead_whatsapp, telefone) AS lead_whatsapp,
  station_name,
  city,
  lead_state                          AS state,
  COALESCE(overall_score, score)     AS overall_score,
  COALESCE(score_range_label, nivel) AS score_range_label,
  urgency_tone,
  weakest_dimension_label,
  strongest_dimension_label,
  main_pain_title,
  next_improvement_title,
  report_status,
  report_is_user_unlocked,
  rayx_status,
  rayx_scheduled_for,
  rayx_attended,
  commercial_status,
  commercial_owner,
  specialist_cta_count,
  rayx_cta_count,
  event_count
FROM public.diagnostico_respostas
ORDER BY created_at DESC;

COMMENT ON VIEW public.diagnostic_summary IS 'Painel comercial: 1 linha por diagnóstico com as colunas mais usadas. Faz fallback pros campos legados (nome/email/telefone/score/nivel) quando os novos estiverem vazios.';

-- =============================================================================
-- RLS · garantir que anon pode inserir/atualizar pela diag_id
-- =============================================================================
ALTER TABLE public.diagnostico_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dr_anon_insert ON public.diagnostico_respostas;
CREATE POLICY dr_anon_insert
  ON public.diagnostico_respostas
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS dr_anon_update ON public.diagnostico_respostas;
CREATE POLICY dr_anon_update
  ON public.diagnostico_respostas
  FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS dr_auth_select ON public.diagnostico_respostas;
CREATE POLICY dr_auth_select
  ON public.diagnostico_respostas
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS dr_auth_update ON public.diagnostico_respostas;
CREATE POLICY dr_auth_update
  ON public.diagnostico_respostas
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS dr_auth_insert ON public.diagnostico_respostas;
CREATE POLICY dr_auth_insert
  ON public.diagnostico_respostas
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================================================
-- Drop das tabelas extras que eu cheguei a criar — não usaremos mais.
-- =============================================================================
DROP TABLE IF EXISTS public.diagnostic_commercial_actions CASCADE;
DROP TABLE IF EXISTS public.diagnostic_rayx              CASCADE;
DROP TABLE IF EXISTS public.diagnostic_events            CASCADE;
DROP TABLE IF EXISTS public.diagnostic_reports           CASCADE;
DROP TABLE IF EXISTS public.diagnostic_results           CASCADE;
DROP TABLE IF EXISTS public.diagnostic_answers           CASCADE;
DROP TABLE IF EXISTS public.diagnostic_sessions          CASCADE;
DROP VIEW  IF EXISTS public.diagnostic_full_view         CASCADE;
DROP FUNCTION IF EXISTS public.unlock_report_on_rayx_attended() CASCADE;

-- =============================================================================
-- FIM. Tudo agora vive em public.diagnostico_respostas.
-- =============================================================================
