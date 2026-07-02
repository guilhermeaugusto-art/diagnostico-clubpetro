import { escHtml } from "../lib/format";
import { Icons } from "../lib/icons";

interface AnswerCardProps {
  index: number;
  label: string;
  desc: string;
  selected: boolean;
  multi?: boolean; // checkbox vs radio
}

/* Card de resposta sem ícone: título + descrição + indicador de seleção.
   A carga visual do ícone foi removida (não ajudava a decisão e pesava na
   leitura no celular). A hierarquia agora é só texto, com o card inteiro como
   área de toque. */
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
      <span class="answer-body">
        <span class="answer-title">${escHtml(p.label)}</span>
        ${desc}
      </span>
      <span class="answer-check" aria-hidden="true">${Icons.check}</span>
    </button>
  `;
}
