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
import {
  showTrackVideo,
  hideTrackVideo,
  videoBlockFor,
  preloadTrackStart,
  TRACK_VIDEO_BLOCKS,
  type VideoTrack,
} from "./lib/trackVideo";
import {
  showTrackImage,
  hideTrackImage,
  imageBlockFor,
  preloadDonoStart,
  DONO_IMAGE_BLOCKS,
} from "./lib/trackImage";
import { track } from "./lib/tracking";
import { uuid, maskPhone, phoneDigitsOnly } from "./lib/format";
import { captureContext, type RequestContext } from "./lib/context";
import {
  createSession,
  setSessionName,
  setSessionContact,
  completeSession,
  markRdSent,
  persistAnswer,
  persistResult,
  persistAgendouRaiox,
  persistSpecialistCta,
  uploadReports,
  markReportFailed,
  resetLocalAnswers,
  flushEvents,
} from "./lib/api";
import { buildReportContent } from "./lib/reportContent";
import { urgencyFor } from "./data/urgency";
import { mainPain, nextImprovementFor, radarReading, strongestBlock, weakestBlock } from "./data/radar-reading";
import { buildResultRecommendations } from "./data/recommendations";

let bootContext: RequestContext | null = null;

import { Header } from "./components/Header";
import { BarsProgress } from "./components/BarsProgress";
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

/* Estado do vídeo da trilha (frentista ou gerente) para a pergunta atual:
   trilha, bloco e lado. Retorna null quando a trilha não tem vídeo (dono),
   é o S1 de roteamento, ou não é tela de pergunta: a camada fica escondida. */
function currentTrackVideo(): { track: VideoTrack; block: number; side: "left" | "right" } | null {
  if (state.screen !== "question") return null;
  const track = currentTrack(state);
  if (track !== "frentista" && track !== "gerente") return null;
  const q = currentQuestion(state);
  if (!q || q.id === "S1") return null;
  const blocks = TRACK_VIDEO_BLOCKS[track];
  const total = Math.max(1, visibleQuestions(state).length - 1); // exclui o S1
  const block = videoBlockFor(blocks, state.cursor - 1, total);  // cursor 0 = S1
  return { track, block, side: blocks[block].side };
}

/* Estado da imagem em blocos da trilha do DONO para a pergunta atual: bloco e
   lado. Retorna null fora da trilha do dono, no S1 de roteamento ou fora de
   tela de pergunta. Mesma logica de blocos do video. */
function currentTrackImage(): { block: number; side: "left" | "right" } | null {
  if (state.screen !== "question") return null;
  if (currentTrack(state) !== "dono") return null;
  const q = currentQuestion(state);
  if (!q || q.id === "S1") return null;
  const total = Math.max(1, visibleQuestions(state).length - 1); // exclui o S1
  const block = imageBlockFor(DONO_IMAGE_BLOCKS, state.cursor - 1, total);
  return { block, side: DONO_IMAGE_BLOCKS[block].side };
}

/* ============== Body ============== */

function renderBody(): string {
  switch (state.screen) {
    case "welcome":
      return WelcomePage({
        resumable: hasResumable,
        name: state.name,
        phone: state.phone,
        entryValid: nameValid(state) && phoneValid(state),
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
      const fv = currentTrackVideo();
      const fi = currentTrackImage();
      return QuestionPage({
        question: q,
        currentIndex: state.cursor,
        totalSteps: totalStepsFn(state),
        selectedIndex,
        selectedIndexes,
        openText,
        plural: isPluralPosto(state),
        videoSide: fv?.side,
        videoBlock: fv?.block,
        videoTrack: fv?.track,
        imageSide: fi?.side,
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
  // Fora das perguntas, as camadas de arte das trilhas ficam escondidas.
  if (state.screen !== "question") { hideTrackVideo(); hideTrackImage(); }
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
    case "confirm-presence": return confirmPresence();
    case "cta-whatsapp":   return ctaEspecialista();
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
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  track("result_goto_raiox", { diag_id: state.diagId }, state.diagId);
}

/* Ação principal: garantir a vaga no Raio-X. Salva o e-mail e o lead na hora
   (sempre), abre o Google Agenda com o e-mail pré-preenchido, adiciona a pessoa
   como convidada no evento e grava o agendamento. Não destrava nada: os 3 passos
   já estão visíveis e o resto é teaser permanente. Idempotente. */
function confirmPresence(): void {
  const input = document.getElementById("confirmEmail") as HTMLInputElement | null;
  if (input) { state.email = input.value; saveState(state); }
  if (!emailValid(state)) {
    if (input) {
      input.classList.add("is-invalid");
      input.setAttribute("aria-invalid", "true");
      input.focus();
    }
    return;
  }

  const email = state.email.trim();
  // 1) lead sempre (e-mail + contato + RD + PDF), idempotente
  submitLead();
  // 2) abre a agenda da pessoa com o evento pronto (e-mail pré-preenchido)
  openInNewTab(calendarTemplateUrl(email));
  // 3) confirma a presença: convidado no evento compartilhado + agendamento no banco
  if (!raioxConfirmed) {
    raioxConfirmed = true;
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
}

function startDiagnostic(): void {
  // Entrada só libera o quiz com nome + WhatsApp (é essa captura que abre a
  // porta e já garante o lead pra follow-up mesmo se a pessoa não confirmar).
  if (!nameValid(state)) { flagFieldInvalid("welcomeName"); return; }
  if (!phoneValid(state)) { flagFieldInvalid("welcomePhone"); return; }
  hasResumable = false;
  resetFlowFlags();
  const keptName = state.name.trim();
  const keptPhone = state.phone;
  state = freshState();
  state.name = keptName;
  state.phone = keptPhone;
  state.diagId = uuid();
  state.startedAt = new Date().toISOString();
  state.screen = "question";
  state.cursor = 0;
  saveState(state);
  // Persiste a sessão (fire-and-forget) e zera buffer local de respostas.
  resetLocalAnswers();
  if (state.diagId) {
    const id = state.diagId;
    createSession(id, CONFIG.VERSION, bootContext || captureContext())
      .then(() => setSessionContact(id, keptName, "", keptPhone));
  }
  track("diagnostic_started", { name: keptName }, state.diagId);
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
  clearState();
  hasResumable = false;
  resetFlowFlags();
  state = freshState();
  state.name = keptName;
  state.phone = keptPhone;
  state.diagId = uuid();
  state.startedAt = new Date().toISOString();
  state.screen = "question";
  state.cursor = 0;
  resetLocalAnswers();
  saveState(state);
  if (state.diagId) {
    const id = state.diagId;
    createSession(id, CONFIG.VERSION, bootContext || captureContext())
      .then(() => setSessionContact(id, keptName, "", keptPhone));
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

  if (q.type === "score") {
    setScoreAnswer(q, i);
    afterAnswer(q);
    setTimeout(() => nextStep(), 380);
  } else if (q.type === "segmentation-single") {
    setSingleAnswer(q.id, i, q.options[i]);
    afterAnswer(q);
    setTimeout(() => nextStep(), 280);
  } else if (q.type === "qualify") {
    setQualifyAnswer(q.id, i, q.options[i]);
    afterAnswer(q);
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

  // Ao escolher o papel (S1), já pré-carrega o 1o vídeo da trilha, para ele
  // estar pronto quando a primeira pergunta da trilha aparecer.
  if (q.id === "S1") {
    const t = currentTrack(state);
    if (t === "frentista" || t === "gerente") preloadTrackStart(t);
    else if (t === "dono") preloadDonoStart();
  }

  // Sinal de checkpoint
  if (!state.signalLocked && allCheckpointAnswered(state)) {
    state.signal = computeSignal(state);
    state.signalLocked = true;
    saveState(state);
    track("diag_signal", { signal: state.signal, diag_id: state.diagId }, state.diagId);
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
    const v = Math.max(0, Math.min(100, bs[b].pct || 0));
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
    // para que a transição de preenchimento (950ms) rode contínua através da
    // troca de pergunta, sem o corte seco do innerHTML completo.
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

  // Camada de vídeo da trilha (frentista/gerente): re-anexa o vídeo persistente
  // no slot (sem reiniciar) e faz crossfade só quando muda de bloco. Fora dessas
  // trilhas, some.
  const tv = currentTrackVideo();
  const mount = document.getElementById("fvideoMount");
  if (tv && mount) showTrackVideo(mount, TRACK_VIDEO_BLOCKS[tv.track], tv.block);
  else hideTrackVideo();

  // Camada de imagem em blocos da trilha do dono: re-anexa a imagem persistente
  // (sem recriar) e faz crossfade + morph de cor so quando muda de bloco.
  const ti = currentTrackImage();
  const imgMount = document.getElementById("fimgMount");
  if (ti && imgMount) showTrackImage(imgMount, DONO_IMAGE_BLOCKS, ti.block);
  else hideTrackImage();

  // Transicao direcional: a coluna da pergunta entra deslizando conforme a
  // navegacao (avancar pela direita, voltar pela esquerda). A midia, persistente,
  // nao e afetada (a animacao e so na .question).
  const qEl = document.querySelector<HTMLElement>(".question");
  if (qEl) qEl.classList.add(navDir === "back" ? "q-enter-back" : "q-enter-fwd");
  navDir = "fwd";
}

function onWelcomeRendered(): void {
  // Vídeo do hero. O WebM tem canal alpha (fundo transparente de verdade), que
  // Chrome/Firefox/Android renderizam. Safari e iOS (todos WebKit) NÃO suportam
  // alpha em WebM e mostrariam um retângulo preto, então nesses casos removemos
  // o WebM e caímos no mp4 (mesmo creme do fundo, funde sem caixa).
  const vid = document.getElementById("welcomeHeroVideo") as HTMLVideoElement | null;
  if (vid) {
    const ua = navigator.userAgent;
    const isApple = /iP(hone|ad|od)/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|Android|CriOS|FxiOS|Edg/.test(ua));
    if (isApple) {
      vid.querySelector('source[type="video/webm"]')?.remove();
      vid.load();
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { vid.removeAttribute("autoplay"); vid.pause(); }
    else { void vid.play?.().catch(() => {}); }
  }

  const input = document.getElementById("welcomeName") as HTMLInputElement | null;
  const phoneEl = document.getElementById("welcomePhone") as HTMLInputElement | null;
  const btn = document.getElementById("btnStartDiag") as HTMLButtonElement | null;
  if (!input) return;
  const updateBtn = () => {
    const ok = nameValid(state) && phoneValid(state);
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
      if (e.key === "Enter") { e.preventDefault(); startDiagnostic(); }
    });
  }
  setTimeout(() => input.focus(), 200);
}

/* Liga o campo de e-mail do gate de confirmação: valida em tempo real, habilita
   o botão "Confirmar minha presença" e confirma no Enter. */
function wireResultInputs(): void {
  const emailEl = document.getElementById("confirmEmail") as HTMLInputElement | null;
  const btn = document.getElementById("btnConfirmPresence") as HTMLButtonElement | null;
  if (!emailEl) return;
  emailEl.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    state.email = t.value;
    saveState(state);
    emailEl.classList.remove("is-invalid");
    emailEl.setAttribute("aria-invalid", "false");
    const ok = emailValid(state);
    if (ok) btn?.removeAttribute("disabled");
    else btn?.setAttribute("disabled", "");
    btn?.setAttribute("aria-disabled", ok ? "false" : "true");
  });
  emailEl.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter" && emailValid(state)) {
      e.preventDefault();
      confirmPresence();
    }
  });
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
    // Dono e gerente: liga o campo de e-mail e arma o resgate na saída.
    wireResultInputs();
    // Se a pessoa já garantiu a vaga nesta sessão (retomada), mostra a confirmação.
    if (raioxConfirmed) restoreConfirmedUI();
    else setupExitRescue();
  }
}

/* Restaura a UI confirmada quando a pessoa volta ao resultado já convertida
   (retomada de sessão): desembaça os passos e mostra a linha de confirmação. */
function restoreConfirmedUI(): void {
  revealConfirmed();
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

/* Envio do lead: a pessoa deixou o WhatsApp e destravou o plano. Grava o
   contato, marca a sessão como MQL, dispara a conversão no RD Station e gera o
   PDF. Só dono e gerente chegam aqui (frentista não vira lead). Idempotente. */
async function submitLead(): Promise<void> {
  if (leadSent) return;
  leadSent = true;
  if (!state.diagId) return;

  const score = totalScore(state);
  const lvl = levelFor(score);
  const routing = buildRoutingPayload(state);
  const bs = blockScores(state);
  const ranked = rankedBlocks(state);
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

  // ============== Edge function RD (best-effort) ==============
  const blockPctsObj: Record<string, number> = {};
  BLOCK_ORDER.forEach((b) => (blockPctsObj[b] = bs[b].pct));
  try {
    const res = await fetch(CONFIG.SUPABASE_URL + CONFIG.RD_CONVERSION_FN, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + CONFIG.SUPABASE_ANON_KEY,
        apikey: CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        nome: state.name,
        email: state.email,
        telefone: state.phone,
        score_total: score,
        nivel: lvl.name,
        dimensao_fraca: ranked[0]?.id ?? null,
        sinal: state.signal,
        z2: routing.z2,
        readiness: routing.readiness,
        block_scores: blockPctsObj,
        diag_id: state.diagId,
        papel: trilha,
        approach_message: routing.approachMessage,
      }),
      keepalive: true,
    });
    if (res.ok && state.diagId) markRdSent(state.diagId);
  } catch (e) {
    console.warn("RD conversion best-effort falhou:", e);
  }

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
  const firstName = state.name.trim().split(/\s+/)[0] || "tudo bem";
  const msg =
    `Olá, aqui é ${firstName}. Acabei de concluir o diagnóstico do meu posto ` +
    `e quero falar com um Especialista ClubPetro sobre como melhorar o resultado.`;
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
    // Flush final dos eventos pendentes
    if (state.diagId) flushEvents(state.diagId);
  });
  bindGlobalActions();
  render();
}
