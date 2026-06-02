/* Radar mini do header.
   Anima entre o estado anterior e o atual usando SMIL (<animate>), de modo
   que a troca entre perguntas evolui o gráfico de forma fluida em vez de
   pular seco. O estado anterior é guardado em memória do módulo. */

import { BLOCK_ORDER, type BlockId } from "../data/blocks";
import { blockScores } from "../lib/scoring";
import type { AppState } from "../lib/state";

interface RadarMiniProps {
  state: AppState;
  size?: number;
}

/* Último estado renderizado, guardado por módulo, para animar de "antes → agora". */
let lastPctsMini: Record<BlockId, number> | null = null;

export function RadarMini({ state, size = 108 }: RadarMiniProps): string {
  const bs = blockScores(state);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.40;
  const n = BLOCK_ORDER.length;
  const angles = Array.from({ length: n }, (_, i) => (-Math.PI / 2) + (i * 2 * Math.PI) / n);

  const ringPoints = (factor: number) =>
    angles.map((a) => {
      const x = cx + r * factor * Math.cos(a);
      const y = cy + r * factor * Math.sin(a);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");

  const axes = angles.map((a) => {
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" />`;
  }).join("");

  const currPcts: Record<BlockId, number> = Object.fromEntries(
    BLOCK_ORDER.map((b) => [b, bs[b].pct]),
  ) as Record<BlockId, number>;

  const prevPcts = lastPctsMini ?? currPcts;

  const buildPoints = (src: Record<BlockId, number>) =>
    BLOCK_ORDER.map((b, i) => {
      const a = angles[i];
      const v = Math.max(0.06, (src[b] || 0) / 100);
      const x = cx + r * v * Math.cos(a);
      const y = cy + r * v * Math.sin(a);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");

  const prevShape = buildPoints(prevPcts);
  const currShape = buildPoints(currPcts);
  const shouldAnimate = prevShape !== currShape;

  const dots = BLOCK_ORDER.map((b, i) => {
    const a = angles[i];
    const vPrev = Math.max(0.06, (prevPcts[b] || 0) / 100);
    const vCurr = Math.max(0.06, (currPcts[b] || 0) / 100);
    const cxNow = (cx + r * vCurr * Math.cos(a)).toFixed(2);
    const cyNow = (cy + r * vCurr * Math.sin(a)).toFixed(2);
    if (!shouldAnimate) {
      return `<circle cx="${cxNow}" cy="${cyNow}" r="2.4" class="radar-dot" />`;
    }
    const cxFrom = (cx + r * vPrev * Math.cos(a)).toFixed(2);
    const cyFrom = (cy + r * vPrev * Math.sin(a)).toFixed(2);
    return `
      <circle cx="${cxNow}" cy="${cyNow}" r="2.4" class="radar-dot">
        <animate attributeName="cx" from="${cxFrom}" to="${cxNow}" dur="600ms" begin="0s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" />
        <animate attributeName="cy" from="${cyFrom}" to="${cyNow}" dur="600ms" begin="0s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" />
      </circle>
    `;
  }).join("");

  const shapeAnimate = shouldAnimate
    ? `<animate attributeName="points" from="${prevShape}" to="${currShape}" dur="600ms" begin="0s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" />`
    : "";

  /* Persistir o estado atual após gerar o HTML, para a próxima render
     usar este como "anterior". */
  lastPctsMini = currPcts;

  return `
    <div class="radar-mini" aria-label="Leitura provisória das frentes" role="img">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <g class="radar-grid">
          <polygon points="${ringPoints(1)}" />
          <polygon points="${ringPoints(0.66)}" />
          <polygon points="${ringPoints(0.33)}" />
          ${axes}
        </g>
        <polygon class="radar-shape" points="${currShape}">
          ${shapeAnimate}
        </polygon>
        ${dots}
      </svg>
      <span class="radar-mini-label">Saúde do posto</span>
    </div>
  `;
}

/* Reset do estado interno: chamar ao iniciar/reiniciar um novo diagnóstico. */
export function resetRadarMiniState(): void {
  lastPctsMini = null;
}
