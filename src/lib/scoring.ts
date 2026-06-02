/* Cálculo da nota normalizada por perfil + leitura por bloco.
   nota = (pontos obtidos / pontos possíveis do perfil) * 100, arredondado.
   "Perfil" = perguntas score visíveis para esse respondente. */

import { BLOCKS, BLOCK_ORDER, type BlockId } from "../data/blocks";
import { QUESTIONS, type ScoreQuestion } from "../data/questions";
import { visibleQuestions } from "./engine";
import type { AppState } from "./state";
import { phoneDigitsOnly } from "./format";

interface BlockScore {
  earned: number;        // pontos somados nas perguntas score do bloco
  possible: number;      // pontos máximos das perguntas score visíveis do bloco
  pct: number;           // percentual normalizado
}

export function blockScores(state: AppState): Record<BlockId, BlockScore> {
  const visible = visibleQuestions(state).filter(
    (q): q is ScoreQuestion => q.type === "score"
  );
  const acc: Record<BlockId, BlockScore> = Object.fromEntries(
    BLOCK_ORDER.map((b) => [b, { earned: 0, possible: 0, pct: 0 }])
  ) as Record<BlockId, BlockScore>;

  for (const q of visible) {
    if (q.block === "qualif") continue;
    const a = state.answers[q.id];
    acc[q.block].possible += q.max;
    if (a && a.kind === "score") acc[q.block].earned += a.pts;
  }
  BLOCK_ORDER.forEach((b) => {
    const e = acc[b];
    e.pct = e.possible > 0 ? Math.round((e.earned / e.possible) * 100) : 0;
  });
  return acc;
}

/* Nota final 0-100, ponderada pelos pesos das frentes da spec. */
export function totalScore(state: AppState): number {
  const bs = blockScores(state);
  let weighted = 0;
  let weightSum = 0;
  for (const id of BLOCK_ORDER) {
    const block = BLOCKS[id];
    if (bs[id].possible === 0) continue;
    weighted += bs[id].pct * block.weight;
    weightSum += block.weight;
  }
  if (weightSum === 0) return 0;
  return Math.round(weighted / weightSum);
}

/* Frentes ordenadas da mais fraca para a mais forte. */
export function rankedBlocks(state: AppState): {
  id: BlockId; name: string; pct: number; weight: number; possible: number;
}[] {
  const bs = blockScores(state);
  return BLOCK_ORDER
    .map((b) => ({
      id: b,
      name: BLOCKS[b].name,
      pct: bs[b].pct,
      weight: BLOCKS[b].weight,
      possible: bs[b].possible,
    }))
    .filter((x) => x.possible > 0)
    .sort((a, b) => a.pct - b.pct);
}

export function weakBlockIds(state: AppState, n: number): BlockId[] {
  return rankedBlocks(state).slice(0, n).map((x) => x.id);
}

/* Lacunas: respostas marcadas como vague + frentes sem nenhuma resposta score. */
export interface Gap {
  questionId: string;
  reason: "vague" | "unmeasured";
}
export function collectGaps(state: AppState): Gap[] {
  const gaps: Gap[] = [];
  for (const q of QUESTIONS) {
    if (q.type !== "score") continue;
    const a = state.answers[q.id];
    if (a && a.kind === "score" && a.vague) {
      gaps.push({ questionId: q.id, reason: "vague" });
    }
  }
  return gaps;
}

/* Telefone */
export function phoneValid(state: AppState): boolean {
  return phoneDigitsOnly(state.phone).length >= 10;
}
