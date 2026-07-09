/* Tracking: dispara GA/Pixel + adiciona ao buffer de eventos da sessão.
   A gravação no Supabase é feita junto com os updates da linha
   (não vai mais numa tabela à parte). */

import { bufferEvent } from "./api";

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
  bufferEvent(event, inferCategory(event), data);
}

function inferCategory(event: string): string {
  if (event.startsWith("specialist_") || event.startsWith("rayx_cta") || event.endsWith("_cta_clicked")) return "cta";
  if (event === "answer_selected" || event.startsWith("diag_answer")) return "answer";
  if (event === "result_viewed") return "result";
  if (event === "diagnostic_started" || event === "name_submitted") return "lifecycle";
  if (event === "diagnostic_completed" || event === "diagnostic_abandoned") return "lifecycle";
  if (event === "report_generated" || event === "report_generation_failed" || event === "report_unlocked") return "report";
  if (event === "rayx_scheduled" || event === "rayx_attended" || event === "rayx_no_show") return "rayx";
  return "behavior";
}
