import { BLOCKS, type BlockId } from "../data/blocks";
import { levelFor } from "../data/levels";
import { planFor } from "../data/recommendations";
import {
  radarReading,
  nextImprovementFor,
  strongestBlock,
  weakestBlock,
  mainPain,
} from "../data/radar-reading";
import { urgencyFor } from "../data/urgency";
import { SectionHeader } from "../components/SectionHeader";
import { RadarChart } from "../components/RadarChart";
import { rankedBlocks, totalScore } from "../lib/scoring";
import { currentTrack } from "../lib/engine";
import { dataProximaSessao, meetLabel } from "../lib/raiox";
import { CONFIG } from "../lib/config";
import type { AppState } from "../lib/state";
import { escHtml } from "../lib/format";
import { Icons } from "../lib/icons";

/* Frase curta que nomeia o ponto cego de cada frente fraca, em linguagem de
   dono: o radar encanta, esta linha explica. Sem travessao, sem emoji,
   no maximo 20 palavras (RULES 3.1, 3.2, 3.5). */
const WEAK_LINE: Record<BlockId, string> = {
  pessoas:     "Seu posto ainda depende de esforço individual, sem rotina que sustente o atendimento.",
  marca:       "Falta um motivo de escolha além do preço, e isso entrega o seu cliente ao concorrente.",
  comercial:   "Sua margem é acompanhada no escuro, e dinheiro escapa todo mês sem aparecer.",
  fidelizacao: "Você sabe quem abastece, não sabe quem volta nem por quê.",
  dados:       "Sua decisão ainda corre sem número na mão, sem painel que mostre o que acontece.",
  resiliencia: "Sobra pouco fôlego de caixa para você planejar movimento próprio na praça.",
};

/* Uma barra da leitura por pilar: nome, trilha, preenchimento e valor exato.
   A frente mais fraca recebe destaque (cor de atencao). */
function radarBar(name: string, pct: number, weak: boolean): string {
  return `
    <div class="radar-bar-row${weak ? " is-weak" : ""}">
      <span class="radar-bar-name">${escHtml(name)}</span>
      <span class="radar-bar-track"><span class="radar-bar-fill" style="width:${pct}%"></span></span>
      <span class="radar-bar-val">${pct}</span>
    </div>
  `;
}

/* Item do trio do hero: rotulo curto + valor + icone tematico. */
function trioItem(label: string, value: string, icon: "trend" | "alert" | "spark"): string {
  const ICON: Record<typeof icon, string> = {
    trend: Icons.trendUp,
    alert: Icons.alert,
    spark: Icons.spark,
  };
  return `
    <div class="result-trio-item">
      <span class="result-trio-icon" aria-hidden="true">${ICON[icon]}</span>
      <div class="result-trio-body">
        <span class="result-trio-label">${escHtml(label)}</span>
        <span class="result-trio-value">${escHtml(value)}</span>
      </div>
    </div>
  `;
}

/* Cabecalho compartilhado do resultado (hero com radar, nivel e leitura).
   `primarySlot` injeta a acao principal especifica de cada trilha. */
function heroHeader(state: AppState, primarySlot: string): string {
  const score = totalScore(state);
  const lvl = levelFor(score);
  const ranked = rankedBlocks(state);
  const firstName = state.name.trim().split(/\s+/)[0] || "";

  const radar = radarReading(state);
  const heroStrong = strongestBlock(state);
  const heroWeak = weakestBlock(state);
  const framesTied =
    ranked.length > 1 && ranked[ranked.length - 1].pct - ranked[0].pct < 5;
  const nextImprovement = nextImprovementFor(ranked[0]?.id);
  const heroPain = mainPain(state);
  const urgency = urgencyFor(score);

  const weakId = ranked[0]?.id as BlockId | undefined;
  const barsHtml = ranked
    .map((r) => radarBar(BLOCKS[r.id].short, r.pct, r.id === weakId))
    .join("");
  const weakName = weakId ? BLOCKS[weakId].short : "";
  const weakLine = weakId ? WEAK_LINE[weakId] : "";

  return `
    <header class="result-hero anim-rise ${urgency.cssClass}"
            style="--urgency-accent:${urgency.accent}; --urgency-glow:${urgency.glow};">
      <div class="result-hero-topline">
        <span class="eyebrow on-dark">Resultado do diagnóstico</span>
        <span class="result-hero-tag">
          <span class="result-hero-tag-dot"></span>
          ${escHtml(urgency.statusLabel)}
        </span>
      </div>

      <h1 class="result-hero-headline">
        ${firstName
          ? `Boa, <span class="ink-orange">${escHtml(firstName)}</span>.`
          : "Diagnóstico do seu posto."}
      </h1>
      <p class="result-hero-lede">${escHtml(heroPain)}</p>

      <div class="result-hero-grid">
        <div class="result-hero-left">
          <div class="result-hero-scoreblock">
            <div class="score-dial-wrap">
              <span class="score-number" id="rScoreNumber">0</span>
              <span class="score-of">/100</span>
            </div>
            <div class="result-level-inline">
              <span class="result-level-tag">Faixa atual</span>
              <h2 class="result-level-name">${escHtml(lvl.name)}</h2>
            </div>
          </div>

          <div class="result-trio">
            ${framesTied
              ? trioItem("Leitura geral", "Frentes niveladas", "trend")
              : trioItem("Ponto mais forte", heroStrong ? `${heroStrong.name} ${heroStrong.pct}` : "Ainda sem leitura", "trend")}
            ${framesTied
              ? trioItem("Foco sugerido", "Consistência do conjunto", "alert")
              : trioItem("Ponto de atenção", heroWeak ? `${heroWeak.name} ${heroWeak.pct}` : "Ainda sem leitura", "alert")}
            ${trioItem("Próxima melhoria", nextImprovement, "spark")}
          </div>

          ${primarySlot}
        </div>

        <div class="result-hero-radar anim-fade delay-2">
          <span class="radar-panel-eyebrow">Raio x dos pilares</span>
          ${RadarChart({ state, width: 480, theme: "paper" })}
          <div class="radar-bars">${barsHtml}</div>
          ${weakName ? `
          <div class="radar-weakest">
            <span class="radar-weakest-label">Ponto mais fraco</span>
            <p class="radar-weakest-name">${escHtml(weakName)}</p>
            <p class="radar-weakest-line">${escHtml(weakLine)}</p>
          </div>` : ""}
          <p class="result-hero-radar-reading">${escHtml(radar.p1)}</p>
        </div>
      </div>
    </header>
  `;
}

/* Plano por frente (dono e gerente): cada frente fraca com os dois rotulos. */
function planSection(state: AppState): string {
  const ranked = rankedBlocks(state); // do mais fraco ao mais forte
  /* Frentes fracas: as abaixo de 70, no maximo tres. Se todas estiverem
     fortes, mostra ao menos a mais fraca para o plano nunca ficar vazio. */
  let weak = ranked.filter((r) => r.pct < 70).slice(0, 3);
  if (weak.length === 0 && ranked.length > 0) weak = ranked.slice(0, 1);

  const cards = weak
    .map((r, i) => {
      const plan = planFor(r.id);
      return `
        <article class="plan-card anim-rise" style="animation-delay:${120 + i * 90}ms;">
          <header class="plan-card-head">
            <h3 class="plan-card-name">${escHtml(BLOCKS[r.id].name)}</h3>
            <span class="plan-card-score">${r.pct}<small>/100</small></span>
          </header>
          <div class="plan-item plan-item-now">
            <span class="plan-item-tag">Para fazer esta semana</span>
            <p class="plan-item-text">${escHtml(plan.estaSemana)}</p>
          </div>
          <div class="plan-item plan-item-apoio">
            <span class="plan-item-tag">Para estruturar com apoio</span>
            <p class="plan-item-text">${escHtml(plan.comApoio)}</p>
          </div>
        </article>`;
    })
    .join("");

  return `
    <section id="planSection" class="result-plan is-hidden" aria-hidden="true">
      ${SectionHeader({ num: 1, title: "Seu plano por frente" })}
      <p class="section-intro">
        Para cada frente que pede atenção, um passo que você começa esta semana
        e um que estrutura com apoio. Comece pelo primeiro de cada uma.
      </p>
      <div class="plan-grid">${cards}</div>
    </section>
  `;
}

/* Bloco do Raio X (dono e gerente): proximo passo principal da pagina. */
function raioxBlock(): string {
  const data = dataProximaSessao();
  const meet = meetLabel();
  return `
    <section class="raiox-block is-hidden" id="raioxBlock" aria-hidden="true">
      <span class="raiox-eyebrow">Ao vivo, toda terça</span>
      <h2 class="raiox-title">Seu próximo passo: o Raio X do Posto</h2>
      <p class="raiox-text">
        Uma sessão fechada, ao vivo, onde nossos especialistas leem o mercado da
        semana e mostram o que postos como o seu estão fazendo para melhorar
        resultado. Só participa quem concluiu o diagnóstico.
      </p>
      <p class="raiox-date">Próxima sessão: terça, ${escHtml(data)}, às 19h.</p>
      <button class="btn btn-primary btn-lg btn-block" type="button" data-action="cta-raiox" id="btnRaioxMain">
        <span>Garantir minha vaga no Raio X</span>
      </button>
      <p class="raiox-meet">
        Sala do Raio X:
        <a href="${CONFIG.RAIOX_MEET_URL}" target="_blank" rel="noopener noreferrer">${escHtml(meet)}</a>
      </p>
    </section>
  `;
}

export function ResultPage(state: AppState): string {
  const score = totalScore(state);
  const track = currentTrack(state);

  if (track === "frentista") {
    return frentistaResult(state, score);
  }

  /* Dono e gerente: resultado -> botao revela plano -> plano -> Raio X -> ghost. */
  const primarySlot = `
    <div class="result-next" id="resultNext">
      <p class="result-next-micro">
        Você já viu onde está perdendo. Veja agora o que dá para fazer para
        melhorar o resultado do seu posto.
      </p>
      <button class="btn btn-hero-primary btn-block btn-hero-xl" type="button" data-action="reveal-plan" id="btnRevealPlan">
        <span>Quero aumentar meu resultado</span>
      </button>
    </div>
  `;

  return `
    <div class="shell stage">
      <article class="result">
        ${heroHeader(state, primarySlot)}
        ${planSection(state)}
        ${raioxBlock()}
        <footer class="result-foot is-hidden" id="resultFoot" aria-hidden="true">
          <button class="btn btn-ghost" type="button" data-action="cta-especialista">
            <span>Prefere conversar agora? Falar com um Especialista ClubPetro</span>
          </button>
          <span class="result-foot-save" id="saveMsg"></span>
        </footer>
      </article>
    </div>

    <div class="raiox-sticky is-hidden" id="raioxSticky" aria-hidden="true">
      <button class="btn btn-primary btn-block" type="button" data-action="cta-raiox">
        <span>Garantir minha vaga no Raio X</span>
      </button>
    </div>

    <span id="rScoreTarget" data-target="${score}" hidden></span>
  `;
}

/* Tela final do frentista (Bloco 2.4): sem Raio X, sem especialista.
   Resultado em segunda pessoa, reconhecimento do papel na pista e um unico
   CTA, de compartilhar o diagnostico com quem decide. */
function frentistaResult(state: AppState, score: number): string {
  const primarySlot = `
    <div class="result-next" id="resultNext">
      <p class="result-next-micro">
        Quem está na pista enxerga o posto de um jeito que ninguém mais vê.
      </p>
    </div>
  `;
  /* Link de compartilhamento fixo (Bloco 2.4). */
  const shareUrl =
    "https://wa.me/?text=Fiz%20um%20diagn%C3%B3stico%20r%C3%A1pido%20do%20posto%20e%20vale%20voc%C3%AA%20ver.%20Leva%204%20minutos%20e%20mostra%20onde%20d%C3%A1%20para%20melhorar%3A%20https%3A%2F%2Fdiagnostico-clubpetro.web.app%2F";

  return `
    <div class="shell stage">
      <article class="result result-frentista">
        ${heroHeader(state, primarySlot)}

        <section class="frentista-final anim-rise" style="animation-delay:120ms;">
          <p class="frentista-recognition">
            O que você respondeu mostra onde o dia a dia do seu posto aperta e
            onde dá para melhorar. A sua visão de pista é o que falta para quem
            decide enxergar isso. Leva esse retrato para o seu gerente ou dono:
            é assim que o que você vê todo dia vira mudança de verdade.
          </p>
          <a class="btn btn-primary btn-lg btn-block" href="${shareUrl}" target="_blank" rel="noopener noreferrer" data-action="share-diagnostico">
            <span>Mostrar esse diagnóstico para o gerente ou dono</span>
          </a>
          <span class="result-foot-save" id="saveMsg"></span>
        </section>
      </article>
    </div>

    <span id="rScoreTarget" data-target="${score}" hidden></span>
  `;
}
