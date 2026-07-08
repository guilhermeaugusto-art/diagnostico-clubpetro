-- Observabilidade: o pg_net descarta a resposta HTTP dos crons; sem estas
-- tabelas a lista "revisar" da presença e os erros da esteira somem sem ninguém ver.
-- Aplicada em produção via MCP em 08/07/2026.
alter table public.diagnostico_respostas
  add column if not exists kommo_erro text;

create table if not exists public.raiox_presenca_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  origem text not null default 'sync-raiox-presenca',
  relatorio jsonb not null
);

create table if not exists public.diagnostico_esteira_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  resumo jsonb not null
);

alter table public.raiox_presenca_log enable row level security;
alter table public.diagnostico_esteira_log enable row level security;
