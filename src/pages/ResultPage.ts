import { BLOCKS, BLOCK_ORDER, type BlockId } from "../data/blocks";
import { insightFor } from "../data/insights";
import { levelFor } from "../data/levels";
import { buildResultRecommendations } from "../data/recommendations";
import {
  radarReading,
  nextImprovementFor,
  strongestBlock,
  weakestBlock,
  mainPain,
} from "../data/radar-reading";
import { urgencyFor } from "../data/urgency";
import { PillarCard } from "../components/PillarCard";
import { RecommendationCard } from "../components/RecommendationCard";
import { LockedCard } from "../components/LockedCard";
import { SectionHeader } from "../components/SectionHeader";
import { Button } from "../components/Button";
import { RadarChart } from "../components/RadarChart";
import { rankedBlocks, totalScore, weakBlockIds, blockScores } from "../lib/scoring";
import type { AppState } from "../lib/state";
import { escHtml } from "../lib/format";
import { Icons } from "../lib/icons";

/* Frase curta que nomeia o ponto cego de cada frente fraca, em linguagem de
   dono: o radar encanta, esta linha explica. Sem travessão, sem emoji,
   no máximo 20 palavras (RULES 3.1, 3.2, 3.5). */
const WEAK_LINE: Record<BlockId, string> = {
  pessoas:     "A operação ainda depende de esforço individual, sem rotina que sustente o atendimento.",
  marca:       "Falta um motivo de escolha além do preço, e isso entrega o cliente ao concorrente.",
  comercial:   "A margem é acompanhada no feeling, e dinheiro escapa todo mês sem aparecer.",
  fidelizacao: "Você sabe quem abastece, não sabe quem volta nem por quê.",
  dados:       "A decisão ainda roda no achismo, sem painel que mostre o que acontece.",
  resiliencia: "Sobra pouco fôlego de caixa para planejar movimento próprio na praça.",
};

/* Uma barra da leitura por pilar: nome, trilha, preenchimento e valor exato.
   A frente mais fraca recebe destaque (cor de atenção). */
function radarBar(name: string, pct: number, weak: boolean): string {
  return `
    <div class="radar-bar-row${weak ? " is-weak" : ""}">
      <span class="radar-bar-name">${escHtml(name)}</span>
      <span class="radar-bar-track"><span class="radar-bar-fill" style="width:${pct}%"></span></span>
      <span class="radar-bar-val">${pct}</span>
    </div>
  `;
}

export function ResultPage(state: AppState): string {
  const score = totalScore(state);
  const lvl = levelFor(score);
  const ranked = rankedBlocks(state);
  const bs = blockScores(state);
  const openBlockIds = new Set(ranked.slice(0, 2).map((x) => x.id));
  const weakestName = ranked[0] ? BLOCKS[ranked[0].id].name : "";
  const strongestName = ranked.length ? BLOCKS[ranked[ranked.length - 1].id].name : "";
  const firstName = state.name.trim().split(/\s+/)[0] || "";

  const radar = radarReading(state);
  const heroStrong = strongestBlock(state);
  const heroWeak = weakestBlock(state);
  const nextImprovement = nextImprovementFor(ranked[0]?.id);
  const heroPain = mainPain(state);
  const urgency = urgencyFor(score);

  /* Leitura por barras (valor exato por pilar) e a frase do ponto mais fraco.
     ranked já vem do mais fraco ao mais forte, então a primeira é o ponto fraco. */
  const weakId = ranked[0]?.id as BlockId | undefined;
  const barsHtml = ranked
    .map((r) => radarBar(BLOCKS[r.id].short, r.pct, r.id === weakId))
    .join("");
  const weakName = weakId ? BLOCKS[weakId].short : "";
  const weakLine = weakId ? WEAK_LINE[weakId] : "";

  const pillarsHtml = BLOCK_ORDER
    .filter((b) => bs[b].possible > 0)
    .map((b, i) => {
      const block = BLOCKS[b];
      const pct = bs[b].pct;
      const isOpen = openBlockIds.has(b as BlockId);
      const insight = isOpen
        ? insightFor(b, pct)
        : "Leitura completa desse pilar liberada após contato com um Especialista ClubPetro.";
      return PillarCard({
        name: block.name,
        pct,
        insight,
        icon: block.icon,
        delayMs: 1700 + i * 80,
      });
    })
    .join("");

  const weakIds = weakBlockIds(state, 4);
  const { open, locked } = buildResultRecommendations(weakIds);

  const openRecsHtml = open
    .map((r, i) =>
      RecommendationCard({
        title: r.title,
        desc: r.desc,
        icon: r.icon,
        impact: r.impact,
        priority: i === 0,
        delayMs: 2300 + i * 100,
      }),
    )
    .join("");

  const lockedRecsHtml = locked
    .map((r, i) =>
      LockedCard({
        title: r.title,
        desc: r.desc,
        icon: r.icon,
        tag: "Próxima melhoria",
        delayMs: 2700 + i * 80,
      }),
    )
    .join("");

  return `
    <div class="shell stage">
      <article class="result">

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
                ${trioItem("Ponto mais forte", heroStrong ? `${heroStrong.name} ${heroStrong.pct}` : "—", "trend")}
                ${trioItem("Ponto de atenção", heroWeak ? `${heroWeak.name} ${heroWeak.pct}` : "—", "alert")}
                ${trioItem("Próxima melhoria", nextImprovement, "spark")}
              </div>

              <div class="result-next" id="resultNext">
                <div class="result-next-cta" id="resultNextCta">
                  <p class="result-next-micro">
                    Você já viu onde está perdendo. Agora veja por onde começar a virar o jogo.
                  </p>
                  <button class="btn btn-hero-primary btn-block" type="button" data-action="show-raiox-explainer">
                    <span>Entenda os próximos passos</span>
                  </button>
                </div>

                <div class="result-raiox is-hidden" id="resultRaiox">
                  <span class="result-raiox-eyebrow">Próxima terça, ao vivo, só pra quem fez o diagnóstico</span>
                  <h3 class="result-raiox-title">O que é o Raio-X do posto</h3>
                  <div class="result-raiox-text">
                    <p>Toda terça-feira, ao vivo, acontece o Raio-X: uma sessão fechada, só pra quem fez o diagnóstico, com os maiores especialistas do mercado de postos.</p>
                    <p>Não é uma auditoria do seu posto. É uma leitura do cenário que o seu diagnóstico revelou, com os caminhos que o ClubPetro usa pra resolver cada ponto: fidelização, margem, equipe e gestão.</p>
                    <p>Dá pra acompanhar do celular, de onde você estiver. E como é fechado, você senta com quem vive esse mercado todo dia.</p>
                  </div>
                  <div class="result-raiox-actions">
                    <button class="btn btn-hero-primary btn-block" type="button" data-action="cta-raiox">
                      <span>Confirmar minha presença no Raio-X</span>
                    </button>
                    <button class="btn-link-back" type="button" data-action="hide-raiox-explainer">Voltar</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="result-hero-radar anim-fade delay-2">
              <span class="radar-panel-eyebrow">Raio-x dos pilares</span>
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

        <section>
          ${SectionHeader({ num: 1, title: "Leitura por frente" })}
          <p class="section-intro">
            Cada frente abaixo conversa com o gráfico de radar acima.
            ${weakestName ? `Sua maior oportunidade está em <b>${escHtml(weakestName)}</b>` : ""}${strongestName ? `, e a frente mais consistente é <b>${escHtml(strongestName)}</b>` : ""}.
          </p>
          <div class="pillar-grid">${pillarsHtml}</div>
        </section>

        <section>
          ${SectionHeader({ num: 2, title: "Próxima melhoria recomendada" })}
          <p class="section-intro">
            Recomendações práticas, conectadas às respostas que você acabou de dar.
            Comece pela primeira: é a que rende mais no curto prazo.
          </p>
          <div class="recs-grid">${openRecsHtml}</div>
        </section>

        <section>
          ${SectionHeader({ num: 3, title: "Outras próximas melhorias identificadas" })}
          <p class="section-intro">
            Estas próximas melhorias apareceram no seu diagnóstico. Clique em descobrir
            para destravar a leitura completa em uma conversa com um Especialista ClubPetro.
          </p>
          <div class="recs-grid">${lockedRecsHtml}</div>
        </section>

        <section>
          ${SectionHeader({ num: 4, title: "Caminho sugerido e como o ClubPetro ajuda" })}
          <div class="path-card anim-rise" style="animation-delay:3000ms;">
            <span class="path-card-tag">Caminho sugerido</span>
            <p class="path-card-text">${escHtml(lvl.path)}</p>
            <hr class="path-card-rule">
            <span class="path-card-tag">Como o ClubPetro ajuda</span>
            <p class="path-card-text">${escHtml(lvl.clubpetroFit)}</p>
          </div>
        </section>

        <section>
          <div class="result-cta-final">
            <div class="cta-card is-primary anim-rise" style="animation-delay:3400ms;">
              <span class="cta-card-tag"><img class="cta-card-tag-png" src="/icons/headset.png" alt="" loading="lazy" decoding="async"/><span>Direto ao ponto</span></span>
              <h3 class="cta-card-title">Fale com um <em>Especialista ClubPetro</em>.</h3>
              <p class="cta-card-desc">
                Já entendeu a sua dor? Senta com quem vive o mercado de postos todo dia e
                vê o que dá pra melhorar no seu, como fazer e por onde começar.
              </p>
              <div class="cta-card-actions">
                ${Button({
                  variant: "on-dark",
                  size: "lg",
                  label: "Falar com um especialista",
                  iconRight: "arrow",
                  dataAction: "cta-whatsapp",
                })}
              </div>
            </div>
          </div>
        </section>

        <footer class="result-footnote anim-fade" style="animation-delay:3600ms;">
          <span class="result-footnote-save" id="saveMsg"></span>
          <span>Leitura completa das frentes restantes liberada após a conversa.</span>
        </footer>
      </article>
    </div>
    <span id="rScoreTarget" data-target="${score}" hidden></span>
  `;
}

/* Item do trio do hero: rótulo curto + valor + ícone temático. */
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

