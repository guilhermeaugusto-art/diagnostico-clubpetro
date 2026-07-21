-- Participacao POR SESSAO + conciliacao nome-do-Meet -> ficha.
--
-- Antes so existia ultima_participacao_raiox (timestamp UNICO): quem repetia
-- presenca "mudava de semana" e sumia da conta da sessao anterior no BI, e a
-- sessao da semana nao tinha como contar quem estava na sala de fato.
--
-- raiox_participacoes: um registro por (pessoa do Meet x sessao), reescrito a
-- cada rodada do sync (autocorretivo: o Meet guarda o historico desde o corte).
-- resposta_id null = esteve na sala mas nao casou com cadastro do funil.
--
-- raiox_conciliacoes: mapa nome-normalizado-do-Meet -> ficha. Alimentado pelo
-- proprio sync a cada match (origem 'auto') e por conciliacao humana (origem
-- 'manual'). Resolve empate: candidato ja conciliado com OUTRO nome sai da
-- disputa (ex.: "Andre Pereira" e do lead Andre/Janauba, logo "Andre
-- Carvalhaes" so pode ser o outro Andre).

create table if not exists public.raiox_participacoes (
  meet_chave    text not null,          -- chave da pessoa no Meet (u:<uid> ou n:<nome normalizado>)
  sessao_inicio timestamptz not null,   -- startTime do conferenceRecord
  meet_nome     text not null,
  segundos      integer not null default 0,
  resposta_id   uuid references public.diagnostico_respostas(id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (meet_chave, sessao_inicio)
);
create index if not exists raiox_participacoes_resposta_idx on public.raiox_participacoes (resposta_id);
create index if not exists raiox_participacoes_sessao_idx on public.raiox_participacoes (sessao_inicio);
alter table public.raiox_participacoes enable row level security; -- sem policies: so service role

create table if not exists public.raiox_conciliacoes (
  meet_nome_norm text primary key,      -- nome exibido no Meet, normalizado (minusculo, sem acento)
  resposta_id    uuid not null references public.diagnostico_respostas(id) on delete cascade,
  origem         text not null default 'auto', -- 'auto' (sync) | 'manual' (humano decidiu)
  criado_em      timestamptz not null default now()
);
alter table public.raiox_conciliacoes enable row level security; -- sem policies: so service role
