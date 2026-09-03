/* Captura de contexto do usuário no boot:
   - UTMs e source da URL
   - click ids de anúncio (fbclid/gclid/ttclid/msclkid/wbraid/gbraid)
   - referrer
   - user-agent, device, browser, OS
   - screen size
   - locale
   Tudo coletado client-side, sem cookies extras. */

export interface RequestContext {
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  gclid: string | null;
  referrer: string | null;
  landing_url: string | null;
  user_agent: string | null;
  device_type: "mobile" | "tablet" | "desktop" | null;
  browser: string | null;
  os: string | null;
  screen_width: number | null;
  screen_height: number | null;
  locale: string | null;
}

export function captureContext(): RequestContext {
  if (typeof window === "undefined") return emptyContext();
  const url = new URL(window.location.href);
  const ua = navigator.userAgent || "";

  // Referrer da própria app (reload/navegação interna) não é origem de tráfego.
  let refExterno = "";
  try {
    if (document.referrer && new URL(document.referrer).origin !== url.origin) refExterno = document.referrer;
  } catch { refExterno = document.referrer || ""; }

  // Primeiro toque: os UTMs só existem na URL da PRIMEIRA pageview — reload
  // ou aba nova dentro do quiz perdia a atribuição e o lead caía como
  // "direto" no RD (ficha de 07/08 com os UTMs presos no referrer). A origem
  // da entrada fica na sessionStorage; sem ela, resgata do referrer quando
  // ele é a própria app ainda com UTMs.
  let params = url.searchParams;
  let source = params.get("source") || sourceDoClickId(params) || (refExterno ? inferSource(refExterno) : null);
  /* Sinal FORTE = utm_* ou ?source, que alguém escreveu de propósito na URL do
     anúncio. Click id sozinho é sinal fraco: a plataforma gruda por conta.
     A distinção existe porque desde 31/08 o click id ativa o primeiro toque —
     sem ela, quem entrasse por ?utm_source=meta&utm_campaign=x e voltasse para
     a aba por um link só com ?fbclid= teria campanha e criativo APAGADOS por um
     dado mais pobre. Forte sobrescreve como sempre fez; fraco só grava quando
     ainda não há nada guardado nesta sessão, e no resto cai no else e usa o que
     já estava salvo. */
  const forte = !!(params.get("utm_source") || params.get("utm_medium") ||
    params.get("utm_campaign") || params.get("source"));
  const jaSalva = lerOrigemSalva();
  if (temOrigem(params) && (forte || !jaSalva)) {
    salvarOrigem(url.search, source);
  } else {
    let salva = jaSalva;
    if (!salva) {
      try {
        const ref = new URL(document.referrer);
        if (ref.origin === url.origin && temOrigem(ref.searchParams)) {
          salva = { search: ref.search, source: null };
          salvarOrigem(salva.search, salva.source);
        }
      } catch { /* sem referrer utilizável */ }
    }
    if (salva) {
      params = new URLSearchParams(salva.search);
      // sourceDoClickId entra aqui também porque o resgate pelo referrer grava
      // source:null — a search recuperada pode ter só o click id, e sem esta
      // linha a origem voltaria a ser referrer/'direct' com o fbclid em mãos.
      source = params.get("source") || salva.source || sourceDoClickId(params) || source;
    }
  }

  return {
    source: source || "direct",
    utm_source:   params.get("utm_source"),
    utm_medium:   params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_content:  params.get("utm_content"),
    utm_term:     params.get("utm_term"),
    fbclid:       primeiroParam(params, "fbclid"),
    // wbraid/gbraid são o que o Google Ads manda no LUGAR do gclid quando o
    // consentimento barra o cookie (iOS/ATT). É a mesma moeda de atribuição,
    // então os três caem na coluna gclid em vez de virar três colunas quase
    // sempre vazias — quem consulta o banco procura "gclid".
    gclid:        primeiroParam(params, "gclid", "wbraid", "gbraid"),
    referrer:     document.referrer || null,
    landing_url:  window.location.href,
    user_agent:   ua,
    device_type:  detectDevice(ua),
    browser:      detectBrowser(ua),
    os:           detectOS(ua),
    screen_width:  window.screen?.width  || null,
    screen_height: window.screen?.height || null,
    locale:       navigator.language || null,
  };
}

function emptyContext(): RequestContext {
  return {
    source: null, utm_source: null, utm_medium: null, utm_campaign: null,
    utm_content: null, utm_term: null, fbclid: null, gclid: null,
    referrer: null, landing_url: null,
    user_agent: null, device_type: null, browser: null, os: null,
    screen_width: null, screen_height: null, locale: null,
  };
}

const ORIGEM_KEY = "diag_origem_primeiro_toque";

/* Click ids que as plataformas grudam na URL do anúncio. Um clique pago pode
   chegar SÓ com o click id: a plataforma acrescenta o dela sozinha, enquanto o
   UTM depende de alguém ter preenchido o campo de URL de destino do criativo.
   No in-app browser do Instagram/Facebook ainda por cima o referrer vem vazio,
   então sem ler isto o clique pago é indistinguível de tráfego direto. */
const CLICK_IDS = ["fbclid", "gclid", "ttclid", "msclkid", "wbraid", "gbraid"] as const;

function primeiroParam(p: URLSearchParams, ...nomes: string[]): string | null {
  for (const n of nomes) {
    const v = p.get(n);
    if (v) return v;
  }
  return null;
}

/* Source deduzido do click id. Só entra quando a URL não trouxe utm_source nem
   ?source= — ou seja, exatamente quando a alternativa seria cair no referrer ou
   em 'direct'. A taxonomia que já chega hoje continua mandando: o anúncio Meta
   bem tagueado vem com utm_source=meta E fbclid, e o utm_source ganha.
   ttclid e msclkid NÃO ganharam coluna própria (volume zero na base e o
   comercial não separa TikTok/Bing hoje), mas servem de graça para nomear o
   canal aqui em vez de gerar mais um 'direct' cego. */
function sourceDoClickId(p: URLSearchParams): string | null {
  if (p.get("utm_source") || p.get("source")) return null;
  if (p.get("fbclid")) return "facebook";
  if (p.get("gclid") || p.get("wbraid") || p.get("gbraid")) return "google";
  if (p.get("ttclid")) return "tiktok";
  if (p.get("msclkid")) return "bing";
  return null;
}

/* O que conta como "entrou por uma origem" e por isso merece virar primeiro
   toque na sessionStorage. Click id entrou na lista em 31/08: antes, quem
   clicava no anúncio e caía numa URL só com ?fbclid= não gravava primeiro toque
   nenhum — no reload seguinte (ou ao voltar do teclado no in-app browser) a
   query sumia e a atribuição morria ali. É metade do tráfego: 41 das 74 sessões
   desde 22/07 chegaram sem query e sem referrer, e 29 delas viraram lead no
   comercial sem NENHUMA origem atribuída. */
function temOrigem(p: URLSearchParams): boolean {
  if (p.get("utm_source") || p.get("utm_medium") || p.get("utm_campaign") || p.get("source")) return true;
  return CLICK_IDS.some((k) => !!p.get(k));
}

function lerOrigemSalva(): { search: string; source: string | null } | null {
  try {
    const raw = sessionStorage.getItem(ORIGEM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function salvarOrigem(search: string, source: string | null): void {
  try { sessionStorage.setItem(ORIGEM_KEY, JSON.stringify({ search, source })); } catch { /* storage bloqueado */ }
}

function inferSource(ref: string): string | null {
  if (!ref) return "direct";
  try {
    const host = new URL(ref).hostname;
    if (/google\./.test(host)) return "google";
    if (/bing\./.test(host))   return "bing";
    if (/facebook\.|fb\./.test(host)) return "facebook";
    if (/instagram\./.test(host)) return "instagram";
    if (/linkedin\./.test(host)) return "linkedin";
    if (/youtube\./.test(host)) return "youtube";
    if (/whatsapp\./.test(host)) return "whatsapp";
    return host;
  } catch {
    return "referral";
  }
}

function detectDevice(ua: string): "mobile" | "tablet" | "desktop" {
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return "desktop";
}

function detectBrowser(ua: string): string {
  /* In-app browser ANTES dos genéricos, e a ordem aqui não é estilo: o UA da
     webview do Instagram no Android carrega "Chrome/" e a do Facebook carrega
     "Safari/", então testar os genéricos primeiro classificaria toda webview
     de rede social como Chrome/Safari. É exatamente a hipótese que a coluna
     `browser` existe para testar — 41 das 74 sessões de 22/07 a 31/08 chegaram
     sem query e sem referrer, que é como um link aberto dentro do app se
     comporta. Sem estes três ramos a coluna nunca responderia a pergunta.
     iOS não traz token de navegador nesses apps: o "Instagram 335.0.0..." no
     fim do UA é o único sinal, e é ele que estes testes procuram. */
  if (/Instagram/i.test(ua))            return "Instagram";
  if (/FBAV|FBAN|FB_IAB|FBIOS/i.test(ua)) return "Facebook";
  if (/WhatsApp/i.test(ua))             return "WhatsApp";
  if (/Edg\//.test(ua))       return "Edge";
  if (/OPR\//.test(ua))       return "Opera";
  if (/Chrome\//.test(ua))    return "Chrome";
  if (/Safari\//.test(ua))    return "Safari";
  if (/Firefox\//.test(ua))   return "Firefox";
  return "Unknown";
}

function detectOS(ua: string): string {
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua))   return "macOS";
  if (/Android/.test(ua))    return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Linux/.test(ua))      return "Linux";
  return "Unknown";
}
