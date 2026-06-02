import { escHtml } from "../lib/format";
import { renderIcon, type AnyIcon } from "../lib/renderIcon";

interface PillarCardProps {
  name: string;
  pct: number;
  insight: string;
  icon: AnyIcon;
  delayMs: number;
}

export function PillarCard(p: PillarCardProps): string {
  return `
    <article class="pillar-card anim-rise" style="animation-delay:${p.delayMs}ms;">
      <header class="pillar-card-head">
        <span class="pillar-card-icon" aria-hidden="true">${renderIcon(p.icon, { sizeClass: "icon-png pillar-icon-png" })}</span>
        <h3 class="pillar-card-name">${escHtml(p.name)}</h3>
        <span class="pillar-card-score">${p.pct}<small>/100</small></span>
      </header>
      <div class="pillar-bar" aria-hidden="true">
        <span class="pillar-bar-fill" data-target="${p.pct}"></span>
      </div>
      <p class="pillar-card-insight">${escHtml(p.insight)}</p>
    </article>
  `;
}
