/* Escala de urgência por score.
   Cada faixa traz um tom (classe CSS) e uma cor primária pro destaque,
   além de uma palavra-chave de status pra ficar coerente com a copy. */

export interface UrgencyTone {
  key: "critical" | "warning" | "attention" | "healthy" | "strong";
  cssClass: string;
  accent: string;       // hex do destaque (número do score, chips)
  glow: string;         // rgba do glow do card principal
  statusLabel: string;  // texto curto, ex: "Atenção imediata"
}

export const URGENCY_TONES: UrgencyTone[] = [
  {
    key: "critical",
    cssClass: "urgency-critical",
    accent: "#D32F1A",
    glow: "rgba(211, 47, 26, 0.32)",
    statusLabel: "Atenção imediata",
  },
  {
    key: "warning",
    cssClass: "urgency-warning",
    accent: "#E2541B",
    glow: "rgba(226, 84, 27, 0.30)",
    statusLabel: "Pontos críticos",
  },
  {
    key: "attention",
    cssClass: "urgency-attention",
    accent: "#F08A1C",
    glow: "rgba(240, 138, 28, 0.28)",
    statusLabel: "Evolução parcial",
  },
  {
    key: "healthy",
    cssClass: "urgency-healthy",
    accent: "#1F8A5C",
    glow: "rgba(31, 138, 92, 0.24)",
    statusLabel: "Operação madura",
  },
  {
    key: "strong",
    cssClass: "urgency-strong",
    accent: "#0E7D4E",
    glow: "rgba(14, 125, 78, 0.26)",
    statusLabel: "Operação consolidada",
  },
];

/* Limiares alinhados às faixas de LEVELS (0-30 / 31-60 / 61-80) e ao teto
   real de pontuação (85), para que status e faixa nunca se contradigam.
   Os cinco tons ficam alcançáveis: 81-85 chega a "strong". */
export function urgencyFor(score: number): UrgencyTone {
  if (score <= 30) return URGENCY_TONES[0];
  if (score <= 50) return URGENCY_TONES[1];
  if (score <= 60) return URGENCY_TONES[2];
  if (score <= 80) return URGENCY_TONES[3];
  return URGENCY_TONES[4];
}
