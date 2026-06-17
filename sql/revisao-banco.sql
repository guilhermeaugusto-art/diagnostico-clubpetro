-- ============================================================================
-- Revisao do banco do Diagnostico ClubPetro (projeto azmtxhjtqodtaeoshrye)
-- Tabela: public.diagnostico_respostas  (119 sessoes na auditoria)
--
-- IMPORTANTE: NAO aplicar sem (1) backup do Supabase e (2) aprovacao.
-- Aplicar de preferencia em branch/staging primeiro, validar o app gravando,
-- e so entao promover. Rode bloco a bloco, nao tudo de uma vez.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- BLOCO A  ·  Seguro e recomendado (nao destrutivo, nao muda o app)
-- ----------------------------------------------------------------------------

-- A1. Indice parcial para a query do cron do Raio X (agendou_raiox sem envio).
--     Espelha o padrao ja usado para o cron do RD (idx_diag_mql_pendente).
CREATE INDEX IF NOT EXISTS idx_diag_raiox_pendente
  ON public.diagnostico_respostas (agendou_raiox)
  WHERE agendou_raiox = true AND rd_raiox_enviado = false;

-- A2. CHECK de dominio na coluna papel (hoje aceita qualquer texto).
--     Valores validos: dono, gerente, outro (outro = trilha frentista).
ALTER TABLE public.diagnostico_respostas
  ADD CONSTRAINT chk_papel
  CHECK (papel IN ('dono', 'gerente', 'outro') OR papel IS NULL);

-- A3. Trigger que marca concluiu=true quando o score e gravado (corrige as
--     10 sessoes com score sem concluiu). Nao exige mudanca no app.
CREATE OR REPLACE FUNCTION public.fn_auto_concluiu()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.score IS NOT NULL AND (OLD.concluiu IS NULL OR OLD.concluiu = false) THEN
    NEW.concluiu := true;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_auto_concluiu ON public.diagnostico_respostas;
CREATE TRIGGER trg_auto_concluiu
  BEFORE UPDATE ON public.diagnostico_respostas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_concluiu();


-- ----------------------------------------------------------------------------
-- BLOCO B  ·  Limpeza de colunas legadas (verificar ANTES de aplicar)
-- ----------------------------------------------------------------------------
-- pdf_path e pdf_gerado_em sao do schema antigo (v4), 0 linhas usando, e o app
-- atual nao as referencia. Conferir antes que nenhuma Edge Function nem workflow
-- n8n as use (grep por 'pdf_path' e 'pdf_gerado_em' nas functions/n8n).
-- (Destrutivo: so com backup.)
-- ALTER TABLE public.diagnostico_respostas DROP COLUMN IF EXISTS pdf_path;
-- ALTER TABLE public.diagnostico_respostas DROP COLUMN IF EXISTS pdf_gerado_em;


-- ----------------------------------------------------------------------------
-- BLOCO C  ·  SEGURANCA / LGPD  ·  RLS aberta (PRECISA DECISAO + provavel
--             ajuste no app). NAO aplicar isolado sem testar o app.
-- ----------------------------------------------------------------------------
-- Hoje, com a chave anon (exposta no client, por design), qualquer pessoa pode:
--   * LER todas as 119 sessoes com nome, email e telefone (policy "anon le");
--   * SOBRESCREVER qualquer linha (policy "anon atualiza" USING true CHECK true).
-- Isso e um risco real de vazamento de PII.
--
-- O app: faz INSERT (createSession) e PATCH por id (persistAnswer/persistResult/
-- setSessionContact) com a chave anon, via REST direto. NAO precisa de SELECT
-- amplo. As Edge Functions e o n8n usam service_role (ignoram RLS).
--
-- C1. SELECT: remover leitura ampla do anon (confirmar antes que nenhuma parte
--     client-side faca GET na tabela; pela auditoria, nao faz).
-- DROP POLICY IF EXISTS "anon le" ON public.diagnostico_respostas;
-- CREATE POLICY "anon sem leitura" ON public.diagnostico_respostas
--   FOR SELECT TO anon USING (false);
--
-- C2. UPDATE: hoje totalmente aberto. Sem login, isolar por linha exige um
--     segredo por sessao. Duas opcoes:
--     (a) RECOMENDADO: mover os PATCH para uma Edge Function com service_role e
--         revogar UPDATE do anon  ->  REVOKE UPDATE ... FROM anon;  (exige mudar
--         api.ts para chamar a function em vez do PATCH REST direto).
--     (b) Adicionar coluna token por sessao (gerada no createSession) e exigir
--         no WITH CHECK. Tambem exige mudar o app para enviar o token.
--     Por exigir mudanca no app + testes, fica para uma rodada dedicada com aval.
-- ============================================================================
