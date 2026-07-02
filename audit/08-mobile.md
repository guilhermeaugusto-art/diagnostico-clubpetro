# Auditoria Mobile e Mídia · Diagnóstico ClubPetro

Escopo: `index.html`, `src/styles/*.css` (reset, tokens, base, components, animations),
`src/pages/*.ts` (Welcome, Question, Transition, Result), `src/components/AnswerCard.ts`,
`src/lib/trackVideo.ts`, `src/components/RadarChart.ts`, `src/components/Header.ts`,
`src/components/Button.ts`.

Modo: somente leitura. Nenhum arquivo de `src/` foi alterado.

## Resumo executivo

O achado mais crítico do app inteiro está em `index.html` linha 12: a tag `viewport` inclui
`maximum-scale=1.0`, que **bloqueia o pinch-to-zoom no iOS e Android**. Isso é proibido
explicitamente pelo enunciado desta auditoria e é uma violação de acessibilidade (WCAG 1.4.4
Resize Text) que afeta 100% dos usuários mobile, o público majoritário de um quiz distribuído
por link/WhatsApp. Nenhum overflow horizontal de layout foi encontrado (larguras fixas em CSS
são consistentemente `max-width`, nunca `min-width` ou `width` fixos em px que estourem 360px),
e nenhum input dispara zoom automático no iOS (todos os campos de texto usam `font-size: 16px`
ou `var(--fs-16)`). Vídeos locais (welcome-hero, frentista-*, gerente-*) estão corretamente
configurados com `muted` + `playsinline` (+ `autoplay`/`loop`); não há embeds de YouTube ou
qualquer `<iframe>` de mídia no produto (a única referência a "youtube" no código é um detector
de UTM/referrer em `src/lib/context.ts`, não relacionado a player). O segundo achado relevante é
que os CTAs principais do resultado (`.btn-hero-primary` / `.btn-hero-secondary`) usam
`min-height: 44px`, abaixo do próprio padrão `--touch: 48px` definido em `tokens.css` e citado
na regra 1.6 do RULES.md — inconsistência de alvo de toque, não bloqueante mas fora da própria
lei do projeto. Por fim, respondendo à pergunta de produto: trocar o fundo do diagnóstico
(`#FAF8F4`) para branco puro quebraria a fusão visual dos vídeos/imagens das trilhas, que vêm
pré-renderizados com fundo `#FAF8F4` exatamente para "colar" no fundo da página sem revelar
retângulo — ver seção dedicada abaixo.

| Severidade | Qtd. |
|---|---|
| Crítica | 1 |
| Alta | 0 |
| Média | 2 |
| Baixa | 2 |

## Tabela de achados

| ID | Título | Severidade | Arquivo:Linha | Evidência | Impacto | Recomendação | Confiança |
|---|---|---|---|---|---|---|---|
| M1 | `maximum-scale=1.0` na viewport bloqueia pinch-to-zoom | Crítica | `index.html:12` | `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0">` | Usuário mobile (maioria do tráfego de um quiz via WhatsApp/link) não consegue dar zoom para ler textos pequenos (ex.: `.answer-desc` 13px, `.bars-name` 8-9px, `.radar-label` 11-12px) nem para compensar baixa visão. Viola WCAG 1.4.4 (Resize Text) e é a causa mais provável de reclamações de "não dá pra dar zoom" / usabilidade ruim em iOS. | Remover `maximum-scale=1.0` (e não adicionar `user-scalable=no`); manter apenas `width=device-width, initial-scale=1, viewport-fit=cover`. | alta |
| M2 | CTAs do hero do resultado abaixo do padrão de toque do próprio projeto | Média | `src/styles/components.css:1196-1213` | `.btn-hero-primary, .btn-hero-secondary { ... min-height: 44px; ... }` | `--touch` é definida como `48px` em `tokens.css:144` e citada como "Área mínima de toque (regra 1.6)"; esses dois botões (CTA principal "Fale com um Especialista"/Raio-X na tela de resultado, incluindo a variante `.btn-hero-xl`) ficam abaixo do próprio padrão declarado do projeto, ainda que acima do mínimo genérico de 44px do WCAG. | Alinhar `min-height` de `.btn-hero-primary`/`.btn-hero-secondary` para `var(--touch)` (48px), consistente com `.btn`, `.rr-cta` e os demais CTAs do app. | média |
| M3 | Troca do fundo do diagnóstico para branco quebraria a fusão de vídeo/imagem (reportado, não é bug) | Média | `src/styles/base.css:24-31`; `src/styles/components.css:1909-1914,1927-1935` | Comentários explícitos no CSS: "Os vídeos das trilhas já vêm com o fundo recolorido nesse mesmo #FAF8F4, então fundem na página sem caixa"; `body:has(.fvideo-panel) { background-color: #faf8f4; }`; `body:has(.fimg-panel) { background-color: var(--fimg-bg, #f9f6ef); ... }` | Os arquivos `.mp4` locais (frentista-*, gerente-*) e as imagens da trilha do dono foram pré-processados com fundo `#FAF8F4` (creme), não branco. Se a página trocar para fundo branco puro (`#FFFFFF`), cada vídeo/imagem passaria a exibir um retângulo/tarja creme visível ao redor da cena (perda do efeito "PNG flutuante" descrito nos comentários do CSS), quebrando a fusão e a legibilidade do enquadramento. Contraste de texto (`--ink-900` sobre branco) melhoraria levemente, mas o custo visual nos vídeos é maior que o ganho de contraste, já que `#FAF8F4` vs `#FFFFFF` tem diferença de luminância mínima. | Não trocar o fundo sem re-exportar todos os vídeos/imagens das trilhas com fundo branco (retrabalho de produção de vídeo). Alternativa mais barata: manter `#FAF8F4` (já é quase branco e passa em contraste) ou aplicar branco só fora dos slots de mídia (`body:has(.fvideo-panel)`/`body:has(.fimg-panel)` já isolam esse caso, então tecnicamente dá para testar branco nas telas sem vídeo, ex. Welcome sem hero, sem tocar nas telas de pergunta com trilha). | média |
| M4 | Rótulos numéricos do radar e do gráfico de barras do header ficam muito pequenos em telas estreitas | Baixa | `src/styles/components.css:308,1142,1150,1331,1410-1411` | `.bars-name { font-size: 9px }` (desktop) e `8px` em mobile (`:1331`); `.radar-chart .radar-label { font-size: 12px }` reduzido para `11px` em mobile (`:1410`); valores (`radar-label-val`) em `12px` mobile. | Com `maximum-scale=1.0` bloqueado (M1), esses textos ficam ilegíveis para quem precisa de zoom; mesmo sem o bloqueio, 8-9px é abaixo do mínimo recomendado (~11px) para leitura confortável em telas de smartphone padrão (360-390px). | Após corrigir M1, considerar piso de 10-11px para `.bars-name` e não reduzir `.radar-label`/`.radar-label-val` abaixo de 12px no breakpoint mobile. | baixa |
| M5 | `overflow-x: hidden` no `body` mascara eventuais estouros em vez de preveni-los | Baixa | `src/styles/base.css:18` | `body { ... overflow-x: hidden; ... }` | Não foi encontrado nenhum elemento que hoje force overflow horizontal (larguras fixas no CSS são todas `max-width`), mas a regra é uma rede de segurança "silenciosa": se um componente futuro introduzir uma largura fixa maior que 100vw, o sintoma vira scroll vertical cortado ou conteúdo invisível na lateral, em vez de um scroll horizontal visível e fácil de diagnosticar. Risco arquitetural, não bug ativo hoje. | Nenhuma ação corretiva necessária agora; ao investigar futuros bugs de layout mobile, lembrar de remover temporariamente essa regra para expor overflow real. | baixa |

## Detalhes de verificação (o que foi checado e passou)

- **Viewport**: único ponto de definição é `index.html:12`; confirmado `viewport-fit=cover` presente (bom para notch/safe-area) mas acompanhado do `maximum-scale=1.0` proibido (M1). Não há `user-scalable=no`.
- **Overflow horizontal**: varredura de `width:` fixo em `components.css` não encontrou nenhum `width` fixo maior que ~300px fora de media queries `min-width` (desktop); todas as ocorrências relevantes em mobile (`max-width: 720px` e `max-width: 380px`) usam `max-width`, `min()`, ou percentuais. `.fvideo-panel`/`.fimg-panel` usam `min(50vw, 210px)` / `min(54vw, 230px)`, seguros em qualquer largura de tela.
- **Inputs e zoom no iOS**: todos os campos de texto (`welcome-field-input`, `contact-input`, `open-input`, `rr-input`) usam `font-size: 16px` explícito ou `var(--fs-16)` (=1rem=16px) tanto no desktop quanto nos blocos `@media (max-width: 720px)`. Nenhum campo abaixo de 16px foi encontrado. `contact-input`/`contact-head` reduzem outros textos em notebooks de tela curta (`min-width: 721px`), fora do escopo mobile.
- **Vídeo — autoplay/mute/playsinline**: `src/pages/WelcomePage.ts:104-116` (vídeo hero) tem `autoplay muted loop playsinline` no HTML, mais fallback `<source>` webm/mp4 e `<img>`/`poster`. `src/lib/trackVideo.ts:65-83` (`makeBaseVideo`, usado pelos vídeos de trilha frentista/gerente) seta `v.muted = true`, `v.playsInline = true` via propriedade **e** via atributo (`setAttribute("muted","")`, `setAttribute("playsinline","")`), redundância proposital que evita bugs conhecidos de Safari iOS quando só a propriedade JS é setada antes do elemento estar no DOM. Nenhum vídeo com som habilitado por padrão foi encontrado.
- **YouTube/iframe**: nenhum `<iframe>` de mídia (o único iframe do projeto é o `noscript` do GTM em `index.html:48`, inofensivo). A única ocorrência de "youtube" no código-fonte é `src/lib/context.ts` (detector de referrer/UTM para tracking), não um player embutido.
- **Imagens**: `.welcome-hero` (vídeo/imagem) usa `object-fit: contain`; `.fvideo`/`.fimg` usam `object-fit: cover` com `width/height: 100%`. Não há `<img>` sem `max-width`/controle de dimensão fora desses componentes controlados.
- **Alvos de toque**: `.answer-card` (cards de resposta) tem `min-height: 56px` desktop e `68px` mobile — acima do padrão. `.q-nav .btn` mobile `min-height: 52px`. `.rr-cta`/`.contact-stage .btn`/`.welcome-cta-row > .btn` usam `min-height: var(--touch)` (48px) ou `52-56px` explícitos em mobile. Exceção: `.btn-hero-primary`/`.btn-hero-secondary` em 44px (M2).
- **Respostas cabendo em 360-390px**: `.answer-grid` é coluna única até 720px, `.shell` usa `padding-inline: var(--sp-5)` (20px) por padrão e cai para `var(--sp-3)` (12px) abaixo de 380px (`components.css:1422-1426`), o que dá margem suficiente para textos de `.answer-title`/`.answer-desc` quebrarem linha sem cortar (`overflow-wrap: anywhere` já aplicado).
- **Above-the-fold / `vh`**: único uso de `vh` puro é como fallback antes de `dvh` em `base.css:19-20` e `183-184` (`min-height: 100vh; min-height: 100dvh;`), padrão correto que evita o problema clássico de `100vh` cortar conteúdo atrás da barra de endereço do navegador mobile. `.transition-wrap` usa `min-height: 60vh` (sem fallback `dvh`), mas por ser uma tela de transição de ~2.2s sem interação, o risco de a barra do navegador cortar CTA é baixo (não há CTA nessa tela).

## Nota sobre a pergunta de produto (fundo branco no diagnóstico)

Ver achado M3. Resumo direto: **não é seguro** trocar cegamente `#FAF8F4` por branco puro nas
telas de pergunta, porque os arquivos de vídeo (`frentista-*.mp4`, `gerente-*.mp4`) e as imagens
da trilha do dono foram produzidos/recoloridos especificamente para casar com `#FAF8F4` (ver
comentários em `src/lib/trackVideo.ts:23-25` e `src/styles/components.css:1909-1914`). Trocar só
o CSS sem reprocessar a mídia revelaria uma "moldura" creme ao redor de cada vídeo/imagem, o que
é pior visualmente do que o ganho marginal de contraste entre `#FAF8F4` e `#FFFFFF` (diferença de
luminância muito pequena, ambos leem como "quase branco").
