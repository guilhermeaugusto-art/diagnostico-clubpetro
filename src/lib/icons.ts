/* Biblioteca de ícones do diagnóstico ClubPetro.
   Paths derivados do Lucide v0.4xx: monoline, viewBox 24x24, stroke 1.75,
   line-cap/join round, herda currentColor.
   Cada ícone é desenhado pelo seu significado, não por preenchimento de
   espaço. Mantém peso visual consistente em qualquer tamanho. */

const I = (path: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision" aria-hidden="true">${path}</svg>`;

export const Icons = {
  /* ================ Combustível e operação de pista ================ */

  /* Bomba de combustível clássica (lucide: fuel) */
  fuelPump: I(`
    <line x1="3" y1="22" x2="15" y2="22"/>
    <line x1="4" y1="9" x2="14" y2="9"/>
    <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/>
    <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>
  `),

  /* Gota de combustível (lucide: droplet) */
  fuelDrop: I(`
    <path d="M12 21.5a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5s-3 3.5-3 5.5a7 7 0 0 0 7 7z"/>
  `),

  /* Loja física (lucide: store) — toldo + porta */
  store: I(`
    <path d="M3 9 L4.5 4 H19.5 L21 9"/>
    <path d="M4 9v11h16V9"/>
    <path d="M3 9c0 1.66 1.34 3 3 3s3-1.34 3-3"/>
    <path d="M9 9c0 1.66 1.34 3 3 3s3-1.34 3-3"/>
    <path d="M15 9c0 1.66 1.34 3 3 3s3-1.34 3-3"/>
    <path d="M10 20v-6h4v6"/>
  `),

  /* Sacola de compras (lucide: shopping-bag) */
  shoppingBag: I(`
    <path d="M6 2 L3 6 V20 a2 2 0 0 0 2 2 H19 a2 2 0 0 0 2 -2 V6 L18 2 Z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1 -8 0"/>
  `),

  /* Carrinho de compras (lucide: shopping-cart) */
  shoppingCart: I(`
    <circle cx="9" cy="21" r="1.5"/>
    <circle cx="18" cy="21" r="1.5"/>
    <path d="M2 3h2.5l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 1.95-1.57L22 7H5.5"/>
  `),

  /* Lavagem / serviços de pista — máquina + bolha */
  wash: I(`
    <rect x="4" y="3" width="16" height="18" rx="2.5"/>
    <line x1="4" y1="8" x2="20" y2="8"/>
    <circle cx="12" cy="14.5" r="4.5"/>
    <circle cx="7.5" cy="5.5" r="0.7" fill="currentColor"/>
    <circle cx="10.5" cy="5.5" r="0.7" fill="currentColor"/>
  `),

  /* Disputa de preço — setas opostas convergindo */
  priceWar: I(`
    <line x1="3" y1="12" x2="21" y2="12"/>
    <polyline points="7 8 3 12 7 16"/>
    <polyline points="17 8 21 12 17 16"/>
  `),

  /* ================ Pessoas e atendimento ================ */

  /* Um usuário (lucide: user) */
  user: I(`
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  `),

  /* Equipe / múltiplos usuários (lucide: users) */
  team: I(`
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  `),

  /* Headset / especialista de atendimento (lucide: headphones) */
  headset: I(`
    <path d="M3 14v-2a9 9 0 0 1 18 0v2"/>
    <path d="M21 19a2 2 0 0 1-2 2h-1v-7h2a1 1 0 0 1 1 1z"/>
    <path d="M3 19a2 2 0 0 0 2 2h1v-7H4a1 1 0 0 0-1 1z"/>
  `),

  /* ================ Marca e diferenciação ================ */

  /* Escudo com check, identidade (lucide: shield-check, usado como badge) */
  badge: I(`
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="m9 12 2 2 4-4"/>
  `),

  /* Estrela cheia (lucide: star) */
  stars: I(`
    <path d="M12 2 L14.85 8.35 L22 9 L16.5 13.85 L18.2 21 L12 17.25 L5.8 21 L7.5 13.85 L2 9 L9.15 8.35 Z"/>
  `),

  /* Megafone (lucide: megaphone) */
  megaphone: I(`
    <path d="M3 11v2a2 2 0 0 0 2 2h2l9 5V4L7 9H5a2 2 0 0 0-2 2z"/>
    <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5"/>
  `),

  /* Selo / prêmio (lucide: award) */
  award: I(`
    <circle cx="12" cy="9" r="6"/>
    <path d="m8.5 13.5-2 7.5 5.5-3 5.5 3-2-7.5"/>
  `),

  /* Medalha (lucide: medal) */
  medal: I(`
    <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/>
    <path d="M11 12 5.12 2.2"/>
    <path d="M13 12 18.88 2.2"/>
    <path d="M8 7h8"/>
    <circle cx="12" cy="17" r="5"/>
    <path d="M12 18v-2"/>
  `),

  /* ================ Coração / fidelização ================ */

  heart: I(`
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
  `),

  /* ================ Dados, gestão, dashboard ================ */

  /* Painel completo (lucide: layout-dashboard) */
  dashboard: I(`
    <rect x="3" y="3" width="7" height="9" rx="1"/>
    <rect x="14" y="3" width="7" height="5" rx="1"/>
    <rect x="14" y="12" width="7" height="9" rx="1"/>
    <rect x="3" y="16" width="7" height="5" rx="1"/>
  `),

  /* Barras (lucide: bar-chart-3) */
  chart: I(`
    <path d="M3 3v18h18"/>
    <path d="M8 17V11"/>
    <path d="M13 17V7"/>
    <path d="M18 17v-4"/>
  `),

  /* Crescimento linear (lucide: activity) */
  spark: I(`
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  `),

  /* Configurações / método (lucide: settings) */
  cogs: I(`
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  `),

  /* Pilha / camadas (lucide: layers) */
  layers: I(`
    <path d="m12 2 9.5 5.5L12 13 2.5 7.5 12 2z"/>
    <path d="m2.5 13.5 9.5 5.5 9.5-5.5"/>
    <path d="m2.5 17.5 9.5 5.5 9.5-5.5"/>
  `),

  /* ================ Dinheiro / margem / resultado ================ */

  /* Duas moedas sobrepostas (lucide: coins) */
  coin: I(`
    <circle cx="8" cy="8" r="6"/>
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18"/>
    <path d="M7 6h1v4"/>
    <path d="m16.71 13.88.7.71-2.82 2.82"/>
  `),

  /* Tendência subindo (lucide: trending-up) */
  trendUp: I(`
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  `),

  /* Balança (lucide: scale) */
  scale: I(`
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
    <path d="M7 21h10"/>
    <path d="M12 3v18"/>
    <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
  `),

  /* Bolt / energia / oportunidade (lucide: zap) */
  bolt: I(`
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  `),

  /* Chama / combustão (lucide: flame) */
  flame: I(`
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  `),

  /* ================ Estado / status ================ */

  /* Check simples (lucide: check) */
  check: I(`
    <polyline points="20 6 9 17 4 12"/>
  `),

  /* Alerta triangular (lucide: alert-triangle) */
  alert: I(`
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  `),

  /* Info circular (lucide: info) */
  info: I(`
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  `),

  /* ================ Diagnóstico / análise ================ */

  /* Alvo (lucide: target) */
  target: I(`
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  `),

  /* Lupa de pesquisa (lucide: search) */
  search: I(`
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  `),

  /* Scanner / raio-x (lucide: scan-line) */
  scan: I(`
    <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
    <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
    <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
    <line x1="7" y1="12" x2="17" y2="12"/>
  `),

  /* ================ Segurança / resiliência ================ */

  /* Escudo simples (lucide: shield) */
  shield: I(`
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
  `),

  /* Cadeado fechado (lucide: lock) */
  lock: I(`
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  `),

  /* ================ Tempo / agenda ================ */

  /* Relógio (lucide: clock) */
  clock: I(`
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  `),

  /* Calendário (lucide: calendar) */
  calendar: I(`
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  `),

  /* Calendário com cabeçalho cheio, leitura imediata de "agenda" */
  calendarSolid: `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" fill="currentColor" opacity="0.14"/>
      <rect x="3" y="4" width="18" height="5" rx="2" fill="currentColor"/>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.75" fill="none"/>
      <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <circle cx="8" cy="14" r="1.2" fill="currentColor"/>
      <circle cx="12" cy="14" r="1.2" fill="currentColor"/>
      <circle cx="16" cy="14" r="1.2" fill="currentColor"/>
      <circle cx="8" cy="18" r="1.2" fill="currentColor"/>
      <circle cx="12" cy="18" r="1.2" fill="currentColor"/>
    </svg>
  `,

  /* ================ Comunicação ================ */

  /* WhatsApp monoline (balão + sinal) */
  whatsapp: I(`
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  `),

  /* WhatsApp filled (marca reconhecível, fill currentColor) */
  whatsappBrand: `
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/>
    </svg>
  `,

  /* Telefone (lucide: phone) */
  phone: I(`
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  `),

  /* Mail / e-mail (lucide: mail) */
  mail: I(`
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-10 5L2 7"/>
  `),

  /* Balão de mensagem (lucide: message-circle) */
  message: I(`
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  `),

  /* ================ Repetição / recorrência ================ */

  /* Refresh circular (lucide: refresh-cw) — usado pra recorrência */
  repeat: I(`
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/>
    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/>
  `),

  /* ================ Setas / UI ================ */

  arrowRight: I(`
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  `),

  arrowLeft: I(`
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  `),

};

export type IconName = keyof typeof Icons;
