/* Cálculo da nota normalizada por perfil + leitura por bloco.
   nota = (pontos obtidos / pontos possíveis do perfil) * 100, arredondado.
   "Perfil" = perguntas score visíveis para esse respondente. */

import { BLOCKS, BLOCK_ORDER, type BlockId } from "../data/blocks";
import { type ScoreQuestion } from "../data/questions";
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

/* Nota final 0-100, calibrada para postos de combustíveis brasileiros.
   Regra de calibração:
   1) Média ponderada das frentes (pesos da spec).
   2) Penalidade global por dispersão: postos com frentes muito desiguais sofrem
      desconto, porque desbalanço = risco real na operação.
   3) Curva de teto: a partir de 62 a nota cresce com retorno decrescente, para
      que acima de 70 só saia quando praticamente todas as frentes estão altas
      e equilibradas (base ponderada precisa passar de ~76).
   4) Penalidade por respostas vagas (sinaliza falta de gestão).
   Objetivo (recalibrado em 13/07/2026, notas estavam saindo altas): a maioria
   fica na casa dos 50-60, e o teto duro é 80 (topo da faixa mais alta). */
export function totalScore(state: AppState): number {
  const bs = blockScores(state);
  let weighted = 0;
  let weightSum = 0;
  const pcts: number[] = [];

  for (const id of BLOCK_ORDER) {
    const block = BLOCKS[id];
    if (bs[id].possible === 0) continue;
    weighted += bs[id].pct * block.weight;
    weightSum += block.weight;
    pcts.push(bs[id].pct);
  }
  if (weightSum === 0) return 0;
  const base = weighted / weightSum;

  const mean = pcts.reduce((s, v) => s + v, 0) / pcts.length;
  const variance = pcts.reduce((s, v) => s + (v - mean) ** 2, 0) / pcts.length;
  const stdev = Math.sqrt(variance);
  const dispersionPenalty = Math.min(8, stdev * 0.18);

  const vagueCount = collectGaps(state).filter((g) => g.reason === "vague").length;
  const vaguePenalty = Math.min(6, vagueCount * 1.5);

  let calibrated = base - dispersionPenalty - vaguePenalty;

  if (calibrated > 62) {
    const over = calibrated - 62;
    calibrated = 62 + Math.pow(over, 0.78);
  }
  if (calibrated > 80) calibrated = 80;
  if (calibrated < 0) calibrated = 0;

  return Math.round(calibrated);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function emailValid(state: AppState): boolean {
  return EMAIL_RE.test(state.email.trim());
}
export function nameValid(state: AppState): boolean {
  return state.name.trim().length >= 2;
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
  /* Itera apenas sobre as perguntas score visíveis do perfil (mesma fonte de
     blockScores). Assim respostas órfãs de uma trilha abandonada (quando o
     respondente volta ao S1 e troca o papel) não inflam a penalidade nem
     poluem routing.gaps. Em um fluxo legítimo o resultado é idêntico. */
  const visible = visibleQuestions(state).filter(
    (q): q is ScoreQuestion => q.type === "score"
  );
  const gaps: Gap[] = [];
  for (const q of visible) {
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
