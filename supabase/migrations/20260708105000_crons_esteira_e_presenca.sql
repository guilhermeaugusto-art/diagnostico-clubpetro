-- Agendamentos (pg_cron) da esteira do diagnóstico. Aplicados em produção via
-- MCP em 08/07/2026 com o token real.
-- ATENÇÃO: substituir <SERVICE_ROLE_JWT> ao aplicar (NUNCA commitar o token).

-- 1) Varredura da esteira a cada 10 min (retry garantido de RD + Kommo)
select cron.schedule('diagnostico-esteira-sweep', '*/10 * * * *', $CMD$
  select net.http_post(
    url := 'https://azmtxhjtqodtaeoshrye.supabase.co/functions/v1/diagnostico-esteira?sweep=1',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_JWT>'),
    body := '{}'::jsonb
  )
$CMD$);

-- 2) Presença do Raio-X durante e logo após a sessão de terça (11h–14h50 BRT)
select cron.schedule('sync-raiox-presenca-terca', '*/10 14-17 * * 2', $CMD$
  select net.http_post(
    url := 'https://azmtxhjtqodtaeoshrye.supabase.co/functions/v1/sync-raiox-presenca',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_JWT>'),
    body := '{}'::jsonb
  )
$CMD$);

-- 3) Job 11 (legado, nome "raiox-sync-participacao") repontado: sincroniza
--    CONFIRMADOS (RSVP aceito no Calendar) na manhã de terça, 07h–11h BRT.
select cron.alter_job(11, schedule => '0 10-14 * * 2');

-- Jobs pré-existentes que permanecem: 10 (confirmados diário 21h UTC) e
-- 13 (sync-raiox-presenca diário 06h UTC, varredura de segurança).
