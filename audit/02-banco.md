# Auditoria de Banco · Diagnóstico ClubPetro

Escopo: toda leitura/escrita ao Supabase feita pelo código deste repositório
(`src/lib/api.ts`, `src/lib/supabase.ts`, `src/lib/raiox.ts`, `public/supabase.js`),
confrontada com `sql/*.sql`, `supabase/migrations/*.sql` e `supabase/README.md`.

Only-read confirmado: o app SÓ escreve (POST/PATCH) em `diagnostico_respostas` e
faz upload em Storage. Não há nenhum `SELECT`/`.from(...)` no client. As tabelas
`vm_clientes` e `BD_Leads_Kommo` citadas no brief **não são referenciadas em
nenhum arquivo deste repositório** (nem `.ts`, nem `.sql`, nem `.md`); portanto
o alerta "status é BOOLEAN" não se aplica a código auditável aqui, é
presumivelmente de outro app/painel. Ver achado B-06.

## Resumo executivo

A tabela real (`diagnostico_respostas`, populada por `supabase/migrations/20260602130000_diagnostico_respostas_enxuto.sql`)
e a tabela descrita em `supabase/README.md` são **dois esquemas completamente
diferentes**: nomes de coluna, bucket de storage e até a filosofia de dados
(colunas por pergunta vs. um único jsonb) divergem ponto a ponto. Qualquer
pessoa do time comercial que siga o README pra rodar SQL vai falhar em toda
query (`column "overall_score" does not exist`, `relation "diagnostic_summary"
does not exist"` etc.) — é o achado mais crítico (B-01).

Logo atrás, o app monta URLs **públicas** de PDF (`/storage/v1/object/public/...`)
mas a migration cria o bucket `diagnostico-pdfs` como **privado**
(`public: false`) e a policy de leitura autenticada é a única capaz de acessar
o objeto — ou seja, o link salvo em `pdf_comercial_url`/`pdf_cliente_url` e
mandado pro cliente pode devolver 400/403 (B-02), a menos que o bucket tenha
sido tornado público manualmente fora do código versionado (não verificável
por auditoria estática).

Também há uma corrida de rede real: a primeira resposta do quiz (S1) pode
gravar (PATCH) antes da sessão existir (POST), porque o app dispara os dois
fetches sem aguardar o primeiro terminar (B-03). E a pergunta aberta do
frentista (`F_MELHORIA`) nunca preenche a coluna dedicada `interesse`, porque
a guarda de tipo em `api.ts` exclui justamente `kind === "text"`, que é o tipo
que `F_MELHORIA` sempre produz (B-04).

`sql/revisao-banco.sql` cria um índice parcial referenciando a coluna
`rd_raiox_enviado`, que não existe em nenhuma migration deste repositório
(B-05) — o `CREATE INDEX` do Bloco 1 falharia se rodado como está.

## Achados

| ID | Título | Severidade | Arquivo:linha | Evidência | Impacto | Recomendação | Confiança |
|----|--------|------------|----------------|-----------|---------|---------------|-----------|
| B-01 | `supabase/README.md` documenta um esquema inteiramente diferente do que existe de fato | Crítica | `supabase/README.md:31-241` vs `supabase/migrations/20260602130000_diagnostico_respostas_enxuto.sql:24-159` e `src/lib/api.ts:86-355` | README lista colunas como `overall_score`, `lead_email`, `lead_whatsapp`, `answer_s1`, `answers_full`, `status`, bucket `diagnostic-reports`, view `diagnostic_summary`, trigger `unlock_report_on_rayx_attended`. Nenhuma dessas colunas/objetos aparece na migration real nem é escrita por `api.ts`, que usa `score`, `email`, `telefone`, `respostas` (jsonb único), `nivel`, `pontuacao_pilares`, bucket `diagnostico-pdfs`, colunas `pdf_comercial_*`/`pdf_cliente_*`, `agendou_raiox`, `raiox_status`. | Qualquer consulta SQL copiada do README (localizar lead, ver diagnóstico completo, funil por UTM, liberar manualmente) falha com "column/relation does not exist". Onboarding de novos devs ou do time comercial quebra na primeira tentativa. | Reescrever `supabase/README.md` a partir do schema real (`diagnostico_respostas_enxuto.sql` + colunas legadas presumidas: `nome`, `email`, `telefone`, `papel`, `conhece`, `interesse`, `score`, `nivel`, `respostas`, `servicos_extras`, `mql`, `rd_enviado*`, `concluido_em`, `concluiu`). Apagar/arquivar a seção de tabelas extra (`diagnostic_answers`, `diagnostic_results` etc.) que já foram dropadas. | Alta |
| B-02 | Bucket de PDF é criado privado mas o app monta URL pública fixa | Alta | `supabase/migrations/20260602130000_diagnostico_respostas_enxuto.sql:133-135` vs `src/lib/api.ts:290-296,300-318` | Migration: `INSERT INTO storage.buckets (id, name, public) VALUES ('diagnostico-pdfs', 'diagnostico-pdfs', false)`. `api.ts:295`: `return \`${CONFIG.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}\`;` gerando `pdf_comercial_url`/`pdf_cliente_url` que são gravados no banco e (pelo comentário da linha 290-292) tratados como "URL pública e permanente... abre direto". Policies de Storage só liberam `INSERT` pra `anon` (linha 139-141) e tudo pra `authenticated` (144-148); não há policy de `SELECT` pra `anon`/`public`. | Se o bucket nunca foi promovido a público manualmente no painel (fora do código versionado), qualquer clique no link do PDF por um cliente anônimo recebe erro do Storage (objeto não encontrado/sem permissão), quebrando a entrega do relatório, um dos CTAs centrais do funil. | Ou (a) alterar a migration para `public: true` no bucket (se a intenção é realmente pública, dado que o path usa UUID como capa de obscuridade) e documentar isso, ou (b) trocar `publicUrl()` por geração de signed URL via Edge Function com `service_role`, coerente com o texto do README (`createSignedUrl`). Conferir no painel Supabase se o bucket está hoje público (fora do que o SQL versionado mostra) e alinhar código/infra. | Média (o estado real do bucket em produção pode ter sido alterado manualmente fora deste SQL) |
| B-03 | Corrida entre `createSession` (POST) e `persistAnswer` da primeira resposta (PATCH) | Média | `src/app.ts:317-328` e `src/app.ts:524-530`; `src/lib/api.ts:58-82` | `startDiagnostic()`: `createSession(id, ...).then(() => setSessionContact(...))` é disparado sem `await` e sem bloquear o fluxo (linha 326-327); a tela já avança para a pergunta S1. `afterAnswer()` (linha 528-529) chama `persistAnswer(state.diagId, q.id, a)` assim que o usuário responde, sem esperar a promise de `createSession`. Ambos usam `fetch(..., { keepalive: true })` direto (sem fila/serialização) em `updateRow`. | Se a resposta a S1 chegar ao servidor antes do INSERT (rede lenta no primeiro fetch, ou usuário respondendo muito rápido), o `PATCH ...?id=eq.<uuid>` não encontra a linha e não atualiza nada (PostgREST retorna 200/204 com 0 linhas afetadas, sem erro visível); `persistAnswer` engole silenciosamente porque `safe()` só loga em `console.warn`. Resultado: a resposta de S1 (papel do usuário) pode se perder da coluna `papel`/`respostas` para sessões afetadas, embora S1 costume ser rápida de responder o suficiente pra mascarar o problema na prática. | Serializar: só habilitar a resposta em S1 (ou todo o fluxo) depois que `createSession` resolver; ou mover a criação da linha para dentro do mesmo `updateRow` via `upsert` (POST com `Prefer: resolution=merge-duplicates`) em vez de POST+PATCH separados. | Média (depende de timing de rede; não reproduzido em runtime, só por leitura estática do fluxo assíncrono) |
| B-04 | `F_MELHORIA` (frentista) nunca preenche a coluna `interesse` | Média | `src/lib/api.ts:172-178` vs `src/data/questions.ts:1583-1588` e `src/lib/state.ts:42-48` | Guarda em `api.ts`: `if ((questionId === "D_DOR" \|\| questionId === "G_DOR" \|\| questionId === "F_MELHORIA") && answer.kind !== "multi" && answer.kind !== "text") { patch.interesse = answer.value; }`. `F_MELHORIA` tem `type: "open"` (`questions.ts:1585`), que segundo `state.ts:42-46` sempre produz `Answer` com `kind: "text"` (tem só `text`, não tem `value`). Logo a condição `answer.kind !== "text"` é sempre falsa para essa pergunta específica, e o bloco nunca executa para ela. | A coluna dedicada `interesse` (usada pelo time comercial pra filtrar rapidamente "o que a pessoa quer resolver", conforme comentário da linha 172-178) fica sempre `NULL` para todo lead da trilha frentista. A dor do frentista só existe enterrada dentro do jsonb `respostas.F_MELHORIA.label`, exigindo iterar o JSON em vez de um filtro de coluna simples. | Adaptar o bloco para tratar `kind === "text"` separadamente: `if (questionId === "F_MELHORIA" && answer.kind === "text") patch.interesse = answer.text;` mantendo o `.value` só para D_DOR/G_DOR que são `qualify`. | Alta |
| B-05 | Índice em `sql/revisao-banco.sql` referencia coluna inexistente `rd_raiox_enviado` | Média | `sql/revisao-banco.sql:21-24` | `CREATE INDEX IF NOT EXISTS idx_diag_raiox_pendente ON public.diagnostico_respostas (agendou_raiox) WHERE agendou_raiox = true AND rd_raiox_enviado = false;` — busca em `supabase/migrations/20260602130000_diagnostico_respostas_enxuto.sql` (o único migration de schema do repo) e em `src/lib/api.ts` não encontra nenhuma criação ou escrita de `rd_raiox_enviado` (só existe `rd_enviado`/`rd_enviado_em`, sem o `raiox` no meio, para o envio do lead ao RD Station geral, não ligado ao cron do Raio X). | Se `sql/revisao-banco.sql` Bloco 1 for executado como está (o próprio arquivo instrui "pode rodar"), o `CREATE INDEX` falha com `column "rd_raiox_enviado" does not exist`, interrompendo o script no meio do Bloco 1 (os itens 1.2 e 1.3 abaixo dele não seriam aplicados na mesma execução, dependendo de como for colado no SQL Editor). | Confirmar se `rd_raiox_enviado` deveria existir (cron do Raio X mencionado no comentário da linha 21 e em `sql/raiox-tracking.sql`) e criar a coluna antes do índice, ou corrigir o nome para uma coluna já existente (ex.: reaproveitar `raiox_status <> 'confirmado'`). | Alta |
| B-06 | Escopo confirmado: `vm_clientes`/`BD_Leads_Kommo` e a coluna `status` booleana não aparecem neste código | Informativo | n/a (busca em todo o repo) | `grep -rn "vm_clientes\|BD_Leads_Kommo"` no repo não retorna nenhuma ocorrência fora deste próprio relatório. `src/lib/api.ts`/`src/lib/supabase.ts`/`public/supabase.js` só operam sobre `diagnostico_respostas` e o bucket `diagnostico-pdfs`. | Nenhum, é apenas delimitação de escopo: o risco "status é BOOLEAN, código tratando como string" citado no brief não se materializa neste repositório porque ele não lê essas tabelas. O risco pode existir em outro app (painel comercial/Retool/n8n) fora deste diretório. | Se houver outro repositório/painel que leia `vm_clientes.status`, auditar lá especificamente; aqui não há achado de código para corrigir. | Alta |
| B-07 | `dr_anon_update` (RLS) permite `UPDATE` irrestrito de qualquer linha por quem tiver a chave anon | Baixa (já documentada e mitigação conhecida) | `supabase/migrations/20260602130000_diagnostico_respostas_enxuto.sql:116-118`; já sinalizado em `sql/revisao-banco.sql:72-84` | `CREATE POLICY dr_anon_update ON public.diagnostico_respostas FOR UPDATE TO anon USING (true) WITH CHECK (true);` — sem filtro por `id`/token de sessão. A chave anon é pública por design (`src/lib/config.ts:1,8-9`, comentário "exposed by design"). | Qualquer pessoa com a anon key (visível no bundle JS) pode fazer PATCH em qualquer linha de `diagnostico_respostas` sabendo (ou adivinhando/enumerando) o UUID, sobrescrevendo score, contato, status de raio-x etc. de outros leads. Já é um risco conhecido e documentado pelo próprio time (`sql/revisao-banco.sql` Bloco 4), com mitigação em aberto (mover updates para Edge Function com `service_role`). | Sem ação nova requerida desta auditoria além de reforçar a prioridade do Bloco 4 de `sql/revisao-banco.sql`: mover escrita sensível (score, respostas, contato) para Edge Function autenticada por token de sessão, então revogar `UPDATE` de `anon`. | Alta |

## Notas metodológicas

- Auditoria 100% estática (leitura de código); não houve execução de query real
  contra o Supabase (sem acesso/credenciais de leitura interativa neste
  ambiente).
- B-02 tem confiança "Média" porque o estado real do bucket em produção pode
  ter sido alterado manualmente no painel Supabase depois da migration, fora
  do controle de versão — recomenda-se confirmar diretamente no painel.
- Não foi encontrado nenhum `supabase/functions/` neste repositório (as Edge
  Functions `rd-diagnostico-conversion` e `confirmar-raiox` referenciadas em
  `src/lib/config.ts` e `src/app.ts` são chamadas por URL mas seu código-fonte
  não está neste projeto), portanto não foram auditadas aqui.
