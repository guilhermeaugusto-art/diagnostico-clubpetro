import { CONFIG } from "../lib/config";

const PHRASES = [
  'Cruzando suas <em>respostas</em>...',
  'Calculando os <em>8 pilares</em>...',
  'Quase pronto...',
];

export function TransitionPage(): string {
  const each = Math.floor(CONFIG.TRANSITION_MS / PHRASES.length);
  const phrases = PHRASES
    .map(
      (text, i) =>
        `<div class="transition-phrase"
              style="animation-delay:${i * each}ms;animation-duration:${each}ms;">
           ${text}
         </div>`
    )
    .join("");

  return `
    <div class="shell stage">
      <div class="transition-wrap">
        <div class="transition-canvas" aria-live="polite">${phrases}</div>
        <div class="transition-bar"><div class="transition-bar-fill" id="transitionBarFill"></div></div>
      </div>
    </div>
  `;
}
