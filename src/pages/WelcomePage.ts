import { Button } from "../components/Button";
import { escHtml } from "../lib/format";

interface WelcomePageProps {
  resumable: boolean;
  name: string;
  phone: string;
  entryValid: boolean; // nome + WhatsApp preenchidos: libera o quiz
}

/* Tela inicial:
   - Coluna esquerda: copy consultiva + campo nome obrigatório + CTA primário.
   - Coluna direita: ilustração da equipe do posto (o vídeo em loop saiu; a
     imagem estática carrega leve e cumpre o mesmo papel visual).
   - Banner de retomada substitui o CTA quando há sessão.
   - Removido: aside escuro com chips das frentes, qualquer menção a "sem login". */
export function WelcomePage(p: WelcomePageProps): string {
  const ctaArea = p.resumable
    ? `
      <div class="welcome-resume anim-rise delay-2" role="status">
        <div class="welcome-resume-body">
          <span class="welcome-resume-l">Análise em andamento</span>
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
          <span class="welcome-field-label">Como podemos te chamar?</span>
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
        <label class="welcome-field" for="welcomePhone">
          <span class="welcome-field-label">Seu WhatsApp com DDD</span>
          <input
            id="welcomePhone"
            class="welcome-field-input"
            type="tel"
            autocomplete="tel"
            inputmode="numeric"
            maxlength="16"
            placeholder="(11) 99999-9999"
            aria-invalid="false"
            value="${escHtml(p.phone)}"
          >
        </label>
        <div class="welcome-cta-row">
          ${Button({
            variant: "primary",
            size: "lg",
            label: "Quero saber onde meu posto perde dinheiro",
            iconRight: "arrow",
            dataAction: "start",
            id: "btnStartDiag",
            disabled: !p.entryValid,
          })}
          <span class="welcome-cta-note">É gratuito. O WhatsApp é pra te mandar o convite do Raio-X.</span>
        </div>
      </form>
    `;

  return `
    <div class="shell stage">
      <section class="welcome">
        <div class="welcome-main">
          <span class="eyebrow anim-rise delay-0">Saúde do seu posto</span>
          <h1 class="display anim-rise delay-1">
            As 6 frentes que definem o <span class="ink-accent">lucro</span> do seu posto.
          </h1>
          <p class="lede measure anim-rise delay-2">
            Em poucos minutos você vê onde o seu posto perde dinheiro: margem da
            bomba, galonagem, aditivada, ticket médio e a fidelização do cliente.
            Nenhum posto está totalmente otimizado, e é por isso que sempre sobra
            frente pra ganhar mais.
          </p>
          ${ctaArea}
        </div>

        <!-- Sem anim-fade aqui de propósito: animação de opacity isola o grupo
             no Chromium e anula o mix-blend-mode que funde a ilustração no
             fundo da página (a borda voltava a aparecer branca). -->
        <aside class="welcome-visual" aria-hidden="true">
          <div class="welcome-hero-wrap">
            <img class="welcome-hero" src="/home-hero.webp" alt="" width="1600" height="1096" fetchpriority="high" decoding="async">
          </div>
        </aside>
      </section>
    </div>
  `;
}
