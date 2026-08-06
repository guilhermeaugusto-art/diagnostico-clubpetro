-- Conversão da tela final ("Sua análise está pronta", âncora #analise-pronta
-- no front). O front grava a PRIMEIRA abertura do resultado via
-- markResultadoVisto (PATCH com filtro resultado_visto_em=is.null), então
-- retomadas e re-renders não sobrescrevem o horário original.
-- Espelho no banco do gatilho de conversão configurado no GTM.

alter table public.diagnostico_respostas
  add column if not exists resultado_visto_em timestamptz;

comment on column public.diagnostico_respostas.resultado_visto_em is
  'Primeira abertura da tela de resultado (Sua análise está pronta). Âncora de conversão GTM: elemento #analise-pronta. Setada uma única vez pelo front (markResultadoVisto).';
