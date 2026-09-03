-- =============================================================================
-- ONDE O LEAD PARA DE RESPONDER  ·  diagnostico_respostas
-- =============================================================================
-- Rodar no SQL Editor do Supabase (projeto Inteligencia Comercial CP).
--
-- Como funciona: a coluna `respostas` (jsonb) recebe um UPDATE a cada resposta
-- dada, com a chave = id da pergunta. Entao a ULTIMA chave presente, na ordem
-- de exibicao da trilha, e a ultima pergunta respondida; a PROXIMA da ordem e a
-- pergunta em que a pessoa parou (viu e nao respondeu).
--
-- Condicionais (D_C_SERV, D_C_LOJA, D_PADRAO, D_EXPANDIR, G_C_SERV, G_C_LOJA,
-- F_R1, F_C_LOJA, F_C_SERV) so entram na conta quando a resposta de servicos /
-- numero de postos torna a pergunta aplicavel. Quando a pessoa parou antes
-- dessa resposta, a condicional e tratada como "nao aplicavel".
-- =============================================================================

-- PRECISAO DOS DADOS: ate 26/08/2026 o app tinha um bug em retomada de sessao
-- (reload): o buffer local nascia vazio e o proximo persistAnswer SOBRESCREVIA
-- o jsonb `respostas`, apagando o que veio antes do reload. Em sessoes
-- retomadas, a "ultima pergunta" sobrevive, mas condicionais podem aparecer
-- como nao-aplicaveis (D_PT_MIX/D_PT_POSTOS apagadas) e a CONSULTA 3 subconta
-- o comeco do funil. Corrigido no app em 26/08/2026 (hydrateLocalAnswers);
-- dados anteriores carregam esse ruido em sessoes retomadas.

-- ATENCAO (26/08/2026): a trilha do DONO foi reordenada no codigo (aquecimento
-- de perfil antes da fidelizacao). O bloco `ordem` abaixo reflete a ORDEM
-- ANTIGA, correta para sessoes criadas ate o deploy da mudanca. Para sessoes
-- criadas DEPOIS do deploy, troque as posicoes do dono por:
--   0 S1 | 1 D_PT_POSTOS | 2 D_PT_MIX | 3 D_DOR | 4 D_F1 | 5 D_F3 | 6 D_M2
--   | 7 D_C2 | 8 D_C3 | 9 D_FCHURN | 10 D_C1 | 11 D_C_SERV | 12 D_C_LOJA
--   | 13 D_M1 | 14 D_P2 | 15 D_P3 | 16 D_P4 | 17 D_DA1 | 18 D_R1
--   | 19 D_PADRAO | 20 D_EXPANDIR | 21 D_CONHECE | 22 D_INTENCAO
-- (gerente e frentista nao mudaram; o c:/tmp/dropoff.mjs ja trata as duas
-- ordens automaticamente via REORDER_DONO_EM.)

with ordem(trilha, pos, qid, rotulo, condicional) as (values
  -- S1 e comum as tres trilhas (posicao 0)
  ('dono',0,'S1','Qual e o seu papel no posto?',null),
  ('gerente',0,'S1','Qual e o seu papel no posto?',null),
  ('frentista',0,'S1','Qual e o seu papel no posto?',null),

  -- ---------------- DONO ----------------
  ('dono', 1,'D_F1','O que voce faz para o cliente voltar?',null),
  ('dono', 2,'D_F3','Sabe o motivo do cliente voltar?',null),
  ('dono', 3,'D_M2','Tirando o preco, por que escolheriam seu posto?',null),
  ('dono', 4,'D_C2','Como decide o preco da bomba?',null),
  ('dono', 5,'D_C3','Quanto da gasolina e aditivada?',null),
  ('dono', 6,'D_FCHURN','Sabe por que o cliente abastece uma vez e some?',null),
  ('dono', 7,'D_C1','Sabe a margem por litro?',null),
  ('dono', 8,'D_PT_POSTOS','Quantos postos voce tem?',null),
  ('dono', 9,'D_PT_MIX','O que oferece alem do combustivel?',null),
  ('dono',10,'D_DOR','O que mais tira o seu sono?',null),
  ('dono',11,'D_C_SERV','Lava rapido / troca de oleo deixam margem?','servicos'),
  ('dono',12,'D_C_LOJA','A loja de conveniencia deixa margem?','loja'),
  ('dono',13,'D_M1','O que ve quem passa pela primeira vez?',null),
  ('dono',14,'D_P2','PEC do fim da 6x1: o posto esta preparado?',null),
  ('dono',15,'D_P3','Qual a rotatividade da equipe?',null),
  ('dono',16,'D_P4','Como e a contratacao e o treinamento?',null),
  ('dono',17,'D_DA1','Tem sistema de venda, margem e estoque?',null),
  ('dono',18,'D_R1','Precisa baixar preco pro vizinho nao levar o cliente?',null),
  ('dono',19,'D_PADRAO','Os postos seguem o mesmo padrao?','rede'),
  ('dono',20,'D_EXPANDIR','Pretende abrir mais postos em 12 meses?','rede'),
  ('dono',21,'D_CONHECE','Ja conhecia o ClubPetro?',null),
  ('dono',22,'D_INTENCAO','Gostaria de conhecer um caminho de melhoria?',null),

  -- ---------------- GERENTE ----------------
  ('gerente', 1,'G_F1','O que voces fazem para o cliente voltar?',null),
  ('gerente', 2,'G_F3','Sabe o motivo do cliente voltar?',null),
  ('gerente', 3,'G_M2','Tirando o preco, por que escolhem o posto?',null),
  ('gerente', 4,'G_C1','Tem visibilidade da margem por litro?',null),
  ('gerente', 5,'G_C2','Quanto da gasolina e aditivada?',null),
  ('gerente', 6,'G_FCHURN','Sabe por que o cliente abastece uma vez e some?',null),
  ('gerente', 7,'G_PT_MIX','O que o posto oferece alem do combustivel?',null),
  ('gerente', 8,'G_PT_EQUIPE','Quantas pessoas respondem a voce?',null),
  ('gerente', 9,'G_DOR','O que mais tira o seu sono na operacao?',null),
  ('gerente',10,'G_C_SERV','Lava rapido / troca de oleo rendem?','servicos'),
  ('gerente',11,'G_C_LOJA','A loja de conveniencia puxa resultado?','loja'),
  ('gerente',12,'G_M1','O posto convida a entrar?',null),
  ('gerente',13,'G_P2','PEC do fim da 6x1: da pra cobrir a escala?',null),
  ('gerente',14,'G_P3','Qual a rotatividade da equipe?',null),
  ('gerente',15,'G_P4','Como e a integracao e o treinamento?',null),
  ('gerente',16,'G_DA1','Usa sistema ou e planilha e caderno?',null),
  ('gerente',17,'G_R1','Precisam baixar preco pro vizinho?',null),
  ('gerente',18,'G_CONHECE','Ja conhecia o ClubPetro?',null),

  -- ---------------- FRENTISTA ----------------
  ('frentista', 1,'F_PT_TEMPO','Ha quanto tempo trabalha no posto?',null),
  ('frentista', 2,'F_PT_AREA','Onde atua no dia a dia?',null),
  ('frentista', 3,'F_PT_TURNO','Quantos colegas no seu turno?',null),
  ('frentista', 4,'F_PT_SERVICOS','O que o posto oferece alem do combustivel?',null),
  ('frentista', 5,'F_F1','Tem programa de fidelidade e consegue usar?',null),
  ('frentista', 6,'F_M2','Sabe explicar por que vale abastecer aqui?',null),
  ('frentista', 7,'F_P3','Gente entra e sai com frequencia?',null),
  ('frentista', 8,'F_F3','O cliente volta e te reconhece?',null),
  ('frentista', 9,'F_R1','Ja apareceu cliente com carro eletrico?','eletrica'),
  ('frentista',10,'F_P1','A escala te da folga certa?',null),
  ('frentista',11,'F_P2','Se a lei mudar, o turno tem gente suficiente?',null),
  ('frentista',12,'F_P4','Recebeu treinamento de verdade?',null),
  ('frentista',13,'F_P5','Como e o ambiente de trabalho?',null),
  ('frentista',14,'F_P6','Ganha algo a mais ao vender aditivado / loja?',null),
  ('frentista',15,'F_M1','O cliente acha o posto convidativo?',null),
  ('frentista',16,'F_F2','Sabe responder sobre desconto ou pontos?',null),
  ('frentista',17,'F_C_LOJA','Indica a loja pro cliente?','loja'),
  ('frentista',18,'F_C_SERV','O cliente faz lava rapido / troca de oleo?','servicos'),
  ('frentista',19,'F_RECLAMA','O que o cliente mais reclama? (texto livre)',null),
  ('frentista',20,'F_MELHORIA','O que mudaria no posto? (texto livre)',null),
  ('frentista',21,'F_SENTE','Como se sente trabalhando aqui?',null)
),

/* Sessoes criadas no mes corrente (fuso de Brasilia), fora os testes internos */
sessoes as (
  select
    d.id,
    d.created_at,
    d.concluido_em,
    d.respostas,
    case d.papel when 'dono' then 'dono'
                 when 'gerente' then 'gerente'
                 when 'outro' then 'frentista' end as trilha,
    coalesce(d.respostas -> 'D_PT_MIX' -> 'value', '[]'::jsonb) ||
    coalesce(d.respostas -> 'G_PT_MIX' -> 'value', '[]'::jsonb) ||
    coalesce(d.respostas -> 'F_PT_SERVICOS' -> 'value', '[]'::jsonb) as servicos,
    d.respostas -> 'D_PT_POSTOS' ->> 'value' as postos
  from public.diagnostico_respostas d
  where (d.created_at at time zone 'America/Sao_Paulo')
        >= date_trunc('month', now() at time zone 'America/Sao_Paulo')
    and coalesce(d.nome, '')  !~* 'teste|test '
    and coalesce(d.email, '') !~* 'teste|test@'
),

/* Ultima pergunta respondida de cada sessao, na ordem da trilha */
ultima as (
  select s.*,
         (select max(o.pos)
            from jsonb_object_keys(s.respostas) k
            join ordem o on o.trilha = s.trilha and o.qid = k) as ultima_pos
  from sessoes s
  where s.respostas is not null and s.respostas <> '{}'::jsonb
),

/* Pergunta em que parou = proxima da ordem que seria exibida de fato */
parou as (
  select u.*,
         (select o.qid from ordem o
           where o.trilha = u.trilha and o.pos > u.ultima_pos
             and (o.condicional is null
                  or (o.condicional = 'servicos' and (u.servicos ? 'troca_oleo' or u.servicos ? 'lava_rapido'))
                  or (o.condicional = 'loja' and u.servicos ? 'conveniencia')
                  or (o.condicional = 'eletrica' and u.servicos ? 'eletrica')
                  or (o.condicional = 'rede' and u.postos in ('2a4','5mais')))
           order by o.pos limit 1) as parou_qid
  from ultima u
  where u.concluido_em is null      -- so quem NAO terminou
)

-- =============================================================================
-- CONSULTA 1 · RESPOSTA DIRETA: em qual pergunta a maioria para
-- =============================================================================
select
  p.trilha,
  coalesce(o.pos, 999)                                 as posicao,
  coalesce(p.parou_qid, '(fim)')                       as pergunta_id,
  coalesce(o.rotulo,
    'Respondeu tudo e nao concluiu (ver resgate)')     as pergunta,
  count(*)                                             as pararam_aqui,
  round(100.0 * count(*) / sum(count(*)) over (), 1)   as pct_dos_abandonos,
  round(100.0 * count(*)
    / sum(count(*)) over (partition by p.trilha), 1)   as pct_na_trilha
from parou p
left join ordem o on o.trilha = p.trilha and o.qid = p.parou_qid
group by p.trilha, o.pos, p.parou_qid, o.rotulo
order by pararam_aqui desc, posicao;


-- =============================================================================
-- CONSULTA 2 · Funil do mes: quantos abriram, responderam e concluiram
-- (descomentar e rodar sozinha, junto com o bloco `with` acima)
-- =============================================================================
-- select
--   count(*)                                                  as sessoes_criadas,
--   count(*) filter (where respostas is not null
--                      and respostas <> '{}'::jsonb)          as responderam_ao_menos_1,
--   count(*) filter (where trilha is not null)                as escolheram_papel,
--   count(*) filter (where concluido_em is not null)          as concluiram,
--   round(100.0 * count(*) filter (where concluido_em is not null)
--         / nullif(count(*),0), 1)                            as pct_conclusao
-- from sessoes;


-- =============================================================================
-- CONSULTA 3 · Sobrevivencia pergunta a pergunta (onde a curva despenca)
-- =============================================================================
-- select o.trilha, o.pos, o.qid, o.rotulo,
--        count(u.id) filter (where u.ultima_pos >= o.pos) as chegaram_ate_aqui
-- from ordem o
-- left join ultima u on u.trilha = o.trilha
-- group by o.trilha, o.pos, o.qid, o.rotulo
-- order by o.trilha, o.pos;
