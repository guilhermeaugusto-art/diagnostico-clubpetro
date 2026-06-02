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
  const params = url.searchParams;
  const ua = navigator.userAgent || "";
  return {
    source: params.get("source") || inferSource(document.referrer),
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
