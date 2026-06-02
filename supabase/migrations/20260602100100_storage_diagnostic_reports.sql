-- =============================================================================
-- Storage · bucket privado para relatórios completos
-- =============================================================================

-- Cria o bucket privado (idempotente).
INSERT INTO storage.buckets (id, name, public)
VALUES ('diagnostic-reports', 'diagnostic-reports', false)
ON CONFLICT (id) DO UPDATE
  SET public = false;

-- ===== Policies =====
-- Anon pode FAZER UPLOAD (necessário pro front salvar o PDF gerado).
-- Anon NÃO pode listar, ler ou deletar — só insert.
-- Para download, gera-se signed URL com service_role (back-office) ou Edge Function.

DROP POLICY IF EXISTS diag_reports_anon_insert ON storage.objects;
CREATE POLICY diag_reports_anon_insert
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'diagnostic-reports');

DROP POLICY IF EXISTS diag_reports_auth_select ON storage.objects;
CREATE POLICY diag_reports_auth_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'diagnostic-reports');

DROP POLICY IF EXISTS diag_reports_auth_update ON storage.objects;
CREATE POLICY diag_reports_auth_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'diagnostic-reports')
  WITH CHECK (bucket_id = 'diagnostic-reports');

DROP POLICY IF EXISTS diag_reports_auth_delete ON storage.objects;
CREATE POLICY diag_reports_auth_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'diagnostic-reports');

-- Anon update/delete: BLOQUEADO (sem policy = sem acesso).
-- Anon read: BLOQUEADO. Quando o relatório for liberado pro usuário,
-- a Edge Function gera signed URL temporário com a service_role.
