/* Ícones SVG monoline em uso no diagnóstico ClubPetro.
   Reduzido às chaves realmente referenciadas: `check` (AnswerCard),
   `arrowRight`/`arrowLeft` (Button) e `whatsapp` (dado em blocks/recommendations).
   Os demais ícones foram removidos por não terem uso (código morto).
   Paths derivados do Lucide: viewBox 24x24, stroke 1.75, herda currentColor. */

const I = (path: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision" aria-hidden="true">${path}</svg>`;

export const Icons = {
  check: I(`
    <polyline points="20 6 9 17 4 12"/>
  `),
  arrowRight: I(`
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  `),
  arrowLeft: I(`
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  `),
  whatsapp: I(`
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  `),
} as const;

export type IconName = keyof typeof Icons;
