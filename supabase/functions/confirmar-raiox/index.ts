// confirmar-raiox — confirmacao de presenca no evento do Raio-X (Google Calendar).
// Modos:
//   ?email=<email>            PUBLICO: link dos e-mails; inscreve o convidado no
//                             evento e redireciona (302) para a agenda/Meet.
//   ?sync=confirmados         ADMIN (header x-sync-secret): RSVP "aceito" vira
//                             raiox_status='confirmado' no banco. Crons 10 e 11.
//   ?relatorio=cruzamento     ADMIN (header x-sync-secret): cruzamento agenda x base.
// v19 (22/07, varredura completa): credenciais Google saem do codigo e vem de
// integration_secrets (gcal_client_id/gcal_client_secret/gcal_refresh_token);
// modos admin exigem segredo (vazavam a lista completa de e-mails sem auth);
// erro do maybeSingle no sync agora e logado. Fonte VERSIONADO neste repo
// (antes existia so em producao).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GCAL_CALENDAR_ID = "marketingcp@familiapires.com.br";
const GCAL_EVENT_ID = "1mtkmto9htm4ngir5v6krubkvi";

const MEET_FALLBACK = "https://meet.google.com/ado-rhwa-kvx";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function getGcalCreds() {
  const { data, error } = await supabase.from("integration_secrets").select("key,value")
    .in("key", ["gcal_client_id", "gcal_client_secret", "gcal_refresh_token"]);
  if (error) throw new Error("secrets: " + error.message);
  const m: Record<string, string> = {};
  for (const r of data || []) m[r.key] = r.value;
  if (!m.gcal_client_id || !m.gcal_client_secret || !m.gcal_refresh_token) {
    throw new Error("secrets gcal_* ausentes em integration_secrets");
  }
  return m;
}

async function getAccessToken() {
  const c = await getGcalCreds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.gcal_client_id,
      client_secret: c.gcal_client_secret,
      refresh_token: c.gcal_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) { console.error("token error", data); throw new Error("token"); }
  return data.access_token;
}

function eventUrl() {
  return "https://www.googleapis.com/calendar/v3/calendars/" +
    encodeURIComponent(GCAL_CALENDAR_ID) + "/events/" + encodeURIComponent(GCAL_EVENT_ID);
}

async function getEvent(token: string) {
  const res = await fetch(eventUrl(), { headers: { Authorization: "Bearer " + token } });
  const ev = await res.json();
  if (!res.ok) throw new Error("calendar: " + JSON.stringify(ev));
  return ev;
}

function attendeesOf(ev: any) {
  return (ev.attendees || [])
    .filter((a: any) => (a.email || "").toLowerCase() !== GCAL_CALENDAR_ID.toLowerCase())
    .map((a: any) => ({ email: (a.email || "").toLowerCase(), status: a.responseStatus || "needsAction" }));
}

async function addGuest(email: string) {
  const token = await getAccessToken();
  const ev = await getEvent(token);
  const attendees = Array.isArray(ev.attendees) ? ev.attendees : [];
  const exists = attendees.some((a: any) => (a.email || "").toLowerCase() === email.toLowerCase());
  if (!exists) {
    attendees.push({ email: email });
    const res = await fetch(eventUrl() + "?sendUpdates=all", {
      method: "PATCH",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ attendees: attendees }),
    });
    if (!res.ok) { const e = await res.json(); console.error("patch error", e); throw new Error("patch"); }
  }
  return ev;
}

// Modos administrativos exigem o segredo compartilhado (vm_app_keys):
// sem isso, ?relatorio=cruzamento vazava a lista COMPLETA de e-mails da base
// e da agenda para qualquer pessoa na internet.
async function adminAutorizado(req: Request): Promise<boolean> {
  const enviado = req.headers.get("x-sync-secret") ?? "";
  if (!enviado) return false;
  const { data } = await supabase.from("vm_app_keys").select("value")
    .eq("key", "CONFIRMAR_RAIOX_SYNC_KEY").maybeSingle();
  return !!data?.value && enviado === data.value;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();

  if (url.searchParams.get("sync") === "confirmados") {
    if (!(await adminAutorizado(req))) {
      return new Response(JSON.stringify({ erro: "nao autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    try {
      const token = await getAccessToken();
      const ev = await getEvent(token);
      const aceitos = attendeesOf(ev).filter((a: any) => a.status === "accepted").map((a: any) => a.email);
      const agora = new Date().toISOString();
      let marcados = 0;
      for (const em of aceitos) {
        const { data, error } = await supabase.from("diagnostico_respostas").select("email,raiox_status").eq("email", em).maybeSingle();
        // 2+ fichas com o mesmo e-mail fazem maybeSingle falhar e o aceite era
        // pulado em silencio — pelo menos registra ate a semantica ser decidida
        if (error) { console.error("sync confirmados: maybeSingle falhou para", em, error.message); continue; }
        if (data) {
          // Aceite de convite (RSVP) marca CONFIRMADO, nunca participacao real.
          // Presenca de verdade vem so da sync-raiox-presenca (Google Meet).
          if ((data as any).raiox_status !== "confirmado") {
            await supabase.from("diagnostico_respostas")
              .update({ raiox_status: "confirmado", raiox_data: agora })
              .eq("email", em);
            marcados++;
          }
        }
      }
      return new Response(JSON.stringify({ aceitaram: aceitos.length, marcados_no_diagnostico: marcados, emails_aceitos: aceitos }, null, 2), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ erro: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  if (url.searchParams.get("relatorio") === "cruzamento") {
    if (!(await adminAutorizado(req))) {
      return new Response(JSON.stringify({ erro: "nao autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    try {
      const token = await getAccessToken();
      const ev = await getEvent(token);
      const att = attendeesOf(ev);
      const setConvidados = new Set(att.map((a: any) => a.email));
      const statusMap = att.reduce((acc: any, a: any) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {});
      const { data: diag } = await supabase.from("diagnostico_respostas").select("email");
      const setDiag = new Set((diag || []).map((r: any) => (r.email || "").toLowerCase()).filter((e: string) => !!e));
      const fezEna = [...setDiag].filter((e) => setConvidados.has(e));
      const fezSem = [...setDiag].filter((e) => !setConvidados.has(e));
      const naSemDiag = [...setConvidados].filter((e) => !setDiag.has(e));
      const out = {
        evento: ev.summary || null,
        total_diagnostico: setDiag.size,
        total_convidados: setConvidados.size,
        fez_diagnostico_e_na_agenda: { count: fezEna.length, emails: fezEna },
        fez_diagnostico_mas_nao_agendou: { count: fezSem.length, emails: fezSem },
        na_agenda_sem_diagnostico: { count: naSemDiag.length, emails: naSemDiag },
        convidados_por_status: { aceitaram: statusMap.accepted || 0, recusaram: statusMap.declined || 0, talvez: statusMap.tentative || 0, pendentes: statusMap.needsAction || 0 }
      };
      return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ erro: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  if (email) {
    try {
      const ev = await addGuest(email);
      const dest = (ev && ev.htmlLink) ? ev.htmlLink : MEET_FALLBACK;
      return new Response(null, { status: 302, headers: { Location: dest } });
    } catch (e) {
      console.error("addGuest failed", e);
      return new Response(null, { status: 302, headers: { Location: MEET_FALLBACK } });
    }
  }
  return new Response(null, { status: 302, headers: { Location: MEET_FALLBACK } });
});
