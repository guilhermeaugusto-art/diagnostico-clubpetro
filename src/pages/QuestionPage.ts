import { BLOCKS } from "../data/blocks";
import type { Question } from "../data/questions";
import { AnswerCard } from "../components/AnswerCard";
import { Button } from "../components/Button";
import { escHtml, pad2 } from "../lib/format";
import { Icons, type IconName } from "../lib/icons";

interface QuestionPageProps {
  question: Question;
  currentIndex: number;
  totalSteps: number;
  selectedIndex?: number;       // para single / score / qualify
  selectedIndexes?: number[];   // para segmentation-multi
}

/* Ícones padrão por categoria de opção: usamos um ícone temático
   por dimensão para todas as opções da pergunta, mantendo a estética
   coerente sem inventar ícone por opção. */
const ICONS_BY_BLOCK: Record<string, IconName> = {
  pessoas:     "team",
  marca:       "badge",
  comercial:   "coin",
  fidelizacao: "heart",
  dados:       "dashboard",
  resiliencia: "shield",
  qualif:      "target",
};

function iconForOption(blockKey: string, idx: number): IconName {
  // Pequena variação por ordem para diferenciar visualmente as opções
  const base = ICONS_BY_BLOCK[blockKey] ?? "info";
  if (idx === 1) return base === "team" ? "stars" :
                       base === "coin" ? "trendUp" :
                       base === "heart" ? "stars" :
                       base === "dashboard" ? "chart" :
                       base === "shield" ? "check" :
                       base === "badge" ? "stars" :
                       "info";
  if (idx === 2) return base === "team" ? "repeat" :
                       base === "coin" ? "scale" :
                       base === "heart" ? "repeat" :
                       base === "dashboard" ? "cogs" :
                       base === "shield" ? "scale" :
                       base === "badge" ? "scale" :
                       "scale";
  if (idx === 3) return base === "team" ? "alert" :
                       base === "coin" ? "alert" :
                       base === "heart" ? "alert" :
                       base === "dashboard" ? "alert" :
                       base === "shield" ? "alert" :
                       base === "badge" ? "alert" :
                       "alert";
  return base;
}

export function QuestionPage(p: QuestionPageProps): string {
  const q = p.question;
  const blockKey = q.block;
  const blockName = blockKey === "qualif"
    ? "Qualificação"
    : BLOCKS[blockKey].name;

  // Rótulo de peso/tipo na meta line
  const weightLabel = q.type === "score"
    ? `Vale ${q.max} pts`
    : q.type === "segmentation-multi"
      ? "Marque todas que se aplicam"
      : "Não pontua, ajuda a guiar";

  const opts = q.options
    .map((opt: any, i: number) => {
      const isMulti = q.type === "segmentation-multi";
      const selected = isMulti
        ? (p.selectedIndexes || []).includes(i)
        : p.selectedIndex === i;
      return AnswerCard({
        index: i,
        label: opt.label,
        desc: opt.desc,
        icon: iconForOption(blockKey, i),
        selected,
        multi: isMulti,
      });
    })
    .join("");

  const context = q.context
    ? `<p class="q-context anim-fade delay-2">${escHtml(q.context)}</p>`
    : "";

  // Tipo de pergunta determina o footer:
  // - score: avança sozinho ao escolher (sem botão "continuar")
  // - segmentation-single / qualify: também avança sozinho
  // - segmentation-multi: precisa do botão "Continuar" porque é multi-resposta
  const showContinue = q.type === "segmentation-multi";
  const continueDisabled = !(p.selectedIndexes && p.selectedIndexes.length > 0);

  const continueBtn = showContinue
    ? Button({
        variant: "primary",
        size: "md",
        label: "Continuar",
        iconRight: "arrow",
        dataAction: "advance-multi",
        id: "btnAdvanceMulti",
        disabled: continueDisabled,
      })
    : "";

  const grouping = q.type === "segmentation-multi" ? "checkbox" : "radio";

  return `
    <div class="shell stage">
      <section class="question">
        <div class="q-meta anim-fade">
          <span class="q-step-tag">
            <b>${pad2(p.currentIndex + 1)}</b> / ${pad2(p.totalSteps)}
          </span>
          <span class="q-pillar-tag">${escHtml(blockName)} · ${escHtml(weightLabel)}</span>
        </div>
        <h2 class="q-title anim-rise delay-1">${q.text}</h2>
        ${context}
        <div class="answer-grid anim-fade delay-3"
             role="${grouping === "checkbox" ? "group" : "radiogroup"}"
             aria-label="Alternativas">
          ${opts}
        </div>
        <div class="q-nav">
          ${Button({
            variant: "ghost",
            label: "Voltar",
            iconLeft: "arrowBack",
            dataAction: "back",
            disabled: p.currentIndex === 0,
          })}
          ${continueBtn}
        </div>
      </section>
    </div>
  `;
}
