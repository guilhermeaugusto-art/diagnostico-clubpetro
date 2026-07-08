-- View de leitura do diagnóstico com data/hora convertida para Brasília.
-- O dado bruto segue em UTC na tabela (padrão correto); esta view é só
-- apresentação para o painel/time comercial.
-- JÁ APLICADA em produção via MCP em 06/07/2026 (migration vw_diagnostico_leads_br).
-- Idempotente: pode rodar de novo sem efeito colateral.
create or replace view public.vw_diagnostico_leads_br
with (security_invoker = true) as
select
  nome,
  telefone,
  email,
  papel,
  conhece,
  concluiu,
  agendou_raiox,
  participou_raiox,
  to_char(created_at    at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as inicio_brasilia,
  to_char(concluido_em  at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as conclusao_brasilia,
  to_char(agendou_raiox_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as agendamento_brasilia,
  created_at
from public.diagnostico_respostas
order by created_at desc;

-- PII: sem leitura pela chave pública do app nem por usuários logados genéricos.
revoke all on public.vw_diagnostico_leads_br from anon, authenticated;
