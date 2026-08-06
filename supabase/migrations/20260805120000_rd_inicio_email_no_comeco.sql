-- Trackeamento RD no INICIO do fluxo (05/08):
--
-- O e-mail passou a ser capturado na tela inicial do quiz (antes era so no
-- portao do resultado). Assim que a coluna email e preenchida, o lead sobe
-- pro RD Station como conversao "iniciou-diagnostico-posto" COM a origem de
-- trafego (utm_* / origem_source, gravadas no INSERT da sessao) — e o time de
-- trafego pago consegue validar o evento de conversao da campanha no RD.
--
-- 1) Colunas de dedup do envio de inicio (mesmo padrao rd_enviado/rd_raiox):
--    a Edge Function so marca apos 2xx do RD.
alter table public.diagnostico_respostas
  add column if not exists rd_inicio_enviado boolean not null default false,
  add column if not exists rd_inicio_enviado_em timestamptz;

comment on column public.diagnostico_respostas.rd_inicio_enviado is
  'Conversao iniciou-diagnostico-posto ja enviada ao RD (dedup do gatilho de inicio).';

-- 2) Trigger: dispara a rd-diagnostico-conversion quando o e-mail entra (ou e
--    corrigido) na linha. A funcao decide o que enviar: inicio (se ainda nao
--    concluiu), e as demais etapas seguem com os gatilhos/sweep existentes.
--    OBS: o Authorization header usa o JWT service_role do projeto (mesmo
--    padrao dos demais triggers) — placeholder aqui; injete o JWT ao aplicar.
drop trigger if exists rd_diagnostico_inicio on public.diagnostico_respostas;
create trigger rd_diagnostico_inicio
  after update of email on public.diagnostico_respostas
  for each row
  when (old.email is distinct from new.email and coalesce(new.email, '') <> '')
  execute function supabase_functions.http_request(
    'https://azmtxhjtqodtaeoshrye.supabase.co/functions/v1/rd-diagnostico-conversion',
    'POST',
    '{"Content-type":"application/json","Authorization":"Bearer <SERVICE_ROLE_JWT>"}',
    '{}',
    '5000'
  );
