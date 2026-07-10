import { BLOCKS } from "../data/blocks";
import type { Question } from "../data/questions";
import { AnswerCard } from "../components/AnswerCard";
import { Button } from "../components/Button";
import { escHtml, pad2, applyForms } from "../lib/format";

interface QuestionPageProps {
  question: Question;
  currentIndex: number;
  totalSteps: number;
  selectedIndex?: number;       // para single / score / qualify
  selectedIndexes?: number[];   // para segmentation-multi
  openText?: string;            // para perguntas type: "open"
  plural?: boolean;             // dois ou mais postos: liga o plural no texto
  barsHtml?: string;            // gráfico de barras por pilar (durante as respostas)
}

/* Barra de progresso do quiz: fina, sempre visível no topo da pergunta.
   Mostra o quanto já foi respondido sem número, só o preenchimento. */
function progressBar(currentIndex: number, totalSteps: number): string {
  const pct = Math.max(0, Math.min(100, Math.round((currentIndex / Math.max(1, totalSteps)) * 100)));
  return `
    <div class="q-progress" role="progressbar"
         aria-valuemin="0" aria-valuemax="${totalSteps}" aria-valuenow="${currentIndex}"
         aria-label="Progresso do diagnóstico">
      <span class="q-progress-fill" style="width:${pct}%"></span>
    </div>`;
}

/* Linha de estímulo à conclusão: muda conforme o avanço pra a pessoa sentir que
   está perto do resultado e querer terminar. Só status, sem expor pontuação. */
function progressHint(currentIndex: number, totalSteps: number): string {
  const remaining = Math.max(0, totalSteps - currentIndex - 1);
  const f = totalSteps > 0 ? currentIndex / totalSteps : 0;
  let text: string;
  if (remaining === 0) text = "Última pergunta pra ver seu resultado.";
  else if (f >= 0.66) text = "Falta pouco pra ver seu resultado.";
  else if (f >= 0.33) text = "Você já passou da metade.";
  else text = "Leva poucos minutos pra ver seu resultado.";
  const near = f >= 0.66 ? " is-near" : "";
  return `<p class="q-progress-hint${near}">${text}</p>`;
}

/* Envolve o conteúdo da pergunta no palco: coluna única centralizada.
   As artes laterais das trilhas (vídeo/imagem) foram removidas do desktop,
   o foco é a pergunta. */
function frameStage(inner: string): string {
  return `
    <div class="shell stage">
      ${inner}
    </div>
  `;
}

export function QuestionPage(p: QuestionPageProps): string {
  const q = p.question;
  const blockKey = q.block;
  const blockName = blockKey === "qualif"
    ? "Qualificação"
    : BLOCKS[blockKey].name;

  // Pergunta de texto aberto (frentista): layout próprio com textarea.
  if (q.type === "open") {
    return renderOpenQuestion(p, blockName);
  }

  const pl = p.plural === true;

  // Rótulo do tipo na meta line. NUNCA expor pontuação para não induzir
  // o usuário a marcar a alternativa "vencedora".
  const metaLabel = q.type === "segmentation-multi"
    ? "Marque todas que se aplicam"
    : "Resposta única";

  // Opções com ilustração (tela de papel, S1) viram a grade bento.
  const isBento = q.options.some((opt: any) => !!opt.image);

  const opts = q.options
    .map((opt: any, i: number) => {
      const isMulti = q.type === "segmentation-multi";
      const selected = isMulti
        ? (p.selectedIndexes || []).includes(i)
        : p.selectedIndex === i;
      return AnswerCard({
        index: i,
        label: applyForms(opt.label, pl),
        desc: applyForms(opt.desc ?? "", pl),
        selected,
        multi: isMulti,
        image: opt.image,
        imageFocus: opt.imageFocus,
        featured: !!opt.featured,
      });
    })
    .join("");

  const context = q.context
    ? `<p class="q-context">${applyForms(escHtml(q.context), pl)}</p>`
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

  const inner = `
      <section class="question${isBento ? " question-bento" : ""}">
        ${progressBar(p.currentIndex, p.totalSteps)}
        ${progressHint(p.currentIndex, p.totalSteps)}
        <div class="q-meta">
          <span class="q-step-tag">
            <b>${pad2(p.currentIndex + 1)}</b> / ${pad2(p.totalSteps)}
          </span>
          <span class="q-pillar-tag">${escHtml(blockName)} · ${escHtml(metaLabel)}</span>
        </div>
        <h2 class="q-title">${applyForms(q.text, pl)}</h2>
        ${context}
        <div class="answer-grid${isBento ? " answer-grid-bento" : ""}"
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
  `;
  return frameStage(inner);
}

/* Pergunta de texto aberto: enunciado + textarea + Continuar.
   Não pontua; serve de leitura qualitativa (trilha do frentista). */
function renderOpenQuestion(p: QuestionPageProps, blockName: string): string {
  const q = p.question;
  const pl = p.plural === true;
  const placeholder = "placeholder" in q && q.placeholder ? q.placeholder : "Escreva com as suas palavras.";
  const context = q.context
    ? `<p class="q-context">${applyForms(escHtml(q.context), pl)}</p>`
    : "";
  const inner = `
      <section class="question">
        ${progressBar(p.currentIndex, p.totalSteps)}
        ${progressHint(p.currentIndex, p.totalSteps)}
        <div class="q-meta">
          <span class="q-step-tag">
            <b>${pad2(p.currentIndex + 1)}</b> / ${pad2(p.totalSteps)}
          </span>
          <span class="q-pillar-tag">${escHtml(blockName)} · Resposta aberta</span>
        </div>
        <h2 class="q-title">${applyForms(q.text, pl)}</h2>
        ${context}
        <div class="open-wrap">
          <textarea
            id="openInput"
            class="open-input"
            rows="4"
            maxlength="600"
            placeholder="${escHtml(placeholder)}"
          >${escHtml(p.openText || "")}</textarea>
        </div>
        <div class="q-nav">
          ${Button({
            variant: "ghost",
            label: "Voltar",
            iconLeft: "arrowBack",
            dataAction: "back",
            disabled: p.currentIndex === 0,
          })}
          ${Button({
            variant: "primary",
            size: "md",
            label: "Continuar",
            iconRight: "arrow",
            dataAction: "advance-open",
            id: "btnAdvanceOpen",
          })}
        </div>
      </section>
  `;
  return frameStage(inner);
}
