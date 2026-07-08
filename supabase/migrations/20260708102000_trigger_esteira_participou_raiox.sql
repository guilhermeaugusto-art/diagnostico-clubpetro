-- Empurra pro RD (oportunidade) e Kommo NA HORA em que a participação real
-- no Raio-X é marcada (participou_raiox vira true).
-- ATENÇÃO: substituir <SERVICE_ROLE_JWT> pelo JWT service_role do projeto ao
-- aplicar (NUNCA commitar o token). Em produção já aplicada (08/07/2026) com o token real.
drop trigger if exists diagnostico_esteira_participou on public.diagnostico_respostas;
create trigger diagnostico_esteira_participou
after update of participou_raiox on public.diagnostico_respostas
for each row
when (new.participou_raiox is true and old.participou_raiox is distinct from true)
execute function supabase_functions.http_request(
  'https://azmtxhjtqodtaeoshrye.supabase.co/functions/v1/diagnostico-esteira',
  'POST',
  '{"Content-type":"application/json","Authorization":"Bearer <SERVICE_ROLE_JWT>"}',
  '{}',
  '5000'
);
