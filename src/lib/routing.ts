/* Payload de roteamento para o time comercial.
   - Nota e faixa
   - Frente mais fraca
   - Resposta da pergunta de dor (Z2-equivalente da trilha)
   - Prontidão (X3 equivalente, só dono)
   - Mensagem de abordagem sugerida.
*/

import type { AppState } from "./state";
import { totalScore, rankedBlocks, collectGaps } from "./scoring";
import { levelFor, type Level } from "../data/levels";
import { BLOCKS, type BlockId } from "../data/blocks";
import {
  PAIN_QUESTION_ID_BY_TRACK,
  READINESS_QUESTION_ID_BY_TRACK,
} from "../data/questions";
import { currentTrack } from "./engine";

export interface RoutingPayload {
  score: number;
  level: { name: string; tagline: string };
  weakestBlock: { id: BlockId; name: string; pct: number } | null;
  z2: string | null;
  readiness: { id: string; value: string } | null;
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

  const track = currentTrack(state);
  const painId = track ? PAIN_QUESTION_ID_BY_TRACK[track] : null;
  const painAns = painId ? state.answers[painId] : undefined;
  const z2 = painAns && (painAns.kind === "qualify" || painAns.kind === "single")
    ? painAns.value
    : null;

  let readiness: RoutingPayload["readiness"] = null;
  const readyId = track ? READINESS_QUESTION_ID_BY_TRACK[track] : null;
  if (readyId) {
    const ra = state.answers[readyId];
    if (ra && (ra.kind === "qualify" || ra.kind === "single")) {
      readiness = { id: readyId, value: ra.value };
    }
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
    z2Texto ? `Sinalizou como prioridade ${z2Texto}.` : null,
    urg,
    `Próximo passo sugerido: ${level.path}`,
    `Como o ClubPetro entra: ${level.clubpetroFit}`,
  ]
    .filter(Boolean)
    .join(" ");
}

function z2Map(v: string | null): string | null {
  switch (v) {
    case "margem":         return "margem e lucro";
    case "equipe":         return "equipe e operação";
    case "fidelizar":      return "fidelizar e reter cliente";
    case "loja":           return "loja e serviços";
    case "dados":          return "dados e gestão";
    case "concorrencia":   return "concorrência e preço";
    case "padrao":         return "padronização do atendimento";
    case "equipamento":    return "equipamento e estrutura";
    case "treinamento":    return "treinamento da equipe";
    case "reconhecimento": return "reconhecimento por meta";
    default:               return null;
  }
}

function readinessText(r: RoutingPayload["readiness"]): string | null {
  if (!r) return null;
  if (r.value === "sim") return "Sinalizou que quer testar um caminho de resolução nos próximos 30 dias.";
  if (r.value === "talvez") return "Sinalizou interesse condicional, depende de ver o caminho.";
  if (r.value === "nao") return "Sinalizou que agora não é o momento, segue como nutrição.";
  return null;
}
