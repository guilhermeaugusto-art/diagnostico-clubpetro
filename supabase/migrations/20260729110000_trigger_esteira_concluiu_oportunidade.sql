-- v14 da esteira (29/07/2026, decisao do dono): quem CONCLUI o quiz vira
-- oportunidade (RD OPPORTUNITY + card Kommo) sem esperar o Raio-X — so para
-- fichas criadas a partir de 29/07 (corte no codigo da esteira). Este trigger
-- da o tempo real; o cron */10 segue como retry.
-- A definicao e COPIADA do trigger diagnostico_esteira_participou (mesma
-- function supabase_functions.http_request e mesmos args, incluindo o JWT
-- service_role que nao e versionado): troca a coluna participou_raiox por
-- concluiu e acrescenta ?gatilho=concluiu na URL — a esteira pula a etapa 1
-- nesse webhook (a rd-diagnostico-conversion dispara no MESMO update e ja
-- envia fez-diagnostico; dois remetentes = conversao em dobro).
do $$
declare def text;
begin
  select pg_get_triggerdef(t.oid) into def
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'diagnostico_respostas'
    and t.tgname = 'diagnostico_esteira_participou';
  if def is null then
    raise exception 'trigger diagnostico_esteira_participou nao encontrado (base para copiar args)';
  end if;
  def := replace(def, 'diagnostico_esteira_participou', 'diagnostico_esteira_concluiu');
  def := replace(def, 'participou_raiox', 'concluiu');
  def := replace(def, 'functions/v1/diagnostico-esteira', 'functions/v1/diagnostico-esteira?gatilho=concluiu');
  execute 'drop trigger if exists diagnostico_esteira_concluiu on public.diagnostico_respostas';
  execute def;
end $$;
