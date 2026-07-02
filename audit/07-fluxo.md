# Auditoria de Fluxo de Dados — Diagnóstico ClubPetro

Rastreamento ponta a ponta: WelcomePage (nome/WhatsApp) → state (`src/lib/state.ts`) →
respostas do quiz → engine/scoring → resultado → Raio-X → captura de e-mail →
integrações (RD Station, Kommo, Supabase, agenda).

Arquivos lidos: `src/lib/state.ts`, `src/lib/context.ts`, `src/app.ts`,
`src/pages/WelcomePage.ts`, `src/pages/ResultPage.ts`, `src/lib/api.ts`, `src/lib/raiox.ts`,
`src/lib/tracking.ts`, `src/lib/engine.ts`, `src/lib/scoring.ts`, `src/lib/routing.ts`.

## Resumo executivo

O achado mais crítico (`F01`) é que **o envio do lead para RD Station/Kommo depende
inteiramente da confirmação de e-mail no Raio-X** (`confirmPresence()` → `submitLead()`).
Nome e WhatsApp são capturados e gravados no Supabase já na WelcomePage — e a copy da
tela ("O WhatsApp é pra te mandar o convite do Raio-X") sugere que esse contato será
usado ativamente — mas nenhum código dispara RD Station, Kommo ou até WhatsApp de
follow-up a partir desse dado isolado. Todo dono/gerente que completa o quiz inteiro,
vê a nota e sai sem digitar e-mail (o `exit_rescue` cobre só desktop, mouseout) vira
lead perdido nas integrações comerciais, mesmo tendo fornecido nome + telefone válidos
e mesmo o app ter certificado `phoneValid`/`nameValid` como suficientes para liberar o quiz.

Em segundo lugar (`F02`), o buffer de eventos (`bufferEvent`/`eventBuffer` em
`src/lib/api.ts`) é preenchido por **todo** `track()` do app (answer_selected,
result_viewed, diag_signal, etc.) mas nunca é lido: `snapshotEvents()` não é chamada em
lugar nenhum e `flushEvents()` é um no-op documentado ("Flush sem efeito no modelo
enxuto"). Ou seja, existe uma trilha de eventos inteira sendo construída em memória e
descartada ao trocar de tela/fechar aba, sem nunca chegar ao Supabase — o que é
inofensivo para o produto (não bloqueia o fluxo principal) mas é morto e engana quem lê
o código achando que há telemetria granular persistida.

Os demais achados são de menor severidade: papel (trilha) sobrescrito silenciosamente
em retomada tardia, e-mail parcialmente digitado perdido se o usuário sai antes de
`confirmPresence`, e ausência de link entre `agendou_raiox` e o envio de RD quando a
pessoa confirma presença mas nunca havia confirmado e-mail antes (ordem de operações
correta, mas vale nota).

## Achados

| ID | Título | Severidade | Arquivo:Linha | Evidência | Impacto | Recomendação | Confiança |
|----|--------|------------|----------------|-----------|---------|---------------|-----------|
| F01 | Lead (RD Station/Kommo) só é enviado se o usuário digitar e-mail no Raio-X; nome+WhatsApp capturados na Welcome nunca acionam a integração comercial sozinhos | Crítica | `src/app.ts:249-279` (`confirmPresence`), `src/app.ts:924-987` (`submitLead`), `src/app.ts:305-332` (`startDiagnostic`) | `startDiagnostic()` grava `setSessionContact(id, keptName, "", keptPhone)` no Supabase (linha 327) assim que nome+telefone são válidos, mas o POST para `CONFIG.RD_CONVERSION_FN` (RD/Kommo) só ocorre dentro de `submitLead()` (linha 953), que só é chamada em `confirmPresence()` (linha 267), que por sua vez exige `emailValid(state)` (linha 256). Não há nenhum caminho alternativo (ex.: timer, exit-intent sem e-mail, ou envio ao finalizar o quiz) que dispare RD/Kommo usando apenas nome+WhatsApp. | Todo dono/gerente que completa o diagnóstico inteiro, vê a nota, mas não digita e-mail (sai da página, fecha a aba, usa o WhatsApp CTA de especialista em vez do Raio-X) tem nome e WhatsApp válidos salvos em `diagnostico_respostas`, porém **nunca vira lead em RD Station/Kommo**, apesar de ter respondido o quiz completo e a copy prometer contato via WhatsApp ("O WhatsApp é pra te mandar o convite do Raio-X"). O time comercial não recebe esse contato pelos canais automatizados. | Persistir/disparar o lead (ou ao menos uma versão "quente, sem e-mail") assim que o quiz termina (`finishQuiz`) para dono/gerente, usando nome+telefone já capturados, e depois enriquecer com e-mail se/quando confirmado — em vez de gate único no e-mail do Raio-X. | Alta |
| F02 | Buffer de eventos (`bufferEvent`/`eventBuffer`) é alimentado por todo `track()` mas nunca é persistido: `snapshotEvents()` não tem caller e `flushEvents()` é no-op | Alta | `src/lib/api.ts:46-54` (declaração do buffer), `src/lib/api.ts:351-355` (`flushEvents` no-op), `src/lib/tracking.ts:15` (todo `track()` chama `bufferEvent`), `src/app.ts:1136` (`flushEvents(state.diagId)` no `pagehide`) | Comentário do próprio código em `api.ts:351-353`: "Flush sem efeito no modelo enxuto (não tem coluna `events`). Mantido pra compat com o app.ts que chama no pagehide." `snapshotEvents()` (linha 52) não aparece em nenhum outro arquivo do `src/`. | Todo evento granular (answer_selected com tempo por pergunta, diag_signal, exit_rescue_shown, specialist_cta_clicked, etc.) é acumulado em memória e perdido ao trocar de aba/fechar o navegador. Não há tabela `diagnostic_events`/coluna `events` na tabela atual (apesar do comentário no topo do arquivo dizer "Eventos são bufferizados localmente e flushados em momentos-chave", o que não é o comportamento real). Isso é enganoso para quem mantém o código e representa telemetria comercial (funil de abandono por pergunta) inexistente, apesar de o código sugerir que existe. | Ou remover o buffer/flush morto (reduzindo a superfície de código enganosa), ou reativar de fato: persistir os eventos bufferizados em uma coluna jsonb `events` na própria linha da sessão (mesma tabela `diagnostico_respostas`), aproveitando os mesmos pontos de flush já identificados (`pagehide`, fim do quiz). | Alta |
| F03 | Papel/trilha (`papel`) pode ser sobrescrito silenciosamente ao "recomeçar do zero" sem persistir o valor anterior primeiro | Média | `src/app.ts:348-371` (`discardAndStart`), `src/lib/api.ts:162` (`patch.papel = answer.value` só ocorre dentro de `persistAnswer`, disparado por `afterAnswer`) | `discardAndStart()` cria uma nova sessão (`state.diagId = uuid()`) e chama `createSession` + `setSessionContact`, mas nunca copia `papel`/respostas da sessão anterior. A sessão antiga fica órfã no Supabase com `S1` respondido (se chegou a responder) mas sem `concluido_em`/`mql`, e não há link entre as duas linhas (nenhum campo tipo `sessao_anterior_id`). | Se o BI/CRM olhar `diagnostico_respostas` por linha isolada, sessões descartadas por "Recomeçar do zero" aparecem como leads incompletos/abandonados sem relação óbvia com a sessão final que de fato converteu, distorcendo taxa de abandono e podendo gerar contagem dupla de contato (duas linhas com mesmo nome/telefone, IDs diferentes). | Gravar um campo `sessao_anterior_id` (ou similar) ao recriar sessão em `discardAndStart`, para permitir deduplicação/join no BI. | Média |
| F04 | E-mail digitado parcialmente no campo `confirmEmail` é salvo no `state`/localStorage a cada tecla, mas só chega ao Supabase se `confirmPresence()` for concluído com sucesso (e-mail válido) | Média | `src/app.ts:767-788` (`wireResultInputs`), `src/app.ts:253-279` (`confirmPresence`) | `wireResultInputs` grava `state.email = t.value; saveState(state)` a cada input (linha 773-774) — isso persiste só no `localStorage` do navegador (`saveState`), não no Supabase. O envio ao Supabase (`setSessionContact`) só acontece dentro de `submitLead()`, chamado por `confirmPresence()`, que exige `emailValid(state)` (regex completo). | Um e-mail digitado incompleto/com erro de digitação (ex.: "joao@gmail") nunca é enviado ao backend — mesmo que o usuário tenha demonstrado intenção clara de fornecer contato. Se a pessoa abandona a aba nesse meio-tempo, o e-mail parcial fica preso no localStorage local (TTL 7 dias) e não é recuperável pelo time comercial. | Considerar um PATCH "best-effort" (debounced) do valor bruto do campo de e-mail para uma coluna separada tipo `email_digitado_raw`, mesmo antes da validação completa, para dar ao comercial pistas de contato mesmo em abandono. | Baixa |
| F05 | `persistAgendouRaiox` e o envio a RD Station não têm ordem de dependência garantida por await: chamadas fire-and-forget em paralelo dentro de `confirmPresence` | Baixa | `src/app.ts:253-279` | `submitLead()` (linha 267) e o `fetch` para `CONFIRMAR_RAIOX_FN` (linha 274) e `persistAgendouRaiox` (linha 275) são todos disparados sem `await` entre si, na mesma função síncrona. Nenhum é bloqueante nem aguarda o outro. | Não é bug funcional (cada chamada é independente e idempotente via flags `leadSent`/`raioxConfirmed`), mas se qualquer uma falhar silenciosamente (todas usam `.catch(() => {})` ou `safe()`), não há retry nem alerta — o dado pode nunca chegar ao RD mesmo com e-mail confirmado, sem sinalização visível ao usuário ou ao time. | Considerar log/telemetria de falha real (hoje só `console.warn`) e, se crítico para o negócio, uma fila de retry no backend em vez de depender só do `keepalive` do fetch client-side. | Baixa |

