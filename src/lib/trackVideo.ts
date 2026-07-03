/* Camada de video em loop das trilhas com personagem (frentista e gerente).
   As perguntas da trilha sao divididas em blocos (4 no frentista, 5 no gerente).
   Cada bloco tem um video que roda em loop suave e CONTINUA tocando ao mudar de
   pergunta dentro do bloco; so troca (crossfade longo) ao entrar no bloco seguinte.

   Persistencia: o "host" (que contem os players) e guardado numa variavel JS,
   sobrevive ao innerHTML como no destacado e e RE-ANEXADO no slot a cada render
   sem chamar load(), entao o currentTime e preservado (nao reinicia).

   Loop sem corte: cada bloco usa um player com DOIS <video> da mesma cena. Ao se
   aproximar do fim, o segundo entra com fade e o primeiro sai, escondendo o corte
   seco do loop nativo (mesmo principio do video do welcome).

   So apresentacao: nao toca em pergunta, pontuacao, roteamento nem envio. */

import { playWhenAllowed } from "./autoplay";

export interface VideoBlock {
  src: string;
  side: "left" | "right";
}

export type VideoTrack = "frentista" | "gerente";

/* Atribuicao video -> bloco e lado (desktop). O fundo de cada video ja vem
   recolorido EXATAMENTE em #FAF8F4 (igual a pagina), entao o video funde no
   fundo sem retangulo nem mascara, sem precisar medir cor por bloco. */
export const TRACK_VIDEO_BLOCKS: Record<VideoTrack, VideoBlock[]> = {
  frentista: [
    { src: "/videos/frentista-1-espera.mp4",   side: "left"  },
    { src: "/videos/frentista-2-abastece.mp4", side: "right" },
    { src: "/videos/frentista-3-limpa.mp4",    side: "left"  },
    { src: "/videos/frentista-4-acena.mp4",    side: "right" },
  ],
  gerente: [
    { src: "/videos/gerente-1-apresenta.mp4", side: "left"  },
    { src: "/videos/gerente-2-loja.mp4",      side: "right" },
    { src: "/videos/gerente-3-equipe.mp4",    side: "left"  },
    { src: "/videos/gerente-4-cliente.mp4",   side: "right" },
    { src: "/videos/gerente-5-aprova.mp4",    side: "left"  },
  ],
};

/* Bloco a partir do indice da pergunta dentro da trilha (por fracao do total
   visivel, para dividir em partes parecidas mesmo com condicionais). */
export function videoBlockFor(blocks: VideoBlock[], relIndex: number, total: number): number {
  const n = blocks.length;
  if (total <= 0) return 0;
  const b = Math.floor((relIndex / total) * n);
  return Math.max(0, Math.min(n - 1, b));
}

const BLOCK_FADE_MS = 1000; // crossfade longo entre blocos (suave)
const LOOP_FADE_S = 0.9;    // crossfade no ponto de loop (sem corte seco)
const PLAYBACK_RATE = 0.82; // loop um pouco mais lento, motion mais calmo

function prefersReduced(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

interface Player {
  el: HTMLElement;
  play(): void;
  pause(): void;
}

function makeBaseVideo(src: string): HTMLVideoElement {
  const v = document.createElement("video");
  v.className = "fvideo";
  v.src = src;
  // Poster (1o frame extraido) aparece na hora enquanto o video carrega: sem
  // tela em branco ao entrar na trilha.
  v.poster = src.replace(/\.mp4$/, "-poster.jpg");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.setAttribute("muted", "");
  v.setAttribute("playsinline", "");
  // Loop mais lento e calmo. defaultPlaybackRate persiste entre loads.
  v.defaultPlaybackRate = PLAYBACK_RATE;
  v.playbackRate = PLAYBACK_RATE;
  v.addEventListener("ratechange", () => {
    if (v.playbackRate !== PLAYBACK_RATE) v.playbackRate = PLAYBACK_RATE;
  });
  return v;
}

/* Player de um bloco: loop sem corte via dois <video> que se cruzam no fim.
   Movimento reduzido: um unico video parado no primeiro frame. */
function makePlayer(src: string): Player {
  const wrap = document.createElement("div");
  wrap.className = "fvideo-player";

  if (prefersReduced()) {
    const v = makeBaseVideo(src);
    v.classList.add("is-active");
    v.addEventListener("loadeddata", () => { try { v.currentTime = 0; } catch { /* ignore */ } }, { once: true });
    wrap.appendChild(v);
    return { el: wrap, play() {}, pause() { try { v.pause(); } catch { /* ignore */ } } };
  }

  const a = makeBaseVideo(src);
  const b = makeBaseVideo(src);
  // O standby (b) só entra no crossfade perto do fim do loop. Mantê-lo em
  // "metadata" evita baixar a mesma cena duas vezes de imediato; quando ele
  // entra, o vídeo já está no cache do navegador (mesma URL de `a`). (PERF-01)
  b.preload = "metadata";
  a.classList.add("is-active");
  wrap.append(a, b);

  let active = a;
  let standby = b;
  let swapping = false;

  const onTime = (): void => {
    if (swapping) return;
    const d = active.duration;
    if (!isFinite(d) || d <= 0) return;
    if (active.currentTime >= d - LOOP_FADE_S) {
      swapping = true;
      try { standby.currentTime = 0; } catch { /* ignore */ }
      standby.play().catch(() => {});
      requestAnimationFrame(() => {
        standby.classList.add("is-active");
        active.classList.remove("is-active");
      });
      const out = active;
      const incoming = standby;
      window.setTimeout(() => {
        try { out.pause(); out.currentTime = 0; } catch { /* ignore */ }
        active = incoming;
        standby = out;
        swapping = false;
      }, LOOP_FADE_S * 1000);
    }
  };
  a.addEventListener("timeupdate", () => { if (active === a) onTime(); });
  b.addEventListener("timeupdate", () => { if (active === b) onTime(); });

  return {
    el: wrap,
    play() { if (active.paused) playWhenAllowed(active); },
    pause() { try { a.pause(); b.pause(); } catch { /* ignore */ } },
  };
}

let host: HTMLDivElement | null = null;
let players: Player[] = []; // player atual (2 durante o crossfade de bloco)
let currentSrc = "";
let preloader: HTMLVideoElement | null = null;

function ensureHost(): HTMLDivElement {
  if (!host) {
    host = document.createElement("div");
    host.className = "fvideo-layer";
    host.setAttribute("aria-hidden", "true");
  }
  return host;
}

function preload(src: string): void {
  if (!src) return;
  if (!preloader) preloader = document.createElement("video");
  if (preloader.dataset.src === src) return;
  preloader.dataset.src = src;
  preloader.muted = true;
  preloader.preload = "auto";
  preloader.src = src;
  try { preloader.load(); } catch { /* ignore */ }
}

/* Pre-carrega o video do 1o bloco da trilha assim que o papel e escolhido (S1),
   para o video ja estar em cache quando a 1a pergunta da trilha aparecer. */
export function preloadTrackStart(track: VideoTrack): void {
  const blocks = TRACK_VIDEO_BLOCKS[track];
  if (blocks && blocks.length) preload(blocks[0].src);
}

/* Mostra o video do bloco no slot. Re-anexa o host (sem reiniciar) e, se a cena
   mudou, faz crossfade longo para o player do novo bloco. */
export function showTrackVideo(mount: HTMLElement, blocks: VideoBlock[], block: number): void {
  const h = ensureHost();
  if (h.parentElement !== mount) mount.appendChild(h);

  const idx = Math.max(0, Math.min(blocks.length - 1, block));
  const blk = blocks[idx];
  const src = blk.src;

  if (src === currentSrc && players.length) {
    // Mesma cena: re-anexar nao reinicia; garante visibilidade e play. NAO mexe
    // no --fv-bg (ja foi amostrado uma vez na troca do bloco e fica fixo, sem
    // re-amostrar frame a frame, que causaria leve wobble de cor).
    const cur = players[players.length - 1];
    cur.el.classList.add("is-shown");
    cur.play();
    return;
  }

  // Fundo dos videos ja vem recolorido EXATAMENTE em #FAF8F4 (igual a pagina),
  // entao nao ha cor por bloco nem amostragem de pixel: a camada usa o #faf8f4
  // fixo do CSS e o video funde no fundo sem caixa, em qualquer device.
  const player = makePlayer(src);
  h.appendChild(player.el);
  player.play();
  requestAnimationFrame(() => player.el.classList.add("is-shown"));

  const old = players;
  players = [player];
  currentSrc = src;
  old.forEach((p) => {
    p.el.classList.remove("is-shown");
    window.setTimeout(() => { p.pause(); p.el.remove(); }, BLOCK_FADE_MS);
  });

  preload(blocks[idx + 1]?.src ?? "");
}

/* Esconde a camada (fora das trilhas com video ou fora das perguntas). */
export function hideTrackVideo(): void {
  if (host && host.parentElement) host.parentElement.removeChild(host);
  players.forEach((p) => p.pause());
}
