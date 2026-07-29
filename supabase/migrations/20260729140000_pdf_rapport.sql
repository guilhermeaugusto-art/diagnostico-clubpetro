-- Rapport de abordagem (29/07/2026, decisao do dono): TODO card no Kommo sobe
-- com um PDF de rapport gerado no servidor (funciona para quiz concluido OU
-- parado no meio). URL do arquivo e marco de geracao; o pdf_comercial_url do
-- app (jsPDF, so na conclusao) continua existindo em paralelo.
alter table public.diagnostico_respostas
  add column if not exists pdf_rapport_url text,
  add column if not exists rapport_gerado_em timestamptz;
