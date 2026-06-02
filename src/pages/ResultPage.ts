import { BLOCKS, BLOCK_ORDER, type BlockId } from "../data/blocks";
import { insightFor } from "../data/insights";
import { levelFor } from "../data/levels";
import { buildResultRecommendations } from "../data/recommendations";
import { PillarCard } from "../components/PillarCard";
import { RecommendationCard } from "../components/RecommendationCard";
import { LockedCard } from "../components/LockedCard";
import { SectionHeader } from "../components/SectionHeader";
import { Button } from "../components/Button";
import { rankedBlocks, totalScore, weakBlockIds, blockScores } from "../lib/scoring";
import type { AppState } from "../lib/state";
import { escHtml } from "../lib/format";
import { Icons } from "../lib/icons";

const LOCK_TAGS = [
  "Oportunidade adicional",
  "Próxima melhoria",
  "Análise complementar",
  "Oportunidade adicional",
  "Próxima melhoria",
  "Análise complementar",
  "Oportunidade adicional",
  "Próxima melhoria",
];

export function ResultPage(state: AppState): string {
  const score = totalScore(state);
  const lvl = levelFor(score);
  const ranked = rankedBlocks(state);
  const bs = blockScores(state);
  const openBlockIds = new Set(ranked.slice(0, 2).map((x) => x.id));

  const pillarsHtml = BLOCK_ORDER
    .filter((b) => bs[b].possible > 0) // só mostra frentes que tiveram pergunta visível
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

  const weak = weakBlockIds(state, 4);
  const { open, locked } = buildResultRecommendations(weak);

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
        tag: LOCK_TAGS[i % LOCK_TAGS.length],
        delayMs: 2700 + i * 80,
      }),
    )
    .join("");

  return `
    <div class="shell stage">
      <article class="result">

        <header class="result-hero anim-rise">
          <div class="result-hero-grid">
            <div>
              <span class="eyebrow on-dark">Resultado do diagnóstico</span>
              <p class="result-pre">${escHtml(lvl.tagline)}</p>
              <div class="score-dial-wrap">
                <span class="score-number" id="rScoreNumber">0</span>
                <span class="score-of">/100</span>
              </div>
            </div>
            <div class="result-level">
              <span class="result-level-tag">Faixa</span>
              <h2 class="result-level-name">${escHtml(lvl.name)}</h2>
              <p class="result-level-msg">${escHtml(lvl.reading)}</p>
            </div>
          </div>
        </header>

        <section class="result-diagnosis-grid">
          ${diagnosisCard("Onde dói", lvl.pain, "alert")}
          ${diagnosisCard("Gancho de resolução", lvl.hook, "target")}
        </section>

        <section>
          ${SectionHeader({ num: 1, title: "Leitura por frente" })}
          <div class="pillar-grid">${pillarsHtml}</div>
        </section>

        <section>
          ${SectionHeader({ num: 2, title: "Recomendações que você pode aplicar agora" })}
          <div class="recs-grid">${openRecsHtml}</div>
        </section>

        <section>
          ${SectionHeader({ num: 3, title: "Oportunidades adicionais identificadas" })}
          <div class="recs-grid">${lockedRecsHtml}</div>
        </section>

        <section>
          ${SectionHeader({ num: 4, title: "Próximos passos" })}
          <div class="cta-grid">
            <div class="cta-card is-primary anim-rise" style="animation-delay:3200ms;">
              <span class="cta-card-tag">${Icons.whatsapp}<span>30 minutos no seu posto</span></span>
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
              <span class="cta-card-tag">${Icons.calendar}<span>Toda terça às 19h</span></span>
              <h3 class="cta-card-title">RaioX do posto, <em>conversa aberta</em>.</h3>
              <p class="cta-card-desc">
                Encontro em vídeo sobre as dores que aparecem em diagnósticos como o seu.
              </p>
              <div class="cta-card-actions">
                ${Button({
                  variant: "primary",
                  label: "Reservar vaga",
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

function diagnosisCard(title: string, body: string, icon: "alert" | "target"): string {
  return `
    <article class="diag-card anim-rise" style="animation-delay:1200ms;">
      <span class="diag-card-icon">${Icons[icon]}</span>
      <div class="diag-card-body">
        <span class="diag-card-title">${escHtml(title)}</span>
        <p class="diag-card-text">${escHtml(body)}</p>
      </div>
    </article>
  `;
}
