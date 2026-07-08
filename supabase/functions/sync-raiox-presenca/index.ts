import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MEETING_CODE = "ado-rhwa-kvx";
const CUTOFF_DEFAULT = "2026-06-23T00:00:00Z";
const MIN_SEGUNDOS = 60;
const RD_ENDPOINT = "https://api.rd.services/platform/conversions";

// Contas internas ClubPetro no Meet (nao sao leads)
const INTERNOS_ID = new Set([
  "104728690399652821553", // Marketing ClubPetro
  "105978899571642399077", // Guilherme Augusto
  "101001357730391988081", // Gabriel Premoli
]);
const INTERNOS_NOME = ["marketing clubpetro", "guilherme augusto", "gabriel premoli"];
const STOP = new Set(["posto","postos","auto","ltda","me","epp","eireli","conveniencia","comercio","combustiveis","distribuidora","servicos","and","the","cia"]);

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function norm(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function toks(s: string) {
  return norm(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t));
}
// Identidade da PESSOA (nao da linha): cadastros duplicados (mesmo telefone/email)
// nao podem contar como 2 candidatos — era isso que mandava Ivan/Ademar pro revisar.
function pessoaChave(L: any) {
  const em = norm(L.email || "").trim();
  if (em) return "e:" + em;
  const tel = (L.telefone || "").toString().replace(/\D/g, "");
  if (tel.length >= 8) return "t:" + tel.slice(-8);
  return "n:" + norm(L.nome || "").trim();
}

async function getCreds() {
  const { data, error } = await supabase.from("integration_secrets").select("key,value")
    .in("key", ["google_client_id", "google_client_secret", "meet_refresh_token"]);
  if (error) throw new Error("secrets: " + error.message);
  const m: Record<string, string> = {};
  for (const r of data || []) m[r.key] = r.value;
  return m;
}
async function getAccessToken(m: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: m.google_client_id, client_secret: m.google_client_secret, refresh_token: m.meet_refresh_token, grant_type: "refresh_token" }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error("token: " + JSON.stringify(d));
  return d.access_token as string;
}
async function meet(path: string, token: string) {
  const res = await fetch("https://meet.googleapis.com/v2/" + path, { headers: { Authorization: "Bearer " + token } });
  const d = await res.json();
  if (!res.ok) throw new Error("meet " + path + ": " + JSON.stringify(d));
  return d;
}
async function getRdToken() {
  const { data } = await supabase.from("Armazena_Token_RD").select("Token").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data && (data as any).Token) ? (data as any).Token as string : null;
}
async function rdRaioxRealizado(rdToken: string, email: string, nome: string) {
  const res = await fetch(RD_ENDPOINT + "?api_key=" + rdToken, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: "CONVERSION", event_family: "CDP", payload: { conversion_identifier: "fez-raiox-posto", email, name: nome || undefined, tags: ["raiox-realizado"] } }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry") === "1";
    const cutoff = url.searchParams.get("desde") || CUTOFF_DEFAULT;

    const creds = await getCreds();
    const token = await getAccessToken(creds);
    const rdToken = await getRdToken();

    const space = await meet("spaces/" + MEETING_CODE, token);
    let recs: any[] = [];
    let pageToken: string | undefined;
    do {
      const q = new URLSearchParams({ filter: `space.name=\"${space.name}\"`, pageSize: "100" });
      if (pageToken) q.set("pageToken", pageToken);
      const d = await meet("conferenceRecords?" + q.toString(), token);
      recs = recs.concat(d.conferenceRecords || []);
      pageToken = d.nextPageToken;
    } while (pageToken);
    recs = recs.filter((r) => (r.startTime || "") >= cutoff);

    const pessoas = new Map<string, { displayName: string; segundos: number; ultima: string; interno: boolean }>();
    for (const rec of recs) {
      const recId = rec.name.split("/")[1];
      let pt: string | undefined;
      do {
        const q = new URLSearchParams({ pageSize: "100" });
        if (pt) q.set("pageToken", pt);
        const d = await meet("conferenceRecords/" + recId + "/participants?" + q.toString(), token);
        for (const p of d.participants || []) {
          const su = p.signedinUser, au = p.anonymousUser, ph = p.phoneUser;
          const uid = su ? su.user.split("/")[1] : null;
          const dn = su ? su.displayName : au ? au.displayName : ph ? ph.displayName : "?";
          const seg = p.earliestStartTime && p.latestEndTime
            ? Math.max(0, (new Date(p.latestEndTime).getTime() - new Date(p.earliestStartTime).getTime()) / 1000) : 0;
          const interno = (uid && INTERNOS_ID.has(uid)) || INTERNOS_NOME.includes(norm(dn).trim());
          const key = uid ? "u:" + uid : "n:" + norm(dn).trim();
          const cur = pessoas.get(key);
          if (!cur) pessoas.set(key, { displayName: dn, segundos: seg, ultima: p.latestEndTime || rec.endTime, interno });
          else { cur.segundos += seg; if ((p.latestEndTime || "") > cur.ultima) cur.ultima = p.latestEndTime; }
        }
        pt = d.nextPageToken;
      } while (pt);
    }

    // Fichas duplicadas (duplicado_de preenchido) ficam fora do match
    const { data: leads } = await supabase.from("diagnostico_respostas")
      .select("id,nome,email,telefone,concluiu,rd_participou_enviado,participou_raiox,ultima_participacao_raiox")
      .not("nome", "is", null)
      .is("duplicado_de", null);
    const marcados: any[] = [], revisar: any[] = [], internos: any[] = [];

    for (const pes of pessoas.values()) {
      const min = Math.round(pes.segundos / 60);
      if (pes.interno) { internos.push({ nome: pes.displayName, min }); continue; }
      if (pes.segundos < MIN_SEGUNDOS) continue;

      const dnT = toks(pes.displayName);
      // Candidatos agrupados por PESSOA (email/telefone), nao por linha — e dentro
      // de cada pessoa preferimos a linha mais completa (concluiu > email).
      const porPessoa = new Map<string, any[]>();
      for (const L of (leads || [])) {
        const nT = norm(L.nome || "").split(/[^a-z0-9]+/).filter(Boolean);
        const first = nT[0] || "";
        let bate = first.length >= 3 && !STOP.has(first) && dnT.includes(first);
        if (!bate) {
          const em = norm(L.email || "");
          for (const t of dnT) if (t.length >= 4 && em.includes(t)) { bate = true; break; }
        }
        if (bate) {
          const k = pessoaChave(L);
          if (!porPessoa.has(k)) porPessoa.set(k, []);
          porPessoa.get(k)!.push(L);
        }
      }

      if (porPessoa.size === 1) {
        const linhas = [...porPessoa.values()][0];
        linhas.sort((a: any, b: any) =>
          (b.concluiu === true ? 4 : 0) + ((b.email || "").includes("@") ? 2 : 0)
          - (a.concluiu === true ? 4 : 0) - ((a.email || "").includes("@") ? 2 : 0));
        const candInfo = linhas[0];
        let rdSent = candInfo.rd_participou_enviado === true;
        if (!dryRun) {
          // UPDATE condicional: so grava quando ha novidade (nao re-dispara os
          // triggers da tabela todo dia para o mesmo participante).
          const jaMarcado = candInfo.participou_raiox === true;
          const maisRecente = pes.ultima && (!candInfo.ultima_participacao_raiox || pes.ultima > candInfo.ultima_participacao_raiox);
          if (!jaMarcado || maisRecente) {
            await supabase.from("diagnostico_respostas").update({
              participou_raiox: true,
              ultima_participacao_raiox: pes.ultima,
              raiox_observacao: `Presenca Meet: ${min} min (${(pes.ultima || "").slice(0, 10)})`,
            }).eq("id", candInfo.id);
          }

          if (rdToken && candInfo.email && !candInfo.rd_participou_enviado) {
            rdSent = await rdRaioxRealizado(rdToken, candInfo.email, candInfo.nome);
            if (rdSent) {
              await supabase.from("diagnostico_respostas").update({ rd_participou_enviado: true }).eq("id", candInfo.id);
            }
          }
        }
        marcados.push({ meet: pes.displayName, min, lead: candInfo.nome, email: candInfo.email, rd_enviado: rdSent });
      } else {
        revisar.push({ meet: pes.displayName, min, candidatos: porPessoa.size });
      }
    }

    const relatorio = {
      dry_run: dryRun, desde: cutoff, sessoes: recs.length,
      total_no_meet: pessoas.size, marcados, revisar, internos,
    };

    // Persistir o relatorio (o pg_net descarta a resposta HTTP do cron; sem
    // isso a lista "revisar" some sem ninguem ver).
    if (!dryRun) {
      await supabase.from("raiox_presenca_log").insert({ relatorio });
    }

    return new Response(JSON.stringify(relatorio, null, 2), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
