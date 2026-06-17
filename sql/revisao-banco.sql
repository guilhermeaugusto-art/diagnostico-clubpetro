-- ============================================================================
-- Revisao do banco do Diagnostico ClubPetro (projeto azmtxhjtqodtaeoshrye)
-- Tabela: public.diagnostico_respostas
--
-- COMO APLICAR (o assistente nao tem acesso para rodar: MCP desconectado, sem
-- CLI/credenciais). Pelo painel Supabase:
--   1) Faca um backup (Database > Backups, ou confie no backup diario).
--   2) Abra SQL Editor.
--   3) Rode o BLOCO 1 (seguro). Depois o BLOCO 2 (seguranca/PII).
--   4) BLOCO 3 e BLOCO 4 so com a verificacao/mudanca descrita.
-- Verificado pelo codigo do app (src/lib/api.ts): o app so faz POST (insert) e
-- PATCH (update) por id; NAO faz SELECT via anon. As Edge Functions/n8n usam
-- service_role (ignoram RLS).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- BLOCO 1  ·  SEGURO e reversivel (nao muda o app). Pode rodar.
-- ----------------------------------------------------------------------------

-- 1.1 Indice parcial para o cron do Raio X (agendou_raiox sem envio).
CREATE INDEX IF NOT EXISTS idx_diag_raiox_pendente
  ON public.diagnostico_respostas (agendou_raiox)
  WHERE agendou_raiox = true AND rd_raiox_enviado = false;

-- 1.2 CHECK de dominio em papel (dono/gerente/outro ou null). Os 119 registros
--     atuais estao dentro disso. Se por acaso falhar (valor inesperado), troque
--     por: ... CHECK (...) NOT VALID;  (valida so as escritas novas).
ALTER TABLE public.diagnostico_respostas
  ADD CONSTRAINT chk_papel
  CHECK (papel IN ('dono', 'gerente', 'outro') OR papel IS NULL);

-- 1.3 Trigger que marca concluiu=true quando o score e gravado (corrige as
--     sessoes com score sem concluiu). Nao exige mudanca no app.
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
-- BLOCO 2  ·  SEGURANCA / LGPD: fecha a LEITURA aberta de PII. Pode rodar.
-- ----------------------------------------------------------------------------
-- Hoje a policy "anon le" (SELECT) permite a qualquer um com a chave anon
-- (exposta no client) ler todos os leads com nome, email e telefone.
-- O app NAO faz SELECT via anon (verificado), entao remover essa leitura nao
-- quebra nada. (Se algum painel/integracao ler via anon, use service_role la.)
DROP POLICY IF EXISTS "anon le" ON public.diagnostico_respostas;
-- (Sem policy de SELECT para anon, o RLS ja nega a leitura por padrao.)


-- ----------------------------------------------------------------------------
-- BLOCO 3  ·  Limpeza de colunas legadas. VERIFICAR antes de rodar.
-- ----------------------------------------------------------------------------
-- pdf_path e pdf_gerado_em sao do schema antigo (0 linhas usando; o app atual
-- usa pdf_comercial_path/pdf_cliente_path). Antes de dropar, confira que nenhuma
-- Edge Function nem workflow n8n as referencia (grep por 'pdf_path' e
-- 'pdf_gerado_em'). Destrutivo: so com backup.
-- ALTER TABLE public.diagnostico_respostas DROP COLUMN IF EXISTS pdf_path;
-- ALTER TABLE public.diagnostico_respostas DROP COLUMN IF EXISTS pdf_gerado_em;


-- ----------------------------------------------------------------------------
-- BLOCO 4  ·  SEGURANCA: fechar o UPDATE aberto. PRECISA de mudanca no app.
-- ----------------------------------------------------------------------------
-- A policy "anon atualiza" (UPDATE) esta aberta (USING true / CHECK true): com a
-- chave anon da para sobrescrever QUALQUER linha (precisa saber o UUID). O app
-- depende de PATCH com anon (createSession/persistAnswer/persistResult), entao
-- NAO revogue isso sem antes mover as escritas para uma Edge Function com
-- service_role (ou adicionar um token por sessao validado no WITH CHECK).
-- Quando o app estiver ajustado:
--   REVOKE UPDATE ON public.diagnostico_respostas FROM anon;
--   DROP POLICY IF EXISTS "anon atualiza" ON public.diagnostico_respostas;
-- (Severidade menor que a leitura: so permite corromper, nao ler. O BLOCO 2 ja
--  fecha o pior buraco. Esta parte fica para uma rodada dedicada.)
-- ============================================================================
