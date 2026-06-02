import { escHtml } from "../lib/format";
import { Icons, type IconName } from "../lib/icons";

interface AnswerCardProps {
  index: number;
  label: string;
  desc: string;
  icon: IconName;
  selected: boolean;
  multi?: boolean; // se true, opera como checkbox; se false, radio.
}

export function AnswerCard(p: AnswerCardProps): string {
  const cls = p.selected ? "answer-card is-selected" : "answer-card";
  const desc = p.desc
    ? `<span class="answer-desc">${escHtml(p.desc)}</span>`
    : "";
  const role = p.multi ? "checkbox" : "radio";
  const checkedAttr = p.multi ? "aria-checked" : "aria-checked";
  return `
    <button class="${cls}"
            type="button"
            role="${role}"
            ${checkedAttr}="${p.selected ? "true" : "false"}"
            data-option="${p.index}"
            data-multi="${p.multi ? "1" : "0"}">
      <span class="answer-icon" aria-hidden="true">${Icons[p.icon]}</span>
      <span class="answer-body">
        <span class="answer-title">${escHtml(p.label)}</span>
        ${desc}
      </span>
      <span class="answer-check" aria-hidden="true">${Icons.check}</span>
    </button>
  `;
}
