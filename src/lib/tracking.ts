/* Tracking: dispara os eventos para o GTM/Meta. A persistência granular por
   evento não existe no modelo enxuto; o que vai pro banco são os updates da
   própria linha da sessão (api.ts). */

export function track(
  event: string,
  data?: Record<string, unknown>,
  _diagId?: string | null,
): void {
  const payload = { ts: new Date().toISOString(), ...(data || {}) };
  // O site carrega GTM (não gtag.js): quem leva o evento pro Tag Manager é o
  // dataLayer. gtag/fbq ficam como fallback caso existam na página.
  try { (window.dataLayer = window.dataLayer || []).push({ event, ...payload }); } catch { /* */ }
  try { window.gtag?.("event", event, payload); } catch { /* */ }
  try { window.fbq?.("trackCustom", event, payload); } catch { /* */ }
}
