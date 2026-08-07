/* Captura de contexto do usuário no boot:
   - UTMs e source da URL
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
  let source = params.get("source") || (refExterno ? inferSource(refExterno) : null);
  if (temOrigem(params)) {
    salvarOrigem(url.search, source);
  } else {
    let salva = lerOrigemSalva();
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
      source = params.get("source") || salva.source || source;
    }
  }

  return {
    source: source || "direct",
    utm_source:   params.get("utm_source"),
    utm_medium:   params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_content:  params.get("utm_content"),
    utm_term:     params.get("utm_term"),
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
    utm_content: null, utm_term: null, referrer: null, landing_url: null,
    user_agent: null, device_type: null, browser: null, os: null,
    screen_width: null, screen_height: null, locale: null,
  };
}

const ORIGEM_KEY = "diag_origem_primeiro_toque";

function temOrigem(p: URLSearchParams): boolean {
  return !!(p.get("utm_source") || p.get("utm_medium") || p.get("utm_campaign") || p.get("source"));
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
