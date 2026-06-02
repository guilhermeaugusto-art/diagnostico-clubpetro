import { getSupabase } from "./supabase";

export function track(event: string, data?: Record<string, unknown>, diagId?: string | null): void {
  const payload = { ts: new Date().toISOString(), ...(data || {}) };
  try { window.gtag?.("event", event, payload); } catch { /* */ }
  try { window.fbq?.("trackCustom", event, payload); } catch { /* */ }
  try {
    const client = getSupabase();
    if (client) {
      client
        .from("diagnostico_eventos")
        .insert({ event_name: event, event_data: payload, diag_id: diagId || null })
        .then(() => {})
        .catch(() => {});
    }
  } catch { /* */ }
}
