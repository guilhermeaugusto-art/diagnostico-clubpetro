import "./styles/index.css";

import { CONFIG } from "./lib/config";
import { BLOCKS, BLOCK_ORDER } from "./data/blocks";
import {
  QUESTIONS,
  SIGNAL_CHECKPOINT_IDS,
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
  collectGaps,
} from "./lib/scoring";
import {
  computeSignal,
  allCheckpointAnswered,
  currentQuestion,
  visibleQuestions,
  totalSteps as totalStepsFn,
} from "./lib/engine";
import { buildRoutingPayload } from "./lib/routing";
import { getSupabase } from "./lib/supabase";
import { track } from "./lib/tracking";
import { uuid, maskPhone, phoneDigitsOnly } from "./lib/format";

import { Header } from "./components/Header";
import { WelcomePage } from "./pages/WelcomePage";
import { QuestionPage } from "./pages/QuestionPage";
import { PhonePage } from "./pages/PhonePage";
import { TransitionPage } from "./pages/TransitionPage";
import { ResultPage } from "./pages/ResultPage";

let state: AppState = freshState();
let hasResumable = false;
let questionStartTime = 0;
let transitionTimer: number | null = null;

const root = () => document.getElementById("app")!;

/* ============== Header context ============== */

function headerContextLabel(): string {
  if (state.screen === "welcome") return CONFIG.VERSION;
  if (state.screen === "transition") return "Calculando";
  if (state.screen === "result") return "Resultado";
  if (state.screen === "phone") return "Final";
  const q = currentQuestion(state);
  if (!q) return "Qualif.";
  if (q.block === "qualif") return "Qualif.";
  return BLOCKS[q.block].short;
}

function headerCurrentStep(): number {
  if (state.screen === "phone") return totalStepsFn(state) - 1;
  if (state.screen === "result") return totalStepsFn(state);
  return Math.min(state.cursor, totalStepsFn(state) - 1);
}

function renderHeader(): string {
  return Header({
    idle: state.screen === "welcome" || state.screen === "transition",
    contextLabel: headerContextLabel(),
    totalSteps: totalStepsFn(state),
    currentStep: headerCurrentStep(),
    score: totalScore(state),
  });
}

/* ============== Body ============== */

function renderBody(): string {
  switch (state.screen) {
    case "welcome":
      return WelcomePage({ resumable: hasResumable, resumeAtIndex: state.cursor });
    case "question": {
      const q = currentQuestion(state);
      if (!q) {
        // sem mais perguntas, vai para telefone
        state.screen = "phone";
        saveState(state);
        return PhonePage({ phone: state.phone, valid: phoneValid(state) });
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
    case "phone":
      return PhonePage({ phone: state.phone, valid: phoneValid(state) });
    case "transition":
      return TransitionPage();
    case "result":
      return ResultPage(state);
  }
}

function render(): void {
  root().innerHTML = renderHeader() + renderBody();
  if (state.screen === "question") onQuestionRendered();
  if (state.screen === "phone") onPhoneRendered();
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
    case "discard":        return discardResume();
    case "back":           return prevStep();
    case "advance-multi":  return advanceFromMulti();
    case "submit-phone":   return goToTransition();
    case "cta-whatsapp":   return ctaWhatsApp();
    case "cta-raiox":      return ctaRaiox();
  }
}

/* ============== Welcome / boot actions ============== */

function startDiagnostic(): void {
  hasResumable = false;
  state = freshState();
  state.diagId = uuid();
  state.startedAt = new Date().toISOString();
  state.screen = "question";
  state.cursor = 0;
  saveState(state);
  track("diag_start", { diag_id: state.diagId });
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function resumeDiagnostic(): void {
  hasResumable = false;
  state.screen = state.cursor >= visibleQuestions(state).length ? "phone" : "question";
  track("diag_resume", { step: state.cursor, diag_id: state.diagId }, state.diagId);
  render();
}
function discardResume(): void {
  clearState();
  hasResumable = false;
  state = freshState();
  render();
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
    "diag_answer",
    {
      question_id: q.id,
      type: q.type,
      time_on_question: dt,
      diag_id: state.diagId,
    },
    state.diagId,
  );

  // Se todas as perguntas do checkpoint foram respondidas e ainda não calculamos o sinal,
  // calcula agora. Isso pode "abrir" os blocos de aprofundamento via visibleQuestions().
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
    state.screen = "phone";
  }
  saveState(state);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function prevStep(): void {
  if (state.screen === "phone") {
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
  if (!phoneValid(state)) return;
  state.finishedAt = new Date().toISOString();
  state.screen = "transition";
  saveState(state);
  track(
    "diag_phone_submit",
    { phone_length: phoneDigitsOnly(state.phone).length, diag_id: state.diagId },
    state.diagId,
  );
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============== Per-screen ============== */

function onQuestionRendered(): void {
  questionStartTime = Date.now();
}

function onPhoneRendered(): void {
  const input = document.getElementById("phoneInput") as HTMLInputElement | null;
  const btn = document.getElementById("btnGoResult") as HTMLButtonElement | null;
  if (!input) return;
  input.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    t.value = maskPhone(t.value);
    state.phone = t.value;
    saveState(state);
    const ok = phoneValid(state);
    if (ok) btn?.removeAttribute("disabled");
    else btn?.setAttribute("disabled", "");
    btn?.setAttribute("aria-disabled", ok ? "false" : "true");
    input.classList.remove("is-invalid");
    input.setAttribute("aria-invalid", "false");
  });
  input.addEventListener("blur", () => {
    if (input.value.length > 0 && !phoneValid(state)) {
      input.classList.add("is-invalid");
      input.setAttribute("aria-invalid", "true");
    }
  });
  setTimeout(() => input.focus(), 160);
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
  const gaps = collectGaps(state);

  const respostasLabels: Record<string, string | null> = {};
  QUESTIONS.forEach((q) => {
    const a = state.answers[q.id];
    if (!a) {
      respostasLabels[q.id] = null;
    } else if (a.kind === "multi") {
      respostasLabels[q.id] = a.labels.join(" | ");
    } else {
      respostasLabels[q.id] = a.label;
    }
  });

  const blockPctsObj: Record<string, number> = {};
  BLOCK_ORDER.forEach((b) => (blockPctsObj[b] = bs[b].pct));

  const respostas = {
    answers: respostasLabels,
    block_scores: blockPctsObj,
    signal: state.signal,
    gaps: gaps.map((g) => g.questionId),
    weakest_block: ranked[0]?.id ?? null,
    z2: state.answers.Z2?.kind === "qualify" ? state.answers.Z2.value : null,
    readiness: routing.readiness,
    diag_id: state.diagId,
    started_at: state.startedAt,
    finished_at: state.finishedAt,
    version: CONFIG.VERSION,
    approach_message: routing.approachMessage,
  };
  const payload = {
    nome: null,
    telefone: state.phone || null,
    score,
    nivel: lvl.name,
    papel:
      state.answers.S1?.kind === "single" ||
      state.answers.S1?.kind === "qualify"
        ? state.answers.S1.value
        : null,
    conhece:
      state.answers.Z1?.kind === "qualify" ? state.answers.Z1.value : null,
    interesse:
      state.answers.Z2?.kind === "qualify" ? state.answers.Z2.value : null,
    respostas,
  };

  track(
    "diag_view_result",
    { score_total: score, nivel: lvl.name, signal: state.signal, diag_id: state.diagId },
    state.diagId,
  );

  const client = getSupabase();
  if (!client) {
    console.warn("Supabase indisponível, resultado não salvo.");
  } else {
    try {
      const { error } = await client.from("diagnostico_respostas").insert(payload);
      if (error) {
        console.error("Erro ao salvar:", error);
      } else {
        const m = document.getElementById("saveMsg");
        if (m) m.textContent = "Respostas registradas";
      }
    } catch (e) {
      console.error("Falha no salvamento:", e);
    }
  }

  try {
    await fetch(CONFIG.SUPABASE_URL + CONFIG.RD_CONVERSION_FN, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + CONFIG.SUPABASE_ANON_KEY,
        apikey: CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        telefone: state.phone,
        score_total: score,
        nivel: lvl.name,
        dimensao_fraca: ranked[0]?.id ?? null,
        sinal: state.signal,
        z2: payload.interesse,
        readiness: routing.readiness,
        block_scores: blockPctsObj,
        diag_id: state.diagId,
        approach_message: routing.approachMessage,
      }),
      keepalive: true,
    });
  } catch (e) {
    console.warn("RD conversion best-effort falhou:", e);
  }
}

/* ============== CTAs ============== */

function ctaWhatsApp(): void {
  const score = totalScore(state);
  track("diag_cta_comercial", { score_total: score, diag_id: state.diagId }, state.diagId);
  const msg =
    `Oi, acabei de fazer o diagnóstico do ClubPetro e tirei nota ${score} de 100. ` +
    `Quero falar com um Especialista ClubPetro sobre o meu posto.`;
  const url = "https://wa.me/" + CONFIG.CLUBPETRO_WHATSAPP + "?text=" + encodeURIComponent(msg);
  window.open(url, "_blank", "noopener,noreferrer");
}

function ctaRaiox(): void {
  const score = totalScore(state);
  track("diag_cta_raiox", { score_total: score, diag_id: state.diagId }, state.diagId);
  const start = nextTuesday19h();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "RaioX do Posto, ClubPetro",
    details:
      "Conversa aberta no Meet sobre as dores que apareceram no seu diagnóstico de saúde do posto.",
    location: CONFIG.RAIOX_MEET_LINK,
    dates: gcalDate(start) + "/" + gcalDate(end),
  });
  window.open(
    "https://calendar.google.com/calendar/render?" + params.toString(),
    "_blank",
    "noopener,noreferrer",
  );
}

function nextTuesday19h(): Date {
  const d = new Date();
  const offset = (2 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + offset);
  d.setHours(19, 0, 0, 0);
  return d;
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
  const saved = loadState();
  if (saved && (Object.keys(saved.answers || {}).length > 0 || (saved.cursor || 0) > 0)) {
    state = { ...freshState(), ...saved };
    state.screen = "welcome";
    hasResumable = true;
  }
  window.addEventListener("pagehide", () => {
    if (state.screen === "result" || state.screen === "welcome") return;
    const elapsed = state.startedAt
      ? Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000)
      : 0;
    track(
      "diag_abandon",
      {
        last_screen: state.screen,
        last_cursor: state.cursor,
        time_total: elapsed,
        diag_id: state.diagId,
      },
      state.diagId,
    );
  });
  track("diag_view_intro", {});
  bindGlobalActions();
  render();
}
