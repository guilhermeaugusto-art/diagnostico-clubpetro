import { Button } from "../components/Button";
import { escHtml } from "../lib/format";

/* Fallback enquanto o vídeo carrega (ou se falhar).
   Motivo de marca, não cena de estoque: um medidor de "saúde" em arco, flat,
   na paleta ClubPetro, integrado ao paper. Sem grid de dashboard, sem 3D,
   sem brilho forte. Lê como "diagnóstico/nota", não como banco de imagem. */
function welcomeIllustration(): string {
  /* Arco track (270°, de 135° a 45° passando por baixo) e arco de valor (~72%).
     Coordenadas calculadas em torno de C=(480,300), R=180. */
  return `
    <svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" class="welcome-illustration" role="img" aria-label="Medidor de saúde do posto">
      <defs>
        <radialGradient id="cpGlow" cx="50%" cy="52%" r="52%">
          <stop offset="0%" stop-color="#F26600" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="#F26600" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="cpArc" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="#FFA132"/>
          <stop offset="100%" stop-color="#CC4D02"/>
        </linearGradient>
      </defs>

      <circle cx="480" cy="300" r="250" fill="url(#cpGlow)"/>

      <!-- Track do medidor: arco fino em tinta clara -->
      <path d="M 352.74 427.28 A 180 180 0 1 1 607.26 427.28"
            fill="none" stroke="#1F2028" stroke-opacity="0.12"
            stroke-width="10" stroke-linecap="round"/>

      <!-- Ticks discretos ao longo do arco -->
      <g stroke="#1F2028" stroke-opacity="0.16" stroke-width="3" stroke-linecap="round">
        <line x1="352.74" y1="427.28" x2="345.67" y2="434.35"/>
        <line x1="300" y1="300" x2="290" y2="300"/>
        <line x1="352.74" y1="172.72" x2="345.67" y2="165.65"/>
        <line x1="480" y1="120" x2="480" y2="110"/>
        <line x1="607.26" y1="172.72" x2="614.33" y2="165.65"/>
        <line x1="660" y1="300" x2="670" y2="300"/>
      </g>

      <!-- Arco de valor (~72% dos 270°), na cor da marca -->
      <path d="M 352.74 427.28 A 180 180 0 1 1 634.94 208.18"
            fill="none" stroke="url(#cpArc)"
            stroke-width="12" stroke-linecap="round"/>

      <!-- Marcador na ponta do valor -->
      <circle cx="634.94" cy="208.18" r="9" fill="#fff" stroke="#CC4D02" stroke-width="3"/>

      <!-- Núcleo: rótulo editorial, sem número (não simular uma nota real) -->
      <text x="480" y="296" text-anchor="middle"
            font-family="Fraunces, Georgia, serif"
            font-size="34" font-weight="600" fill="#353745" letter-spacing="-0.5">
        Saúde
      </text>
      <text x="480" y="330" text-anchor="middle"
            font-family="Inter, system-ui, sans-serif"
            font-size="15" font-weight="600" fill="#6C7C8E"
            letter-spacing="3" style="text-transform:uppercase">
        DO POSTO
      </text>
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
            Em poucos minutos, um raio-x do seu posto: onde o lucro está vazando
            hoje, o que rende mais mexer primeiro, e por onde começar a virar o jogo.
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
              webkit-playsinline="true"
              disableremoteplayback
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
              webkit-playsinline="true"
              disableremoteplayback
              preload="none">
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
