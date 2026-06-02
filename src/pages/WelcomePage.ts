import { Button } from "../components/Button";
import { escHtml } from "../lib/format";

/* Ilustração placeholder enquanto o vídeo final não está disponível.
   Composição premium minimal alinhada à paleta ClubPetro (azul + laranja),
   integrada ao paper da página. Quando o video carregar, o video sobe por z-index. */
function welcomeIllustration(): string {
  return `
    <svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" class="welcome-illustration" role="img" aria-label="Diagnóstico do posto">
      <defs>
        <radialGradient id="cpGlow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#F26600" stop-opacity="0.35"/>
          <stop offset="60%" stop-color="#F26600" stop-opacity="0.06"/>
          <stop offset="100%" stop-color="#F26600" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="cpBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#163554"/>
          <stop offset="100%" stop-color="#0B1F33"/>
        </linearGradient>
        <linearGradient id="cpOrange" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FF8A3D"/>
          <stop offset="100%" stop-color="#D85600"/>
        </linearGradient>
      </defs>
      <circle cx="480" cy="270" r="240" fill="url(#cpGlow)"/>
      <g opacity="0.18">
        <circle cx="480" cy="270" r="200" fill="none" stroke="#0B1F33" stroke-width="0.8"/>
        <circle cx="480" cy="270" r="150" fill="none" stroke="#0B1F33" stroke-width="0.8"/>
        <circle cx="480" cy="270" r="100" fill="none" stroke="#0B1F33" stroke-width="0.8"/>
        <line x1="480" y1="70"  x2="480" y2="470" stroke="#0B1F33" stroke-width="0.8"/>
        <line x1="280" y1="270" x2="680" y2="270" stroke="#0B1F33" stroke-width="0.8"/>
        <line x1="338" y1="128" x2="622" y2="412" stroke="#0B1F33" stroke-width="0.8"/>
        <line x1="622" y1="128" x2="338" y2="412" stroke="#0B1F33" stroke-width="0.8"/>
      </g>
      <polygon points="480,130 660,240 620,400 340,400 300,240"
               fill="url(#cpOrange)" opacity="0.85"/>
      <circle cx="480" cy="130" r="7" fill="#fff"/>
      <circle cx="660" cy="240" r="7" fill="#fff"/>
      <circle cx="620" cy="400" r="7" fill="#fff"/>
      <circle cx="340" cy="400" r="7" fill="#fff"/>
      <circle cx="300" cy="240" r="7" fill="#fff"/>
      <g transform="translate(480, 270)">
        <circle r="70" fill="url(#cpBlue)"/>
        <circle r="70" fill="none" stroke="#FF8A3D" stroke-width="2" opacity="0.6"/>
        <text x="0" y="8" text-anchor="middle"
              font-family="Plus Jakarta Sans, Inter, sans-serif"
              font-size="26" font-weight="700" fill="#fff" letter-spacing="-0.5">
          CP
        </text>
      </g>
    </svg>
  `;
}

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
          <span class="welcome-field-hint" id="welcomeNameHint">Informe seu nome para iniciar.</span>
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
            Uma leitura estratégica e personalizada da sua operação.
            Você descobre onde estão os principais pontos de atenção,
            quais melhorias podem gerar mais impacto e como evoluir
            gestão, fidelização e margem com clareza.
          </p>
          ${ctaArea}
        </div>

        <aside class="welcome-visual anim-fade delay-2" aria-hidden="true">
          <div class="welcome-video-wrap" id="welcomeVideoWrap">
            <!-- Crossfade loop: dois vídeos sobrepostos. Um toca enquanto o outro
                 espera; perto do fim, o segundo entra com fade e o primeiro sai. -->
            <video
              class="welcome-video is-active"
              id="welcomeVideoA"
              autoplay
              muted
              playsinline
              preload="auto"
              poster="/welcome-poster.jpg">
              <source src="/welcome-loop.webm" type="video/webm">
              <source src="/welcome-loop.mp4" type="video/mp4">
            </video>
            <video
              class="welcome-video"
              id="welcomeVideoB"
              muted
              playsinline
              preload="auto">
              <source src="/welcome-loop.webm" type="video/webm">
              <source src="/welcome-loop.mp4" type="video/mp4">
            </video>
            <div class="welcome-visual-fallback" id="welcomeVideoFallback" aria-hidden="true">
              ${welcomeIllustration()}
            </div>
          </div>
        </aside>
      </section>
    </div>
  `;
}
