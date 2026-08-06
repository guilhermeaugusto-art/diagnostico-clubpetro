import "./styles/index.css";

import { CONFIG } from "./lib/config";
import { calendarTemplateUrl } from "./lib/raiox";
import { BLOCKS, BLOCK_ORDER } from "./data/blocks";
import {
  type Question,
  type ScoreQuestion,
  type NoScoreOption,
  type ScoreOption,
} from "./data/questions";
import { levelFor } from "./data/levels";
import { freshState, type AppState, type Answer } from "./lib/state";
import { saveState, loadState, clearState } from "./lib/storage";
import {
  totalScore,
  blockScores,
  rankedBlocks,
  phoneValid,
  emailValid,
  nameValid,
} from "./lib/scoring";
import {
  computeSignal,
  allCheckpointAnswered,
  currentQuestion,
  currentTrack,
  visibleQuestions,
  totalSteps as totalStepsFn,
  isPluralPosto,
} from "./lib/engine";
import { buildRoutingPayload } from "./lib/routing";
import { track } from "./lib/tracking";
import { uuid, maskPhone, phoneDigitsOnly, escHtml } from "./lib/format";
import { captureContext, type RequestContext } from "./lib/context";
import {
  createSession,
  setSessionContact,
  completeSession,
  markResultadoVisto,
  persistAnswer,
  persistResult,
  persistAgendouRaiox,
  persistSpecialistCta,
  uploadReports,
  markReportFailed,
  resetLocalAnswers,
} from "./lib/api";
import { buildReportContent } from "./lib/reportContent";
import { urgencyFor } from "./data/urgency";
import { mainPain, nextImprovementFor, radarReading, strongestBlock, weakestBlock } from "./data/radar-reading";
import { buildResultRecommendations } from "./data/recommendations";

let bootContext: RequestContext | null = null;

import { Header } from "./components/Header";
import { BarsProgress, barsDisplayPct } from "./components/BarsProgress";
import { WelcomePage } from "./pages/WelcomePage";
import { QuestionPage } from "./pages/QuestionPage";
import { TransitionPage } from "./pages/TransitionPage";
import { ResultPage } from "./pages/ResultPage";

let state: AppState = freshState();
let hasResumable = false;
let questionStartTime = 0;
let transitionTimer: number | null = null;
let raioxConfirmed = false; // clicou em garantir a vaga (abriu a agenda), idempotente
let leadSent = false;       // idempotência do envio do lead (contato + RD + PDF)
let exitRescueShown = false; // idempotência do pop-up de recuperação
let navDir: "fwd" | "back" = "fwd"; // direção da navegação, para a transição da pergunta
let advancing = false;      // trava o auto-avanço para ignorar toque duplo (BUG-01)
let resultPersistedFor: string | null = null; // idempotência da gravação do resultado por sessão (BUG-04)
let exitRescueBound = false; // registra o listener de saída uma única vez (BUG-05)

const root = () => document.getElementById("app")!;

/* ============== Header context ============== */

function headerContextLabel(): string {
  if (state.screen === "welcome") return "";
  if (state.screen === "transition") return "Calculando";
  if (state.screen === "result") return "Resultado";
  const q = currentQuestion(state);
  if (!q) return "";
  if (q.block === "qualif") return "Qualificação";
  return BLOCKS[q.block].short;
}

function renderHeader(): string {
  // Durante as respostas, o gráfico de barras por pilar fica no header (à direita).
  const barsHtml = state.screen === "question" ? BarsProgress(state) : "";
  return Header({
    idle: state.screen === "welcome" || state.screen === "transition" || state.screen === "result",
    contextLabel: headerContextLabel(),
    barsHtml,
  });
}

/* ============== Body ============== */

function renderBody(): string {
  switch (state.screen) {
    case "welcome":
      return WelcomePage({
        resumable: hasResumable,
        name: state.name,
        phone: state.phone,
        email: state.email,
        entryValid: nameValid(state) && phoneValid(state) && emailValid(state),
      });
    case "question": {
      const q = currentQuestion(state);
      if (!q) {
        // Fim do quiz sem próxima pergunta (ex.: retomada no fim): vai direto
        // ao resultado. A captura de telefone virou um gate dentro dele.
        state.screen = "result";
        state.finishedAt = state.finishedAt || new Date().toISOString();
        saveState(state);
        return ResultPage(state);
      }
      const a = state.answers[q.id];
      const selectedIndex =
        a && (a.kind === "score" || a.kind === "single" || a.kind === "qualify")
          ? a.optionIndex
          : undefined;
      const selectedIndexes =
        a && a.kind === "multi" ? a.selectedIndexes : [];
      const openText = a && a.kind === "text" ? a.text : "";
      return QuestionPage({
        question: q,
        currentIndex: state.cursor,
        totalSteps: totalStepsFn(state),
        selectedIndex,
        selectedIndexes,
        openText,
        plural: isPluralPosto(state),
      });
    }
    case "transition":
      return TransitionPage();
    case "result":
      return ResultPage(state);
  }
}

function render(): void {
  root().innerHTML = renderHeader() + renderBody();
  if (state.screen === "welcome") onWelcomeRendered();
  if (state.screen === "question") onQuestionRendered();
  if (state.screen === "transition") onTransitionRendered();
  if (state.screen === "result") onResultRendered();
}

/* ============== Eventos globais ============== */

let actionsBound = false;
function bindGlobalActions(): void {
  if (actionsBound) return;
  actionsBound = true;
  document.addEventListener("click", (e: Event) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    const action = t.closest<HTMLElement>("[data-action]");
    if (action) return handleAction(action.dataset.action || "");
    const opt = t.closest<HTMLElement>("[data-option]");
    if (opt) {
      const idx = Number(opt.dataset.option);
      const isMulti = opt.dataset.multi === "1";
      return isMulti ? toggleMultiOption(idx) : selectOption(idx);
    }
  });

}
function handleAction(action: string): void {
  switch (action) {
    case "start":          return startDiagnostic();
    case "resume":         return resumeDiagnostic();
    case "discard":        return discardAndStart();
    case "back":           return prevStep();
    case "advance-multi":  return advanceFromMulti();
    case "advance-open":   return advanceFromOpen();
    case "see-next-steps": return gotoRaiox();
    case "goto-raiox":     return gotoRaiox();
    case "unlock-results": return submitResultGate();
    case "confirm-presence": return confirmPresence();
    case "cta-especialista": return ctaEspecialista();
    case "rescue-confirm": return rescueConfirm();
    case "rescue-close":   return closeExitRescue();
    case "share-diagnostico": return trackShareFrentista();
  }
}

/* Todos os CTAs (hero e "aplicar isso agora") levam ao bloco do Raio-X, que fica
   logo abaixo do hero. O do "aplicar" sobe, o do hero desce: os dois convergem lá. */
function gotoRaiox(): void {
  const el = document.getElementById("raiox");
  // Alinha o TOPO do bloco ao topo da tela (antes centralizava e escondia a
  // intro "O que é o Raio-X", fazendo a pessoa nem começar a ler). (Fase 4 #5)
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  track("result_goto_raiox", { diag_id: state.diagId }, state.diagId);
}

/* Ação principal: garantir a vaga no Raio-X. Salva o e-mail e o lead na hora
   (sempre), abre o Google Agenda com o e-mail pré-preenchido, adiciona a pessoa
   como convidada no evento e grava o agendamento. Não destrava nada: os 3 passos
   já estão visíveis e o resto é teaser permanente. Idempotente. */
/* CTA do bloco do Raio-X. O e-mail já foi capturado no portão do resultado, então
   aqui é só (re)abrir a agenda da pessoa e confirmar a vaga. Não pede e-mail de novo. */
function confirmPresence(): void {
  const email = state.email.trim();
  if (!email) { gotoRaiox(); return; }
  markRaioxScheduled(email);
}

/* Envia o lead (idempotente), abre o Google Agenda com o evento pré-preenchido,
   confirma a presença no evento compartilhado e grava o agendamento. É o "marcar
   na agenda" acionado tanto pelo portão de e-mail quanto pelo CTA do bloco Raio-X. */
function markRaioxScheduled(email: string): void {
  // 1) lead sempre (contato + RD + PDF), idempotente
  submitLead();
  // 2) abre a agenda da pessoa com o evento pronto (e-mail pré-preenchido)
  openInNewTab(calendarTemplateUrl(email));
  // 3) confirma a presença: convidado no evento compartilhado + agendamento no banco
  if (!raioxConfirmed) {
    raioxConfirmed = true;
    state.raioxConfirmed = true; // persiste para restaurar a UI confirmada numa retomada (BUG-03)
    saveState(state);
    const fnUrl = CONFIG.SUPABASE_URL + CONFIG.CONFIRMAR_RAIOX_FN + "?email=" + encodeURIComponent(email);
    try { fetch(fnUrl, { mode: "no-cors", keepalive: true }).catch(() => {}); } catch { /* ignore */ }
    if (state.diagId) persistAgendouRaiox(state.diagId);
  }
  revealConfirmed();
  track("raiox_presence_confirmed", { diag_id: state.diagId }, state.diagId);
}

/* Mostra a linha de confirmação no card. Não mexe nos passos borrados (o resto
   é teaser permanente) nem relabela o botão. */
function revealConfirmed(): void {
  const done = document.getElementById("rrConfirmDone");
  if (done) done.textContent = "Pronto. Sua vaga está garantida e o convite entrou na sua agenda. Você recebe o plano completo das seis frentes no Raio-X.";
}

/* Compartilhamento do frentista: o link abre nativamente (target _blank).
   Aqui so registramos o clique. */
function trackShareFrentista(): void {
  track("frentista_share_clicked", { diag_id: state.diagId }, state.diagId);
}


/* ============== Welcome / boot actions ============== */

/* Zera os travões de idempotência do resultado (destrave, lead, Raio X, resgate)
   para um novo diagnóstico não herdar o estado de um anterior na mesma aba. */
function resetFlowFlags(): void {
  leadSent = false;
  raioxConfirmed = false;
  exitRescueShown = false;
  resultPersistedFor = null;
}

function startDiagnostic(): void {
  // Entrada só libera o quiz com nome + WhatsApp + e-mail. O e-mail no início
  // é o que sobe o lead pro RD Station na hora (conversão
  // iniciou-diagnostico-posto, via trigger no banco quando a coluna email é
  // gravada), com a origem de tráfego capturada no boot.
  if (!nameValid(state)) { flagFieldInvalid("welcomeName"); return; }
  if (!phoneValid(state)) { flagFieldInvalid("welcomePhone"); return; }
  if (!emailValid(state)) { flagFieldInvalid("welcomeEmail"); return; }
  hasResumable = false;
  resetFlowFlags();
  const keptName = state.name.trim();
  const keptPhone = state.phone;
  const keptEmail = state.email.trim();
  state = freshState();
  state.name = keptName;
  state.phone = keptPhone;
  state.email = keptEmail;
  state.diagId = uuid();
  state.startedAt = new Date().toISOString();
  state.screen = "question";
  state.cursor = 0;
  saveState(state);
  // Persiste a sessão (fire-and-forget) e zera buffer local de respostas.
  // O contato entra num PATCH separado APÓS o INSERT: é ele que dispara o
  // trigger rd_diagnostico_inicio (a linha já tem as UTMs do INSERT).
  resetLocalAnswers();
  if (state.diagId) {
    const id = state.diagId;
    createSession(id, CONFIG.VERSION, bootContext || captureContext())
      .then(() => setSessionContact(id, keptName, keptEmail, keptPhone));
  }
  track("diagnostic_started", {}, state.diagId); // não enviar PII (nome) a GTM/Meta Pixel (SEC-03)
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function resumeDiagnostic(): void {
  hasResumable = false;
  // Já respondeu tudo antes de sair: volta direto ao resultado (o gate de
  // telefone vive lá). Senão, retoma na pergunta onde parou.
  if (state.cursor >= visibleQuestions(state).length) {
    state.screen = "result";
    state.finishedAt = state.finishedAt || new Date().toISOString();
  } else {
    state.screen = "question";
  }
  track("diag_resume", { step: state.cursor, diag_id: state.diagId }, state.diagId);
  render();
}
/* Recomeçar do zero: limpa estado e vai DIRETO à primeira pergunta.
   Sem passar pela tela intermediária "começar diagnóstico" outra vez. */
function discardAndStart(): void {
  const keptName = state.name.trim();
  const keptPhone = state.phone;
  const keptEmail = state.email.trim();
  clearState();
  hasResumable = false;
  resetFlowFlags();
  state = freshState();
  state.name = keptName;
  state.phone = keptPhone;
  state.email = keptEmail;
  state.diagId = uuid();
  state.startedAt = new Date().toISOString();
  state.screen = "question";
  state.cursor = 0;
  resetLocalAnswers();
  saveState(state);
  if (state.diagId) {
    const id = state.diagId;
    createSession(id, CONFIG.VERSION, bootContext || captureContext())
      .then(() => setSessionContact(id, keptName, keptEmail, keptPhone));
  }
  track("diagnostic_restarted", {}, state.diagId);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function flagFieldInvalid(id: string): void {
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (input) {
    input.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
    input.focus();
  }
}

/* ============== Respostas ============== */

function selectOption(i: number): void {
  const q = currentQuestion(state);
  if (!q) return;
  if (advancing) return; // ignora toque duplo enquanto o auto-avanço está agendado (BUG-01)

  if (q.type === "score") {
    setScoreAnswer(q, i);
    afterAnswer(q);
    advancing = true;
    setTimeout(() => nextStep(), 380);
  } else if (q.type === "segmentation-single") {
    setSingleAnswer(q.id, i, q.options[i]);
    afterAnswer(q);
    advancing = true;
    setTimeout(() => nextStep(), 280);
  } else if (q.type === "qualify") {
    setQualifyAnswer(q.id, i, q.options[i]);
    afterAnswer(q);
    advancing = true;
    setTimeout(() => nextStep(), 280);
  } else {
    // segmentation-multi: clique alterna no array, sem avançar
    toggleMultiOption(i);
  }
  refreshSelectionUI();
}

function toggleMultiOption(i: number): void {
  const q = currentQuestion(state);
  if (!q || q.type !== "segmentation-multi") return;
  const existing = state.answers[q.id];
  const currentIdx = existing && existing.kind === "multi" ? [...existing.selectedIndexes] : [];

  const pos = currentIdx.indexOf(i);
  if (pos >= 0) currentIdx.splice(pos, 1);
  else currentIdx.push(i);

  // Regra: "Só a pista de combustível" é mutuamente exclusivo com os outros.
  // Quando o usuário marca essa, esvazia o resto. Quando marca outra, tira essa.
  const SO_PISTA_IDX = q.options.findIndex((o) => (o as NoScoreOption).value === "so_pista");
  if (SO_PISTA_IDX >= 0) {
    if (i === SO_PISTA_IDX && currentIdx.includes(SO_PISTA_IDX)) {
      currentIdx.splice(0, currentIdx.length, SO_PISTA_IDX);
    } else if (currentIdx.includes(SO_PISTA_IDX) && i !== SO_PISTA_IDX) {
      const idx = currentIdx.indexOf(SO_PISTA_IDX);
      if (idx >= 0) currentIdx.splice(idx, 1);
    }
  }

  const values = currentIdx.map((idx) => (q.options[idx] as NoScoreOption).value);
  const labels = currentIdx.map((idx) => q.options[idx].label);
  const ans: Answer = {
    kind: "multi",
    selectedIndexes: currentIdx,
    values,
    labels,
  };
  state.answers[q.id] = ans;
  saveState(state);
  refreshSelectionUI();
  refreshMultiAdvanceButton();
}

function refreshMultiAdvanceButton(): void {
  const q = currentQuestion(state);
  if (!q || q.type !== "segmentation-multi") return;
  const a = state.answers[q.id];
  const ok = a && a.kind === "multi" && a.selectedIndexes.length > 0;
  const btn = document.getElementById("btnAdvanceMulti") as HTMLButtonElement | null;
  if (!btn) return;
  if (ok) {
    btn.removeAttribute("disabled");
    btn.removeAttribute("aria-disabled");
  } else {
    btn.setAttribute("disabled", "");
    btn.setAttribute("aria-disabled", "true");
  }
}

function advanceFromMulti(): void {
  const q = currentQuestion(state);
  if (!q || q.type !== "segmentation-multi") return;
  const a = state.answers[q.id];
  if (!a || a.kind !== "multi" || a.selectedIndexes.length === 0) return;
  afterAnswer(q);
  nextStep();
}

function advanceFromOpen(): void {
  const q = currentQuestion(state);
  if (!q || q.type !== "open") return;
  const el = document.getElementById("openInput") as HTMLTextAreaElement | null;
  state.answers[q.id] = { kind: "text", text: el ? el.value.trim() : "" };
  saveState(state);
  afterAnswer(q);
  nextStep();
}

function setScoreAnswer(q: ScoreQuestion, idx: number): void {
  const opt = q.options[idx] as ScoreOption;
  const ans: Answer = {
    kind: "score",
    optionIndex: idx,
    label: opt.label,
    value: opt.value || String(idx),
    pts: opt.pts,
    vague: opt.vague === true,
    block: q.block as Exclude<typeof q.block, "qualif">,
    max: q.max,
  };
  state.answers[q.id] = ans;
  saveState(state);
}
function setSingleAnswer(qid: string, idx: number, opt: NoScoreOption): void {
  const ans: Answer = {
    kind: "single",
    optionIndex: idx,
    label: opt.label,
    value: opt.value,
  };
  state.answers[qid] = ans;
  saveState(state);
}
function setQualifyAnswer(qid: string, idx: number, opt: NoScoreOption): void {
  const ans: Answer = {
    kind: "qualify",
    optionIndex: idx,
    label: opt.label,
    value: opt.value,
  };
  state.answers[qid] = ans;
  saveState(state);
}

function afterAnswer(q: Question): void {
  const dt = Math.round((Date.now() - questionStartTime) / 1000);
  track(
    "answer_selected",
    {
      question_id: q.id,
      type: q.type,
      time_on_question: dt,
      diag_id: state.diagId,
    },
    state.diagId,
  );

  // Persiste a resposta na linha da sessão (coluna answer_<qid> + jsonb).
  const a = state.answers[q.id];
  if (a && state.diagId) {
    persistAnswer(state.diagId, q.id, a);
  }

  // Sinal de checkpoint: recalcula sempre que todos os checkpoints estão
  // respondidos, inclusive quando a pessoa volta e corrige uma resposta. Só
  // grava/dispara o evento quando o valor de fato muda, evitando payload RD e
  // eventos com o sinal antigo (BUG-02).
  if (allCheckpointAnswered(state)) {
    const novoSinal = computeSignal(state);
    if (novoSinal !== state.signal) {
      state.signal = novoSinal;
      saveState(state);
      track("diag_signal", { signal: state.signal, diag_id: state.diagId }, state.diagId);
    }
  }
}

function refreshSelectionUI(): void {
  const q = currentQuestion(state);
  if (!q) return;
  const a = state.answers[q.id];
  document.querySelectorAll<HTMLElement>(".answer-card").forEach((el) => {
    const idx = Number(el.dataset.option);
    let selected = false;
    if (a) {
      if (a.kind === "multi") selected = a.selectedIndexes.includes(idx);
      else if ("optionIndex" in a) selected = a.optionIndex === idx;
    }
    el.classList.toggle("is-selected", selected);
    el.setAttribute("aria-checked", selected ? "true" : "false");
  });
  updateBarsLive();
}

/* Anima o gráfico de barras conforme a resposta muda (sobe/desce), sem mostrar
   número. A barra do pilar da pergunta atual recebe um leve destaque. */
function updateBarsLive(): void {
  const bs = blockScores(state);
  const q = currentQuestion(state);
  const bump = q && q.block !== "qualif" ? q.block : null;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  BLOCK_ORDER.forEach((b) => {
    const el = document.querySelector<HTMLElement>(`.bars-fill[data-block="${b}"]`);
    if (!el) return;
    const v = barsDisplayPct(bs[b].pct);
    const prev = Number(el.dataset.target ?? "NaN");
    const changed = prev !== v;
    el.dataset.target = String(v);
    el.style.setProperty("--v", `${v}%`);
    // Só pulsa a barra ativa quando o valor de fato mudou e há movimento.
    const item = el.closest<HTMLElement>(".bars-item");
    if (item && bump === b && changed && !reduce) {
      item.classList.add("is-bumped");
      window.setTimeout(() => item.classList.remove("is-bumped"), 600);
    }
  });
}

/* ============== Navegação ============== */

function nextStep(): void {
  if (state.screen !== "question") return;
  const list = visibleQuestions(state);
  const nextCursor = state.cursor + 1;
  // Saindo do S1 a trilha passa a ser conhecida: reconstrói o header (render
  // completo) para o gráfico de barras por pilar nascer com os pilares da
  // trilha (S1 nao tem trilha, entao o header dele vem sem barras).
  const leavingS1 = state.cursor === 0;
  if (nextCursor < list.length) {
    // Continua nas perguntas: atualiza só o corpo e preserva o nó das barras,
    // para que a transição de preenchimento (lenta e com delay, ver .bars-fill)
    // rode contínua através da troca de pergunta, sem o corte seco do innerHTML.
    state.cursor = nextCursor;
    navDir = "fwd";
    saveState(state);
    if (leavingS1) render();
    else softRenderQuestion();
  } else {
    state.cursor = list.length;
    finishQuiz();
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* Re-render leve da tela de pergunta: troca o corpo, mantém o header e as
   barras no DOM (a transição CSS em curso não é interrompida) e só move o
   destaque da barra ativa e o rótulo de contexto. */
function softRenderQuestion(): void {
  const headerEl = document.getElementById("cpHeader");
  if (!headerEl || headerEl.parentElement !== root()) {
    render();
    return;
  }
  while (headerEl.nextSibling) root().removeChild(headerEl.nextSibling);
  headerEl.insertAdjacentHTML("afterend", renderBody());
  updateHeaderForQuestion();
  onQuestionRendered();
}

/* Atualiza, no header preservado, o rótulo de contexto e qual barra fica ativa,
   sem recriar os nós de preenchimento (.bars-fill). */
function updateHeaderForQuestion(): void {
  const label = headerContextLabel();
  const tag = document.querySelector<HTMLElement>(".cp-brand-tag");
  if (tag) tag.innerHTML = `Análise do posto${label ? ` · <b>${label}</b>` : ""}`;
  const q = currentQuestion(state);
  const active = q && q.block !== "qualif" ? q.block : null;
  document.querySelectorAll<HTMLElement>(".bars-item").forEach((item) => {
    item.classList.toggle("is-active", item.getAttribute("data-block") === active);
  });
}

function prevStep(): void {
  if (state.screen === "question" && state.cursor > 0) {
    state.cursor -= 1;
    navDir = "back";
    saveState(state);
    track("diag_back", { diag_id: state.diagId }, state.diagId);
    // Soft render no voltar: preserva o header e as barras (sem corte seco) e
    // roda a transicao direcional para tras.
    softRenderQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

/* Fim do quiz: a pessoa respondeu tudo. Vai pra animação de cálculo e daí pro
   resultado. O contato NÃO é mais exigido aqui: o telefone virou um gate dentro
   do resultado (recompensa primeiro), então a pessoa já vê nota e parte das
   frentes antes de deixar qualquer dado. */
function finishQuiz(): void {
  state.finishedAt = new Date().toISOString();
  state.screen = "transition";
  saveState(state);
  track("diagnostic_completed", { diag_id: state.diagId }, state.diagId);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============== Per-screen ============== */

function onQuestionRendered(): void {
  questionStartTime = Date.now();
  advancing = false; // nova pergunta na tela: libera o próximo avanço (BUG-01)
  // Pergunta de texto aberto: salva o texto a cada digitação.
  const open = document.getElementById("openInput") as HTMLTextAreaElement | null;
  if (open) {
    open.addEventListener("input", () => {
      const q = currentQuestion(state);
      if (!q || q.type !== "open") return;
      state.answers[q.id] = { kind: "text", text: open.value };
      saveState(state);
    });
  }

  // Transicao direcional: a coluna da pergunta entra deslizando conforme a
  // navegacao (avancar pela direita, voltar pela esquerda).
  const qEl = document.querySelector<HTMLElement>(".question");
  if (qEl) qEl.classList.add(navDir === "back" ? "q-enter-back" : "q-enter-fwd");
  navDir = "fwd";
}

function onWelcomeRendered(): void {
  const input = document.getElementById("welcomeName") as HTMLInputElement | null;
  const phoneEl = document.getElementById("welcomePhone") as HTMLInputElement | null;
  const emailEl = document.getElementById("welcomeEmail") as HTMLInputElement | null;
  const btn = document.getElementById("btnStartDiag") as HTMLButtonElement | null;
  if (!input) return;
  const updateBtn = () => {
    const ok = nameValid(state) && phoneValid(state) && emailValid(state);
    if (ok) btn?.removeAttribute("disabled");
    else btn?.setAttribute("disabled", "");
    btn?.setAttribute("aria-disabled", ok ? "false" : "true");
  };
  input.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    state.name = t.value;
    saveState(state);
    input.classList.remove("is-invalid");
    input.setAttribute("aria-invalid", "false");
    updateBtn();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); phoneEl?.focus(); }
  });
  if (phoneEl) {
    phoneEl.addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement;
      t.value = maskPhone(t.value);
      state.phone = t.value;
      saveState(state);
      phoneEl.classList.remove("is-invalid");
      phoneEl.setAttribute("aria-invalid", "false");
      updateBtn();
    });
    phoneEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); emailEl?.focus(); }
    });
  }
  if (emailEl) {
    emailEl.addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement;
      state.email = t.value;
      saveState(state);
      emailEl.classList.remove("is-invalid");
      emailEl.setAttribute("aria-invalid", "false");
      updateBtn();
    });
    emailEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); startDiagnostic(); }
    });
  }
  // Autofoco só no desktop: no iPhone o foco programático dispara o zoom
  // automático do Safari e a página já abre ampliada. No toque, a pessoa
  // decide quando abrir o teclado.
  if (window.matchMedia?.("(min-width: 960px)").matches) {
    setTimeout(() => input.focus(), 200);
  }
}

/* ============== Portão de e-mail das trilhas comerciais ==============
   Desde 05/08 o e-mail é capturado na TELA INICIAL, então este portão virou
   FALLBACK: só aparece pra sessão antiga (retomada) que chegou ao resultado
   sem e-mail válido no estado. No fluxo novo, emailValid já é true e o
   onResultRendered pula direto pro submitLead. O frentista não passa por aqui
   (não vira lead). Regra registrada na RULES.md 3.15. */
function showResultGate(): void {
  if (document.getElementById("resultGate") || emailValid(state)) return;
  const article = document.querySelector<HTMLElement>(".rr-result");
  if (article) article.classList.add("is-gated");
  document.body.style.overflow = "hidden";

  const wrap = document.createElement("div");
  wrap.className = "rescue-overlay";
  wrap.id = "resultGate";
  wrap.innerHTML = `
    <div class="rescue-card result-gate-card" role="dialog" aria-modal="true" aria-label="Liberar a análise do posto">
      <span class="rescue-eyebrow">Sua análise das 6 frentes está pronta</span>
      <h3 class="rescue-title">Pra onde eu mando a leitura completa do seu posto?</h3>
      <p class="rescue-text">Confirma o seu melhor e-mail e eu libero a sua análise agora, com o plano por frente.</p>
      <label class="result-gate-field" for="gateEmail">
        <span class="rr-field-label">Seu melhor e-mail</span>
        <input id="gateEmail" class="rr-input" type="email" inputmode="email" autocomplete="email" placeholder="voce@empresa.com" value="${escHtml(state.email)}">
      </label>
      <button class="rr-cta rr-cta-primary rr-cta-block" type="button" data-action="unlock-results" id="btnUnlockResults"${emailValid(state) ? "" : " disabled aria-disabled=\"true\""}>
        Quero ver a análise do meu posto
      </button>
      <span class="result-gate-micro">Leva 10 segundos. É por aqui que você recebe o plano das seis frentes.</span>
    </div>
  `;
  document.body.appendChild(wrap);

  const input = document.getElementById("gateEmail") as HTMLInputElement | null;
  const btn = document.getElementById("btnUnlockResults") as HTMLButtonElement | null;
  if (input) {
    input.addEventListener("input", (e) => {
      state.email = (e.target as HTMLInputElement).value;
      saveState(state);
      input.classList.remove("is-invalid");
      input.setAttribute("aria-invalid", "false");
      const ok = emailValid(state);
      if (ok) btn?.removeAttribute("disabled");
      else btn?.setAttribute("disabled", "");
      btn?.setAttribute("aria-disabled", ok ? "false" : "true");
    });
    input.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter" && emailValid(state)) {
        e.preventDefault();
        submitResultGate();
      }
    });
    setTimeout(() => input.focus(), 100);
  }
  track("result_gate_shown", { diag_id: state.diagId }, state.diagId);
}

/* Submissão do portão: valida, envia o lead (RD + MQL + PDF) e libera o resultado. */
function submitResultGate(): void {
  const input = document.getElementById("gateEmail") as HTMLInputElement | null;
  if (input) { state.email = input.value; saveState(state); }
  if (!emailValid(state)) {
    if (input) {
      input.classList.add("is-invalid");
      input.setAttribute("aria-invalid", "true");
      input.focus();
    }
    return;
  }
  // O portão captura o e-mail e já LEVA a pessoa pra agenda (abre o Google
  // Agenda) além de enviar o lead ao RD. Depois libera o resultado por baixo.
  track("result_gate_submitted", { diag_id: state.diagId }, state.diagId);
  markRaioxScheduled(state.email.trim());
  unlockResults();
}

/* Remove o portão, desfoca o resultado e liga os inputs/resgate do resultado. */
function unlockResults(): void {
  const gate = document.getElementById("resultGate");
  if (gate) gate.remove();
  document.body.style.overflow = "";
  const article = document.querySelector<HTMLElement>(".rr-result");
  if (article) article.classList.remove("is-gated");
  // Retomada já convertida: mostra a linha de confirmação; senão arma o resgate.
  if (raioxConfirmed) revealConfirmed();
  else setupExitRescue();
}

function onTransitionRendered(): void {
  if (transitionTimer !== null) clearTimeout(transitionTimer);
  requestAnimationFrame(() => {
    const bar = document.getElementById("transitionBarFill");
    if (bar) {
      (bar as HTMLElement).style.transition =
        `width ${CONFIG.TRANSITION_MS}ms cubic-bezier(.4,0,.2,1)`;
      (bar as HTMLElement).style.width = "100%";
    }
  });
  transitionTimer = window.setTimeout(() => {
    transitionTimer = null;
    state.screen = "result";
    saveState(state);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, CONFIG.TRANSITION_MS);
}

function onResultRendered(): void {
  const targetEl = document.getElementById("rScoreTarget");
  const numEl = document.getElementById("rScoreNumber");
  if (targetEl && numEl) {
    const target = Number((targetEl as HTMLElement).dataset.target || "0");
    animateScore(numEl, target, 1100, 280);
  }

  // Grava o diagnóstico (anônimo) já na abertura do resultado, mesmo antes do
  // contato. Assim medimos quem chegou ao resultado e não converteu.
  persistResultData();

  const trilha = currentTrack(state);
  if (trilha === "frentista") {
    // Frentista não gera MQL: marca a conclusão e para por aqui.
    if (state.diagId) completeSession(state.diagId, false);
  } else {
    // Dono e gerente: o e-mail já veio da tela inicial, então o caminho normal
    // é direto — envia o lead (idempotente) e libera o resultado sem pop-up.
    // O portão só abre no fallback de sessão antiga sem e-mail no estado.
    if (emailValid(state)) {
      submitLead();
      unlockResults();
    } else {
      showResultGate();
    }
  }
}

function animateScore(el: HTMLElement, target: number, dur: number, delay: number): void {
  setTimeout(() => {
    const t0 = performance.now();
    function tick(t: number) {
      const p = Math.min((t - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(eased * target);
      el.textContent = String(val);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, delay);
}

/* ============== Persistência no backend ============== */

/* Grava o resultado consolidado (anônimo, sem contato) já na abertura da tela.
   Roda pra todo mundo que chega ao resultado, converta ou não. O envio do lead
   (contato + RD + PDF) fica em submitLead, disparado quando o telefone entra. */
async function persistResultData(): Promise<void> {
  // Grava o resultado uma única vez por sessão: onResultRendered roda a cada
  // render da tela (retomada, re-render), o que antes inflava gravações e o
  // evento result_viewed (BUG-04).
  if (state.diagId && resultPersistedFor === state.diagId) return;
  if (state.diagId) resultPersistedFor = state.diagId;
  const score = totalScore(state);
  const lvl = levelFor(score);
  const routing = buildRoutingPayload(state);
  const bs = blockScores(state);
  const ranked = rankedBlocks(state);
  const urgency = urgencyFor(score);
  const radar = radarReading(state);
  const strong = strongestBlock(state);
  const weak = weakestBlock(state);
  const weakIds = ranked.slice(0, 4).map((x) => x.id);
  const recs = buildResultRecommendations(weakIds);
  const heroPain = mainPain(state);
  const nextImp = nextImprovementFor(ranked[0]?.id);

  track("result_viewed", { score_total: score, nivel: lvl.name, signal: state.signal }, state.diagId);

  if (!state.diagId) return;

  // Conversão da tela final: grava a primeira abertura do resultado no banco
  // (coluna resultado_visto_em), espelho do gatilho GTM na âncora #analise-pronta.
  markResultadoVisto(state.diagId);

  const dimensions: Record<string, { earned: number; possible: number; pct: number }> = {};
  BLOCK_ORDER.forEach((b) => {
    dimensions[b] = { earned: bs[b].earned, possible: bs[b].possible, pct: bs[b].pct };
  });

  const content = buildReportContent(state);

  await persistResult(state.diagId, {
    overall_score: score,
    score_range_label: lvl.name,
    urgency_tone: urgency.key,
    signal: state.signal,
    dimensions,
    strongest_dimension_key: ranked[ranked.length - 1]?.id ?? null,
    strongest_dimension_label: strong?.name ?? null,
    strongest_dimension_score: strong?.pct ?? null,
    weakest_dimension_key: ranked[0]?.id ?? null,
    weakest_dimension_label: weak?.name ?? null,
    weakest_dimension_score: weak?.pct ?? null,
    main_pain_title: ranked[0] ? `Frente crítica: ${BLOCKS[ranked[0].id].name}` : "Diagnóstico geral",
    main_pain_description: heroPain,
    main_pain_risk: content.pain.risk,
    radar_summary: radar.p1,
    radar_summary_extra: radar.p2,
    next_improvement_title: nextImp,
    next_improvement_description: content.nextImprovement.description,
    recommendations_open: recs.open.map((r) => ({
      id: r.id, title: r.title, desc: r.desc, impact: r.impact, block: r.block,
    })),
    recommendations_locked: recs.locked.map((r) => ({
      id: r.id, title: r.title, desc: r.desc, impact: r.impact, block: r.block,
    })),
    clubpetro_solutions: content.clubpetroSolutions,
    commercial_summary: content.commercial.leitura,
    commercial_reading: content.commercial,
    approach_message: routing.approachMessage,
    readiness: routing.readiness ? routing.readiness.value : null,
  });

  const m = document.getElementById("saveMsg");
  if (m) m.textContent = "Respostas registradas";
}

/* Envio do lead: contato completo + conclusão gravados na linha da sessão e
   PDF gerado. Quem manda a conversão pro RD Station é o BANCO: o flip de
   `concluiu` dispara o trigger rd_diagnostico_conversion (fez-diagnostico-posto)
   e o sweep da esteira cobre o retry. A chamada direta daqui foi REMOVIDA
   (05/08): o payload dela não tinha `concluiu`, a função respondia 200 sem
   enviar nada e o markRdSent marcava rd_enviado=true à toa — envenenando o
   dedup e podendo calar o envio real. Idempotente. */
async function submitLead(): Promise<void> {
  if (leadSent) return;
  leadSent = true;
  state.leadSent = true; // persiste a conversão para não reenviar numa retomada (BUG-03)
  saveState(state);
  if (!state.diagId) return;

  const score = totalScore(state);
  const trilha = currentTrack(state);

  setSessionContact(state.diagId, state.name, state.email, state.phone);
  completeSession(state.diagId, true);

  track(
    "lead_captured",
    {
      phone_length: phoneDigitsOnly(state.phone).length,
      has_email: state.email.length > 0,
      diag_id: state.diagId,
    },
    state.diagId,
  );

  // Evento ÚNICO de conversão para o GTM (trigger de Evento Personalizado
  // "conversao_diagnostico"). Sem PII: só score e trilha.
  track("conversao_diagnostico", { score, trilha }, state.diagId);

  // ============== Geração + upload do PDF (background) ==============
  generateAndUploadReport().catch((e) => {
    console.warn("Geração de PDF falhou:", e);
    if (state.diagId) markReportFailed(state.diagId, String(e));
  });
}

async function generateAndUploadReport(): Promise<void> {
  if (!state.diagId) return;
  track("report_generation_started", {}, state.diagId);
  const { generateReportPdf, generateClientPdf } = await import("./lib/report");
  const content = buildReportContent(state);
  // Comercial (interno, completo) + cliente (limpo). Ambos no bucket privado.
  const [comercial, cliente] = await Promise.all([
    generateReportPdf(content),
    generateClientPdf(content),
  ]);
  await uploadReports(state.diagId, comercial, cliente);
}

/* ============== CTAs ============== */

/* CTA secundário (ghost) do resultado: falar agora com um Especialista
   ClubPetro pelo WhatsApp. Número da Camila entra via WHATSAPP_ESPECIALISTA. */
function ctaEspecialista(): void {
  const score = totalScore(state);
  track("specialist_cta_clicked", { score_total: score }, state.diagId);
  if (state.diagId) persistSpecialistCta(state.diagId, score);

  // Mensagem personalizada com os dados da análise, pronta pra puxar conversa:
  // nome, perfil, nota, nível e as frentes mais fracas (resumo pelas respostas).
  const first = state.name.trim().split(/\s+/)[0] || "";
  const nivel = levelFor(score).name;
  const perfil = currentTrack(state) === "gerente" ? "gerente" : "dono";
  const ranked = rankedBlocks(state);
  const fracas = ranked.slice(0, 2).map((r) => BLOCKS[r.id].name).join(" e ");

  const linhas = [
    `Olá, tudo bem? Aqui é ${first || "o responsável pelo posto"}.`,
    ``,
    `Acabei de fazer a análise das 6 frentes do meu posto e queria bater um papo pra entender como vocês podem me ajudar.`,
    ``,
    `Sou ${perfil} do posto.`,
    `Minha nota foi ${score} de 100 (${nivel}).`,
  ];
  if (fracas) linhas.push(`As frentes que mais pesam hoje: ${fracas}.`);
  linhas.push(``, `Podemos conversar?`);

  const msg = linhas.join("\n");
  const url = "https://wa.me/" + CONFIG.WHATSAPP_ESPECIALISTA + "?text=" + encodeURIComponent(msg);
  window.open(url, "_blank", "noopener,noreferrer");
}

/* Abre uma URL em nova aba via navegação real (clique num <a target="_blank">).
   Mais confiável que window.open com string de features, que alguns navegadores
   tratam como popup programático e bloqueiam (sintoma: o clique não abre nada).
   A aba nova carrega a URL; o app continua vivo na aba original para o PATCH
   de agendou_raiox concluir. */
function openInNewTab(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ============== Resgate na saída ============== */

/* Arma o resgate: no desktop, se a pessoa ainda não garantiu a vaga e leva o
   cursor pra fora pela borda de cima (intenção de fechar), chama de volta pro
   bloco do Raio-X. No mobile não dá pra interceptar a saída a tempo, então lá
   o resgate não aparece (o lead já ficou salvo na entrada). */
function setupExitRescue(): void {
  if (exitRescueBound) return; // o listener global é registrado uma única vez (BUG-05)
  exitRescueBound = true;
  const onMouseOut = (e: MouseEvent) => {
    if (state.screen !== "result") return;
    if (exitRescueShown || raioxConfirmed) return;
    if (e.clientY <= 0 && !e.relatedTarget) {
      showExitRescue();
    }
  };
  document.addEventListener("mouseout", onMouseOut);
}

/* Pop-up de recuperação: um CTA só, que leva de volta pro bloco de garantir a
   vaga. O nome e o WhatsApp já vieram na entrada. */
function showExitRescue(): void {
  if (exitRescueShown || raioxConfirmed) return;
  exitRescueShown = true;
  const first = state.name.trim().split(/\s+/)[0] || "";
  const wrap = document.createElement("div");
  wrap.className = "rescue-overlay";
  wrap.id = "rescueOverlay";
  wrap.innerHTML = `
    <div class="rescue-card" role="dialog" aria-modal="true" aria-label="Garantir vaga no Raio-X">
      <button class="rescue-close" type="button" data-action="rescue-close" aria-label="Fechar">&times;</button>
      <span class="rescue-eyebrow">Espera</span>
      <h3 class="rescue-title">Você está a um passo${first ? `, ${first}` : ""}.</h3>
      <p class="rescue-text">
        A sua vaga no próximo Raio-X ainda não está garantida. Leva 30 segundos e o
        evento entra direto na sua agenda.
      </p>
      <button class="rr-cta rr-cta-primary rr-cta-block" type="button" data-action="rescue-confirm" id="btnRescueConfirm">
        Quero garantir minha vaga agora
      </button>
      <button class="rescue-dismiss" type="button" data-action="rescue-close">
        Fechar
      </button>
    </div>
  `;
  document.body.appendChild(wrap);
  track("exit_rescue_shown", { diag_id: state.diagId }, state.diagId);
}

/* Botão do pop-up: fecha e leva de volta pro bloco de garantir a vaga. Se já há
   e-mail válido, confirma direto. */
function rescueConfirm(): void {
  track("exit_rescue_confirm", { diag_id: state.diagId }, state.diagId);
  closeExitRescue();
  if (emailValid(state)) confirmPresence();
  else gotoRaiox();
}

function closeExitRescue(): void {
  const el = document.getElementById("rescueOverlay");
  if (el) el.remove();
}

/* ============== Boot ============== */

export function boot(): void {
  // Captura contexto (UTMs, device, browser) uma vez no boot.
  // O page_viewed entra no buffer; é gravado junto com o createSession quando
  // o usuário inicia o diagnóstico.
  bootContext = captureContext();
  track("page_viewed", {
    landing_url: bootContext.landing_url,
    referrer: bootContext.referrer,
    utm_source: bootContext.utm_source,
    utm_campaign: bootContext.utm_campaign,
  }, null);

  const saved = loadState();
  if (saved && (Object.keys(saved.answers || {}).length > 0 || (saved.cursor || 0) > 0)) {
    state = { ...freshState(), ...saved };
    if (typeof state.name !== "string") state.name = "";
    if (typeof state.email !== "string") state.email = "";
    if (typeof state.phone !== "string") state.phone = "";
    // Sempre reabre no welcome com opção de retomar (telas antigas "phone" e
    // "contact" não existem mais no fluxo).
    state.screen = "welcome";
    hasResumable = true;
    // Restaura os travões de conversão para não reenviar o lead nem reabrir o
    // portão/confirmação numa retomada de sessão já convertida (BUG-03).
    leadSent = state.leadSent === true;
    raioxConfirmed = state.raioxConfirmed === true;
  }
  window.addEventListener("pagehide", () => {
    // transition = diagnostico ja concluido (contato entregue), so animacao: nao e abandono.
    if (state.screen === "result" || state.screen === "welcome" || state.screen === "transition") return;
    const elapsed = state.startedAt
      ? Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000)
      : 0;
    track(
      "diagnostic_abandoned",
      {
        last_screen: state.screen,
        last_cursor: state.cursor,
        time_total: elapsed,
      },
      state.diagId,
    );
  });
  bindGlobalActions();
  render();
}
