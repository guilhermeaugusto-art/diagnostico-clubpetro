import { escHtml } from "../lib/format";
import { Icons, type IconName } from "../lib/icons";

interface LockedCardProps {
  title: string;     // partially visible
  desc: string;      // will be blurred
  icon: IconName;
  tag: string;       // "Oportunidade adicional" / "Próxima melhoria"
  delayMs: number;
}

export function LockedCard(p: LockedCardProps): string {
  return `
    <article class="rec-card is-locked anim-rise" style="animation-delay:${p.delayMs}ms;" aria-hidden="false">
      <span class="rec-card-lock-ribbon">
        ${Icons.lock}
        <span>${escHtml(p.tag)}</span>
      </span>
      <header class="rec-card-head">
        <span class="rec-card-icon" aria-hidden="true">${Icons[p.icon]}</span>
        <span class="rec-card-tag">Análise complementar</span>
      </header>
      <h3 class="rec-card-title">${escHtml(p.title)}</h3>
      <p class="rec-card-desc">${escHtml(p.desc)}</p>
    </article>
  `;
}
