import { escHtml } from "../lib/format";
import { Icons } from "../lib/icons";
import { renderIcon, type AnyIcon } from "../lib/renderIcon";

interface RecommendationCardProps {
  title: string;
  desc: string;
  icon: AnyIcon;
  impact: string;
  priority?: boolean;
  delayMs: number;
}

export function RecommendationCard(p: RecommendationCardProps): string {
  const cls = p.priority ? "rec-card is-priority" : "rec-card";
  return `
    <article class="${cls} anim-rise" style="animation-delay:${p.delayMs}ms;">
      <header class="rec-card-head">
        <span class="rec-card-icon" aria-hidden="true">${renderIcon(p.icon, { sizeClass: "icon-png rec-icon-png" })}</span>
        <span class="rec-card-tag">Pode aplicar agora</span>
      </header>
      <h3 class="rec-card-title">${escHtml(p.title)}</h3>
      <p class="rec-card-desc">${escHtml(p.desc)}</p>
      <span class="rec-card-impact">${Icons.trendUp}${escHtml(p.impact)}</span>
    </article>
  `;
}
