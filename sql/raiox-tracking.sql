-- ============================================================================
-- Raio X: rastreio de agendamento e participacao
-- Rode no SQL Editor do Supabase (projeto azmtxhjtqodtaeoshrye).
-- ============================================================================

-- 1) DATA DO AGENDAMENTO (Parte 1)
--    O app ja grava agendou_raiox = true ao clicar. Este gatilho carimba a data
--    no momento em que isso acontece, sem mexer no app.
alter table public.diagnostico_respostas
  add column if not exists agendou_raiox_em timestamptz;

create or replace function public.fn_stamp_agendou_raiox()
returns trigger language plpgsql as $$
begin
  if new.agendou_raiox = true
     and (old.agendou_raiox is distinct from true)
     and new.agendou_raiox_em is null then
    new.agendou_raiox_em := now();
  end if;
  return new;
end;
$$;
drop trigger if exists trg_stamp_agendou_raiox on public.diagnostico_respostas;
create trigger trg_stamp_agendou_raiox
  before update on public.diagnostico_respostas
  for each row execute function public.fn_stamp_agendou_raiox();


-- 2) PARTICIPACAO NO RAIO X (Parte 2) - colunas prontas para o job futuro
--    participou_raiox: ja participou ao menos uma vez.
--    ultima_participacao_raiox: data da ultima participacao.
--    (Estas colunas serao preenchidas por um cron/Edge Function que le os
--     convidados/presenca do evento do Google Calendar - ver nota abaixo.)
alter table public.diagnostico_respostas
  add column if not exists participou_raiox boolean not null default false;
alter table public.diagnostico_respostas
  add column if not exists ultima_participacao_raiox timestamptz;

-- NOTA sobre como preencher a participacao (a implementar no backend):
--  - Fonte automatica simples: ler os attendees do evento unico do Google
--    Calendar e marcar quem tem responseStatus = 'accepted' (aceitou o convite).
--  - Fonte real de presenca: relatorio de presenca do Google Meet (so no
--    Workspace, via Admin SDK Reports) - diz quem entrou de fato na sala.
--  O cron casa o email do attendee com o email do lead e faz:
--    update public.diagnostico_respostas
--       set participou_raiox = true, ultima_participacao_raiox = <data da sessao>
--     where lower(email) = lower(<email do attendee>);
-- ============================================================================
