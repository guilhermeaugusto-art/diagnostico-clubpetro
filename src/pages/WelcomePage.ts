import { BLOCKS, BLOCK_ORDER } from "../data/blocks";
import { Button } from "../components/Button";
import { escHtml } from "../lib/format";

interface WelcomePageProps {
  resumable: boolean;
  resumeAtIndex: number;
}

export function WelcomePage(p: WelcomePageProps): string {
  const pillars = BLOCK_ORDER
    .map((b) => `<span class="welcome-pillar-chip">${escHtml(BLOCKS[b].short)}</span>`)
    .join("");

  /* Aplicação da regra 2.2: um único primário por viewport.
     Resumable => banner com "Continuar" (primary) + "Começar de novo" (ghost),
     CTA principal "Começar diagnóstico" some.
     Sem sessão => banner some, CTA principal aparece. */
  const ctaArea = p.resumable
    ? `
      <div class="welcome-resume anim-rise delay-2" role="status">
        <div class="welcome-resume-body">
          <span class="welcome-resume-l">Diagnóstico em andamento</span>
          <p class="welcome-resume-t">Você já começou. Pode retomar de onde parou.</p>
        </div>
        <div class="welcome-resume-actions">
          ${Button({
            variant: "primary",
            size: "lg",
            label: "Continuar de onde parei",
            iconRight: "arrow",
            dataAction: "resume",
          })}
          ${Button({
            variant: "ghost",
            label: "Começar de novo",
            dataAction: "discard",
          })}
        </div>
      </div>
    `
    : `
      <div class="welcome-cta-row anim-rise delay-3">
        ${Button({
          variant: "primary",
          size: "lg",
          label: "Começar diagnóstico",
          iconRight: "arrow",
          dataAction: "start",
        })}
        <span class="welcome-hint">Sem login, sem cadastro</span>
      </div>
    `;

  return `
    <div class="shell stage">
      <section class="welcome">
        <div class="welcome-main">
          <span class="eyebrow anim-rise delay-0">Diagnóstico de saúde do posto</span>
          <h1 class="display anim-rise delay-1">
            Qual a <span class="ink-accent">saúde</span> do seu posto?
          </h1>
          <p class="lede measure anim-rise delay-2">
            Em poucos minutos, uma nota de 0 a 100 sobre a operação do seu posto,
            em seis frentes que decidem o resultado.
          </p>
          ${ctaArea}
        </div>

        <aside class="welcome-visual anim-pop delay-2" aria-label="Frentes analisadas">
          <span class="eyebrow on-dark">Análise em seis frentes</span>
          <h2 class="welcome-visual-title">Onde o seu posto ganha e onde sangra.</h2>
          <div class="welcome-pillars">${pillars}</div>
          <div class="welcome-stats">
            <div class="welcome-stat">
              <span class="welcome-stat-l">Tempo</span>
              <span class="welcome-stat-v">4 min</span>
            </div>
            <div class="welcome-stat">
              <span class="welcome-stat-l">Frentes</span>
              <span class="welcome-stat-v">06</span>
            </div>
            <div class="welcome-stat">
              <span class="welcome-stat-l">Nota</span>
              <span class="welcome-stat-v">0 a 100</span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  `;
}
