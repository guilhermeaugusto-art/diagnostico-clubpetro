import "./styles/index.css";

import { CONFIG } from "./lib/config";
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
  weakBlockIds,
  phoneValid,
  emailValid,
  nameValid,
  contactValid,
  collectGaps,
} from "./lib/scoring";
import {
  computeSignal,
  allCheckpointAnswered,
  currentQuestion,
  currentTrack,
  visibleQuestions,
  totalSteps as totalStepsFn,
} from "./lib/engine";
import { buildRoutingPayload } from "./lib/routing";
import { getSupabase } from "./lib/supabase";
import { track } from "./lib/tracking";
import { uuid, maskPhone, phoneDigitsOnly } from "./lib/format";
import { captureContext, type RequestContext } from "./lib/context";
import {
  createSession,
  setSessionName,
  setSessionContact,
  completeSession,
  persistAnswer,
  persistResult,
  persistRayxRequest,
  persistSpecialistCta,
  uploadReportPdf,
  markReportGenerated,
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
import { resetRadarMiniState } from "./components/RadarMini";
import { WelcomePage } from "./pages/WelcomePage";
import { QuestionPage } from "./pages/QuestionPage";
import { ContactPage } from "./pages/ContactPage";
import { TransitionPage } from "./pages/TransitionPage";
import { ResultPage } from "./pages/ResultPage";

let state: AppState = freshState();
let hasResumable = false;
let questionStartTime = 0;
let transitionTimer: number | null = null;

const root = () => document.getElementById("app")!;

/* ============== Header context ============== */

function headerContextLabel(): string {
  if (state.screen === "welcome") return "";
  if (state.screen === "transition") return "Calculando";
  if (state.screen === "result") return "Resultado";
  if (state.screen === "contact") return "Contato";
  const q = currentQuestion(state);
  if (!q) return "";
  if (q.block === "qualif") return "Qualificação";
  return BLOCKS[q.block].short;
}

function headerCurrentStep(): number {
  if (state.screen === "contact") return totalStepsFn(state) - 1;
  if (state.screen === "result") return totalStepsFn(state);
  return Math.min(state.cursor, totalStepsFn(state) - 1);
}

function renderHeader(): string {
  /* Radar mini aparece a partir do diagnóstico em andamento e segue até o contact.
     Welcome e transition ficam idle (sem progresso, sem radar). */
  const showRadar =
    state.screen === "question" || state.screen === "contact";
  return Header({
    state,
    idle: state.screen === "welcome" || state.screen === "transition" || state.screen === "result",
    contextLabel: headerContextLabel(),
    totalSteps: totalStepsFn(state),
    currentStep: headerCurrentStep(),
    showRadar,
  });
}

/* ============== Body ============== */

function renderBody(): string {
  switch (state.screen) {
    case "welcome":
      return WelcomePage({
        resumable: hasResumable,
        name: state.name,
        nameValid: nameValid(state),
      });
    case "question": {
      const q = currentQuestion(state);
      if (!q) {
        state.screen = "contact";
        saveState(state);
        return ContactPage({
          name: state.name,
          phone: state.phone,
          email: state.email,
          phoneValid: phoneValid(state),
          emailValid: emailValid(state),
          allValid: contactValid(state),
        });
      }
      const a = state.answers[q.id];
      const selectedIndex =
        a && (a.kind === "score" || a.kind === "single" || a.kind === "qualify")
          ? a.optionIndex
          : undefined;
      const selectedIndexes =
        a && a.kind === "multi" ? a.selectedIndexes : [];
      return QuestionPage({
        question: q,
        currentIndex: state.cursor,
        totalSteps: totalStepsFn(state),
        selectedIndex,
        selectedIndexes,
      });
    }
    case "contact":
      return ContactPage({
        name: state.name,
        phone: state.phone,
        email: state.email,
        phoneValid: phoneValid(state),
        emailValid: emailValid(state),
        allValid: contactValid(state),
      });
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
  if (state.screen === "contact") onContactRendered();
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
    case "submit-contact": return goToTransition();
    case "cta-whatsapp":   return ctaWhatsApp();
    case "cta-raiox":      return ctaRaiox();
  }
}

/* ============== Welcome / boot actions ============== */

function startDiagnostic(): void {
  if (!nameValid(state)) {
    flagNameInvalid();
    return;
  }
  hasResumable = false;
  const keptName = state.name.trim();
  state = freshState();
  state.name = keptName;
  state.diagId = uuid();
  state.startedAt = new Date().toISOString();
  state.screen = "question";
  state.cursor = 0;
  resetRadarMiniState();
  saveState(state);
  // Persiste a sessão (fire-and-forget) e zera buffer local de respostas.
  resetLocalAnswers();
  if (state.diagId) {
    createSession(state.diagId, CONFIG.VERSION, bootContext || captureContext())
      .then(() => setSessionName(state.diagId!, keptName));
  }
  track("diagnostic_started", { name: keptName }, state.diagId);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function resumeDiagnostic(): void {
  hasResumable = false;
  state.screen = state.cursor >= visibleQuestions(state).length ? "contact" : "question";
  track("diag_resume", { step: state.cursor, diag_id: state.diagId }, state.diagId);
  render();
}
/* Recomeçar do zero: limpa estado e vai DIRETO à primeira pergunta.
   Sem passar pela tela intermediária "começar diagnóstico" outra vez. */
function discardAndStart(): void {
  const keptName = state.name.trim();
  clearState();
  hasResumable = false;
  state = freshState();
  state.name = keptName;
  state.diagId = uuid();
  state.startedAt = new Date().toISOString();
  state.screen = "question";
  state.cursor = 0;
  resetRadarMiniState();
  resetLocalAnswers();
  saveState(state);
  if (state.diagId) {
    createSession(state.diagId, CONFIG.VERSION, bootContext || captureContext())
      .then(() => setSessionName(state.diagId!, keptName));
  }
  track("diagnostic_restarted", {}, state.diagId);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function flagNameInvalid(): void {
  const input = document.getElementById("welcomeName") as HTMLInputElement | null;
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
  const chip = document.getElementById("cpScore");
  if (chip) chip.textContent = String(totalScore(state));
}

/* ============== Navegação ============== */

function nextStep(): void {
  if (state.screen !== "question") return;
  const list = visibleQuestions(state);
  const nextCursor = state.cursor + 1;
  if (nextCursor < list.length) {
    state.cursor = nextCursor;
  } else {
    state.cursor = list.length;
    state.screen = "contact";
  }
  saveState(state);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function prevStep(): void {
  if (state.screen === "contact") {
    const list = visibleQuestions(state);
    state.screen = "question";
    state.cursor = Math.max(0, list.length - 1);
  } else if (state.screen === "question" && state.cursor > 0) {
    state.cursor -= 1;
  } else {
    return;
  }
  saveState(state);
  track("diag_back", { diag_id: state.diagId }, state.diagId);
  render();
}

function goToTransition(): void {
  if (!contactValid(state)) return;
  state.finishedAt = new Date().toISOString();
  state.screen = "transition";
  saveState(state);
  // Persiste contato no Supabase, registra consentimento implícito (LGPD)
  // e marca a sessão como completa.
  if (state.diagId) {
    setSessionContact(state.diagId, state.name, state.email, state.phone);
    completeSession(state.diagId);
  }
  track(
    "contact_form_submitted",
    {
      phone_length: phoneDigitsOnly(state.phone).length,
      has_email: state.email.length > 0,
      diag_id: state.diagId,
    },
    state.diagId,
  );
  track("diagnostic_completed", { diag_id: state.diagId }, state.diagId);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============== Per-screen ============== */

function onQuestionRendered(): void {
  questionStartTime = Date.now();
}

/* Crossfade loop entre dois vídeos.
   Em vez do `loop` nativo (que dá um corte seco no fim), dois <video> ficam
   sobrepostos. Quando o ativo chega perto do fim, o próximo entra com fade,
   o ativo sai com fade, e os papéis se invertem. */
const VIDEO_CROSSFADE_MS = 700;
function setupWelcomeVideoLoop(): void {
  const a = document.getElementById("welcomeVideoA") as HTMLVideoElement | null;
  const b = document.getElementById("welcomeVideoB") as HTMLVideoElement | null;
  if (!a || !b) return;

  const safePlay = (v: HTMLVideoElement): void => {
    v.play().catch(() => {/* autoplay com áudio mudo é permitido; ignora falhas */});
  };

  let active: HTMLVideoElement = a;
  let standby: HTMLVideoElement = b;
  let swapping = false;

  const fadeS = VIDEO_CROSSFADE_MS / 1000;

  const onTime = (): void => {
    if (swapping) return;
    const dur = active.duration;
    if (!isFinite(dur) || dur <= 0) return;
    // Quando faltar menos que o tempo de fade, inicia o swap.
    if (active.currentTime >= dur - fadeS) {
      swapping = true;
      // Prepara o próximo: zera e dispara play antes de revelar.
      try { standby.currentTime = 0; } catch { /* alguns formatos exigem ready state */ }
      safePlay(standby);
      // Próximo frame: cruza a opacidade.
      requestAnimationFrame(() => {
        standby.classList.add("is-active");
        active.classList.remove("is-active");
      });
      // Ao terminar o fade, troca papéis e pausa o que saiu (economiza CPU).
      const oldActive = active;
      const newActive = standby;
      window.setTimeout(() => {
        try { oldActive.pause(); oldActive.currentTime = 0; } catch { /* ignore */ }
        active = newActive;
        standby = oldActive;
        swapping = false;
      }, VIDEO_CROSSFADE_MS);
    }
  };

  // Mesmo listener nos dois: cada um só dispara enquanto for o ativo.
  a.addEventListener("timeupdate", () => { if (active === a) onTime(); });
  b.addEventListener("timeupdate", () => { if (active === b) onTime(); });

  // Erro de carregamento: esconde os dois (revela fallback SVG).
  const onErr = (): void => {
    a.classList.remove("is-active");
    b.classList.remove("is-active");
  };
  a.addEventListener("error", onErr, { once: true });
  b.addEventListener("error", onErr, { once: true });

  // Garante muted antes de qualquer play (iOS exige).
  a.muted = true;
  b.muted = true;
  a.playsInline = true;
  b.playsInline = true;

  // Tenta tocar assim que possível (alguns iOS só topam depois de loadeddata).
  const tryStart = (): void => { safePlay(a); };
  tryStart();
  a.addEventListener("loadeddata", tryStart, { once: true });
  a.addEventListener("canplay", tryStart, { once: true });

  // Fallback: alguns navegadores mobile só liberam autoplay no primeiro
  // gesto do usuário. No toque/scroll inicial, força o play.
  const resumeOnGesture = (): void => {
    if (a.paused) safePlay(a);
    document.removeEventListener("touchstart", resumeOnGesture);
    document.removeEventListener("click", resumeOnGesture);
    document.removeEventListener("scroll", resumeOnGesture);
  };
  document.addEventListener("touchstart", resumeOnGesture, { passive: true, once: true });
  document.addEventListener("click", resumeOnGesture, { once: true });
  document.addEventListener("scroll", resumeOnGesture, { passive: true, once: true });
}

function onWelcomeRendered(): void {
  setupWelcomeVideoLoop();
  const input = document.getElementById("welcomeName") as HTMLInputElement | null;
  const btn = document.getElementById("btnStartDiag") as HTMLButtonElement | null;
  if (!input) return;
  const updateBtn = () => {
    const ok = nameValid(state);
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
    if (e.key === "Enter") {
      e.preventDefault();
      startDiagnostic();
    }
  });
  setTimeout(() => input.focus(), 200);
}

function onContactRendered(): void {
  const phoneEl = document.getElementById("phoneInput") as HTMLInputElement | null;
  const emailEl = document.getElementById("emailInput") as HTMLInputElement | null;
  const btn = document.getElementById("btnGoResult") as HTMLButtonElement | null;
  const updateBtn = () => {
    const ok = contactValid(state);
    if (ok) btn?.removeAttribute("disabled");
    else btn?.setAttribute("disabled", "");
    btn?.setAttribute("aria-disabled", ok ? "false" : "true");
  };
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
    phoneEl.addEventListener("blur", () => {
      if (phoneEl.value.length > 0 && !phoneValid(state)) {
        phoneEl.classList.add("is-invalid");
        phoneEl.setAttribute("aria-invalid", "true");
      }
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
    emailEl.addEventListener("blur", () => {
      if (emailEl.value.length > 0 && !emailValid(state)) {
        emailEl.classList.add("is-invalid");
        emailEl.setAttribute("aria-invalid", "true");
      }
    });
  }
  setTimeout(() => phoneEl?.focus(), 160);
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
  setTimeout(() => {
    document.querySelectorAll<HTMLElement>(".pillar-bar-fill").forEach((el) => {
      el.style.width = (el.dataset.target || "0") + "%";
    });
  }, 1900);
  saveResultToBackend();
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

async function saveResultToBackend(): Promise<void> {
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

  // ============== Persiste resultado consolidado na linha da sessão ==============
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

  // Sinaliza "Respostas registradas" no rodapé.
  const m = document.getElementById("saveMsg");
  if (m) m.textContent = "Respostas registradas";

  // ============== Edge function RD (best-effort, mantida) ==============
  // Frentista (papel = "outro") pontua só para comparação interna, sem MQL.
  // Pulamos o disparo da edge function nesse caso.
  const trilha = currentTrack(state);
  if (trilha !== "frentista") {
    const blockPctsObj: Record<string, number> = {};
    BLOCK_ORDER.forEach((b) => (blockPctsObj[b] = bs[b].pct));
    try {
      await fetch(CONFIG.SUPABASE_URL + CONFIG.RD_CONVERSION_FN, {
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
    } catch (e) {
      console.warn("RD conversion best-effort falhou:", e);
    }
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
  const { generateReportPdf } = await import("./lib/report");
  const content = buildReportContent(state);
  const blob = await generateReportPdf(content);
  const upload = await uploadReportPdf(state.diagId, blob);
  if (!upload) {
    await markReportFailed(state.diagId, "upload_failed");
    return;
  }
  await markReportGenerated(state.diagId, upload.path, upload.size);
}

/* ============== CTAs ============== */

function ctaWhatsApp(): void {
  const score = totalScore(state);
  track("specialist_cta_clicked", { score_total: score }, state.diagId);
  if (state.diagId) persistSpecialistCta(state.diagId, score);
  const firstName = state.name.trim().split(/\s+/)[0] || "tudo bem";
  const msg =
    `Olá, aqui é ${firstName}. Acabei de fazer o diagnóstico do ClubPetro e tirei nota ${score} de 100. ` +
    `Quero falar com um Especialista ClubPetro sobre o meu posto.`;
  const url = "https://wa.me/" + CONFIG.CLUBPETRO_WHATSAPP + "?text=" + encodeURIComponent(msg);
  window.open(url, "_blank", "noopener,noreferrer");
}

function ctaRaiox(): void {
  const score = totalScore(state);
  track("rayx_cta_clicked", { score_total: score, diag_id: state.diagId }, state.diagId);
  const start = nextTuesday19h();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  // Persiste agendamento direto na linha da sessão (colunas rayx_*).
  if (state.diagId) {
    persistRayxRequest(state.diagId, start.toISOString(), CONFIG.RAIOX_MEET_LINK);
  }
  const firstName = state.name.trim().split(/\s+/)[0] || "";
  const details =
    `Conversa aberta no Google Meet sobre o seu diagnóstico${firstName ? `, ${firstName}` : ""}. ` +
    `Discutimos os pontos de atenção que apareceram e o caminho prático pra evoluir a operação do seu posto.\\n\\n` +
    `Sua nota: ${score}/100. ` +
    `Você receberá o link do Meet no convite após confirmar o horário.`;
  const params = new URLSearchParams();
  params.append("action", "TEMPLATE");
  params.append("text", "RaioX do Posto, ClubPetro");
  params.append("details", details);
  params.append("location", CONFIG.RAIOX_MEET_LINK);
  params.append("dates", gcalDate(start) + "/" + gcalDate(end));
  /* Recorrência semanal toda terça. `dates` define a 1ª ocorrência,
     `recur` cuida da repetição. URLSearchParams faz o encode do ":" e "=". */
  params.append("recur", "RRULE:FREQ=WEEKLY;BYDAY=TU");
  /* Sinaliza ao Calendar pra anexar Google Meet automaticamente. */
  params.append("add", "Hangouts");
  /* Se o usuário forneceu e-mail, já adiciona como convidado, gerando convite real. */
  if (state.email && state.email.includes("@")) {
    params.append("add", state.email);
  }
  window.open(
    "https://calendar.google.com/calendar/render?" + params.toString(),
    "_blank",
    "noopener,noreferrer",
  );
}

/* Próxima terça-feira útil para o RaioX, calculada toda vez que o usuário
   clica em "Agendar raio-x".
   Regra:
   - Se hoje for terça antes das 19h, sugere ainda a terça de hoje.
   - Se hoje for terça mas já passou das 19h, pula para a próxima terça.
   - Em qualquer outro dia, pula para a terça mais próxima no futuro. */
function nextTuesday19h(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 dom, 2 ter
  const isTuesday = day === 2;
  const beforeCutoff = now.getHours() < 19;
  let offset: number;
  if (isTuesday && beforeCutoff) {
    offset = 0;
  } else if (isTuesday) {
    offset = 7;
  } else {
    offset = (2 - day + 7) % 7;
    if (offset === 0) offset = 7;
  }
  const target = new Date(now);
  target.setDate(now.getDate() + offset);
  target.setHours(19, 0, 0, 0);
  return target;
}
function gcalDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    "00Z"
  );
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
    if ((state.screen as string) === "phone") state.screen = "contact";
    state.screen = "welcome";
    hasResumable = true;
  }
  window.addEventListener("pagehide", () => {
    if (state.screen === "result" || state.screen === "welcome") return;
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
