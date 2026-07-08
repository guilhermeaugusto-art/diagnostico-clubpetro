-- Fichas duplicadas da mesma pessoa (mesmo telefone/e-mail): marcadas, nunca
-- apagadas, apontando para a ficha canônica. Esteira, sync de presença e
-- conversão RD ignoram fichas com duplicado_de preenchido.
-- Aplicada em produção via MCP em 08/07/2026.
alter table public.diagnostico_respostas
  add column if not exists duplicado_de uuid references public.diagnostico_respostas(id);
create index if not exists idx_diagnostico_duplicado_de
  on public.diagnostico_respostas (duplicado_de) where duplicado_de is not null;
