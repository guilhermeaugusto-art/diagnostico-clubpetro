/* Gráfico de barras por pilar exibido DURANTE as respostas, no lugar do radar.
   Regras:
   - mostra o nome de cada pilar, nunca o número/pontuação;
   - o comprimento de cada barra reflete o score normalizado por pilar que o
     motor já calcula (blockScores), só sem exibir o valor;
   - a animação (subir/descer) é feita no app.ts ao marcar/trocar a resposta,
     via transição CSS na variável --v de cada preenchimento.
   Visual editorial: papel e tinta, laranja da marca, sem glow. */

import { BLOCK_ORDER, BLOCKS } from "../data/blocks";
import { blockScores } from "../lib/scoring";
import { currentQuestion } from "../lib/engine";
import type { AppState } from "../lib/state";

export function BarsProgress(state: AppState): string {
  const bs = blockScores(state);
  // Pilar da pergunta atual: fica destacado para a pessoa entender qual barra
  // será afetada pela resposta (qualif não pontua, então não destaca nada).
  const q = currentQuestion(state);
  const active = q && q.block !== "qualif" ? q.block : null;

  // Só os pilares que a trilha realmente pontua: evita barra sempre zerada
  // (ex.: a trilha do frentista não tem pergunta do pilar "dados").
  const items = BLOCK_ORDER.filter((b) => (bs[b]?.possible ?? 0) > 0).map((b) => {
    const v = Math.max(0, Math.min(100, bs[b].pct || 0));
    const cls = b === active ? "bars-item is-active" : "bars-item";
    return `
      <div class="${cls}" data-block="${b}">
        <div class="bars-track">
          <div class="bars-fill" data-block="${b}" data-target="${v}" style="--v:${v}%"></div>
        </div>
        <span class="bars-name">${BLOCKS[b].short}</span>
      </div>`;
  }).join("");

  return `
    <div class="bars-chart anim-fade" id="barsChart" role="img" aria-label="Leitura provisória das frentes do posto">
      <span class="bars-eyebrow">Saúde do posto</span>
      <div class="bars-grid">${items}</div>
    </div>`;
}
