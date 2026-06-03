/* Radar chart do resultado.
   ViewBox retangular gera margem suficiente pros labels mais longos
   ("Resiliência", "Comercial", "Fidelização") ficarem inteiros, e o valor
   numérico fica em LINHA SEPARADA fora do nome — nunca sobreposto. */

import { BLOCKS, BLOCK_ORDER, type BlockId } from "../data/blocks";
import { blockScores } from "../lib/scoring";
import type { AppState } from "../lib/state";

interface RadarChartProps {
  state: AppState;
  width?: number;
  /* "paper" remove o glow e usa rótulos em tinta; "dark" mantém o legado. */
  theme?: "paper" | "dark";
}

/* Ordem VISUAL dos vértices (não toca em dados nem pontuação): Fidelização
   ancorada no topo, porque é a alavanca da ClubPetro. O resto segue no
   sentido horário. Cada vértice continua usando o pct do seu próprio bloco. */
const RADAR_ORDER: BlockId[] = [
  "fidelizacao", "resiliencia", "dados", "comercial", "marca", "pessoas",
];

export function RadarChart({ state, width = 480, theme = "paper" }: RadarChartProps): string {
  const bs = blockScores(state);
  /* ViewBox proporcional, generoso o suficiente para acomodar os labels
     externos sem cortar. Padding interno = labelGap. */
  const vbW = width;
  const vbH = Math.round(width * 0.95);
  const cx = vbW / 2;
  const cy = vbH / 2;
  /* Raio menor que cy/2 deixa espaço pra labels + valores. */
  const r = Math.min(vbW, vbH) * 0.30;
  const order = RADAR_ORDER.length === BLOCK_ORDER.length ? RADAR_ORDER : BLOCK_ORDER;
  const n = order.length;
  const angles = Array.from({ length: n }, (_, i) => (-Math.PI / 2) + (i * 2 * Math.PI) / n);

  const ringPolygon = (factor: number) =>
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

  const dataPoints = order.map((b, i) => {
    const a = angles[i];
    const v = Math.max(0.04, (bs[b].pct || 0) / 100);
    const x = cx + r * v * Math.cos(a);
    const y = cy + r * v * Math.sin(a);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  const dots = order.map((b, i) => {
    const a = angles[i];
    const v = Math.max(0.04, (bs[b].pct || 0) / 100);
    const x = cx + r * v * Math.cos(a);
    const y = cy + r * v * Math.sin(a);
    const lead = b === "fidelizacao" ? " radar-dot-lead" : "";
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.5" class="radar-dot${lead}" />`;
  }).join("");

  /* Labels com nome + valor em linhas SEPARADAS, posicionados radialmente:
     - vértices superiores: empilham para cima (nome em cima, valor embaixo)
     - vértices inferiores: empilham para baixo (nome em cima, valor embaixo)
     - vértices laterais: alinhados ao lado, valor logo abaixo
     A separação vertical mínima (16px) garante zero sobreposição. */
  const labelGap = Math.max(28, r * 0.36);
  const labels = order.map((b, i) => {
    const a = angles[i];
    const lx = cx + (r + labelGap) * Math.cos(a);
    const ly = cy + (r + labelGap) * Math.sin(a);
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);

    const anchor =
      Math.abs(cosA) < 0.25 ? "middle"
        : cosA > 0 ? "start" : "end";

    /* Nome em cima, valor em baixo. Quando o vértice está no topo do radar,
       o conjunto inteiro sobe (nome -8, valor +8); quando está embaixo, desce
       (nome +0, valor +18). Lados ficam centralizados em altura. */
    let nameDy = 0;
    let valueDy = 18;
    let baseline: string = "middle";
    if (sinA < -0.5) {
      baseline = "auto";
      nameDy = -10;
      valueDy = 8;
    } else if (sinA > 0.5) {
      baseline = "hanging";
      nameDy = 0;
      valueDy = 18;
    }

    const lead = b === "fidelizacao" ? " radar-label-lead" : "";
    return `
      <text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}"
            text-anchor="${anchor}" dominant-baseline="${baseline}"
            class="radar-label${lead}" dy="${nameDy}">${BLOCKS[b].short}</text>
      <text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}"
            text-anchor="${anchor}" dominant-baseline="${baseline}"
            class="radar-label-val" dy="${valueDy}">${bs[b].pct}</text>
    `;
  }).join("");

  return `
    <div class="radar-chart radar-chart--${theme}" aria-label="Gráfico de radar das seis frentes" role="img">
      <svg viewBox="0 0 ${vbW} ${vbH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <g class="radar-grid">
          <polygon points="${ringPolygon(1)}" />
          <polygon points="${ringPolygon(0.66)}" />
          <polygon points="${ringPolygon(0.33)}" />
          ${axes}
        </g>
        <polygon class="radar-shape" points="${dataPoints}" />
        ${dots}
        ${labels}
      </svg>
    </div>
  `;
}
