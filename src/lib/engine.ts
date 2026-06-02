/* Motor adaptativo do diagnóstico.
   - Constrói o leitor de respostas (ReadAnswers) que as condicionais usam.
   - Decide a próxima pergunta visível a partir do cursor.
   - Calcula o sinal CRÍTICO/NEUTRO/AVANÇADO depois das 5 primeiras pontuadas. */

import {
  QUESTIONS,
  QUESTION_ORDER,
  SIGNAL_CHECKPOINT_IDS,
  getQuestionById,
  type Question,
  type ReadAnswers,
} from "../data/questions";
import type { AppState, SignalTier } from "./state";

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
  };
}

/* --- Sinal -------------------------------------------------------------- */

/* Após as 5 primeiras pontuadas (C1, F1, D1, R1, C4), calcula:
   - percentual provisório do bloco-âncora (sobre o máximo possível das 5)
   - número de respostas vermelhas (pts == 0) entre essas 5
   CRÍTICO se pct provisório <= 30 OU 3+ respostas vermelhas
   AVANÇADO se pct provisório >= 75 e 0 vermelhas
   NEUTRO caso contrário. */
export function computeSignal(state: AppState): SignalTier {
  let earned = 0;
  let max = 0;
  let reds = 0;
  for (const id of SIGNAL_CHECKPOINT_IDS) {
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
  return SIGNAL_CHECKPOINT_IDS.every((id) => !!state.answers[id]);
}

/* --- Trilha de perguntas ----------------------------------------------- */

/* Lista de perguntas visíveis, considerando condicionais e sinal corrente. */
export function visibleQuestions(state: AppState): Question[] {
  const read = makeReader(state);
  const list: Question[] = [];
  for (const id of QUESTION_ORDER) {
    const q = getQuestionById(id);
    if (!q) continue;
    if (q.condition && !q.condition(read)) continue;
    list.push(q);
  }
  return list;
}

/* Pergunta atual baseada no cursor: percorre a trilha e devolve a primeira
   ainda não respondida a partir do cursor. */
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
  return questionnaireLength(state) + 1; // +1 para a etapa de telefone
}
