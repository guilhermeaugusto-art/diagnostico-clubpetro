# Auditoria de Integrações — RD Station, Kommo, WhatsApp, Google Agenda

Diagnóstico ClubPetro (`C:/Users/Lenovo/diagnostico-clubpetro`) — Vite + TypeScript vanilla.
Auditor de Integrações · leitura de código apenas, nenhum arquivo em `src/` foi alterado.

Arquivos lidos: `src/lib/api.ts`, `src/lib/raiox.ts`, `src/pages/ResultPage.ts`, `src/lib/report.ts`,
`src/lib/reportContent.ts`, `src/lib/config.ts`, `src/app.ts` (fluxo de ações e `submitLead`/`confirmPresence`),
`src/lib/scoring.ts` (validadores), `src/lib/tracking.ts`, `public/supabase.js`.

---

## Resumo executivo

O achado mais crítico do domínio é estrutural e confirma exatamente a hipótese de risco de produto
apontada no prompt: **o envio do lead para o RD Station, a marcação de MQL (`completeSession(..., mql=true)`)
e a gravação do e-mail de contato dependem inteiramente de um único gatilho de UI** — o clique em
"Quero garantir minha vaga no próximo Raio-X" (`data-action="confirm-presence"` → `confirmPresence()` →
`submitLead()` em `src/app.ts:253-279` e `924-987`). Não existe nenhum outro caminho no código que envie
o lead ao RD Station. Em particular:

- O CTA secundário "Fale com um Especialista ClubPetro" (`ctaEspecialista()`, `src/app.ts:1006-1016`) só
  abre um link `wa.me` e chama `persistSpecialistCta()`, que por sua vez **não grava nada no banco** (é um
  no-op documentado, `src/lib/api.ts:346-349`) e **não dispara `submitLead()`**. Um usuário que termina o
  quiz e escolhe falar direto com o especialista, sem clicar em "garantir vaga", nunca vira MQL, nunca tem
  e-mail salvo e nunca é enviado ao RD Station/Kommo.
- O e-mail (`state.email`) só existe em memória/local até esse clique; ele nunca é persistido isoladamente
  antes disso (não há `setSessionContact` parcial só com e-mail). Se a pessoa fecha a aba na tela de
  resultado sem clicar no CTA do Raio-X, o e-mail digitado no campo (se preencheu e não confirmou) se perde.
- Nome e telefone (WhatsApp), por outro lado, SÃO salvos cedo (`startDiagnostic`/`discardAndStart`,
  `src/app.ts:324-328` e `363-367`), então esses dois campos não dependem do agendamento — é só o
  e-mail + envio ao RD que ficam reféns do fluxo do Raio-X.
- A própria existência do mecanismo de "resgate de saída" (`setupExitRescue`/`showExitRescue`,
  `src/app.ts:1040-1079`), que só dispara quando `raioxConfirmed` ainda é `false`, é evidência de que o
  time já sabe que uma fração dos usuários chega ao resultado e sai sem confirmar — e é justamente esse
  grupo que hoje não vira lead comercial completo (sem e-mail, sem RD, sem MQL).

Outros achados relevantes: a confirmação de presença no Raio-X é enviada via `fetch(..., { mode: "no-cors" })`
(`src/app.ts:274`), o que torna literalmente impossível detectar falha (a Promise sempre resolve como sucesso
opaco); o envio ao RD Station é "best-effort" sem retry (uma tentativa, silenciosa em caso de erro,
`src/app.ts:952-980`); e o WhatsApp do especialista é um placeholder que hoje aponta para o número geral
(`CONFIG.WHATSAPP_ESPECIALISTA`, `src/lib/config.ts:4-6`), então tecnicamente não há como saber se um clique
"Fale com Especialista" corresponde de fato a um canal do especialista dedicado.

Não há integração Kommo no código-fonte do frontend (nenhuma referência a `Kommo`/`BD_Leads_Kommo` em `src/`);
o mapa do projeto indica que o Kommo é alimentado indiretamente via webhook do RD Station, fora do escopo
auditável neste repositório — mas isso também significa que o mesmo buraco do RD Station (item acima) se
propaga para o Kommo: se o lead não chega ao RD, também não chega ao Kommo.

---

## Achados

| ID | Título | Severidade | Arquivo:Linha | Evidência | Impacto | Recomendação | Confiança |
|----|--------|------------|----------------|-----------|---------|---------------|-----------|
| INT-01 | Lead só vira MQL/RD Station se o usuário clicar em "garantir vaga no Raio-X"; CTA "Fale com Especialista" não gera lead nem envia ao RD | Crítica | `src/app.ts:222-239` (roteamento de ações), `src/app.ts:253-279` (`confirmPresence`), `src/app.ts:924-987` (`submitLead`), `src/app.ts:1006-1016` (`ctaEspecialista`), `src/lib/api.ts:346-349` (`persistSpecialistCta` é no-op) | `submitLead()` é chamado apenas dentro de `confirmPresence()` (linha 267). `ctaEspecialista()` chama só `persistSpecialistCta(_sessionId, score)`, cujo corpo é `// Não há coluna específica de CTA no modelo enxuto; só GA/Pixel via track().` — ou seja, não grava e-mail, não marca MQL, não chama a Edge Function do RD. Não existe nenhuma outra chamada a `submitLead` no arquivo (`grep` confirma única ocorrência de invocação). | Todo usuário dono/gerente que completa o diagnóstico e opta por "Fale com um Especialista" em vez de "garantir vaga no Raio-X" é perdido como lead comercial: sem e-mail salvo, sem `mql=true`, sem conversão no RD Station e, por consequência, sem chegar ao Kommo (que é alimentado via RD). Esse é exatamente o cenário que o prompt de auditoria pediu para verificar ("lead precisa ser enviado MESMO SEM agendamento") e o código não garante. | Desacoplar o envio do lead (RD Station + `completeSession(mql=true)` + gravação de e-mail) do clique específico de agendamento. Chamar `submitLead()` assim que a pessoa chega à tela de resultado (ou ao digitar/validar e-mail em qualquer CTA), e tratar a confirmação de presença no Raio-X como um evento adicional e independente sobre o mesmo lead. | Alta |
| INT-02 | Confirmação do Raio-X usa `fetch` em `mode: "no-cors"`, tornando a chamada à Edge Function opaca — sucesso e falha são indistinguíveis | Alta | `src/app.ts:271-276` | `const fnUrl = CONFIG.SUPABASE_URL + CONFIG.CONFIRMAR_RAIOX_FN + "?email=" + encodeURIComponent(email); try { fetch(fnUrl, { mode: "no-cors", keepalive: true }).catch(() => {}); } catch { /* ignore */ } if (state.diagId) persistAgendouRaiox(state.diagId);` — a resposta `no-cors` é sempre um `Response` opaco (`status: 0`), então mesmo um 500 da Edge Function não é detectável, e o `.catch()` só cobre falha de rede/CORS pré-flight, não erro de aplicação. `persistAgendouRaiox` roda incondicionalmente logo em seguida, sem depender do resultado do fetch. | O app sempre grava `agendou_raiox: true` e `raiox_status: "confirmado"` no Supabase (`src/lib/api.ts:335-344`) mesmo que a Edge Function `confirmar-raiox` falhe silenciosamente ao adicionar o convidado no Google Calendar. Isso pode gerar leads marcados como "confirmados" no Raio-X que nunca foram de fato adicionados ao evento — problema de negócio (achar que a vaga foi garantida quando não foi) mascarado por um erro técnico silencioso. | Trocar para uma chamada `fetch` normal (sem `no-cors`) com header `Authorization`/`apikey` explícitos (a Edge Function do Supabase provavelmente aceita CORS configurável) para poder checar `res.ok` antes de marcar `raiox_status: "confirmado"`, ou ao menos logar o resultado para diagnóstico. Nota: como o app já abre a agenda do usuário via `calendarTemplateUrl` (fluxo independente que sempre funciona), o pior caso de falha da Edge Function é "não foi adicionado como convidado no Meet compartilhado", não perda total do agendamento — mas hoje isso não é nem logado. | Alta |
| INT-03 | Conversão RD Station é "best-effort" de tentativa única, sem retry nem fila; falha vira apenas `console.warn` | Alta | `src/app.ts:952-980` | `try { const res = await fetch(CONFIG.SUPABASE_URL + CONFIG.RD_CONVERSION_FN, {...}); if (res.ok && state.diagId) markRdSent(state.diagId); } catch (e) { console.warn("RD conversion best-effort falhou:", e); }` — nenhum retry, nenhum backoff, nenhuma persistência de "falhou, tentar depois". Se `res.ok` for `false` (ex.: 500/502 da Edge Function), o código também não grava nada indicando falha (só não chama `markRdSent`), então a única forma de descobrir a falha é auditar `rd_enviado` vazio no banco depois. | Picos de instabilidade da Edge Function ou do RD Station (rate limit, timeout, deploy) resultam em leads permanentemente não enviados ao RD/Kommo sem qualquer sinalização visível fora do console do navegador do usuário final (que ninguém do time vê). Combinado com INT-01, esses leads ficam "perdidos" até alguém rodar uma auditoria manual na tabela `diagnostico_respostas` filtrando por `mql=true AND rd_enviado IS NOT TRUE`. | Implementar fila de retry (ex.: reenviar via cron do lado do banco, similar ao já existente `?sync=confirmados` do Raio-X) para sessões com `mql=true` e `rd_enviado` nulo/false após N minutos. Mínimo viável: um job agendado que varre e reenvia. | Média |
| INT-04 | WhatsApp do "Especialista" é placeholder apontando para o número geral do ClubPetro; não há como diferenciar tráfego do CTA especialista do WhatsApp genérico | Média | `src/lib/config.ts:3-6` | `CLUBPETRO_WHATSAPP: "5531992697762", /* WhatsApp do especialista (Camila) para o CTA secundario do resultado. Placeholder ate o numero ser informado: cai no WhatsApp geral por enquanto. */ WHATSAPP_ESPECIALISTA: "5531992697762",` — os dois valores são idênticos hoje. | Não é um bug funcional (o link abre e funciona), mas é uma lacuna de produto documentada no próprio código: o time não consegue rotear o clique "Fale com um Especialista" para um atendimento dedicado, nem segmentar esse número por origem, até o número real ser configurado. Combinado com INT-01, este é hoje o único canal de contato para quem NÃO agenda o Raio-X — e ele não fica associado a nenhum registro de lead no backend. | Confirmar com o time comercial se o número da Camila (ou outro especialista dedicado) já está disponível para atualizar `WHATSAPP_ESPECIALISTA`; considerar adicionar UTM/parâmetro de origem na mensagem pré-preenchida (`ctaEspecialista`, `src/app.ts:1006-1016`) para rastrear a conversão no WhatsApp Business API/CRM do lado de fora. | Alta |
| INT-05 | E-mail de contato só é persistido no Supabase dentro do mesmo `confirmPresence()`, junto com o envio ao RD; não há salvamento incremental/parcial ao digitar ou perder foco do campo | Média | `src/pages/ResultPage.ts:164-176` (campo `confirmEmail`), `src/app.ts:253-267` (`confirmPresence`), `src/lib/api.ts:91-98` (`setSessionContact`) | O `<input id="confirmEmail">` não tem listener de `blur`/`change` que persista o valor parcialmente; o único ponto que lê `input.value` e grava em `state.email` é dentro de `confirmPresence()` (`src/app.ts:254-255`), que só roda ao clicar no botão. Se o e-mail for inválido, a função retorna cedo (linha 256-263) sem chamar `submitLead()`, então nem o texto digitado (mesmo que quase válido) é salvo em lugar nenhum. | Alguém que digita um e-mail com erro de digitação, ou desiste no meio da validação, perde completamente o dado digitado, sem qualquer rastro no banco para follow-up manual do time comercial. | Persistir o valor do campo (mesmo que inválido) em `localStorage`/estado a cada `input`/`blur`, e considerar um PATCH "melhor esforço" para uma coluna de rascunho separada, para não perder o dado só porque o formato não passou na validação síncrona. | Média |
| INT-06 | `RAIOX_MEET_URL` é uma sala única e fixa do Google Meet compartilhada entre todos os leads confirmados, sem rotação nem verificação de capacidade | Baixa | `src/lib/config.ts:14-15`, `src/lib/raiox.ts:1-5` | `RAIOX_MEET_URL: "https://meet.google.com/ado-rhwa-kvx"` — comentário no próprio arquivo confirma: "Sessao ao vivo do Raio X do seu posto... Sala unica e compartilhada (sem Meet dinamico)." | Não é um bug de integração per se (é decisão de produto documentada), mas junto com o fato de que `agendou_raiox` é gravado incondicionalmente no cliente (INT-02) sem confirmação da Edge Function, não há nenhum controle client-side de capacidade da sala — todo o controle de "vaga limitada" citado na copy da UI (`src/pages/ResultPage.ts:150`: "Grupo pequeno, então a sua vaga é limitada") é apenas textual, sem enforcement técnico visível neste código. | Confirmar que o controle de capacidade (se existir) vive inteiramente na Edge Function/backend, fora deste repositório; não é uma ação necessária no frontend, mas vale registrar para quem for auditar o backend/Edge Functions em outra frente. | Média |
| INT-07 | Kommo não possui nenhuma integração direta no frontend; dependência total do pipeline RD Station → Kommo (fora deste código) herda os mesmos riscos de INT-01/INT-03 | Informativo | N/A (ausência confirmada por busca em `src/`) | Busca por `Kommo`/`BD_Leads_Kommo` em `src/` não retornou nenhuma ocorrência. O mapa do projeto (contexto fornecido) indica "Kommo: Lead criado via RD webhook". | Como não há código client-side de Kommo para auditar, qualquer lead que não chegue ao RD Station (por INT-01 ou INT-03) certamente também não chega ao Kommo. Este item é apenas para deixar registrado que a cobertura desta auditoria de Kommo é indireta/por inferência, já que o Kommo não é alcançável a partir do frontend. | Se houver acesso à configuração da Edge Function `rd-diagnostico-conversion` ou ao webhook RD→Kommo, recomenda-se auditoria separada desse pipeline (fora do escopo deste repositório) para confirmar mapeamento de campos e tratamento de erro. | Alta |

---

## Notas complementares (não tabeladas)

- **`calendarTemplateUrl` (Google Agenda)** — `src/lib/raiox.ts:41-62` — está correto e é um ponto positivo:
  usa `action=TEMPLATE` do Google Calendar (abre a tela de criar evento já preenchida na agenda do próprio
  usuário, sem depender de aceitar convite) e usa `authuser` como dica de conta a partir do e-mail informado,
  com fallback silencioso (`if (clean.includes("@"))`) quando o e-mail está vazio/inválido. Nenhum problema
  encontrado aqui.
- **Ordem de operações em `confirmPresence`** (`src/app.ts:253-279`) é correta *quando* o usuário de fato clica
  no botão: primeiro `submitLead()` (lead + RD + PDF), depois abre a agenda, depois confirma presença. Isso
  é bom design para o caso feliz — o problema (INT-01) é que esse é o ÚNICO caminho que leva a `submitLead()`.
- **Idempotência**: `leadSent` (`src/app.ts:85`) e `raioxConfirmed` protegem bem contra duplo envio dentro da
  mesma sessão de aba; ambos são resetados corretamente em `resetFlowFlags()` a cada novo diagnóstico
  (`src/app.ts:299-303`). Nenhum problema de duplicidade encontrado nesse mecanismo.
- **`markRdSent`/`rd_enviado`** (`src/lib/api.ts:113-118`) é a única forma de auditar no banco se o RD foi
  de fato notificado; recomenda-se ao time de dados cruzar `mql = true AND rd_enviado IS NOT TRUE` para
  quantificar o impacto real de INT-01/INT-03 na base já coletada.
