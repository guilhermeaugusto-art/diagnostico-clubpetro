/* Catálogo de ícones PNG flat coloridos (mercado de postos).
   Esses ícones vivem em /public/icons/*.png e são servidos como assets
   estáticos. Quando um nome aqui é usado em vez de uma key do `Icons` SVG,
   renderizamos um <img> em vez de inline SVG. */

export const ICON_ASSETS = {
  // === Combustível e operação de pista ===
  "asset:bomba":      "/icons/bomba.png",
  "asset:posto":      "/icons/posto.png",
  "asset:lavagem":    "/icons/lavagem.png",       // carro em lavagem

  // === Pessoas ===
  "asset:frentista":      "/icons/frentista.png",
  "asset:equipe-mercado": "/icons/equipe-mercado.png",  // 3 pessoas + engrenagem
  "asset:headset":        "/icons/headset.png",         // atendimento consultivo
  "asset:executivo":      "/icons/executivo.png",       // homem barbado de terno + estratégia (gestor formal)
  "asset:lojista":        "/icons/lojista.png",         // pessoa com carrinho (cliente varejista / lojista)
  "asset:grupo":          "/icons/grupo.png",           // 3 pessoas diversas
  "asset:apresentacao":   "/icons/apresentacao.png",    // 2 apresentando gráfico (reunião / consultoria)
  "asset:conversa":       "/icons/conversa.png",        // 2 pessoas + balão de fala

  // === Comercial / margem / dinheiro ===
  "asset:real":      "/icons/real.png",
  "asset:margem":    "/icons/margem.png",
  "asset:carrinho":  "/icons/carrinho.png",   // carrinho de compras verde
  "asset:cesta":     "/icons/cesta.png",      // cesta supermercado com produtos

  // === Dados ===
  "asset:dados-base":     "/icons/dados-base.png",
  "asset:dados-analise":  "/icons/dados-analise.png",
  "asset:gestao":         "/icons/gestao.png",
  "asset:projetos":       "/icons/projetos.png",
  "asset:engrenagens":    "/icons/engrenagens.png",     // 3 engrenagens laranja

  // === Marca, qualidade, atendimento ===
  "asset:marca":        "/icons/marca.png",
  "asset:qualidade":    "/icons/qualidade.png",
  "asset:atendimento":  "/icons/atendimento.png",
  "asset:coracao":      "/icons/coracao.png",   // coração vermelho grande

  // === Diagnóstico / próximos passos ===
  "asset:alvo":          "/icons/alvo.png",
  "asset:diagnostico":   "/icons/diagnostico.png",  // prancheta + alvo
  "asset:visao":         "/icons/visao.png",        // homem com luneta
  "asset:lampada":       "/icons/lampada.png",      // ideia / dica
  "asset:cronometro":    "/icons/cronometro.png",   // cronômetro vermelho
  "asset:crescimento":   "/icons/crescimento.png",  // saco $ + seta crescimento
  "asset:estrela":       "/icons/estrela.png",      // estrela amarela única
  "asset:carregador-ev": "/icons/carregador-ev.png", // EV charger verde

  // === Status / sinais ===
  "asset:check":            "/icons/check-verde.png",       // check verde
  "asset:atencao-circulo":  "/icons/atencao-circulo.png",   // ! vermelho círculo
  "asset:aviso-triangulo":  "/icons/aviso-triangulo.png",   // ! laranja triângulo
  "asset:escudo":           "/icons/escudo.png",            // escudo verde com check
  "asset:cadeado":          "/icons/cadeado.png",           // cadeado outline gradiente

  // === Balança e equilíbrio ===
  "asset:balanca":   "/icons/balanca.png",     // 2 pratos equilibrados
  "asset:gangorra":  "/icons/gangorra.png",    // gangorra desequilibrada

  // === Concorrência ===
  "asset:concorrente":   "/icons/concorrente.png",   // tela com 2 pessoas + lupa
  "asset:concorrencia":  "/icons/concorrencia.png",  // 2 corredores + olho

  // === Calendário / agenda ===
  "asset:calendario":  "/icons/calendario.png",

  // === Recorrência / ciclo ===
  "asset:repetir":  "/icons/repetir.png",

  // === Comunicação ===
  "asset:whatsapp":  "/icons/whatsapp-color.png",  // WhatsApp verde oficial
  "asset:envelope":  "/icons/envelope.png",        // e-mail / envelope
} as const;

export type IconAssetName = keyof typeof ICON_ASSETS;

export function isIconAsset(name: string): name is IconAssetName {
  return name in ICON_ASSETS;
}

export function iconAssetUrl(name: IconAssetName): string {
  return ICON_ASSETS[name];
}
