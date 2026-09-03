-- Origem cega (31/08): click id do anuncio + fingerprint do navegador.
--
-- MOTIVO (numero real, medido hoje no banco): das 74 sessoes gravadas desde
-- 22/07 — data em que o INSERT passou a persistir origem (ver
-- 20260722160000_origem_utm_diagnostico_respostas.sql) — 41 (55%) chegaram com
-- landing_url = 'https://diagnostico-clubpetro.web.app/' SEM query string
-- nenhuma e com referrer VAZIO. As 41 sao identicas entre si e caem todas em
-- origem_source='direct' com utm_* nulos. Dessas 41, 29 viraram lead de fato
-- (nome+email), 29 subiram pro RD e 16 viraram card no Kommo: ou seja, 29 leads
-- entregues ao comercial sem NENHUMA origem atribuida. Enquanto isso o trafego
-- que chega com UTM aparece direitinho (meta/cpc/diagnostico-cadastro, RD
-- Station/email, instagram/bio, blog/banner_posts_blog).
--
-- Duas hipoteses para os 55% cegos, e esta migration cria a coluna que testa
-- cada uma:
--   (a) Clique de anuncio que chega SO com click id (?fbclid=... / ?gclid=...)
--       e sem UTM. Hoje o captureContext() nem le esses parametros, entao o
--       clique paga e vira 'direct'. Nao ha NENHUMA linha na base com fbclid ou
--       gclid na landing_url — coerente com "nunca foi lido", nao com "nunca
--       aconteceu". As colunas fbclid/gclid passam a guardar o id cru.
--   (b) In-app browser do Instagram/Facebook, que abre o link sem referrer e
--       (dependendo do fluxo) sem query. O captureContext() JA coleta
--       user_agent/device_type/browser/os desde 22/07, mas o createSession()
--       joga fora antes do INSERT — o dado existe no navegador e morre ali.
--       Persistindo, da pra separar 'direct de verdade' de 'webview cega'.
--
-- RLS: verificado em 20260722150000_rls_token_sessao_quiz.sql que a policy
-- "anon insere com token" e POR LINHA — with check (token_sessao is not null
-- and length(token_sessao) >= 32) — e nao enumera colunas. Idem as policies de
-- select/update, que casam so por token_sessao. Portanto colunas novas entram
-- no INSERT do anon sem nenhuma alteracao de policy, e esta migration NAO
-- mexe em RLS nem em grants (anon ja tem insert/select/update na tabela).
alter table public.diagnostico_respostas
  add column if not exists fbclid      text,
  add column if not exists gclid       text,
  add column if not exists user_agent  text,
  add column if not exists device_type text,   -- mobile / tablet / desktop
  add column if not exists browser     text,
  add column if not exists os          text;

comment on column public.diagnostico_respostas.fbclid is
  'Click id do Facebook/Meta (?fbclid=) capturado na landing. Serve quando a campanha nao manda utm_*: sem ele o clique pago cai em origem_source=direct. Tambem e a chave para casar a sessao com o clique no Ads Manager / CAPI.';

comment on column public.diagnostico_respostas.gclid is
  'Click id do Google Ads capturado na landing. ATENCAO: guarda gclid OU wbraid OU gbraid (o primeiro que vier na URL) — o Google manda wbraid/gbraid no LUGAR do gclid quando o consentimento barra o cookie (iOS/ATT), e as tres sao a mesma moeda de atribuicao. Para upload de conversao offline no Google Ads o campo de destino muda conforme o tipo, entao NAO mapeie a coluna inteira como gclid: separe pelo prefixo do valor ou pelo landing_url.';

comment on column public.diagnostico_respostas.user_agent is
  'User-Agent cru do navegador na abertura do quiz. Coletado desde 22/07 mas descartado antes do INSERT ate 31/08. Serve para identificar in-app browser (Instagram/FBAV/FBAN no UA), a hipotese principal para os 55% de sessoes sem referrer e sem query string.';

comment on column public.diagnostico_respostas.device_type is
  'mobile/tablet/desktop derivado do User-Agent. Trafego social sem origem tende a ser 100% mobile; se os direct forem mistos, a causa nao e webview.';

comment on column public.diagnostico_respostas.browser is
  'Navegador derivado do User-Agent (Chrome, Safari, Instagram, Facebook, ...). O valor Instagram/Facebook aqui e a confirmacao direta de que a sessao veio de webview de rede social e nao de acesso direto.';

comment on column public.diagnostico_respostas.os is
  'Familia do sistema operacional derivada do User-Agent (Windows/macOS/Android/iOS/Linux), SEM versao. Serve para o recorte iOS vs Android do trafego sem origem. NAO serve para medir o bug do crypto.randomUUID (webview antiga, corrigido em 31/08): quem caiu nele nunca chegou a ter linha no banco, porque o TypeError estourava antes do INSERT. Versao de SO, quando precisar, sai do user_agent.';

-- Indice: NAO criado de proposito. Ja existe
-- idx_diagnostico_respostas_created_at ON (created_at DESC), criado em
-- 20260602130000_diagnostico_respostas_enxuto.sql, e ele ja atende como coluna
-- lider um composto (created_at, origem_source). Com 74 linhas na tabela o
-- planner faz seq scan de qualquer jeito e o BI (funil-diagnostico-data) le a
-- janela inteira de uma vez. Se o volume crescer e o corte por canal ficar
-- caro, o indice a criar e:
--   create index if not exists idx_diagnostico_respostas_created_origem
--     on public.diagnostico_respostas (created_at desc, origem_source);
