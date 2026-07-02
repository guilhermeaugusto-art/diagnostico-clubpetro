-- =============================================================================
-- Contato direto com o especialista
-- =============================================================================
-- Marca se o lead clicou em "Fale com um Especialista ClubPetro" (contato direto
-- pelo WhatsApp) na tela de resultado. Alimentado pelo front via persistSpecialistCta
-- (PATCH em diagnostico_respostas). Idempotente.
-- =============================================================================

ALTER TABLE public.diagnostico_respostas
  ADD COLUMN IF NOT EXISTS contato_especialista     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contato_especialista_em  timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_diagnostico_respostas_contato_especialista
  ON public.diagnostico_respostas (contato_especialista);

COMMENT ON COLUMN public.diagnostico_respostas.contato_especialista
  IS 'true quando o lead acionou o CTA "Fale com um Especialista" no resultado';
