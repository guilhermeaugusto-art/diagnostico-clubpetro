import { BLOCKS, type BlockId } from "../data/blocks";
import { levelFor } from "../data/levels";
import { planFor } from "../data/recommendations";
import { RadarChart } from "../components/RadarChart";
import { rankedBlocks, totalScore } from "../lib/scoring";
import { currentTrack } from "../lib/engine";
import type { AppState } from "../lib/state";
import { escHtml } from "../lib/format";
import { Icons } from "../lib/icons";

/* ============================================================
   Personalização: nome e perfil (papel), puxados do diagnóstico.
   ============================================================ */

function firstNameOf(state: AppState): string {
  return state.name.trim().split(/\s+/)[0] || "";
}

/* "Você, como {revendedor|gestor}," */
function roleWord(state: AppState): string {
  const t = currentTrack(state);
  if (t === "gerente") return "gestor";
  return "revendedor";
}

/* Cor de assinatura por pilar (fora do clichê de roxo). */
const PILLAR_ACCENT: Record<BlockId, string> = {
  comercial: "#1F8A5C",
  fidelizacao: "#F26600",
  pessoas: "#2F6DB0",
  marca: "#C0532A",
  dados: "#0E8A8A",
  resiliencia: "#566074",
};

/* Recorte da frente mais fraca, escrito pra fluir depois de
   "{nome}, como {perfil}, o que você respondeu mostra que ". */
const PROBLEM_COPY: Record<BlockId, string> = {
  comercial:
    "o seu posto marcou baixo em Comercial. É aqui que mora o seu ticket médio e a margem da aditivada. Tem espaço claro pra crescer, e você ainda não está usando.",
  fidelizacao:
    "na Fidelização o seu posto ficou pra trás. Cliente que passa uma vez e some não sustenta galonagem. Dá pra transformar quem abastece hoje em quem volta toda semana.",
  pessoas:
    "o seu frentista é quem fecha ou perde a venda na pista. Essa foi uma das suas frentes mais fracas, e é uma das de retorno mais rápido.",
  dados:
    "em Dados o seu posto ficou atrás. Sem número na mão, cada decisão da pista vira aposta. Dá pra enxergar galonagem, ticket médio e margem num lugar só.",
  marca:
    "na Marca o seu posto ficou pra trás. Quando o único motivo pra parar é o preço, o vizinho leva o seu cliente. Dá pra construir um motivo de escolha que segura quem passa.",
  resiliencia:
    "em Resiliência o seu posto ficou exposto. Sem fôlego de caixa, a guerra de preço da praça manda no seu mês. Dá pra montar uma reserva que te tira do sufoco.",
};

/* Leitura curta do momento, adaptada à faixa da nota. */
function shortRead(score: number): string {
  if (score <= 30) return "Tem margem escapando em várias frentes ao mesmo tempo. A boa notícia: é onde mais dá pra ganhar rápido.";
  if (score <= 60) return "Você já acerta em pontos importantes, mas o conjunto ainda não rende o que poderia. Faltam poucas peças no lugar.";
  return "Sua base já é sólida. O próximo degrau é fino: método e dado puxando mais resultado por litro.";
}

/* ============================================================
   Radar do hero (destaque) com as 6 frentes e barras.
   ============================================================ */

function radarBars(state: AppState): string {
  const ranked = rankedBlocks(state); // fraco -> forte
  const weakId = ranked[0]?.id;
  return ranked
    .map((r) => `
      <div class="rr-bar${r.id === weakId ? " is-weak" : ""}" style="--accent:${PILLAR_ACCENT[r.id]}">
        <span class="rr-bar-name">${escHtml(BLOCKS[r.id].short)}</span>
        <span class="rr-bar-track"><span class="rr-bar-fill" style="width:${r.pct}%"></span></span>
        <span class="rr-bar-val">${r.pct}</span>
      </div>`)
    .join("");
}

/* ============================================================
   SEÇÃO 1 · HERO (nota + radar)
   CTA desce pros pontos de melhoria, logo abaixo.
   O id "analise-pronta" é âncora de conversão no GTM (gatilho de
   visibilidade do elemento): não renomear nem remover.
   ============================================================ */

function hero(state: AppState, score: number, comCta = true): string {
  const lvl = levelFor(score);
  const first = firstNameOf(state);
  return `
    <header class="rr-hero">
      <div class="rr-hero-copy">
        <span class="rr-eyebrow" id="analise-pronta">Sua análise está pronta</span>
        <h1 class="rr-headline">
          ${first ? `Fala, ${escHtml(first)}.` : "Olá."} Esse é o retrato do seu posto hoje.
        </h1>

        <div class="rr-scoreline">
          <div class="rr-score">
            <span class="rr-score-num" id="rScoreNumber">0</span>
            <span class="rr-score-den">/100</span>
          </div>
          <div class="rr-scoreline-meta">
            <span class="rr-level">${escHtml(lvl.name)}</span>
            <p class="rr-hero-read">Nenhum posto opera no limite. Sempre tem frente pra destravar, e o seu tem várias mapeadas aqui.</p>
          </div>
        </div>

        ${comCta ? `<button class="rr-cta rr-cta-primary rr-cta-lg" type="button" data-action="see-next-steps">
          Quero ver meus próximos passos
        </button>` : ""}
        <span class="rr-reassure">${escHtml(shortRead(score))}</span>
      </div>

      <div class="rr-hero-radar">
        <span class="rr-radar-label">As suas 6 frentes</span>
        <div class="rr-radar-chart">${RadarChart({ state, width: 460 })}</div>
        <div class="rr-bars">${radarBars(state)}</div>
      </div>
    </header>`;
}

/* ============================================================
   SEÇÃO 2 · PONTOS DE MELHORIA (os 3 primeiros passos)
   O CTA logo após o 3º passo abre o WhatsApp do especialista
   DIRETO, com a mensagem do diagnóstico já pronta.
   ============================================================ */

interface Step { block: BlockId; text: string; }

function buildSteps(state: AppState): Step[] {
  const ranked = rankedBlocks(state); // fraco -> forte: os primeiros pedem mais ação
  return ranked.map((r) => ({ block: r.id, text: planFor(r.id).estaSemana }));
}

function stepCard(step: Step, index: number, locked: boolean): string {
  return `
    <li class="rr-step${locked ? " is-locked" : ""}" style="--accent:${PILLAR_ACCENT[step.block]}">
      <span class="rr-step-num">${index + 1}</span>
      <div class="rr-step-body">
        <span class="rr-step-front">${escHtml(BLOCKS[step.block].name)}</span>
        <p class="rr-step-text">${escHtml(step.text)}</p>
      </div>
    </li>`;
}

function pontosSection(state: AppState): string {
  const ranked = rankedBlocks(state);
  const weak = ranked[0];
  const first = firstNameOf(state);
  const steps = buildSteps(state);
  const open = steps.slice(0, 3);
  const openHtml = open.map((s, i) => stepCard(s, i, false)).join("");

  const intro = weak
    ? `${first ? `${escHtml(first)}, como ${escHtml(roleWord(state))}, ` : ""}o que você respondeu mostra que ${escHtml(PROBLEM_COPY[weak.id])}`
    : "";

  return `
    <section class="rr-steps" id="pontos">
      <span class="rr-section-eyebrow">Seus pontos de melhoria</span>
      <h2 class="rr-section-title">Por onde começar</h2>

      <div class="rr-pontos-intro">
        ${intro ? `<p class="rr-section-sub">${intro}</p>` : ""}
        <figure class="rr-illus rr-illus-pain" aria-hidden="true">
          <img src="/resultado/dono-preocupado.webp" alt="" loading="lazy" decoding="async">
        </figure>
      </div>

      <div class="rr-apply">
        <p class="rr-apply-line">Os 3 primeiros passos estão logo abaixo. O plano completo das seis frentes, aplicado ao seu posto, um Especialista ClubPetro monta com você.</p>
        <button class="rr-cta rr-cta-wpp rr-cta-lg" type="button" data-action="cta-especialista">
          <span class="rr-cta-wpp-icon" aria-hidden="true">${Icons.whatsapp}</span>
          Falar com um Especialista no WhatsApp
        </button>
      </div>

      <div class="rr-steps-row">
        <ol class="rr-steplist">${openHtml}</ol>
        <figure class="rr-illus rr-illus-plan" aria-hidden="true">
          <img src="/resultado/gerente-frentes.webp" alt="" loading="lazy" decoding="async">
        </figure>
      </div>
    </section>`;
}

/* ============================================================
   SEÇÃO 3 · ESPECIALISTA — a peça final da tela.
   Único ponto de conversão: abre o WhatsApp DIRETO, com a
   mensagem do diagnóstico pronta (nota, frentes fracas, dor).
   Sem agenda, sem evento, sem confirmação: o especialista marca
   o horário dentro da própria conversa.
   ============================================================ */

function specialistSection(state: AppState): string {
  const first = firstNameOf(state);
  const ranked = rankedBlocks(state);
  const weak = ranked[0];
  /* .short: "destravar Resiliencia" funciona, "destravar Resiliencia e
     mercado" nao. Vale pros 6 nomes. */
  const frente = weak ? BLOCKS[weak.id].short : "";
  return `
    <footer class="rr-specialist" id="especialista">
      <div class="rr-specialist-card">
        <img class="rr-specialist-photo" src="/especialista.jpg" alt="Especialista ClubPetro" loading="lazy" decoding="async" onerror="this.style.display='none'">
        <div class="rr-specialist-body">
          <span class="rr-specialist-eyebrow">O seu próximo passo</span>
          <h3 class="rr-specialist-title">
            ${first ? `${escHtml(first)}, fale com um especialista` : "Fale com um especialista"}
            ${frente ? ` sobre ${escHtml(frente)}` : ""}
          </h3>
          <p class="rr-specialist-text">
            Um Especialista ClubPetro pega o resultado que você acabou de ver e te
            mostra, no seu caso, o que fazer primeiro${frente ? ` pra destravar ${escHtml(frente)}` : ""}.
            Sem custo e sem compromisso.
          </p>
          <button class="rr-cta rr-cta-wpp rr-cta-lg rr-cta-block" type="button" data-action="cta-especialista" id="btnEspecialista">
            <span class="rr-cta-wpp-icon" aria-hidden="true">${Icons.whatsapp}</span>
            Falar agora no WhatsApp
          </button>
          <span class="rr-specialist-micro">
            Abre a conversa com a sua análise já escrita. É só apertar enviar.
          </span>
        </div>
      </div>
      <span class="rr-save" id="saveMsg"></span>
    </footer>`;
}

/* ============================================================
   Página
   ============================================================ */

export function ResultPage(state: AppState): string {
  const score = totalScore(state);
  const track = currentTrack(state);

  if (track === "frentista") {
    return frentistaResult(state, score);
  }

  return `
    <div class="shell stage rr">
      <article class="rr-result">
        ${hero(state, score)}
        ${pontosSection(state)}
        ${specialistSection(state)}
      </article>
    </div>
    <span id="rScoreTarget" data-target="${score}" hidden></span>
  `;
}

/* Tela final do frentista: mesmo hero claro, sem gate nem CTA comercial.
   Frentista não gera MQL: o caminho é levar o retrato pra quem decide. */
function frentistaResult(state: AppState, score: number): string {
  const shareUrl =
    "https://wa.me/?text=Fiz%20um%20diagn%C3%B3stico%20r%C3%A1pido%20do%20posto%20e%20vale%20voc%C3%AA%20ver.%20Leva%204%20minutos%20e%20mostra%20onde%20d%C3%A1%20para%20melhorar%3A%20https%3A%2F%2Fdiagnostico-clubpetro.web.app%2F";
  return `
    <div class="shell stage rr">
      <article class="rr-result">
        ${hero(state, score, false)}
        <section class="rr-frentista">
          <p class="rr-frentista-text">
            O que você respondeu mostra onde o dia a dia do seu posto aperta e onde dá
            pra melhorar. A sua visão de pista é o que falta pra quem decide enxergar
            isso. Leva esse retrato pro seu gerente ou dono.
          </p>
          <a class="rr-cta rr-cta-primary rr-cta-lg" href="${shareUrl}" target="_blank" rel="noopener noreferrer" data-action="share-diagnostico">
            Mostrar esse diagnóstico pro meu gerente ou dono
          </a>
          <span class="rr-save" id="saveMsg"></span>
        </section>
      </article>
    </div>
    <span id="rScoreTarget" data-target="${score}" hidden></span>
  `;
}
