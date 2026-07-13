/* Escala de urgência por score.
   Cada faixa traz uma cor primária pro destaque e uma palavra-chave de status
   pra ficar coerente com a copy (o key também vai pro banco em urgency_tone). */

export interface UrgencyTone {
  key: "critical" | "warning" | "attention" | "healthy" | "strong";
  accent: string;       // hex do destaque (número do score, chips)
  statusLabel: string;  // texto curto, ex: "Atenção imediata"
}

export const URGENCY_TONES: UrgencyTone[] = [
  { key: "critical",  accent: "#D32F1A", statusLabel: "Atenção imediata" },
  { key: "warning",   accent: "#E2541B", statusLabel: "Pontos críticos" },
  { key: "attention", accent: "#F08A1C", statusLabel: "Evolução parcial" },
  { key: "healthy",   accent: "#1F8A5C", statusLabel: "Operação madura" },
  { key: "strong",    accent: "#0E7D4E", statusLabel: "Operação consolidada" },
];

/* Limiares alinhados às faixas de LEVELS (0-30 / 31-60 / 61-80) e ao teto
   real de pontuação (80, recalibrado em 13/07/2026), para que status e faixa
   nunca se contradigam. Os cinco tons ficam alcançáveis: "strong" pede 75+,
   que só sai com base ponderada perto de 90 (frentes altas e equilibradas). */
export function urgencyFor(score: number): UrgencyTone {
  if (score <= 30) return URGENCY_TONES[0];
  if (score <= 50) return URGENCY_TONES[1];
  if (score <= 60) return URGENCY_TONES[2];
  if (score <= 74) return URGENCY_TONES[3];
  return URGENCY_TONES[4];
}
