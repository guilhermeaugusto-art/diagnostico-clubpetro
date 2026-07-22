-- Varredura 22/07 (pacote "corrigir agora"):
--
-- 1) Armazena_Token_RD: policy DELETE USING(true) para PUBLIC + grants de
-- DELETE/TRUNCATE permitiam a qualquer usuario logado apagar o unico token RD
-- do funil (conversoes 1-3 parariam em silencio). Functions leem via
-- service_role (bypassa RLS): zero impacto no fluxo.
-- Rollback: CREATE POLICY delete_all_policy ON "Armazena_Token_RD" FOR DELETE USING (true);
--           GRANT DELETE, TRUNCATE ON "Armazena_Token_RD" TO authenticated, anon;
drop policy if exists delete_all_policy on public."Armazena_Token_RD";
revoke delete, truncate on public."Armazena_Token_RD" from authenticated, anon;

-- 2) Trigger rd_diagnostico_conversion disparava em TODO update (fan-out de
-- invocacoes a cada toque da esteira/sync e terceiro remetente nas corridas).
-- Restringe para mudanca REAL de concluiu/raiox_status — as unicas condicoes
-- que a funcao avalia. Retry continua garantido pelo sweep da esteira (*/10).
-- Definicao antiga (rollback): AFTER UPDATE sem OF/WHEN, mesma function/args.
-- OBS: o Authorization header do http_request usa o JWT service_role do
-- projeto (mesmo padrao dos demais crons/triggers) — nao esta neste arquivo;
-- ao recriar em outro ambiente, injete o JWT.
drop trigger if exists rd_diagnostico_conversion on public.diagnostico_respostas;
create trigger rd_diagnostico_conversion
  after update of concluiu, raiox_status on public.diagnostico_respostas
  for each row
  when (old.concluiu is distinct from new.concluiu or old.raiox_status is distinct from new.raiox_status)
  execute function supabase_functions.http_request(
    'https://azmtxhjtqodtaeoshrye.supabase.co/functions/v1/rd-diagnostico-conversion',
    'POST',
    '{"Content-type":"application/json","Authorization":"Bearer <SERVICE_ROLE_JWT>"}',
    '{}',
    '5000'
  );

-- 3) Sentinela kommo_enviado_em=2000-01-01 na ficha canonica da Bianca
-- (10bc150c): eternamente pendente na condicao da etapa 5b da esteira.
update public.diagnostico_respostas
   set kommo_enviado_em = now()
 where id = '10bc150c-2153-4b75-ac6a-de389f739074'
   and kommo_enviado_em = '2000-01-01T00:00:00Z';
