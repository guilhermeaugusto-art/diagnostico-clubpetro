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

              <div class="result-hero-cta-row">
                <button class="btn btn-hero-primary" type="button" data-action="cta-whatsapp">
                  <img class="btn-cta-png" src="/icons/headset.png" alt="" loading="lazy" decoding="async"/>
                  <span>Falar com especialista</span>
                </button>
                <button class="btn btn-hero-secondary" type="button" data-action="cta-raiox">
                  <img class="btn-cta-png" src="/icons/calendario.png" alt="" loading="lazy" decoding="async"/>
                  <span>Agendar raio-x</span>
                </button>
              </div>
            </div>

            <div class="result-hero-radar anim-fade delay-2">
              ${RadarChart({ state, width: 480 })}
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
          ${SectionHeader({ num: 5, title: "Próximos passos" })}
          <div class="cta-grid">
            <div class="cta-card is-primary anim-rise" style="animation-delay:3200ms;">
              <span class="cta-card-tag"><img class="cta-card-tag-png" src="/icons/whatsapp-color.png" alt="" loading="lazy" decoding="async"/><span>30 minutos no seu posto</span></span>
              <h3 class="cta-card-title">Levar o resultado para um <em>Especialista ClubPetro</em>.</h3>
              <p class="cta-card-desc">
                Conversa direta sobre os números do seu posto e o caminho para o que apareceu aqui.
              </p>
              <div class="cta-card-actions">
                ${Button({
                  variant: "on-dark",
                  size: "lg",
                  label: "Fale com um Especialista ClubPetro",
                  iconRight: "arrow",
                  dataAction: "cta-whatsapp",
                })}
              </div>
            </div>
            <div class="cta-card anim-rise" style="animation-delay:3300ms;">
              <span class="cta-card-tag"><img class="cta-card-tag-png" src="/icons/calendario.png" alt="" loading="lazy" decoding="async"/><span>Toda terça às 19h</span></span>
              <h3 class="cta-card-title">RaioX do posto, <em>conversa aberta</em>.</h3>
              <p class="cta-card-desc">
                Encontro em vídeo sobre as dores que aparecem em diagnósticos como o seu.
                Reserve sua vaga e receba o convite no seu e-mail.
              </p>
              <div class="cta-card-actions">
                ${Button({
                  variant: "primary",
                  label: "Reservar vaga e agendar",
                  iconRight: "arrow",
                  dataAction: "cta-raiox",
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

