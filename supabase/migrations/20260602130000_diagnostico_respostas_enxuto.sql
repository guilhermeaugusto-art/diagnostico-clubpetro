-- =============================================================================
-- Diagnóstico ClubPetro · estrutura ENXUTA na tabela única `diagnostico_respostas`
-- =============================================================================
-- Mantém a tabela já existente (com nome/email/telefone/score/nivel/papel/conhece/
-- interesse/respostas/created_at) e ADICIONA APENAS os campos necessários para:
--   1. Gerar e salvar o PDF do diagnóstico em bucket privado.
--   2. Controlar liberação do PDF (raio-x ou release manual).
--   3. Registrar participação no raio-x.
--   4. Resumo, dor principal, próxima melhoria e leitura comercial pro time.
-- =============================================================================

-- Função utilitária pra updated_at (idempotente)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Colunas mínimas necessárias (todas IF NOT EXISTS — idempotente)
ALTER TABLE public.diagnostico_respostas
  ADD COLUMN IF NOT EXISTS updated_at            timestamp with time zone DEFAULT now(),

  -- PDF
  ADD COLUMN IF NOT EXISTS pdf_status            text DEFAULT 'nao_gerado',
  ADD COLUMN IF NOT EXISTS pdf_bucket            text,
  ADD COLUMN IF NOT EXISTS pdf_path              text,
  ADD COLUMN IF NOT EXISTS pdf_url               text,
  ADD COLUMN IF NOT EXISTS pdf_gerado_em         timestamp with time zone,
  ADD COLUMN IF NOT EXISTS pdf_liberado          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pdf_liberado_em       timestamp with time zone,
  ADD COLUMN IF NOT EXISTS pdf_liberado_motivo   text,

  -- Raio-X (RaioX do Posto, toda terça às 19h)
  ADD COLUMN IF NOT EXISTS participou_raiox      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS raiox_data            timestamp with time zone,
  ADD COLUMN IF NOT EXISTS raiox_status          text DEFAULT 'nao_agendado',
  ADD COLUMN IF NOT EXISTS raiox_observacao      text,

  -- Especialista que liberou ou conduziu o atendimento
  ADD COLUMN IF NOT EXISTS especialista_nome     text,
  ADD COLUMN IF NOT EXISTS especialista_email    text,

  -- Leitura consultiva (texto curto + estruturado)
  ADD COLUMN IF NOT EXISTS resumo_diagnostico    text,
  ADD COLUMN IF NOT EXISTS dor_principal         text,
  ADD COLUMN IF NOT EXISTS proxima_melhoria      text,
  ADD COLUMN IF NOT EXISTS recomendacoes         jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS leitura_comercial     jsonb DEFAULT '{}'::jsonb;

-- Índices essenciais pro painel comercial
CREATE INDEX IF NOT EXISTS idx_diagnostico_respostas_email
  ON public.diagnostico_respostas (lower(email));

CREATE INDEX IF NOT EXISTS idx_diagnostico_respostas_telefone
  ON public.diagnostico_respostas (telefone);

CREATE INDEX IF NOT EXISTS idx_diagnostico_respostas_created_at
  ON public.diagnostico_respostas (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_diagnostico_respostas_score
  ON public.diagnostico_respostas (score);

CREATE INDEX IF NOT EXISTS idx_diagnostico_respostas_nivel
  ON public.diagnostico_respostas (nivel);

CREATE INDEX IF NOT EXISTS idx_diagnostico_respostas_participou_raiox
  ON public.diagnostico_respostas (participou_raiox);

CREATE INDEX IF NOT EXISTS idx_diagnostico_respostas_raiox_status
  ON public.diagnostico_respostas (raiox_status);

CREATE INDEX IF NOT EXISTS idx_diagnostico_respostas_pdf_liberado
  ON public.diagnostico_respostas (pdf_liberado);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_diagnostico_respostas_updated_at ON public.diagnostico_respostas;
CREATE TRIGGER trg_diagnostico_respostas_updated_at
BEFORE UPDATE ON public.diagnostico_respostas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: ao marcar participou_raiox = true, libera o PDF automaticamente.
CREATE OR REPLACE FUNCTION public.dr_liberar_pdf_apos_raiox()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.participou_raiox = true AND (OLD.participou_raiox IS DISTINCT FROM NEW.participou_raiox) THEN
    IF NEW.pdf_liberado = false THEN
      NEW.pdf_liberado        := true;
      NEW.pdf_liberado_em     := COALESCE(NEW.pdf_liberado_em, now());
      NEW.pdf_liberado_motivo := COALESCE(NEW.pdf_liberado_motivo, 'participou_raiox');
    END IF;
    NEW.raiox_status := COALESCE(NEW.raiox_status, 'participou');
    NEW.raiox_data   := COALESCE(NEW.raiox_data, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dr_liberar_pdf_raiox ON public.diagnostico_respostas;
CREATE TRIGGER trg_dr_liberar_pdf_raiox
BEFORE UPDATE OF participou_raiox ON public.diagnostico_respostas
FOR EACH ROW EXECUTE FUNCTION public.dr_liberar_pdf_apos_raiox();

-- RLS
ALTER TABLE public.diagnostico_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dr_anon_insert ON public.diagnostico_respostas;
CREATE POLICY dr_anon_insert ON public.diagnostico_respostas
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS dr_anon_update ON public.diagnostico_respostas;
CREATE POLICY dr_anon_update ON public.diagnostico_respostas
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS dr_auth_all ON public.diagnostico_respostas;
CREATE POLICY dr_auth_all ON public.diagnostico_respostas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Comentários
COMMENT ON COLUMN public.diagnostico_respostas.pdf_status          IS 'nao_gerado | gerando | gerado | erro';
COMMENT ON COLUMN public.diagnostico_respostas.pdf_liberado_motivo IS 'participou_raiox | liberado_manual | regra_negocio';
COMMENT ON COLUMN public.diagnostico_respostas.raiox_status        IS 'nao_agendado | agendado | confirmado | participou | falta | cancelado';
COMMENT ON COLUMN public.diagnostico_respostas.leitura_comercial   IS 'JSONB com { frentes_criticas, abordagem, perguntas_para_conversa, objecoes_provaveis, proximos_passos }';

-- =============================================================================
-- Bucket privado para PDFs
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('diagnostico-pdfs', 'diagnostico-pdfs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Anon pode UPLOAD (front grava o PDF). NÃO pode ler/listar/deletar.
DROP POLICY IF EXISTS diag_pdfs_anon_insert ON storage.objects;
CREATE POLICY diag_pdfs_anon_insert
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'diagnostico-pdfs');

-- Authenticated (back-office): tudo.
DROP POLICY IF EXISTS diag_pdfs_auth_all ON storage.objects;
CREATE POLICY diag_pdfs_auth_all
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'diagnostico-pdfs')
  WITH CHECK (bucket_id = 'diagnostico-pdfs');

-- =============================================================================
-- Drop do bucket antigo (caso tenha sido criado) e tabelas extras se sobraram
-- =============================================================================
DELETE FROM storage.buckets WHERE id = 'diagnostic-reports';

DROP POLICY IF EXISTS diag_reports_anon_insert  ON storage.objects;
DROP POLICY IF EXISTS diag_reports_auth_select  ON storage.objects;
DROP POLICY IF EXISTS diag_reports_auth_update  ON storage.objects;
DROP POLICY IF EXISTS diag_reports_auth_delete  ON storage.objects;
