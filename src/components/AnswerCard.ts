import { escHtml } from "../lib/format";
import { Icons } from "../lib/icons";

interface AnswerCardProps {
  index: number;
  label: string;
  desc: string;
  selected: boolean;
  multi?: boolean;    // checkbox vs radio
  image?: string;     // ilustração da opção (variante bento da tela de papel)
  imageFocus?: string; // ponto da ilustração a manter no quadro (object-position)
  featured?: boolean; // card destaque do bento (ocupa a largura toda)
}

/* Card de resposta sem ícone: título + descrição + indicador de seleção.
   A carga visual do ícone foi removida (não ajudava a decisão e pesava na
   leitura no celular). A hierarquia agora é só texto, com o card inteiro como
   área de toque. Exceção: a tela de papel (S1) usa a variante bento, com a
   ilustração da trilha no card (RULES 4.2). */
export function AnswerCard(p: AnswerCardProps): string {
  const classes = ["answer-card"];
  if (p.image) classes.push("answer-card-bento");
  if (p.featured) classes.push("is-featured");
  if (p.selected) classes.push("is-selected");
  const desc = p.desc
    ? `<span class="answer-desc">${escHtml(p.desc)}</span>`
    : "";
  const focus = p.imageFocus ? ` style="--img-focus:${escHtml(p.imageFocus)}"` : "";
  const media = p.image
    ? `<span class="answer-media" aria-hidden="true"${focus}><img src="${escHtml(p.image)}" alt="" decoding="async"></span>`
    : "";
  const role = p.multi ? "checkbox" : "radio";
  return `
    <button class="${classes.join(" ")}"
            type="button"
            role="${role}"
            aria-checked="${p.selected ? "true" : "false"}"
            data-option="${p.index}"
            data-multi="${p.multi ? "1" : "0"}">
      ${media}
      <span class="answer-body">
        <span class="answer-title">${escHtml(p.label)}</span>
        ${desc}
      </span>
      <span class="answer-check" aria-hidden="true">${Icons.check}</span>
    </button>
  `;
}
