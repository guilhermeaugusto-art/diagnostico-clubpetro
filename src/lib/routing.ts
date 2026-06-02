/* Payload de roteamento para o time comercial (Seção 7 da spec).
   - Nota e faixa
   - Frente mais fraca
   - Resposta de Z2 (o que quer resolver primeiro)
   - Prontidão: X3 (crítico) ou Y2 (avançado)
   - Mensagem de abordagem sugerida, escrita como resolução de um problema do posto,
     dentro das regras de copy da Seção 1.
*/

import type { AppState } from "./state";
import { totalScore, rankedBlocks, collectGaps } from "./scoring";
import { levelFor, type Level } from "../data/levels";
import { BLOCKS, type BlockId } from "../data/blocks";

export interface RoutingPayload {
  score: number;
  level: { name: string; tagline: string };
  weakestBlock: { id: BlockId; name: string; pct: number } | null;
  z2: string | null;
  readiness: { id: "X3" | "Y2"; value: string } | null;
  signal: AppState["signal"];
  gaps: string[];
  approachMessage: string;
}

export function buildRoutingPayload(state: AppState): RoutingPayload {
  const score = totalScore(state);
  const level = levelFor(score);
  const ranked = rankedBlocks(state);
  const weakest = ranked[0]
    ? { id: ranked[0].id, name: ranked[0].name, pct: ranked[0].pct }
    : null;

  const z2 = state.answers.Z2?.kind === "qualify" ? state.answers.Z2.value : null;

  let readiness: RoutingPayload["readiness"] = null;
  if (state.answers.X3?.kind === "qualify") {
    readiness = { id: "X3", value: state.answers.X3.value };
  } else if (state.answers.Y2?.kind === "qualify") {
    readiness = { id: "Y2", value: state.answers.Y2.value };
  }

  return {
    score,
    level: { name: level.name, tagline: level.tagline },
    weakestBlock: weakest,
    z2,
    readiness,
    signal: state.signal,
    gaps: collectGaps(state).map((g) => g.questionId),
    approachMessage: approachMessage(state, score, level, weakest, z2, readiness),
  };
}

/* --- Geração da mensagem de abordagem -----------------------------------
   A mensagem é direta, na voz de quem resolve, sem venda crua, sem travessão,
   sem emoji, sem nome de bandeira. */
function approachMessage(
  _state: AppState,
  score: number,
  level: Level,
  weakest: RoutingPayload["weakestBlock"],
  z2: string | null,
  readiness: RoutingPayload["readiness"],
): string {
  const frenteFraca = weakest ? BLOCKS[weakest.id].name.toLowerCase() : "a frente mais fraca";
  const z2Texto = z2Map(z2);
  const urg = readinessText(readiness);

  return [
    `Nota ${score} de 100 na faixa "${level.name}".`,
    `Onde mais aperta hoje: ${frenteFraca}.`,
    z2Texto ? `O dono já disse que quer resolver primeiro ${z2Texto}.` : null,
    urg,
    `Próximo passo sugerido: ${level.hook}`,
  ]
    .filter(Boolean)
    .join(" ");
}

function z2Map(v: string | null): string | null {
  switch (v) {
    case "margem":      return "margem e lucro";
    case "equipe":      return "equipe e atendimento";
    case "fidelizar":   return "fidelizar e reter cliente";
    case "loja":        return "loja e serviços";
    case "dados":       return "dados e gestão";
    default:            return null;
  }
}

function readinessText(r: RoutingPayload["readiness"]): string | null {
  if (!r) return null;
  if (r.id === "X3") {
    if (r.value === "sim") return "Sinalizou que quer testar um caminho de resolução nos próximos 30 dias.";
    if (r.value === "talvez") return "Sinalizou interesse condicional, depende de ver o caminho.";
    if (r.value === "nao") return "Sinalizou que agora não é o momento, segue como nutrição.";
  }
  if (r.id === "Y2") {
    if (r.value === "sim") return "Sinalizou plano de crescer ou abrir mais postos nos próximos 12 meses.";
    if (r.value === "talvez") return "Aberto a expandir se a oportunidade aparecer.";
    if (r.value === "nao") return "Foco em melhorar o que já tem, sem plano de expansão.";
  }
  return null;
}
