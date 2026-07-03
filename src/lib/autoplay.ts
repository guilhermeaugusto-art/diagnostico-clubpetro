/* Autoplay resiliente no mobile.
   O navegador só permite autoplay com o vídeo mudo, e o iOS ainda bloqueia
   quando o aparelho está em Modo de Baixo Consumo. Quando o play() é recusado,
   este módulo arma um retry único no primeiro gesto do usuário (toque, rolagem
   ou tecla) em qualquer lugar da página: nesse gesto, todos os vídeos mudos que
   estiverem parados retomam sozinhos, sem exigir que a pessoa toque no vídeo.

   Só apresentação: não toca em pergunta, pontuação, roteamento nem envio. */

let listening = false;

function resumeMutedVideos(): void {
  document.querySelectorAll<HTMLVideoElement>("video").forEach((v) => {
    if (v.muted && v.paused) v.play().catch(() => { /* segue parado, sem erro */ });
  });
}

function onFirstGesture(): void {
  window.removeEventListener("pointerdown", onFirstGesture);
  window.removeEventListener("touchstart", onFirstGesture);
  window.removeEventListener("keydown", onFirstGesture);
  window.removeEventListener("scroll", onFirstGesture);
  listening = false;
  resumeMutedVideos();
}

function armFirstGestureRetry(): void {
  if (listening) return;
  listening = true;
  window.addEventListener("pointerdown", onFirstGesture, { passive: true });
  window.addEventListener("touchstart", onFirstGesture, { passive: true });
  window.addEventListener("keydown", onFirstGesture);
  window.addEventListener("scroll", onFirstGesture, { passive: true });
}

/* Tenta tocar um vídeo mudo. Se o navegador recusar (autoplay bloqueado), arma
   a retomada no primeiro gesto do usuário em vez de deixar o vídeo parado. */
export function playWhenAllowed(v: HTMLVideoElement): void {
  const p = v.play?.();
  if (p && typeof p.catch === "function") p.catch(() => armFirstGestureRetry());
}
