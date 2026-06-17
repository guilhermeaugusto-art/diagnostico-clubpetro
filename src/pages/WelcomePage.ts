import { Button } from "../components/Button";
import { escHtml } from "../lib/format";

interface WelcomePageProps {
  resumable: boolean;
  name: string;
  nameValid: boolean;
}

/* Tela inicial:
   - Coluna esquerda: copy consultiva + campo nome obrigatório + CTA primário.
   - Coluna direita: vídeo em loop como elemento visual principal, sem moldura.
   - Banner de retomada substitui o CTA quando há sessão.
   - Removido: aside escuro com chips das frentes, qualquer menção a "sem login". */
export function WelcomePage(p: WelcomePageProps): string {
  const ctaArea = p.resumable
    ? `
      <div class="welcome-resume anim-rise delay-2" role="status">
        <div class="welcome-resume-body">
          <span class="welcome-resume-l">Diagnóstico em andamento</span>
          <p class="welcome-resume-t">Você já começou. Pode retomar de onde parou ou recomeçar do zero.</p>
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
            label: "Recomeçar do zero",
            dataAction: "discard",
          })}
        </div>
      </div>
    `
    : `
      <form class="welcome-form anim-rise delay-3" novalidate>
        <label class="welcome-field" for="welcomeName">
          <span class="welcome-field-label">Para começarmos, como podemos te chamar?</span>
          <input
            id="welcomeName"
            class="welcome-field-input"
            type="text"
            autocomplete="given-name"
            inputmode="text"
            maxlength="60"
            placeholder="Seu nome"
            aria-invalid="false"
            value="${escHtml(p.name)}"
          >
        </label>
        <div class="welcome-cta-row">
          ${Button({
            variant: "primary",
            size: "lg",
            label: "Iniciar diagnóstico",
            iconRight: "arrow",
            dataAction: "start",
            id: "btnStartDiag",
            disabled: !p.nameValid,
          })}
        </div>
      </form>
    `;

  return `
    <div class="shell stage">
      <section class="welcome">
        <div class="welcome-main">
          <span class="eyebrow anim-rise delay-0">Diagnóstico de saúde do posto</span>
          <h1 class="display anim-rise delay-1">
            Entenda a <span class="ink-accent">saúde</span> do seu posto.
          </h1>
          <p class="lede measure anim-rise delay-2">
            Em poucos minutos, um Raio X do seu posto: onde o lucro está vazando
            hoje, o que rende mais mexer primeiro, e por onde começar a virar o jogo.
          </p>
          ${ctaArea}
        </div>

        <aside class="welcome-visual anim-fade delay-2" aria-hidden="true">
          <div class="welcome-video-wrap" id="welcomeVideoWrap">
            <img
              class="welcome-hero"
              src="/welcome-hero.jpg"
              alt=""
              decoding="async"
              fetchpriority="high">
          </div>
        </aside>
      </section>
    </div>
  `;
}
