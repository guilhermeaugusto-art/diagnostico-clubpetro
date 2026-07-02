# Auditoria de Performance — Diagnóstico ClubPetro

Escopo: peso de bundle (JS/CSS), assets (vídeo/imagem/ícone), custo de
remontagem de DOM a cada navegação, listeners, fontes e trabalho síncrono
pesado (geração de PDF). Stack real: Vite + TypeScript vanilla (sem
framework), então toda "renderização" é `innerHTML` imperativo, não VDOM.
Somente leitura: nenhum arquivo de `src/` foi alterado.

## Resumo executivo

O maior risco de performance do produto está nos **assets de vídeo das
trilhas dono/gerente/frentista**: `public/videos/` sozinho pesa **13 MB** em
9 arquivos MP4 (~1.1–1.9 MB cada), todos com `preload="auto"` e, mais grave,
**cada bloco de vídeo instancia DOIS elementos `<video>` da mesma cena**
simultaneamente para fazer crossfade de loop (`trackVideo.ts`), o que
**dobra o download real** de cada cena tocada (o segundo vídeo começa a
carregar assim que o primeiro é criado, mesmo antes de precisar tocar).
Isso é agravado pelo fato de que as três trilhas somam 22 MB em `public/`
para um formulário de diagnóstico que deveria ser leve em mobile (o público
de posto de gasolina é majoritariamente 4G/redes fracas).

Em segundo lugar, `src/styles/components.css` tem 2664 linhas / 84 KB com
`cssCodeSplit: false` no `vite.config.ts` — ou seja, **100% do CSS do app
(incluindo estilos do PDF-adjacent, resultado, todas as trilhas) é carregado
de uma vez só na primeira tela** (welcome), mesmo que a pessoa nunca chegue
ao resultado ou nunca veja a trilha do frentista.

Terceiro, e positivo: o `jspdf` está corretamente lazy-carregado via
`import("./lib/report")` dentro de `generateAndUploadReport()`
(`src/app.ts:992`) e dentro do próprio `report.ts` (linhas 23 e 159) — não
há import estático de `jspdf` em nenhum arquivo do bundle inicial. Isso é
uma boa prática já implementada; não há achado de bug aqui, mas vale
registrar que a geração roda em `Promise.all` de dois PDFs completos
(comercial + cliente) na thread principal, sem `requestIdleCallback` nem
Web Worker — em aparelhos fracos pode gerar jank perceptível durante o clique
de "confirmar presença".

Não há evidência de vazamento clássico de listener (os `addEventListener`
em `document`/`window` — clique global, `mouseout`, `pagehide` — são
registrados uma única vez via guarda `actionsBound`/chamada única no boot;
os listeners por-tela como `open.addEventListener("input", ...)` são presos
a nós recriados a cada `innerHTML`, então morrem junto com o nó antigo).

## Achados

| ID | Título | Severidade | Arquivo:linha | Evidência | Impacto | Recomendação | Confiança |
|----|--------|-----------|----------------|-----------|---------|---------------|-----------|
| PERF-01 | Cada bloco de vídeo de trilha carrega a mesma cena em **dois** `<video>` simultâneos | Crítica | `src/lib/trackVideo.ts:88-139` (`makePlayer`), `:100-103` | `makePlayer` cria `a = makeBaseVideo(src)` e `b = makeBaseVideo(src)` com o **mesmo `src`**, ambos com `preload="auto"`, para viabilizar o crossfade de loop sem corte. Os dois elementos são anexados ao DOM (`wrap.append(a, b)`) e ambos iniciam carregamento assim que o player é criado. | Dobra o tráfego de download por cena tocada (ex.: um vídeo de 1.5 MB vira ~3 MB de download real por bloco visto), em um público que majoritariamente acessa via 4G no celular do posto. Com 4–5 blocos por trilha, o pior caso de dados baixados por sessão completa pode passar de 10 MB só de vídeo. | Adiar o carregamento do segundo `<video>` (`b`) para só quando o primeiro estiver perto do fim do loop (ex.: setar `b.src` dentro do handler que hoje já dispara o crossfade, em vez de no `makeBaseVideo` inicial), ou usar `preload="metadata"` no standby e só trocar para `"auto"`/chamar `.load()` quando faltar ~2s pro fim. | Alta |
| PERF-02 | 13 MB de vídeo MP4 em `public/videos/` sem variante de menor resolução/bitrate para mobile | Alta | `public/videos/*.mp4` (9 arquivos, 1.1–1.9 MB cada), referenciados em `src/lib/trackVideo.ts:27-40` | `du -sh public/videos` = 13 MB; nenhum `<source>` alternativo por `media`/`sizes` nem variante `.webm` menor; todos os vídeos têm `preload="auto"` (`trackVideo.ts:74`). | Em conexão 4G típica de posto (muitas vezes instável), isso é uma fatia grande do orçamento de dados só para elementos decorativos (a própria doc do arquivo diz "só apresentação: não toca em pergunta, pontuação, roteamento nem envio"). Risco de abandono do quiz por carregamento lento em mobile. | Gerar variante `.webm`/H.264 menor (720p ou inferior, bitrate reduzido) para mobile via media query de largura, ou trocar `preload="auto"` por `preload="metadata"` e só disparar `load()` quando o bloco for de fato exibido (o preload seguinte já é feito sob demanda em `preload(blocks[idx+1]?.src)`, então dá pra alinhar o preload inicial também). | Média |
| PERF-03 | `cssCodeSplit: false` faz todo o CSS (2664 linhas / 84 KB de `components.css`) carregar de uma vez na tela de welcome | Alta | `vite.config.ts:10`; `src/styles/components.css` (2664 linhas, 84 KB) | `build.cssCodeSplit: false` combinado com `src/styles/index.css` importando todos os parciais (`reset`, `tokens`, `base`, `animations`, `components`) resulta em um único arquivo CSS de saída aplicado a **todas** as telas (welcome, pergunta, transição, resultado, todas as trilhas) já no primeiro paint. | CSS não usado na tela inicial (estilos de resultado, radar, PDF-like cards, trilhas frentista/gerente que a pessoa pode nunca ver) bloqueia o parse/render inicial. Em CSS puro isso é "só" 84 KB, mas é 100% do peso de estilo carregado antes mesmo de saber qual trilha o usuário vai seguir. | Considerar dividir por rota/tela (welcome vs question vs result) se o ganho de LCP compensar a complexidade, ou ao menos auditar seletores mortos em `components.css` com uma ferramenta de CSS coverage antes de decidir. Não é urgente dado o tamanho absoluto (84 KB minifica bem), mas é a maior violação de "carregar só o necessário" do projeto. | Média |
| PERF-04 | `assetsInlineLimit: 8192` pode inlinar assets de até 8 KB como base64 no bundle JS/CSS | Média | `vite.config.ts:11` | `assetsInlineLimit: 8192` (8 KB) é mais alto que o default do Vite (4 KB). Ícones PNG do diretório `public/icons` variam de poucos KB a 64 KB (`marca.png`), mas eles estão em `public/` (fora do pipeline de asset do Vite, servidos como estáticos, não afetados por este limite) — o risco real é para qualquer asset referenciado via `import` dentro de `src/` (CSS `url()` de `src/styles`) que hoje fique abaixo de 8 KB e seja embutido como base64 no CSS, inchando o CSS crítico único gerado por PERF-03. | Assets pequenos inlinados aumentam o peso do CSS crítico (que já é grande, ver PERF-03) em vez de serem cacheáveis separadamente pelo navegador. | Baixar o limite para o default (4096) ou auditar quais assets em `src/` de fato passam por esse pipeline hoje; se nenhum, achado é de baixo risco prático e pode ser rebaixado. | Baixa |
| PERF-05 | Geração de dois PDFs completos roda em `Promise.all` na thread principal sem idle scheduling | Média | `src/app.ts:989-1000` (`generateAndUploadReport`); `src/lib/report.ts:22,158` | `const [comercial, cliente] = await Promise.all([generateReportPdf(content), generateClientPdf(content)])` — ambas as funções fazem dezenas de chamadas síncronas de desenho (`doc.text`, `doc.roundedRect`, `wrap`/`splitTextToSize`) em loop sobre `content.dimensions`, `content.recommendations`, `content.questionsAndAnswers` (pode ser uma lista longa de 40+ perguntas, ver `drawSection "11. Respostas completas"` em `report.ts:136-146`). | Dispara logo depois do clique em "confirmar presença" (`submitLead` → `generateAndUploadReport().catch(...)`, `app.ts:983`), no meio da navegação de resultado. Em aparelhos fracos, dois PDFs de várias páginas gerados na thread principal (ainda que `jsPDF` seja majoritariamente síncrono e leve por chamada) podem coincidir com a animação de score (`animateScore`, `app.ts:840-852`) e causar jank perceptível, mesmo sendo "fire and forget" sem bloquear a UI de forma bloqueante hard (é `async`, mas as chamadas internas do jsPDF são síncronas dentro de cada microtask). | Considerar mover a geração de PDF para um Web Worker (jsPDF funciona fora do DOM) ou ao menos serializar via `requestIdleCallback`/`setTimeout(…, 0)` para não competir com a animação de score que roda no mesmo instante. Prioridade baixa/média porque hoje já é assíncrono e best-effort (erro é só logado, `markReportFailed`). | Média |
| PERF-06 | `<link rel="preload" as="image" href="/welcome-hero.webp">` referencia o poster que também é usado como último `<source>`/fallback dentro do `<video>`, mas WebM (3.5 MB) e MP4 (2.9 MB) do hero não são preload-hinted, dependendo só do `autoplay`/`preload="auto"` do `<video>` | Baixa | `index.html:42`; `src/pages/WelcomePage.ts:104-116` | O `<link rel=preload>` cobre só o poster (248 KB); os vídeos reais de 2.9–3.5 MB carregam via atributo do `<video>` sem prioridade de preload explícita no `<head>`, competindo por prioridade de rede com fontes (`fonts.googleapis.com`) e o script GTM/Pixel que já correm no topo do `<head>`. | LCP/hero pode atrasar em conexões lentas porque scripts de terceiro (GTM, Meta Pixel) e fontes competem por banda antes do vídeo do hero começar a baixar. | Não é um bug isolado, é ordenação de prioridade de carregamento; se o hero for considerado crítico para conversão, mover o script GTM para depois do conteúdo principal ou usar `fetchpriority="high"` no `<video>`/fonte helps. Severidade baixa porque já existe poster leve (248 KB) cobrindo o LCP visual. | Baixa |
| PERF-07 | `welcome-hero.mp4` (2.9 MB) e `welcome-hero.webm` (3.5 MB) são baixados como pares de fallback, mas nenhum dos dois é o formato mais eficiente disponível hoje (AV1/H.265) | Baixa | `public/welcome-hero.mp4`, `public/welcome-hero.webm`; `src/pages/WelcomePage.ts:113-114` | `du -sh` mostra webm maior que mp4 (3.5 MB vs 2.9 MB) para a mesma cena — o WebM parece estar sendo usado só pelo canal alpha (fundo transparente), conforme comentário em `app.ts:710-713`, então o par é funcionalmente necessário, mas o peso segue alto para um vídeo decorativo do hero. | Mesma classe de risco do PERF-02 mas para a tela de entrada, que é a primeira impressão e a mais sensível a abandono. | Se possível, comprimir mais agressivamente ou reduzir duração/resolução do hero mantendo o alpha; ou considerar canvas/Lottie leve para o efeito, se o conteúdo visual permitir. Confirmar antes se compressão adicional já foi tentada (não verificável só por leitura de código). | Baixa |
| PERF-08 | Todos os 48 ícones PNG em `public/icons/` são referenciados no código-fonte (nenhum órfão identificado) — item de verificação, não é um achado de desperdício | Informativo | `src/lib/iconAssets.ts` | `grep -rhoE "icons/[a-z0-9-]+\.png" src` retorna 48 caminhos distintos, batendo com os 48 arquivos físicos em `public/icons/`. | Nenhum. Confirma que não há ícones mortos sendo publicados sem uso — ponto positivo, registrado para não ser reaberto em auditoria futura. | Nenhuma ação necessária. | Alta |

## Notas metodológicas

- Tamanhos de arquivo obtidos via `du -sh` local (Git Bash) sobre a árvore
  atual de `public/`; não foi feito build de produção (`vite build`) nesta
  auditoria, então os números de bundle JS/CSS finais (após minificação/
  gzip) não foram medidos diretamente — as observações sobre `components.css`
  (2664 linhas / 84 KB) são do arquivo-fonte, não do artefato final.
- Não foi encontrado nenhum import estático de `jspdf` fora do lazy-import
  em `src/lib/report.ts` — a mecânica de lazy-loading do PDF está correta e
  não gerou achado de severidade.
- Listeners globais (`click`, `mouseout`, `pagehide`) são registrados uma
  única vez por boot (guardas `actionsBound` em `src/app.ts:205-208` e
  chamada única de `setupExitRescue`/`boot`), não configurando vazamento
  clássico de listener acumulado a cada re-render.
