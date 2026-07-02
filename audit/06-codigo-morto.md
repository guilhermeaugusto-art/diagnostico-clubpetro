# Auditoria de Código Morto · Diagnóstico ClubPetro

Data: 2026-07-02
Escopo: `src/**`, `public/**`, `index.html`, `package.json`.
Metodologia: grep exaustivo por nome de arquivo, export, classe CSS e chave de ícone em todo `src/`,
cruzando cada candidato "sem hit" com possíveis construções dinâmicas (`class="x${var}"`, `Icons[name]`,
`ICON_ASSETS[name]`) antes de confirmar como morto. Cada achado abaixo traz o grep usado e onde ele rodou.

## Resumo executivo

O código morto neste projeto está concentrado em **três bolsões**, todos originados do mesmo evento: uma
reescrita do `ResultPage.ts` que trocou o design antigo (classes `result-hero-*`, `frente-card-*`,
`plan-card-*`, `contact-*`, `lock-gate*`, `email-step-*`, `radar-bar-*`, `rr-problem-*`, `rr-portao-*`,
`rr-confirm-*`, `frentista-final`, `frentista-recognition`) pelo design atual (classes `rr-hero`, `rr-cta`,
`rr-steps`, `rr-gate`, `rr-value`, `rr-bar-*`, `rr-raiox-*`), sem que o CSS antigo fosse removido:

1. **CSS órfão massivo em `src/styles/components.css`**: aproximadamente **120 classes** (um bloco contíguo
   de cerca de 1300 linhas, do começo da seção `RESULT` até pouco antes da seção redesenhada) não têm
   nenhum ponto de aplicação em `src/**/*.ts`. É o achado de maior volume e maior risco de confusão para quem
   for mexer no CSS depois (fácil editar a classe errada achando que ela está em uso).
2. **34 dos 48 ícones PNG catalogados em `src/lib/iconAssets.ts`** (`public/icons/*.png`) nunca são
   passados para `renderIcon()`; só aparecem na própria definição do mapa. Os assets físicos continuam
   publicados e seriam baixados/servidos por qualquer ferramenta que varra `public/` sem saber disso.
3. **42 dos 45 ícones SVG inline em `src/lib/icons.ts`** nunca são referenciados via `Icons.<key>`; só os
   3 usados (`check`, `arrowRight`, `arrowLeft`) sobrevivem no bundle final (tree-shaking de objeto JS não
   remove propriedades não usadas do objeto `Icons`, então o objeto inteiro continua no JS, só não é
   exercitado em runtime).

Fora desses três bolsões, o restante da árvore de `src/` está bem enxuto: nenhum arquivo `.ts` inteiro está
órfão exceto `SectionHeader.ts`, nenhuma dependência do `package.json` está sem uso, e todos os vídeos/imagens
em `public/` (welcome-hero, `dono-*.webp`, `frentista-*`, `gerente-*`) têm referência confirmada em código.

**Achado mais crítico**: MORTO-01 (bloco de ~120 classes CSS órfãs em `components.css`), por volume, por
risco de manutenção futura (edições em classe que parece viva mas não é) e por ser sintoma de uma migração
de design incompleta que também deixou PNGs e SVGs órfãos atrás de si.

---

## Achados

| ID | Título | Severidade | Arquivo:Linha | Evidência | Impacto | Recomendação | Confiança |
|----|--------|------------|----------------|-----------|---------|---------------|-----------|
| MORTO-01 | Bloco de ~120 classes CSS órfãs do `ResultPage` antigo em `components.css` | Alta | `src/styles/components.css:628-2073` (aprox.; ver lista abaixo) | Nenhuma das classes abaixo tem hit em `grep -rn "<classe>" src/**/*.ts`: `contact-card`, `contact-field`, `contact-field-hint`, `contact-field-label`, `contact-head`, `contact-input`, `contact-nav`, `contact-stage`, `contact-trust`, `result-hero`, `result-hero-grid`, `result-hero-headline`, `result-hero-lede`, `result-hero-left`, `result-hero-radar`, `result-hero-radar-reading`, `result-hero-scoreblock`, `result-hero-tag`, `result-hero-tag-dot`, `result-hero-topline`, `radar-bar-row`, `radar-bar-name`, `radar-bar-track`, `radar-bar-fill`, `radar-bar-val`, `radar-bars`, `plan-card`, `plan-card-head`, `plan-card-name`, `plan-card-score`, `plan-grid`, `plan-item`, `plan-item-apoio`, `plan-item-now`, `plan-item-tag`, `plan-item-text`, `frente-card`, `frente-card-bar`, `frente-card-fill`, `frente-card-head`, `frente-card-line`, `frente-card-name`, `frente-card-score`, `frente-card-tag`, `frente-grid`, `frentes-read`, `lock-gate`, `lock-gate-field`, `lock-gate-label`, `lock-gate-progress`, `lock-gate-text`, `lock-gate-title`, `lock-gate-why`, `locked-content`, `locked-plan`, `email-step`, `email-step-body`, `email-step-done`, `email-step-eyebrow`, `email-step-row`, `email-step-text`, `email-step-title`, `frentista-final`, `frentista-recognition`, `result-foot`, `result-foot-save`, `result-level`, `result-level-inline`, `result-level-msg`, `result-level-name`, `result-level-tag`, `result-locked`, `result-next`, `result-next-micro`, `result-trio`, `result-trio-body`, `result-trio-icon`, `result-trio-item`, `result-trio-label`, `result-trio-value`, `score-dial-wrap`, `score-number`, `score-of`, `section-intro`, `section-note`, `is-hidden`, `radar-weakest`, `radar-weakest-label`, `radar-weakest-line`, `radar-weakest-name`, `radar-panel-eyebrow`, `btn-hero-primary`, `btn-hero-secondary`, `btn-hero-xl`, `btn-cta-png`, `welcome-field-hint`, `rr-locked`, `rr-confirm`, `rr-confirm-badge`, `rr-confirm-title`, `rr-confirm-text`, `rr-confirm-done`, `rr-problem`, `rr-problem-body`, `rr-problem-card`, `rr-problem-gauge*` (6 sub-classes), `rr-problem-hook`, `rr-problem-text`, `rr-locked-seal`, `rr-locked-seal-badge`, `rr-portao`, `rr-portao-badge`, `rr-portao-done`, `rr-portao-inner`, `rr-portao-micro`, `rr-portao-text`, `rr-portao-title`, `rr-raiox-bridge`, `rr-raiox-cta`, `rr-raiox-done`, `rr-raiox-gate`, `rr-reassure-light`, `rr-sub`. Em contraste, o `src/pages/ResultPage.ts` atual (lido por completo) usa exclusivamente `rr-hero`, `rr-cta*`, `rr-bar*`, `rr-steps`, `rr-gate*`, `rr-raiox*` (sem `-cta`/`-done`/`-bridge`/`-gate` como sufixo próprio), `rr-value*`, `rr-specialist*`, `rr-frentista*`, `rr-eyebrow`, `rr-section-*`. Os comentários de seção no próprio CSS ("SEÇÃO 2 · Veja seu problema", "SEÇÃO 3 · Selo sobre os passos embaçados", "SEÇÃO 5 · Portão único (conversão)") descrevem uma versão anterior do fluxo de resultado (com "portão de e-mail", "selo" e "problema") que não existe mais em `ResultPage.ts`. | Nenhum impacto funcional (CSS não usado não quebra nada), mas é ruído de manutenção real: ~1300 linhas de um arquivo de 2664 linhas (quase metade) descrevem um layout que não existe mais no DOM atual, aumentando o custo de qualquer refactor de `components.css` e o risco de um dev editar a classe "parecida" errada (ex.: mexer em `.rr-raiox-cta` achando que afeta o CTA do Raio-X atual, quando o real é `.rr-cta` dentro de `.rr-raiox`). | Confirmar com quem fez a reescrita do `ResultPage.ts` se o design antigo (com portão de e-mail, selo de bloqueio e cards de plano) foi de fato descontinuado; se sim, remover o bloco morto em um PR dedicado só de CSS, testando visualmente Welcome/Question/Transition/Result antes e depois (algumas classes genéricas como `is-hidden` podem ter nome comum e merecem checagem manual extra antes de apagar). | Alta |
| MORTO-02 | 34 de 48 ícones PNG do catálogo `ICON_ASSETS` nunca chegam a `renderIcon()` | Média | `src/lib/iconAssets.ts:8-79` | `renderIcon()` (`src/lib/renderIcon.ts:10`) só recebe valores vindos de `icon:` em `src/data/blocks.ts` e `src/data/recommendations.ts` (único chamador real do tipo `AnyIcon` no projeto). Nesses dois arquivos os únicos `"asset:*"` usados são: `asset:atendimento`, `asset:bomba`, `asset:dados-analise`, `asset:dados-base`, `asset:diagnostico`, `asset:equipe-mercado`, `asset:frentista`, `asset:gestao`, `asset:marca`, `asset:margem`, `asset:posto`, `asset:projetos`, `asset:qualidade`, `asset:real` (14 chaves). As outras 34 chaves definidas em `ICON_ASSETS` (`alvo`, `apresentacao`, `atencao-circulo`, `aviso-triangulo`, `balanca`, `cadeado`, `calendario`, `carregador-ev`, `carrinho`, `cesta`, `check`, `concorrencia`, `concorrente`, `conversa`, `coracao`, `crescimento`, `cronometro`, `dois`, `engrenagens`, `envelope`, `escudo`, `estrela`, `executivo`, `gangorra`, `grupo`, `headset`, `lampada`, `lavagem`, `outro`, `repetir`, `tres`, `um`, `visao`, `whatsapp`) não aparecem em nenhum outro `.ts` do projeto além da própria linha de definição em `iconAssets.ts` (`grep -rln "icons/<nome>.png" src index.html` retorna 1 hit = só `iconAssets.ts`). Os arquivos PNG correspondentes continuam fisicamente em `public/icons/*.png` e seriam publicados no deploy. | Bytes mortos publicados (34 PNGs no `public/icons/`, peso somado não trivial para ícones ilustrativos); nenhum bug funcional porque o código nunca tenta acessá-los. Risco de "achar" que um ícone está disponível no design system e ele nunca renderizar (dev tenta usar `icon: "asset:visao"` em um novo card achando que já está testado). | Se as 34 chaves foram catalogadas para telas futuras (comentários no arquivo sugerem curadoria intencional, ex. "Numerados (tempo de operação do gerente: 1, 2, 3)" para `um/dois/tres`), manter só se houver plano de uso próximo; caso contrário, remover a entrada do `ICON_ASSETS` e o `.png` correspondente de `public/icons/`. Verificar cada PNG individualmente antes de apagar (baixo custo, mas confirmar com design). | Alta |
| MORTO-03 | 42 de 45 ícones SVG inline em `Icons` (`src/lib/icons.ts`) nunca são referenciados | Média | `src/lib/icons.ts:11-345` | Único consumidor de `Icons.<key>` no projeto é via import direto (não indexação dinâmica por string) em `src/components/AnswerCard.ts:33` (`Icons.check`), `src/components/Button.ts:34` (`Icons.arrowRight`) e `:37` (`Icons.arrowLeft`). `grep -rn "Icons\.<key>\b" src --include=*.ts` retorna 0 para as outras 42 chaves definidas no objeto: `alert`, `award`, `badge`, `bolt`, `calendar`, `calendarSolid`, `chart`, `clock`, `cogs`, `coin`, `dashboard`, `flame`, `fuelDrop`, `fuelPump`, `heart`, `info`, `layers`, `lock`, `mail`, `medal`, `megaphone`, `message`, `phone`, `priceWar`, `repeat`, `scale`, `scan`, `search`, `shield`, `shoppingBag`, `shoppingCart`, `spark`, `stars`, `store`, `target`, `team`, `trendUp`, `user`, `wash`, `whatsapp`, `whatsappBrand`. `renderIcon.ts:15` faz `Icons[name as IconName]`, mas `name` só chega ali vindo do fluxo de `AnyIcon` de `blocks.ts`/`recommendations.ts`, que usa exclusivamente `"asset:*"` (PNG), nunca uma key de `Icons` (SVG); ou seja, mesmo o fallback dinâmico de `renderIcon` nunca é exercitado com uma key de `Icons` na prática atual. | Nenhum peso de rede adicional relevante (SVGs são strings JS já dentro do bundle, mas o objeto inteiro entra no bundle porque é `export const`); é ruído de manutenção: um catálogo de 45 ícones do qual só 3 são usados sugere um design system planejado e abandonado, ou um remanescente de versão anterior do produto (nomes como `priceWar`, `fuelPump`, `store`, `wash` remetem a categorias de posto que hoje são cobertas pelos PNGs de `iconAssets.ts`, sugerindo migração de SVG inline para PNG flat que não completou a limpeza). | Se o objeto `Icons` foi substituído pelo catálogo PNG (`ICON_ASSETS`) como fonte principal de ícones ilustrativos, considerar reduzir `Icons` só às chaves realmente usadas (`check`, `arrowRight`, `arrowLeft`) e mover o restante para fora do bundle, ou documentar explicitamente que é um catálogo "de reserva" mantido de propósito. | Alta |
| MORTO-04 | Componente `SectionHeader` nunca é importado | Baixa | `src/components/SectionHeader.ts:8` | `grep -rn "SectionHeader" src --include=*.ts` só retorna a própria declaração (`interface SectionHeaderProps` linha 3 e `export function SectionHeader` linha 8) dentro do arquivo `src/components/SectionHeader.ts`; nenhum `import { SectionHeader }` existe em `src/app.ts`, `src/pages/*.ts` ou outro componente. | Arquivo de 17 linhas sem custo de manutenção relevante, mas é um export público morto que aparece em buscas/autocomplete como se fosse usado em algum lugar do fluxo de perguntas (nome sugere cabeçalho de seção de pergunta, mas `QuestionPage.ts` não o usa). | Remover o arquivo `src/components/SectionHeader.ts`, ou, se o padrão visual "número + título + régua" ainda for desejado em alguma tela futura (ex. PDF ou seção do Raio-X), anotar a intenção no próprio arquivo. | Alta |

---

## Itens verificados e descartados (falso positivo evitado)

Para deixar claro o que foi checado e **não** entrou como achado, por ter sido confirmado como uso dinâmico
ou construção via template literal:

- `.radar-chart--paper` / `.radar-chart--dark`: construída dinamicamente em `src/components/RadarChart.ts:113`
  via `class="radar-chart radar-chart--${theme}"`, com `theme` vindo de `ResultPage.ts:112`
  (`RadarChart({ state, width: 460, theme: "paper" })`). **Uso confirmado**, não é código morto.
- `.q-stage-${p.videoSide}` / `.q-stage-${p.imageSide}` (`src/pages/QuestionPage.ts:41,51`): construção
  dinâmica confirmada, não avaliada individualmente por classe final (fora do escopo desta varredura simples
  por nome literal, mas não sinalizada como suspeita).
- `.radar-dot` / `.radar-dot-lead` / `.radar-label` / `.radar-label-lead` / `.radar-label-val`
  (`src/components/RadarChart.ts:65,101,105,108`): construção dinâmica confirmada via template literal,
  **não** são as mesmas classes que `.radar-bar-*` (do bloco morto MORTO-01, que é outro componente
  descontinuado).
- `jspdf` (`package.json` dependencies): usado via `await import("jspdf")` em
  `src/lib/report.ts:23` e `:159`. **Não é dependência morta.**
- Todos os vídeos/pôsteres em `public/videos/*.mp4|.jpg` (`frentista-1..4`, `gerente-1..5`): referenciados em
  `src/lib/trackVideo.ts`. **Não são assets órfãos.**
- Todas as imagens `public/dono/*.webp`: cada uma tem pelo menos 1 hit em `src/**/*.ts`. **Não são órfãs.**
- `public/welcome-hero.mp4|.webm|.webp`: referenciadas em `src/pages/WelcomePage.ts:105-115` e
  `index.html:42` (preload). **Não são órfãs.**
- `public/supabase.js`: carregado em `index.html:44` e consumido via `window.supabase` em
  `src/lib/supabase.ts`. **Não é órfão.**
- Nenhum embed de YouTube foi encontrado em `index.html` ou `src/**` (busca por `youtube`, `youtu.be`,
  `<iframe` não retornou resultado); todos os vídeos do produto são arquivos locais `.mp4`/`.webm`.
- Dependências do `package.json` (`typescript`, `vite`, `jspdf`): todas em uso (build tooling + import direto).
  Nenhuma dependência não usada encontrada.
- Nenhum arquivo `.ts` inteiro está órfão além de `SectionHeader.ts`: todos os outros 34 arquivos de
  `src/components`, `src/data`, `src/lib`, `src/pages` têm pelo menos um importador confirmado (ver grade de
  checagem cruzada rodada nesta auditoria: `AnswerCard`, `BarsProgress`, `Button`, `Header`, `Logo`,
  `RadarChart` todos importados; `levels`, `radar-reading`, `recommendations`, `urgency`, `context`,
  `format`, `iconAssets`, `icons`, `raiox`, `renderIcon`, `reportContent`, `routing`, `storage`, `supabase`,
  `trackImage`, `trackVideo` todos importados por pelo menos um arquivo).

---

## Notas metodológicas

- Toda alegação "sem hit" foi obtida com `grep -rn` restrito a `src/**/*.ts` (mais `index.html` quando
  relevante para assets), rodado a partir da raiz `C:/Users/Lenovo/diagnostico-clubpetro`, sem alterar nenhum
  arquivo do projeto (auditoria somente leitura).
- Para cada candidato a classe CSS morta, o processo foi: (1) listar todas as classes de primeiro nível em
  `components.css` via `grep -oE '^\.[a-zA-Z][a-zA-Z0-9_-]*'`, (2) para cada uma, grep por substring no nome
  em todos os `.ts`, (3) para toda classe sem hit, ler o arquivo `.ts` correspondente à tela citada nos
  comentários do CSS (`ResultPage.ts`, `WelcomePage.ts`, `QuestionPage.ts`) para confirmar visualmente que a
  classe de fato não é gerada, descartando falsos positivos de construção dinâmica (confirmados 3 casos:
  `radar-chart--{theme}`, `radar-dot{lead}`, `radar-label{lead}`, todos em `RadarChart.ts`, todos MANTIDOS
  como vivos).
- Não foi feita varredura de `tokens.css`, `base.css`, `reset.css` e `animations.css` linha a linha por
  variável CSS individual (custom properties `--*`), por ser um universo muito maior e de menor sinal
  (variáveis de design system tendem a ser reaproveitadas ao longo do tempo); se desejado, pode ser objeto de
  uma auditoria complementar focada em tokens.
