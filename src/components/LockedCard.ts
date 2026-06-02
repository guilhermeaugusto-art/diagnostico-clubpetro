import { escHtml } from "../lib/format";
import { Icons } from "../lib/icons";
import { renderIcon, type AnyIcon } from "../lib/renderIcon";

interface LockedCardProps {
  title: string;
  desc: string;
  icon: AnyIcon;
  tag: string;
  delayMs: number;
}

/* "Próxima melhoria" travada com selo lateral + botão Descobrir. */
export function LockedCard(p: LockedCardProps): string {
  return `
    <article class="rec-card is-locked anim-rise" style="animation-delay:${p.delayMs}ms;" aria-hidden="false">
      <span class="rec-card-lock-ribbon">
        ${Icons.lock}
        <span>${escHtml(p.tag)}</span>
      </span>
      <header class="rec-card-head">
        <span class="rec-card-icon" aria-hidden="true">${renderIcon(p.icon, { sizeClass: "icon-png rec-icon-png" })}</span>
        <span class="rec-card-tag">Análise complementar</span>
      </header>
      <h3 class="rec-card-title">${escHtml(p.title)}</h3>
      <p class="rec-card-desc">${escHtml(p.desc)}</p>
      <div class="rec-card-actions">
        <button class="btn-discover" type="button" data-action="cta-raiox">
          <span>Descobrir próxima melhoria</span>
          <span class="btn-arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  `;
}
