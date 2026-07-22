-- Varredura 22/07: RLS do quiz com token de sessao + higiene de grants.
--
-- ANTES (inseguro): anon (chave publica do quiz) podia SELECT toda a base
-- (PII de todos os leads) e UPDATE qualquer linha, alem de ter DELETE/TRUNCATE.
--
-- DEPOIS: cada sessao do quiz gera um token secreto no navegador, gravado na
-- coluna token_sessao no INSERT e enviado no header x-quiz-token em cada
-- UPDATE. A RLS por token restringe anon a VER e ATUALIZAR apenas a propria
-- linha (a que tem o token que ele apresenta). Sem token => enxerga 0 linhas.
--
-- IMPORTANTE (aprendido na aplicacao): o UPDATE ... WHERE id=X do PostgREST
-- LE a coluna id, entao anon precisa de GRANT SELECT + policy de SELECT — sem
-- a policy de SELECT o UPDATE casa 0 linhas silenciosamente. Por isso a policy
-- de SELECT (escopada ao token) e obrigatoria, nao opcional.
--
-- As edges (esteira/sync/confirmar-raiox/funil-diagnostico-data) usam
-- service_role e ignoram RLS; o painel le via edge protegida + RPC
-- SECURITY DEFINER; nada disso e afetado.

alter table public.diagnostico_respostas add column if not exists token_sessao text;

-- Grants: anon PRECISA de SELECT (para o UPDATE...WHERE e para a policy de
-- SELECT funcionarem) e NAO deve ter DELETE/TRUNCATE.
grant select on public.diagnostico_respostas to anon;
revoke delete, truncate on public.diagnostico_respostas from anon;

-- Substitui as policies anon permissivas (USING/CHECK true) por versoes
-- escopadas ao token. Rollback: recriar "anon le"/"anon atualiza"/"anon insere"
-- todas com USING(true)/CHECK(true).
drop policy if exists "anon le" on public.diagnostico_respostas;
drop policy if exists "anon atualiza" on public.diagnostico_respostas;
drop policy if exists "anon insere" on public.diagnostico_respostas;
drop policy if exists "anon le com token" on public.diagnostico_respostas;
drop policy if exists "anon atualiza com token" on public.diagnostico_respostas;
drop policy if exists "anon insere com token" on public.diagnostico_respostas;

create policy "anon insere com token" on public.diagnostico_respostas
  for insert to anon
  with check (token_sessao is not null and length(token_sessao) >= 32);

create policy "anon le com token" on public.diagnostico_respostas
  for select to anon
  using (token_sessao is not null
         and token_sessao = (current_setting('request.headers', true)::json ->> 'x-quiz-token'));

create policy "anon atualiza com token" on public.diagnostico_respostas
  for update to anon
  using (token_sessao is not null
         and token_sessao = (current_setting('request.headers', true)::json ->> 'x-quiz-token'))
  with check (token_sessao is not null
              and token_sessao = (current_setting('request.headers', true)::json ->> 'x-quiz-token'));
