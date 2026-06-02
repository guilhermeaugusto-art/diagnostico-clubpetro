/* Motor adaptativo do diagnóstico.
   - Constrói o leitor de respostas (ReadAnswers) usado pelas condicionais.
   - Determina a trilha (dono/gerente/frentista) a partir de S1.
   - Decide a próxima pergunta visível a partir do cursor.
   - Calcula o sinal CRÍTICO/NEUTRO/AVANÇADO depois das 5 primeiras pontuadas
     da trilha em curso. */

import {
  QUESTIONS,
  QUESTION_ORDER_BY_TRACK,
  SIGNAL_CHECKPOINT_IDS_BY_TRACK,
  trackFromS1Value,
  getQuestionById,
  type Question,
  type ReadAnswers,
  type TrackId,
} from "../data/questions";
import type { AppState, SignalTier } from "./state";

/* --- Trilha ------------------------------------------------------------- */

export function currentTrack(state: AppState): TrackId | null {
  const a = state.answers.S1;
  if (!a) return null;
  if (a.kind === "single" || a.kind === "qualify") {
    return trackFromS1Value(a.value);
  }
  return null;
}

/* --- Leitor de respostas ----------------------------------------------- */
export function makeReader(state: AppState): ReadAnswers {
  return {
    single: (id) => {
      const a = state.answers[id];
      if (!a) return null;
      if (a.kind === "single" || a.kind === "qualify") return a.value;
      return null;
    },
    multi: (id) => {
      const a = state.answers[id];
      if (!a) return [];
      if (a.kind === "multi") return a.values;
      return [];
    },
    score: (id) => {
      const a = state.answers[id];
      if (!a || a.kind !== "score") return null;
      return { value: a.value, pts: a.pts };
    },
    signal: () => state.signal,
    track: () => currentTrack(state),
  };
}

/* --- Sinal -------------------------------------------------------------- */

function checkpointIdsFor(state: AppState): string[] {
  const t = currentTrack(state);
  return t ? SIGNAL_CHECKPOINT_IDS_BY_TRACK[t] : [];
}

export function computeSignal(state: AppState): SignalTier {
  let earned = 0;
  let max = 0;
  let reds = 0;
  for (const id of checkpointIdsFor(state)) {
    const q = getQuestionById(id);
    const a = state.answers[id];
    if (!q || q.type !== "score" || !a || a.kind !== "score") continue;
    earned += a.pts;
    max += q.max;
    if (a.pts === 0) reds += 1;
  }
  const pct = max > 0 ? (earned / max) * 100 : 0;
  if (pct <= 30 || reds >= 3) return "critico";
  if (pct >= 75 && reds === 0) return "avancado";
  return "neutro";
}

export function allCheckpointAnswered(state: AppState): boolean {
  const ids = checkpointIdsFor(state);
  if (ids.length === 0) return false;
  return ids.every((id) => !!state.answers[id]);
}

/* --- Trilha de perguntas ----------------------------------------------- */

/* Lista de perguntas visíveis, considerando trilha, condicionais e sinal.
   Antes de S1 ser respondida, mostra só S1.
   Depois de S1, anexa as perguntas da trilha selecionada. */
export function visibleQuestions(state: AppState): Question[] {
  const list: Question[] = [];
  const s1 = getQuestionById("S1");
  if (s1) list.push(s1);

  const track = currentTrack(state);
  if (!track) return list;

  const read = makeReader(state);
  const order = QUESTION_ORDER_BY_TRACK[track];
  for (const id of order) {
    const q = getQuestionById(id);
    if (!q) continue;
    if (q.tracks && !q.tracks.includes(track)) continue;
    if (q.condition && !q.condition(read)) continue;
    list.push(q);
  }
  return list;
}

/* Pergunta atual baseada no cursor. */
export function currentQuestion(state: AppState): Question | null {
  const list = visibleQuestions(state);
  if (state.cursor >= list.length) return null;
  return list[state.cursor];
}

export function questionnaireLength(state: AppState): number {
  return visibleQuestions(state).length;
}

/* O passo de "telefone" entra como última etapa visualmente, após as perguntas. */
export function totalSteps(state: AppState): number {
  return questionnaireLength(state) + 1;
}
