-- =============================================================================
-- RESGATE COMERCIAL · terminou o quiz mas NAO virou MQL (concluido_em nulo)
-- =============================================================================
-- Rodar no SQL Editor do Supabase (projeto Inteligencia Comercial CP).
--
-- Quem entra na lista: dono ou gerente que respondeu o diagnostico ate o fim
-- (viu o resultado, ou respondeu a ultima pergunta da PROPRIA trilha) mas cuja
-- linha ficou com concluido_em nulo — ou seja, nunca subiu como MQL/conversao.
-- O contato (nome, WhatsApp, e-mail) existe desde a tela inicial.
--
-- LEITURA POR EPOCA (importante):
--   * Sessoes ATE 05/08/2026 (fluxo antigo, com portao de confirmacao no
--     resultado): sao leads que viram a propria nota e NAO clicaram na
--     confirmacao final — abandono real de ultimo passo. Ligar vale ouro.
--   * Sessoes APOS 05/08/2026: a conclusao passou a ser gravada AUTOMATICA-
--     MENTE na abertura do resultado (submitLead no onResultRendered), entao
--     concluido_em nulo aqui = FALHA DE GRAVACAO (PATCH perdido: rede,
--     adblock, retomada em aba nova que perdeu o token RLS — corrigido no app
--     em 26/08/2026). Continuam valendo resgate: nunca chegaram ao RD/Kommo.
--   * Limitacao: no fluxo pos-05/08 quem abre o resultado e some ganha
--     concluido_em na hora — abandono de ultimo passo deixou de ser
--     mensuravel por esta query (nao existe mais "ultimo passo" manual).
--
-- Julho/2026: 6 leads (todos da epoca do portao). Conferencia cruzada com a
-- analise de abandono do mes: bate 1:1.
-- =============================================================================

select
  nome,
  telefone,
  email,
  papel,
  score,
  nivel,
  interesse                                                   as dor_principal,
  (created_at at time zone 'America/Sao_Paulo')::date         as comecou_em,
  (resultado_visto_em at time zone 'America/Sao_Paulo')::date as viu_resultado_em,
  case when created_at < '2026-08-05T00:00:00-03:00'
       then 'abandono no ultimo passo (portao)'
       else 'falha de gravacao (verificar)' end               as leitura,
  (now() at time zone 'America/Sao_Paulo')::date
    - (created_at at time zone 'America/Sao_Paulo')::date     as dias_atras
from public.diagnostico_respostas
where concluido_em is null                      -- nunca virou MQL/conversao
  and nome is not null and telefone is not null -- contato existe (tela inicial)
  and papel in ('dono', 'gerente')              -- frentista nao gera MQL
  and (resultado_visto_em is not null           -- abriu a tela de resultado
       -- ...ou respondeu a ultima pergunta da PROPRIA trilha (cruzado com o
       -- papel: chave de outra trilha herdada de troca de papel nao conta)
       or (papel = 'dono'    and respostas ? 'D_INTENCAO')
       or (papel = 'gerente' and respostas ? 'G_CONHECE'))
  and coalesce(nome, '')  !~* 'teste|ignorar'   -- fora os testes internos
  and coalesce(email, '') !~* 'teste|tracking|@clubpetro-validacao'
order by created_at desc;

-- Obs. de precisao: em sessoes anteriores a 24/07 (sem resultado_visto_em) que
-- foram retomadas direto na tela de resultado, um bug antigo do app reescrevia
-- o jsonb `respostas` apagando as chaves — esses casos escapam do fallback
-- acima (falso negativo raro; corrigido no app em 26/08/2026).
