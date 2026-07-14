-- =============================================================================
-- Rota RESERVA de dados do painel do diagnóstico (independência do relatório)
-- =============================================================================
-- O painel em diagnostico-clubpetro.web.app/painel busca os dados primeiro na
-- Edge Function relatorio-diagnostico; se ela falhar (plataforma, deploy,
-- runtime), cai automaticamente para esta RPC, que vive NO BANCO e devolve o
-- mesmo shape. A mesma chave de integration_secrets é o portão: chave errada
-- devolve NULL. security definer para ler as tabelas sem abrir grants ao anon.
-- Aplicada em produção em 14/07/2026 via MCP (revisada no mesmo dia: + participou_raiox).
-- =============================================================================

create or replace function public.relatorio_diagnostico_dados(chave text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from integration_secrets s
      where s.key = 'relatorio_diagnostico_key' and s.value = chave
    )
    then coalesce((
      select jsonb_agg(t)
      from (
        select nome, telefone, email, papel, conhece, score, concluiu, mql,
               agendou_raiox, participou_raiox, raiox_observacao, interesse,
               pontuacao_pilares, pdf_comercial_url, respostas, created_at
        from diagnostico_respostas
        order by created_at desc
        limit 1000
      ) t
    ), '[]'::jsonb)
    else null
  end;
$$;

revoke all on function public.relatorio_diagnostico_dados(text) from public;
grant execute on function public.relatorio_diagnostico_dados(text) to anon, authenticated;
