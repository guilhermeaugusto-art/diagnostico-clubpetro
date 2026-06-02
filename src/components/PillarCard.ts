import { escHtml } from "../lib/format";
import { Icons, type IconName } from "../lib/icons";

interface PillarCardProps {
  name: string;
  pct: number;
  insight: string;
  icon: IconName;
  delayMs: number;
}

export function PillarCard(p: PillarCardProps): string {
  return `
    <article class="pillar-card anim-rise" style="animation-delay:${p.delayMs}ms;">
      <header class="pillar-card-head">
        <span class="pillar-card-icon" aria-hidden="true">${Icons[p.icon]}</span>
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
