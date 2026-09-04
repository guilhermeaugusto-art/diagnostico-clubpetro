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

-- 1b) Jobs legados de Raio-X criados fora deste repo. Os ids conhecidos em
--     producao sao 10, 11 e 13, e eles batem em DUAS functions diferentes:
--       * 13  -> /functions/v1/sync-raiox-presenca  (presenca real)
--       * 10 e 11 -> /functions/v1/confirmar-raiox?sync=confirmados
--                    (le RSVP aceito no Calendar e grava raiox_status='confirmado')
--     Por isso o filtro precisa cobrir as DUAS urls: filtrar so por
--     'sync-raiox-presenca' deixaria o 10 e o 11 vivos, e ai todo dia eles
--     voltariam a escrever raiox_status='confirmado' — o que dispara o trigger
--     rd_diagnostico_conversion (after update of concluiu, raiox_status) e
--     mandaria a conversao 'confirmou-raiox-posto' pro RD de um evento que nao
--     existe mais. O jobname nao serve de rede de seguranca: jobs criados pelo
--     dashboard podem ter jobname NULL, e NULL ilike '...' e NULL.
--     Desativa sem apagar: rollback = cron.alter_job(<id>, active => true).
do $$
declare j record;
begin
  for j in
    select jobid, jobname from cron.job
     where command ilike '%sync-raiox-presenca%'
        or command ilike '%confirmar-raiox%'
        or coalesce(jobname, '') ilike '%raiox%'
  loop
    perform cron.alter_job(j.jobid, active => false);
    raise notice 'cron job % (%) desativado', j.jobid, coalesce(j.jobname, '(sem nome)');
  end loop;
end $$;

-- 1c) Confere o resultado: lista o que sobrou ativo com cara de Raio-X e
--     GARANTE que o sweep da esteira (retry de RD + Kommo) segue ativo — ele
--     nao pode ser desligado por engano, e o comando dele nao contem 'raiox'.
do $$
declare sobrou int; sweep_ativo boolean;
begin
  select count(*) into sobrou from cron.job
   where active and (command ilike '%raiox%' or coalesce(jobname,'') ilike '%raiox%');
  select bool_or(active) into sweep_ativo from cron.job
   where jobname = 'diagnostico-esteira-sweep';
  raise notice 'jobs de raiox ainda ativos: %', sobrou;
  if sweep_ativo is distinct from true then
    raise exception 'ABORTADO: o cron diagnostico-esteira-sweep nao esta ativo. Ele e o retry de RD/Kommo e NAO pode ser desligado por esta migration.';
  end if;
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


-- =============================================================================
-- 5) PAINEL OPERACIONAL: a conversao lida passa a ser contato_especialista
-- =============================================================================
-- O painel (public/painel/index.html) classificava o funil por agendou_raiox /
-- participou_raiox. Congeladas essas colunas, TODO lead novo cairia em "sem
-- contato" e os KPIs de conversao iriam a zero permanente. O painel ja foi
-- ajustado para ler contato_especialista; falta a coluna CHEGAR ate ele.
-- Sao duas rotas de dados e as duas precisam devolver o campo:
--   * Edge Function relatorio-diagnostico -> corrigida no repo, PRECISA DE
--     DEPLOY: supabase functions deploy relatorio-diagnostico
--   * RPC relatorio_diagnostico_dados     -> recriada aqui embaixo
-- Enquanto a function nao for deployada, o painel detecta a ausencia do campo
-- e cai sozinho no RPC.

create or replace function public.relatorio_diagnostico_dados(chave text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  select case
    when exists (
      select 1 from integration_secrets s
      where s.key = 'relatorio_diagnostico_key' and s.value = chave
    )
    then coalesce((
      select jsonb_agg(t)
      from (
        select nome, telefone, email, papel, conhece, score, concluiu, mql,
               contato_especialista, contato_especialista_em,
               agendou_raiox, participou_raiox, raiox_observacao, interesse,
               pontuacao_pilares, pdf_comercial_url, respostas, created_at
        from diagnostico_respostas
        order by created_at desc
        limit 1000
      ) t
    ), '[]'::jsonb)
    else null
  end;
$fn$;

revoke all on function public.relatorio_diagnostico_dados(text) from public;
grant execute on function public.relatorio_diagnostico_dados(text) to anon, authenticated;
