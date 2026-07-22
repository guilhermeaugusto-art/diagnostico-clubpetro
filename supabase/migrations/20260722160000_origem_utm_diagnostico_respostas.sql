-- Origem/UTM do lead: o quiz JA captura (context.ts, captureContext) mas
-- descartava (createSession recebia o contexto como _context nao usado).
-- Passa a gravar no INSERT (src/lib/api.ts). Colunas nullable — leads antigos
-- ficam sem origem. Anon grava as suas via RLS por token (dados do proprio
-- cadastro); o BI (funil-diagnostico-data) le e classifica em canais.
alter table public.diagnostico_respostas
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content  text,
  add column if not exists utm_term     text,
  add column if not exists origem_source text,   -- source inferido: whatsapp/google/facebook/direct/...
  add column if not exists referrer     text,
  add column if not exists landing_url  text;

comment on column public.diagnostico_respostas.origem_source is
  'Source inferido do referrer/param no boot do quiz (whatsapp, google, facebook, direct, ...). UTMs cruas nas colunas utm_*.';
