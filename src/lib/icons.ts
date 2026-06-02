// Mini SVG illustrations for the universe of fuel stations.
// Stroke-based, monoline, neutral. They inherit currentColor.
// Each icon is a 24x24 viewBox unless stated otherwise.

const I = (path: string, extra = ""): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}${extra}</svg>`;

export const Icons = {
  // Universe: stations
  fuelPump: I(`
    <rect x="4" y="3" width="9" height="18" rx="1.5"/>
    <path d="M4 10h9"/>
    <path d="M6 6h5"/>
    <path d="M13 8l3 3v6a2 2 0 0 0 2 2 2 2 0 0 0 2-2v-9l-3-3"/>
  `),
  fuelDrop: I(`
    <path d="M12 3s5 6 5 10a5 5 0 0 1-10 0c0-4 5-10 5-10z"/>
    <path d="M9 14c.4 1.5 1.6 2.4 3 2.4"/>
  `),
  store: I(`
    <path d="M4 8l1.5-3h13L20 8"/>
    <path d="M4 8v12h16V8"/>
    <path d="M4 8c0 1.5 1 2.5 2.5 2.5S9 9.5 9 8"/>
    <path d="M9 8c0 1.5 1 2.5 2.5 2.5S14 9.5 14 8"/>
    <path d="M14 8c0 1.5 1 2.5 2.5 2.5S19 9.5 19 8"/>
    <path d="M10 20v-5h4v5"/>
  `),
  team: I(`
    <circle cx="9" cy="8" r="3"/>
    <circle cx="17" cy="9" r="2.4"/>
    <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5"/>
    <path d="M15 19c0-2.4 1.8-4 4-4"/>
  `),
  badge: I(`
    <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/>
    <path d="M9 12l2 2 4-4"/>
  `),
  // Customers / loyalty
  user: I(`
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c1.5-4 4.8-6 8-6s6.5 2 8 6"/>
  `),
  heart: I(`
    <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>
  `),
  stars: I(`
    <path d="M12 3l2.2 4.6L19 8.4l-3.5 3.4.9 4.9L12 14.4 7.6 16.7l.9-4.9L5 8.4l4.8-.8L12 3z"/>
  `),
  repeat: I(`
    <path d="M17 3l4 4-4 4"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <path d="M7 21l-4-4 4-4"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  `),
  // Mix / product
  layers: I(`
    <path d="M12 3l9 5-9 5-9-5 9-5z"/>
    <path d="M3 13l9 5 9-5"/>
    <path d="M3 17l9 5 9-5"/>
  `),
  bottle: I(`
    <path d="M10 2h4v3l1.5 2c.5.7 1 2 1 3v9a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3v-9c0-1 .5-2.3 1-3L10 5V2z"/>
    <path d="M9 12h6"/>
  `),
  // Tech / dashboard
  dashboard: I(`
    <rect x="3" y="4" width="18" height="14" rx="2"/>
    <path d="M3 9h18"/>
    <path d="M7 13l3 2 2-3 5 4"/>
  `),
  chart: I(`
    <path d="M4 19V5"/>
    <path d="M4 19h16"/>
    <path d="M8 16v-5"/>
    <path d="M12 16V8"/>
    <path d="M16 16v-3"/>
  `),
  spark: I(`
    <path d="M3 17l5-6 4 4 4-7 5 5"/>
  `),
  cogs: I(`
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>
  `),
  // Strategy / states
  target: I(`
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="5"/>
    <circle cx="12" cy="12" r="1.5"/>
  `),
  flame: I(`
    <path d="M12 3c1.5 3 4 5 4 8a4 4 0 0 1-8 0c0-1.5.6-2.5 1.5-3.5C9 9 9.5 7 9 5c2 0 3-1 3-2z"/>
  `),
  bolt: I(`
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>
  `),
  scale: I(`
    <path d="M12 3v18"/>
    <path d="M3 21h18"/>
    <path d="M5 9l3-4 3 4h-6z"/>
    <path d="M13 9l3-4 3 4h-6z"/>
  `),
  clock: I(`
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v5l3 2"/>
  `),
  // Currency
  coin: I(`
    <circle cx="12" cy="12" r="9"/>
    <path d="M9 9.5c0-1 1-2 3-2s3 1 3 2c0 2.5-6 1-6 4 0 1 1.2 2 3 2s3-1 3-2"/>
    <path d="M12 6.5v1"/>
    <path d="M12 16.5v1"/>
  `),
  trendUp: I(`
    <path d="M3 17l6-6 4 4 8-9"/>
    <path d="M14 6h7v7"/>
  `),
  // UI
  arrowRight: I(`
    <path d="M5 12h14"/>
    <path d="M13 6l6 6-6 6"/>
  `),
  arrowLeft: I(`
    <path d="M19 12H5"/>
    <path d="M11 18l-6-6 6-6"/>
  `),
  check: I(`
    <path d="M5 12l5 5 9-11"/>
  `),
  lock: I(`
    <rect x="5" y="11" width="14" height="9" rx="2"/>
    <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
  `),
  shield: I(`
    <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z"/>
    <path d="M9 12l2 2 4-4"/>
  `),
  whatsapp: I(`
    <path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.5L3 21z"/>
    <path d="M9 9.5c.4-1 1.4-1.5 2.2-.9 1.3 1 .4 2.7 2.1 4.4 1.7 1.7 3.4.8 4.4 2.1.6.8.1 1.8-.9 2.2"/>
  `),
  calendar: I(`
    <rect x="3" y="5" width="18" height="16" rx="2"/>
    <path d="M3 9h18"/>
    <path d="M8 3v4"/>
    <path d="M16 3v4"/>
  `),
  // Generic
  alert: I(`
    <path d="M12 3l10 17H2L12 3z"/>
    <path d="M12 10v4"/>
    <circle cx="12" cy="17" r="0.6" fill="currentColor"/>
  `),
  info: I(`
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 11v5"/>
    <circle cx="12" cy="8" r="0.6" fill="currentColor"/>
  `),
};

export type IconName = keyof typeof Icons;
