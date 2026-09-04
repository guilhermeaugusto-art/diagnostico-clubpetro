/* Ícones SVG monoline em uso no diagnóstico ClubPetro.
   Reduzido às chaves realmente referenciadas: `check` (AnswerCard),
   `arrowRight`/`arrowLeft` (Button) e `whatsapp` (CTA do especialista no
   resultado). Os demais foram removidos por não terem uso (código morto).
   Paths derivados do Lucide: viewBox 24x24, stroke 1.75, herda currentColor. */

const I = (path: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision" aria-hidden="true">${path}</svg>`;

/* Marca preenchida (sem traço): o logo do WhatsApp é um glifo sólido, não um
   ícone monoline. Herda currentColor, então fica branco dentro do botão verde. */
const F = (path: string): string =>
  `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" shape-rendering="geometricPrecision" aria-hidden="true">${path}</svg>`;

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
  /* Logo OFICIAL do WhatsApp: balão com o fone dentro, glifo sólido de uma
     peça só (o balão e o fone são o mesmo path, com o fone em furo pelo
     fill-rule). Antes daqui vivia um "message-circle" do Lucide, que é só um
     balão genérico e não lia como WhatsApp no botão. */
  whatsapp: F(`
    <path fill-rule="evenodd" clip-rule="evenodd" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.16 8.16 0 0 1-1.25-4.38c0-4.54 3.7-8.24 8.24-8.24a8.18 8.18 0 0 1 5.82 2.42 8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.13-.14.17-.24.25-.41.09-.16.04-.3-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31-.22.24-.85.83-.85 2.03 0 1.19.87 2.35.99 2.51.12.17 1.72 2.62 4.16 3.67.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z"/>
  `),
} as const;
