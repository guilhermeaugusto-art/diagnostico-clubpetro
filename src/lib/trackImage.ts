/* Camada de imagem em blocos da trilha do dono.
   As perguntas do dono sao divididas em 5 blocos. Cada bloco mostra uma imagem
   FIXA no painel lateral. Trocar de pergunta dentro do bloco NAO muda a imagem;
   ela so troca (crossfade + leve zoom + morph da cor de fundo) ao entrar no
   bloco seguinte.

   Persistencia: o host (que contem as imagens) e guardado numa variavel JS,
   sobrevive ao innerHTML como no destacado e e RE-ANEXADO no slot a cada render.

   Fundo casado: cada imagem tem um creme proprio (medido). A pagina assume essa
   cor (via --fimg-bg) por bloco e as bordas dissolvem nela (mascara), entao a
   ilustracao parece embutida na pagina, sem moldura. Imagens com chao mais
   escuro na base (visao, suprimento) nao dissolvem embaixo (corte mais limpo).

   So apresentacao: nao toca em pergunta, pontuacao, roteamento nem envio. */

export interface ImageBlock {
  src: string;
  side: "left" | "right";
  bg: string;          // creme do topo da imagem, p/ casar o fundo da pagina
  ground?: boolean;    // base com chao mais escuro: feather so no topo/laterais
  focusY?: string;     // foco vertical no mobile (object-position Y) p/ enquadrar
                       // a ACAO de cada cena na faixa horizontal. Sem efeito no
                       // desktop (la o painel e 3:4 = aspecto da imagem).
}

/* Atribuicao imagem -> bloco e lado (desktop), com a cor de fundo medida de cada
   imagem. Temas em progressao: visao -> pessoas -> suprimento -> dados ->
   expansao. Lados alternados para dar dinamismo. */
export const DONO_IMAGE_BLOCKS: ImageBlock[] = [
  { src: "/dono/dono-1-visao.webp",      side: "left",  bg: "#f9f6ef", ground: true, focusY: "40%" },
  { src: "/dono/dono-2-pessoas.webp",    side: "right", bg: "#fbf8f3", focusY: "44%" },
  { src: "/dono/dono-3-suprimento.webp", side: "left",  bg: "#f9f6ed", ground: true, focusY: "58%" },
  { src: "/dono/dono-4-dados.webp",      side: "right", bg: "#f7efe2", focusY: "48%" },
  { src: "/dono/dono-5-expansao.webp",   side: "left",  bg: "#fbf8f3", focusY: "42%" },
];

/* Bloco a partir do indice da pergunta dentro da trilha (por fracao do total
   visivel, para dividir em partes parecidas mesmo com condicionais). */
export function imageBlockFor(blocks: ImageBlock[], relIndex: number, total: number): number {
  const n = blocks.length;
  if (total <= 0) return 0;
  const b = Math.floor((relIndex / total) * n);
  return Math.max(0, Math.min(n - 1, b));
}

const BLOCK_FADE_MS = 620; // crossfade entre blocos (suave, com easing no CSS)

function prefersReduced(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

let host: HTMLDivElement | null = null;
let layers: HTMLImageElement[] = []; // imagem atual (2 durante o crossfade)
let currentSrc = "";
let preloader: HTMLImageElement | null = null;

function ensureHost(): HTMLDivElement {
  if (!host) {
    host = document.createElement("div");
    host.className = "fimg-layer";
    host.setAttribute("aria-hidden", "true");
  }
  return host;
}

function makeImg(blk: ImageBlock): HTMLImageElement {
  const im = document.createElement("img");
  im.className = blk.ground ? "fimg is-ground" : "fimg";
  im.src = blk.src;
  im.alt = "";
  im.decoding = "async";
  // Foco vertical da cena (so afeta o recorte da faixa horizontal no mobile).
  im.style.objectPosition = `50% ${blk.focusY ?? "44%"}`;
  return im;
}

function preload(src: string): void {
  if (!src) return;
  if (!preloader) preloader = new Image();
  if (preloader.dataset.src === src) return;
  preloader.dataset.src = src;
  preloader.src = src;
}

/* Pre-carrega a 1a imagem da trilha do dono assim que o papel e escolhido (S1),
   para ela ja estar em cache quando a primeira pergunta aparecer. */
export function preloadDonoStart(): void {
  if (DONO_IMAGE_BLOCKS.length) preload(DONO_IMAGE_BLOCKS[0].src);
}

/* Mostra a imagem do bloco no slot. Re-anexa o host (sem recriar). Se a cena
   mudou, faz crossfade longo + morph da cor de fundo da pagina. */
export function showTrackImage(mount: HTMLElement, blocks: ImageBlock[], block: number): void {
  const h = ensureHost();
  if (h.parentElement !== mount) mount.appendChild(h);

  const idx = Math.max(0, Math.min(blocks.length - 1, block));
  const blk = blocks[idx];
  const src = blk.src;

  if (src === currentSrc && layers.length) {
    // Mesma cena: re-anexar nao recria; so garante visivel.
    layers[layers.length - 1].classList.add("is-shown");
    return;
  }

  // Troca de bloco: a pagina morpha para a cor de fundo da nova imagem (a CSS
  // anima --fimg-bg junto com o crossfade, sem flash de descasamento).
  document.documentElement.style.setProperty("--fimg-bg", blk.bg);

  const img = makeImg(blk);
  h.appendChild(img);

  if (prefersReduced()) {
    img.classList.add("is-shown", "is-static");
  } else {
    // proximo frame: entra com fade (+ leve zoom 1.02 -> 1 via CSS)
    requestAnimationFrame(() => img.classList.add("is-shown"));
  }

  const old = layers;
  layers = [img];
  currentSrc = src;
  old.forEach((p) => {
    p.classList.remove("is-shown");
    window.setTimeout(() => p.remove(), BLOCK_FADE_MS);
  });

  preload(blocks[idx + 1]?.src ?? "");
}

/* Esconde a camada (fora da trilha do dono ou fora das perguntas). */
export function hideTrackImage(): void {
  if (host && host.parentElement) host.parentElement.removeChild(host);
}
