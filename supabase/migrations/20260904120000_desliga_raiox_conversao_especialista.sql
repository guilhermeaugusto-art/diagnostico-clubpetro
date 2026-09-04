-- =============================================================================
-- RAIO-X SAI DO FLUXO · a conversao da tela final passa a ser o ESPECIALISTA
-- =============================================================================
-- Decisao de produto (04/09/2026): o Raio-X (sessao ao vivo de terca) foi
-- descontinuado. Com ele saem o agendamento automatico em Google Calendar, a
-- confirmacao de presenca e o sync de participacao. A tela final vira
-- diagnostico + contato direto com um Especialista ClubPetro pelo WhatsApp.
--
-- O QUE ESTA MIGRATION FAZ
--   1. Desliga o cron que sincronizava presenca nas tercas.
--   2. Desliga o trigger que empurrava RD/Kommo quando participou_raiox virava
--      true (ninguem mais marca essa coluna).
--   3. Documenta as colunas de Raio-X como HISTORICO CONGELADO.
--
-- O QUE ESTA MIGRATION **NAO** FAZ (decisao explicita)
--   * NAO apaga coluna nenhuma: o historico de quem participou do Raio-X segue
--     consultavel (agendou_raiox, raiox_status, raiox_data, participou_raiox,
--     ultima_participacao_raiox, raiox_observacao).
--   * NAO mexe nas conversoes do RD (confirmou-raiox-posto / fez-raiox-posto)
--     nem na tag `raiox-realizado` do Kommo. O codigo da esteira segue no ar,
--     apenas dorme: sem ninguem marcando confirmado/participou, as etapas 2 e 3
--     nao tem mais linha elegivel. Se um dia quiser limpar de vez, o lugar e
--     supabase/functions/diagnostico-esteira/index.ts (etapas 2 e 3).
--   * NAO remove as Edge Functions confirmar-raiox e sync-raiox-presenca. Elas
--     ficam sem chamador (o front nao chama mais, o cron esta desligado).
--
-- ROLLBACK
--   Reagendar o cron e recriar o trigger com o JWT service_role, exatamente
--   como em 20260708105000_crons_esteira_e_presenca.sql (item 2) e
--   20260708102000_trigger_esteira_participou_raiox.sql.
-- =============================================================================

-- 1) Cron de presenca das tercas (11h-14h50 BRT). unschedule tolerante: se o
--    job ja nao existir no ambiente, segue sem erro.
do $$
begin
  perform cron.unschedule('sync-raiox-presenca-terca');
exception when others then
  raise notice 'cron sync-raiox-presenca-terca ja estava ausente';
end $$;

-- 1b) Jobs legados por id (10, 11 e 13 no ambiente de producao) que tambem
--     batiam no sync de presenca. Desativa sem apagar, para o rollback ser um
--     simples cron.alter_job(<id>, active => true).
do $$
declare j record;
begin
  for j in
    select jobid, jobname from cron.job
     where command ilike '%sync-raiox-presenca%'
        or jobname ilike '%raiox%'
  loop
    perform cron.alter_job(j.jobid, active => false);
    raise notice 'cron job % (%) desativado', j.jobid, j.jobname;
  end loop;
end $$;

-- 2) Trigger de participacao real: sem Raio-X, participou_raiox nunca mais
--    muda. Removido para nao deixar webhook armado apontando pra etapa morta.
drop trigger if exists diagnostico_esteira_participou on public.diagnostico_respostas;

-- 3) Documentacao das colunas: historico congelado, o app nao escreve mais.
comment on column public.diagnostico_respostas.agendou_raiox is
  'HISTORICO CONGELADO (ate 04/09/2026). Raio-X descontinuado; o app nao escreve mais nesta coluna. Conversao da tela final passou a ser contato_especialista.';
comment on column public.diagnostico_respostas.raiox_status is
  'HISTORICO CONGELADO (ate 04/09/2026). nao_agendado | agendado | confirmado | participou | falta | cancelado. Raio-X descontinuado.';
comment on column public.diagnostico_respostas.raiox_data is
  'HISTORICO CONGELADO (ate 04/09/2026). Raio-X descontinuado.';
comment on column public.diagnostico_respostas.participou_raiox is
  'HISTORICO CONGELADO (ate 04/09/2026). Raio-X descontinuado; cron de sync e trigger de participacao desligados nesta migration.';
comment on column public.diagnostico_respostas.contato_especialista is
  'Conversao da tela final desde 04/09/2026: a pessoa acionou o WhatsApp do Especialista ClubPetro no resultado. Libera tambem pdf_liberado.';

-- 4) O trigger que liberava o PDF ao marcar participou_raiox continua existindo
--    (inofensivo, sem gatilho). A liberacao do PDF passou para o CTA do
--    especialista, gravada pelo app junto de contato_especialista.
