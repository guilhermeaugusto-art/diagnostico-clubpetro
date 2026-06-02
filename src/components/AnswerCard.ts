import { escHtml } from "../lib/format";
import { Icons } from "../lib/icons";
import { renderIcon, type AnyIcon } from "../lib/renderIcon";

interface AnswerCardProps {
  index: number;
  label: string;
  desc: string;
  icon: AnyIcon;
  selected: boolean;
  multi?: boolean; // checkbox vs radio
}

export function AnswerCard(p: AnswerCardProps): string {
  const cls = p.selected ? "answer-card is-selected" : "answer-card";
  const desc = p.desc
    ? `<span class="answer-desc">${escHtml(p.desc)}</span>`
    : "";
  const role = p.multi ? "checkbox" : "radio";
  return `
    <button class="${cls}"
            type="button"
            role="${role}"
            aria-checked="${p.selected ? "true" : "false"}"
            data-option="${p.index}"
            data-multi="${p.multi ? "1" : "0"}">
      <span class="answer-icon" aria-hidden="true">${renderIcon(p.icon, { sizeClass: "icon-png answer-icon-png" })}</span>
      <span class="answer-body">
        <span class="answer-title">${escHtml(p.label)}</span>
        ${desc}
      </span>
      <span class="answer-check" aria-hidden="true">${Icons.check}</span>
    </button>
  `;
}
