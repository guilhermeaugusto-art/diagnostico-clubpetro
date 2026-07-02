# Auditoria 01 · Caça-Bugs (lógica, estado, corrida, nota, persistência)

Escopo: `src/app.ts`, `src/lib/engine.ts`, `src/lib/scoring.ts`, `src/lib/state.ts`,
`src/lib/storage.ts`, `src/lib/routing.ts`, `src/lib/api.ts`, `src/data/*.ts`,
`src/pages/*.ts`, `src/components/*.ts`, `src/lib/raiox.ts`, `src/lib/format.ts`,
`src/lib/config.ts`.

Somente leitura: cada achado aponta arquivo, linha, evidência, cenário de falha
concreto (entrada -> resultado errado) e recomendação. Nenhum arquivo em `src/`
foi tocado.

---

## Resumo executivo (mais críticos primeiro)

- **BUG-01 (alta) · Corrida de duplo-avanço nas perguntas de resposta única.**
  `selectOption` agenda `nextStep()` com `setTimeout` de 280-380 ms e não bloqueia
  novos cliques. Dois cliques rápidos (na mesma pergunta) agendam dois `nextStep`,
  o cursor pula 2 e **uma pergunta seguinte é pulada sem ser respondida**. Isso
  distorce a nota (frente sem resposta) e o roteamento. É o defeito mais provável
  em uso real (celular, toque duplo, ansiedade).

- **BUG-02 (alta) · Sinal (`signal`) trava e nunca recalcula ao voltar e corrigir.**
  Depois de `signalLocked = true`, mudar respostas de checkpoint pelo "Voltar" não
  recomputa o sinal. O payload comercial/RD e o evento `diag_signal` saem com o
  sinal antigo (ex.: "critico" mesmo após a pessoa corrigir tudo para nota máxima).

- **BUG-03 (média) · Reenvio de lead / RD em retomada de sessão já convertida.**
  `raioxConfirmed` e `leadSent` são variáveis de módulo (não persistidas). Quem já
  garantiu a vaga, recarrega a página e volta ao resultado: a UI reaparece como
  "não confirmado", o resgate de saída rearma e um novo clique dispara **outra
  conversão no RD** e novo `submitLead`.

- **BUG-04 (média) · `persistResultData` reexecuta a cada render do resultado.**
  Grava o resultado (PATCH no Supabase) e dispara `result_viewed` toda vez que a
  tela de resultado é renderizada, inflando eventos/gravações.

- **BUG-05 (média) · Vazamento de listener `mouseout` no resgate de saída.**
  `setupExitRescue` adiciona um listener em `document` a cada render do resultado e
  nunca o remove: acumulação de handlers.

- **BUG-06 (baixa) · Coluna `papel` grava "outro", enquanto trilha/RD usa "frentista".**
  Inconsistência de dado entre `diagnostico_respostas.papel` e o payload RD.

---

## Tabela de achados

| id | título | sev | arquivo:linha | evidência | impacto | recomendação | conf |
|----|--------|-----|---------------|-----------|---------|--------------|------|
| BUG-01 | Duplo-avanço por `setTimeout(nextStep)` sem trava | alta | src/app.ts:390-398 | `setScoreAnswer... setTimeout(() => nextStep(), 380)` e `...280` para single/qualify, sem lock nem `pointer-events:none` no card selecionado (AnswerCard.ts sem guarda) | Dois cliques rápidos na mesma pergunta agendam 2 `nextStep`; cursor +2; **a próxima pergunta é pulada** e fica sem resposta. Ex.: numa frente de 1 só item (dados `D_DA1`/resiliência `D_R1`), pular = `possible` menor e nota mudada; roteamento perde a dor. `nextStep` só checa `screen==='question'`, que continua verdadeiro no 2º disparo | Travar após a 1ª seleção (flag `advancing`/desabilitar cliques no grid até o `nextStep`); ou cancelar timer anterior antes de agendar | alta |
| BUG-02 | `signal` congelado após `signalLocked`; não recalcula ao voltar | alta | src/app.ts:541-546 ; src/lib/engine.ts:82-98 | `if (!state.signalLocked && allCheckpointAnswered(state)) { state.signal = computeSignal(state); state.signalLocked = true; ... }` | Usuário responde os 5 checkpoints ruins (sinal "critico"), volta com "Voltar" e troca todas para a melhor opção: `signal` permanece "critico". Vai errado no payload RD (`sinal`), no `result_viewed` e em `persistResult._meta.signal` | Recalcular sinal quando um checkpoint muda (ou não travar; computar sob demanda a partir das respostas atuais) | alta |
| BUG-03 | Reenvio de lead/RD e UI errada na retomada pós-conversão | média | src/app.ts:80-86, 828-831, 924-927 | `raioxConfirmed`/`leadSent` são globais de módulo, resetados no reload; estado persistido não guarda "convertido". `onResultRendered`: `if (raioxConfirmed) restoreConfirmedUI(); else setupExitRescue()` | Quem confirmou a vaga, recarrega e o app retoma no resultado (`resumeDiagnostic`): `raioxConfirmed===false` → mostra gate como não confirmado, rearma resgate; novo clique em confirmar chama `submitLead` de novo → **nova conversão RD**, novo `completeSession(mql=true)`, novo PDF | Persistir flag de conversão (localStorage/estado) e restaurar `raioxConfirmed/leadSent` no boot; ou tornar o backend idempotente por `diag_id` | média |
| BUG-04 | `persistResultData` roda a cada render do resultado | média | src/app.ts:809-819, 859-919 | `onResultRendered` chama `persistResultData()` sempre; ele faz `track("result_viewed"...)` e `await persistResult(...)` (PATCH) | Qualquer novo `render()` na tela de resultado (retomada, futuros refresh) regrava a linha e reconta `result_viewed`. Métricas de "chegou ao resultado" infladas | Guardar idempotência (flag `resultPersisted` por `diag_id`) antes de gravar/trackear | média |
| BUG-05 | Listener `mouseout` acumulado (memory leak) no resgate | média | src/app.ts:1040-1049 | `document.addEventListener("mouseout", onMouseOut)` dentro de `setupExitRescue`, chamado em todo `onResultRendered` para dono/gerente, sem `removeEventListener` | Cada render do resultado adiciona um handler global que nunca sai. Acúmulo em sessões longas; múltiplas avaliações do mesmo callback | Registrar o listener uma única vez (guarda booleana) ou remover no teardown | média |
| BUG-06 | `papel` persistido como "outro" diverge de trilha "frentista" | baixa | src/lib/api.ts:162 ; src/data/questions.ts:21-26 | `if (questionId === "S1" ...) patch.papel = answer.value;` grava o valor bruto ("dono"/"gerente"/"outro"); `trackFromS1Value("outro") === "frentista"`; RD recebe `papel: trilha` (="frentista") em src/app.ts:972 | A coluna `papel` fica "outro" enquanto RD/roteamento usam "frentista": relatórios/joins por papel podem não bater | Padronizar: gravar a trilha mapeada (`currentTrack`) ou documentar o significado de "outro" | média |
| BUG-07 | Nota/nível/urgência calculados 3+ vezes por render (inconsistência potencial) | baixa | src/app.ts:269 (ResultPage), 862, 929 ; src/lib/scoring.ts:47 | `totalScore(state)` recomputado em `ResultPage`, `persistResultData` e `submitLead`; cada um refaz `blockScores`/`visibleQuestions` | Se `state.answers` mudar entre chamadas (ex.: e-mail não muda a nota, mas edições concorrentes sim), telas e payload podem divergir. Também custo O(n) repetido | Calcular a nota uma vez ao entrar no resultado e reusar (snapshot) | média |
| BUG-08 | Frentista sem "eletrica" zera a frente Resiliência no radar | baixa | src/components/RadarChart.ts:51-66 ; src/lib/scoring.ts:17-36 ; src/data/questions.ts:1552-1572 | `F_R1` (único item de `resiliencia` no frentista) é condicional a `F_PT_SERVICOS` incluir "eletrica". `blockScores` só soma `possible` de perguntas visíveis; o radar sempre desenha as 6 frentes com `pct||0` | Frentista sem carregador elétrico: `resiliencia.possible===0 → pct 0`. O radar mostra Resiliência = 0 (parece nota péssima) mesmo sem nenhuma pergunta feita da frente | No radar, tratar frente sem `possible` como "não medida" (traço/omitir) em vez de 0 | alta |
| BUG-09 | `nextStep` reconstrói lista dinâmica; passo/denominador oscila e passos podem reintroduzir/remover perguntas ao voltar | baixa | src/app.ts:592-615, 645-656 ; src/lib/engine.ts:111-129 | `visibleQuestions` recomputa condicionais a cada passo; `totalStepsFn` muda quando um condicional entra/sai | Voltar e alterar um gatilho (`D_PT_MIX`/`F_PT_SERVICOS`) muda o total; contador "X / N" e a barra pulam para trás/frente; resposta órfã fica em `answers` (excluída da nota, ok) mas pode confundir | Congelar a lista visível por sessão ou recalcular o cursor por id (não por índice) ao alterar gatilhos | média |
| BUG-10 | Resgate de saída/`wireResultInputs` religam inputs a cada render sem limpar | baixa | src/app.ts:767-788, 826-831 | `wireResultInputs` adiciona listeners de `input`/`keydown` a cada `onResultRendered`; os nós antigos são recriados pelo `innerHTML`, mas o padrão depende de o DOM ser sempre substituído | Se a tela de resultado for parcialmente atualizada no futuro (sem `innerHTML` total), haverá listeners duplicados; hoje o risco é latente | Idempotência de binding (delegação global já existe para clicks; usar o mesmo padrão para input) | baixa |

---

## Detalhamento dos principais

### BUG-01 · Duplo-avanço (corrida de navegação)
`src/app.ts:383-404`
```
function selectOption(i: number): void {
  ...
  if (q.type === "score") {
    setScoreAnswer(q, i);
    afterAnswer(q);
    setTimeout(() => nextStep(), 380);   // <- sem trava
  } else if (q.type === "segmentation-single") {
    ...
    setTimeout(() => nextStep(), 280);
  } else if (q.type === "qualify") {
    ...
    setTimeout(() => nextStep(), 280);
  }
  ...
}
```
`nextStep` (app.ts:592) só valida `state.screen !== "question"`. No intervalo de
280-380 ms a mesma tela de pergunta continua clicável (AnswerCard não desabilita).
Dois toques -> dois `nextStep` -> `cursor += 2`. A pergunta intermediária nunca é
respondida.

**Cenário concreto:** dono responde `D_C3` (aditivada), toca duas vezes rápido.
Pula `D_FCHURN`. `D_FCHURN` é `fidelizacao` (maior peso, 22). A frente perde um
item de `possible`/`earned` e a nota muda; se era um checkpoint de outra trilha,
o sinal pode nem disparar. Resultado numérico diferente do real.

### BUG-02 · Sinal travado
Depois de `signalLocked = true` (app.ts:543), nenhuma edição posterior recomputa
`state.signal`. Como o sinal é lido no payload RD (`src/app.ts:970` -> `sinal:
state.signal`) e em `persistResult` (`_meta.signal`), corrigir respostas com
"Voltar" mantém o rótulo errado. Hoje nenhuma `condition` de pergunta lê
`r.signal()` (verificado em questions.ts), então não altera o fluxo de perguntas,
mas contamina dados comerciais.

### BUG-03 · Retomada pós-conversão
`raioxConfirmed`/`leadSent`/`exitRescueShown` vivem só em memória (app.ts:84-86) e
não são persistidos em `saveState`. No boot (app.ts:1109-1119) o estado é
reidratado, mas essas flags nascem `false`. `resumeDiagnostic` leva de volta ao
resultado; `onResultRendered` (app.ts:826-831) entra no ramo `else` (não
confirmado) para dono/gerente, rearma resgate e permite novo `confirmPresence ->
submitLead -> fetch RD_CONVERSION_FN` (app.ts:953). Duplicação de lead/conversão.

### BUG-08 · Resiliência = 0 no radar do frentista
`F_R1` é o único item pontuável de `resiliencia` na trilha frentista e é
condicional a "eletrica" (questions.ts:1560). Sem "eletrica", `blockScores`
deixa `resiliencia.possible = 0` e `pct = 0` (scoring.ts:33). O RadarChart
(RadarChart.ts:53/61) usa `(bs[b].pct || 0)/100` para as 6 frentes sempre, então
desenha Resiliência no fundo do radar como se fosse desempenho péssimo, quando na
verdade a frente não foi medida. Leitura visual enganosa para o frentista.

---

## Notas de verificação
- Confirmado que `status` de `vm_clientes` (BOOLEAN) não é tocado por este app
  (somente `diagnostico_respostas`); fora do escopo deste relatório.
- `levelFor` (levels.ts:65-69) cobre corretamente a faixa 81-85 via
  `score >= last.max` -> não há gap de faixa. (Suspeita descartada.)
- `applyForms` + `escHtml` em `q.context` preserva `{{a|b}}` (chaves não são
  escapadas), então o plural continua funcionando. (Suspeita descartada.)
- Plural do dono: as perguntas com `{{...}}` (D_PT_MIX, D_M1, D_DOR) aparecem na
  ordem *após* `D_PT_POSTOS`, então `isPluralPosto` já tem base. (Suspeita
  descartada.)
</content>
</invoke>
