// diagnostico-esteira: reconciliador do funil do Diagnostico/Raio-X.
// Roda por trigger (linha unica) e por cron (varredura ?sweep=1). Cada etapa tem
// dedup por coluna e so marca apos 2xx — falha fica pendente e a proxima
// varredura retenta. Fichas com duplicado_de preenchido sao ignoradas (a
// canonica da pessoa e quem conta). Etapas:
//   1) RD conversao fez-diagnostico-posto        (concluiu && !rd_enviado)
//   2) RD conversao confirmou-raiox-posto        (confirmado && !rd_raiox_enviado)
//   3) RD conversao fez-raiox-posto + tag        (participou && !rd_participou_enviado)
//   4) RD evento OPPORTUNITY (funil default)     (participou && !rd_oportunidade_enviado)
//   5) Kommo lead com tag raiox-realizado        (participou && !kommo_enviado)
//      - match de lead existente APENAS por contato exato (email/telefone),
//        ignorando a base fria de prospeccao; sem match, cria
//        "{Nome} - Raio X" no pipeline Fidelidade (v5, 14/07).
//      - card PERDIDO de quem participou reabre no inicio do funil (v8, 21/07).
//      - relacao com o posto: sempre na nota e no SELECT "Relação com o
//        Posto" do contato; "Nao se aplica" conta como vazio (v11, 21/07).
//      - contato exato so casa se o primeiro nome OU o telefone baterem:
//        e-mail de casal nao cola duas pessoas num card (v12, 22/07).
// Antes das etapas, a varredura marca duplicado_de automaticamente (mesma
// pessoa refez o quiz): mesmo e-mail E mesmo primeiro nome (v6, 21/07).
// ?dry=1 simula: nao chama RD/Kommo nem grava nada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RD_CONV = "https://api.rd.services/platform/conversions";
const RD_EVENTS = "https://api.rd.services/platform/events";
const RD_AUTH = "https://api.rd.services/auth/token";
const KOMMO_PIPELINE = 8166623;        // Pipe | Fidelidade
const KOMMO_PIPELINE_PROSPECCAO = 8437139; // base fria (Leads BDMP/Prolife): nunca reaproveitar
const KOMMO_STATUS_FALLBACK = 65190271; // mesmo fallback do prosp-postos-kommo
const CF_ORIGEM = 1266644;
const CF_SUBORIGEM = 1266176;
const CF_CONTATO_RELACAO = 1265854; // select "Relação com o Posto" no CONTATO

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const PILAR_LABEL: Record<string, string> = {
  pessoas: "Pessoas", marca: "Marca", comercial: "Comercial",
  fidelizacao: "Fidelizacao", dados: "Dados", resiliencia: "Resiliencia",
};
const RELACAO_LABEL: Record<string, string> = {
  dono: "Dono(a) ou Diretor(a)", gerente: "Gerente ou Supervisor(a)",
  outro: "Frentista", frentista: "Frentista",
};

function safeParse(s: unknown) { try { return JSON.parse(String(s)); } catch { return null; } }
function asStr(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}
function dimensaoFraca(row: any): string | undefined {
  const raw = row.pontuacao_pilares;
  const obj = typeof raw === "string" ? safeParse(raw) : raw;
  if (obj && typeof obj === "object") {
    let worst: string | null = null; let min = Infinity;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const n = Number(v);
      if (!Number.isNaN(n) && n < min) { min = n; worst = k; }
    }
    if (worst) return PILAR_LABEL[worst] ?? worst;
  }
  const dor = (row.dor_principal ?? "").toString().trim();
  if (!dor) return undefined;
  return dor.length > 80 ? dor.slice(0, 77) + "..." : dor;
}
function relacaoPosto(row: any): string | undefined {
  const direto = (row.relacao_posto ?? "").toString().trim();
  if (direto) return direto;
  return RELACAO_LABEL[(row.papel ?? "").toString().trim().toLowerCase()];
}
function isFrentista(row: any) {
  const p = (row.papel ?? "").toString().trim().toLowerCase();
  return p === "outro" || p === "frentista";
}
function temEmail(row: any) {
  return typeof row.email === "string" && row.email.includes("@");
}
function ehCliente(row: any) {
  return (row.conhece ?? "").toString().trim().toLowerCase() === "cliente";
}
// Pessoal interno (Familia Pires trabalha no ClubPetro) nao vira oportunidade
// nem card no Kommo — regra do dono (21/07). Conversoes RD comuns continuam.
function ehFamiliaPires(row: any) {
  return typeof row.email === "string" && row.email.trim().toLowerCase().endsWith("@familiapires.com.br");
}

async function vmGet(keys: string[]) {
  const { data, error } = await supabase.from("vm_app_keys").select("key,value").in("key", keys);
  if (error) throw new Error("vm_app_keys: " + error.message);
  const m: Record<string, string> = {};
  for (const r of data || []) m[r.key] = r.value;
  return m;
}
async function vmSet(key: string, value: string) {
  await supabase.from("vm_app_keys").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
}

async function getRdPublicToken(): Promise<string | null> {
  const { data } = await supabase.from("Armazena_Token_RD").select("Token")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.Token ? String(data.Token) : null;
}
async function rdConversion(token: string, payload: unknown) {
  const res = await fetch(`${RD_CONV}?api_key=${token}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: "CONVERSION", event_family: "CDP", payload }),
  });
  return { ok: res.ok, status: res.status, text: (await res.text()).slice(0, 300) };
}

// ---- RD OAuth (marcar oportunidade) com refresh automatico em 401 ----
let rdOauthCache: { access: string; refresh: string; clientId: string; clientSecret: string } | null = null;
async function rdOauthLoad() {
  if (rdOauthCache) return rdOauthCache;
  const m = await vmGet(["RD_ACCESS_TOKEN", "RD_REFRESH_TOKEN", "RD_CLIENT_ID", "RD_CLIENT_SECRET"]);
  rdOauthCache = { access: m.RD_ACCESS_TOKEN, refresh: m.RD_REFRESH_TOKEN, clientId: m.RD_CLIENT_ID, clientSecret: m.RD_CLIENT_SECRET };
  return rdOauthCache;
}
async function rdOauthRefresh() {
  const c = await rdOauthLoad();
  const res = await fetch(RD_AUTH, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refresh }),
  });
  const d = await res.json();
  if (!res.ok || !d.access_token) throw new Error("rd refresh falhou: " + JSON.stringify(d).slice(0, 200));
  c.access = d.access_token;
  if (d.refresh_token) c.refresh = d.refresh_token;
  await vmSet("RD_ACCESS_TOKEN", c.access);
  if (d.refresh_token) await vmSet("RD_REFRESH_TOKEN", c.refresh);
  return c;
}
async function rdMarkOpportunity(email: string) {
  let c = await rdOauthLoad();
  const body = JSON.stringify({ event_type: "OPPORTUNITY", event_family: "CDP", payload: { funnel_name: "default", email } });
  let res = await fetch(RD_EVENTS, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.access }, body,
  });
  if (res.status === 401) {
    c = await rdOauthRefresh();
    res = await fetch(RD_EVENTS, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.access }, body,
    });
  }
  return { ok: res.ok, status: res.status, text: (await res.text()).slice(0, 300) };
}

// ---- Kommo ----
let kommoCache: { base: string; token: string } | null = null;
async function kommoCreds() {
  if (kommoCache) return kommoCache;
  const m = await vmGet(["KOMMO_ACCESS_TOKEN", "KOMMO_SUBDOMAIN"]);
  const sd = (m.KOMMO_SUBDOMAIN || "clubpetro").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const host = sd.includes(".") ? sd : sd + ".kommo.com";
  kommoCache = { base: `https://${host}/api/v4`, token: m.KOMMO_ACCESS_TOKEN };
  return kommoCache;
}
async function kfetch(path: string, init?: RequestInit) {
  const { base, token } = await kommoCreds();
  const res = await fetch(base + path, {
    ...(init || {}),
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...((init || {}).headers || {}) },
  });
  const text = await res.text();
  let json: any = null;
  if (text) { try { json = JSON.parse(text); } catch { /* html de erro */ } }
  return { ok: res.ok, status: res.status, json, text: text.slice(0, 300) };
}
let kommoMetaCache: { statusId: number; origemEnum: number | null; suborigem: { type: string; id?: number } | null } | null = null;
async function kommoMeta() {
  if (kommoMetaCache) return kommoMetaCache;
  let statusId = KOMMO_STATUS_FALLBACK;
  const pl = await kfetch(`/leads/pipelines/${KOMMO_PIPELINE}`);
  const sts = (pl.json?._embedded?.statuses || [])
    .filter((s: any) => s.id !== 142 && s.id !== 143 && s.type !== 1)
    .sort((a: any, b: any) => (a.sort || 0) - (b.sort || 0));
  if (sts.length) statusId = sts[0].id;
  let origemEnum: number | null = null;
  const fo = await kfetch(`/leads/custom_fields/${CF_ORIGEM}`);
  const eo = (fo.json?.enums || []).find((e: any) => /inbound/i.test(e.value || ""));
  if (eo) origemEnum = eo.id;
  let suborigem: { type: string; id?: number } | null = null;
  const fs = await kfetch(`/leads/custom_fields/${CF_SUBORIGEM}`);
  if (fs.json) {
    if (["text", "textarea"].includes(fs.json.type)) suborigem = { type: "text" };
    else {
      const es = (fs.json.enums || []).find((e: any) => /diagn|raio/i.test(e.value || ""));
      if (es) suborigem = { type: "enum", id: es.id };
    }
  }
  kommoMetaCache = { statusId, origemEnum, suborigem };
  return kommoMetaCache;
}
function digitosFone(v: unknown): string {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d;
}
/* Match EXATO por contato (e-mail ou telefone), nunca pela busca fuzzy de
   leads: a query solta do Kommo casava "olecramutima@..." com o card frio
   "AUTO POSTO MUTIMA" do BDMP e a tag caía em prospecção (incidente de
   14/07/2026). Sem match exato, cria lead novo "{Nome} - Raio X". */
async function kommoFindLead(row: any): Promise<any | null> {
  const alvoEmail = (row.email ?? "").toString().trim().toLowerCase();
  const alvoFone = digitosFone(row.telefone);
  for (const q of [alvoEmail, alvoFone]) {
    if (!q || q.length < 5) continue;
    const d = await kfetch(`/contacts?query=${encodeURIComponent(q)}&with=leads&limit=10`);
    for (const c of d.json?._embedded?.contacts || []) {
      let exato = false;
      for (const f of c.custom_fields_values || []) {
        if (f.field_code === "EMAIL" && alvoEmail) {
          for (const v of f.values || []) {
            if (String(v.value ?? "").trim().toLowerCase() === alvoEmail) exato = true;
          }
        }
        if (f.field_code === "PHONE" && alvoFone) {
          for (const v of f.values || []) {
            if (digitosFone(v.value) === alvoFone) exato = true;
          }
        }
      }
      if (!exato) continue;
      // Contato exato != mesma PESSOA: casais dividem e-mail (Carla e
      // Cristiano, posto3palmeiras@) e a Carla acabava colada no card do
      // marido, invisivel para o comercial (incidente 21-22/07). Alem do
      // contato exato, o primeiro nome precisa aparecer no nome do contato OU
      // o telefone bater; senao, segue e cria card proprio.
      const pn = nrmDedup(row.nome || "").split(/\s+/)[0] || "";
      const nomeBate = pn.length >= 3 && nrmDedup(c.name || "").includes(pn);
      let foneBate = false;
      if (alvoFone) {
        for (const f of c.custom_fields_values || []) {
          if (f.field_code === "PHONE") {
            for (const v of f.values || []) if (digitosFone(v.value) === alvoFone) foneBate = true;
          }
        }
      }
      if (!nomeBate && !foneBate) continue;
      // O mesmo contato pode ter varios leads: pega o primeiro que NAO seja
      // da base fria de prospeccao (la os e-mails dos postos apontam para
      // outras pessoas e o card nao e da pessoa que fez o Raio-X).
      for (const l of c._embedded?.leads || []) {
        const ld = await kfetch(`/leads/${l.id}`);
        if (ld.json?.id && ld.json.pipeline_id !== KOMMO_PIPELINE_PROSPECCAO) {
          return { ...ld.json, _contatoId: c.id }; // contato do match: alvo do select de relacao
        }
      }
    }
  }
  return null;
}
// "Relação com o Posto" e um SELECT no contato: resolve o enum pelo rotulo
// (os valores do quiz batem 1:1 com as opcoes do campo). Cache por execucao.
let relacaoEnumsCache: { id: number; value: string }[] | null | undefined;
async function kommoEnumRelacao(row: any): Promise<number | null> {
  const alvo = nrmDedup(relacaoPosto(row) || "");
  if (!alvo) return null;
  if (relacaoEnumsCache === undefined) {
    const d = await kfetch(`/contacts/custom_fields/${CF_CONTATO_RELACAO}`);
    relacaoEnumsCache = Array.isArray(d.json?.enums) ? d.json.enums : null;
  }
  for (const e of relacaoEnumsCache || []) if (nrmDedup(e.value) === alvo) return e.id;
  return null;
}
// Preenche o select no contato. Valor real escolhido pelo comercial (Dono,
// Gerente...) nunca e sobrescrito; vazio ou "Nao se aplica" (default de fluxo
// antigo — quem respondeu o quiz TEM relacao) e substituido pela resposta.
async function kommoGarantirRelacao(contatoId: number | null | undefined, row: any) {
  if (!contatoId) return;
  const en = await kommoEnumRelacao(row);
  if (!en) return;
  const d = await kfetch(`/contacts/${contatoId}`);
  if (!d.json?.id) return;
  const atual = (d.json.custom_fields_values || []).find((f: any) => f.field_id === CF_CONTATO_RELACAO);
  const valorAtual = nrmDedup(atual?.values?.[0]?.value || "");
  if (valorAtual && valorAtual !== "nao se aplica") return;
  await kfetch(`/contacts/${contatoId}`, {
    method: "PATCH",
    body: JSON.stringify({ custom_fields_values: [{ field_id: CF_CONTATO_RELACAO, values: [{ enum_id: en }] }] }),
  });
}

async function kommoEnsureTag(leadId: number) {
  const d = await kfetch(`/leads/${leadId}`);
  const tags = (d.json?._embedded?.tags || []).map((t: any) => ({ name: t.name }));
  if (tags.some((t: any) => t.name === "raiox-realizado")) return { ok: true, status: 200, text: "tag ja presente" };
  tags.push({ name: "raiox-realizado" });
  return await kfetch(`/leads/${leadId}`, { method: "PATCH", body: JSON.stringify({ _embedded: { tags } }) });
}
function notaKommo(row: any): string {
  // relacaoPosto (nao o campo cru): cai para o papel (dono/gerente/frentista)
  // quando relacao_posto esta vazio — antes a relacao sumia da nota
  const rel = relacaoPosto(row);
  const partes = [
    `Participou do Raio-X do Posto (diagnostico ClubPetro).`,
    rel ? `Relacao com o posto: ${rel}` : null,
    row.score !== null && row.score !== undefined ? `Score do diagnostico: ${row.score} (${row.nivel ?? "sem nivel"})` : null,
    row.interesse ? `Frente de interesse: ${row.interesse}` : null,
    row.telefone ? `Telefone: ${row.telefone}` : null,
    row.email ? `E-mail: ${row.email}` : null,
    row.pdf_comercial_url ? `PDF comercial: ${row.pdf_comercial_url}` : null,
  ].filter(Boolean);
  return partes.join("\n");
}
// Card PERDIDO (status 143) de quem participou volta ao INICIO do pipeline
// Fidelidade — regra do dono (21/07): perdido no passado nao segura o lead
// fora; se participou do Raio-X, e prospeccao ativa de novo.
async function kommoReabrir(leadId: number): Promise<{ ok: boolean; detalhe: string }> {
  const meta = await kommoMeta();
  const r = await kfetch(`/leads/${leadId}`, {
    method: "PATCH",
    body: JSON.stringify({ pipeline_id: KOMMO_PIPELINE, status_id: meta.statusId }),
  });
  if (!r.ok) return { ok: false, detalhe: `reabrir lead ${leadId}: HTTP ${r.status} ${r.text}` };
  return { ok: true, detalhe: "lead perdido reaberto no inicio do funil" };
}

async function kommoPush(row: any): Promise<{ ok: boolean; leadId?: number; detalhe: string }> {
  const existente = await kommoFindLead(row);
  if (existente?.id) {
    let detalhe = "lead existente atualizado com tag";
    if (existente.status_id === 143) {
      const rb = await kommoReabrir(existente.id);
      if (!rb.ok) return { ok: false, detalhe: rb.detalhe };
      detalhe = rb.detalhe;
    }
    const r = await kommoEnsureTag(existente.id);
    if (!r.ok) return { ok: false, detalhe: `tag em lead existente ${existente.id}: HTTP ${r.status} ${r.text}` };
    await kommoGarantirRelacao(existente._contatoId, row);
    await kfetch(`/leads/${existente.id}/notes`, {
      method: "POST",
      body: JSON.stringify([{ note_type: "common", params: { text: notaKommo(row) } }]),
    });
    return { ok: true, leadId: existente.id, detalhe };
  }
  const meta = await kommoMeta();
  const cf: any[] = [];
  if (meta.origemEnum) cf.push({ field_id: CF_ORIGEM, values: [{ enum_id: meta.origemEnum }] });
  if (meta.suborigem?.type === "text") cf.push({ field_id: CF_SUBORIGEM, values: [{ value: "diagnostico-raiox" }] });
  else if (meta.suborigem?.type === "enum") cf.push({ field_id: CF_SUBORIGEM, values: [{ enum_id: meta.suborigem.id }] });
  const contactCf: any[] = [];
  if (row.telefone) contactCf.push({ field_code: "PHONE", values: [{ value: String(row.telefone), enum_code: "MOB" }] });
  if (temEmail(row)) contactCf.push({ field_code: "EMAIL", values: [{ value: row.email, enum_code: "WORK" }] });
  // relacao com o posto vai no SELECT proprio do contato ("Relação com o
  // Posto"), como o comercial usa — nao no Cargo, que e campo livre deles
  const enRel = await kommoEnumRelacao(row);
  if (enRel) contactCf.push({ field_id: CF_CONTATO_RELACAO, values: [{ enum_id: enRel }] });
  const body = [{
    name: `${row.nome || row.email || "Lead"} - Raio X`,
    pipeline_id: KOMMO_PIPELINE,
    status_id: meta.statusId,
    ...(cf.length ? { custom_fields_values: cf } : {}),
    _embedded: {
      tags: [{ name: "raiox-realizado" }],
      contacts: [{
        name: row.nome || row.email || "Lead Diagnostico",
        ...(contactCf.length ? { custom_fields_values: contactCf } : {}),
      }],
    },
  }];
  const r = await kfetch(`/leads/complex`, { method: "POST", body: JSON.stringify(body) });
  const leadId = Array.isArray(r.json) ? r.json[0]?.id : r.json?._embedded?.leads?.[0]?.id;
  if (!r.ok || !leadId) return { ok: false, detalhe: `criar lead: HTTP ${r.status} ${r.text}` };
  await kfetch(`/leads/${leadId}/notes`, {
    method: "POST",
    body: JSON.stringify([{ note_type: "common", params: { text: notaKommo(row) } }]),
  });
  return { ok: true, leadId, detalhe: "lead criado" };
}

async function marcar(id: string, patch: Record<string, unknown>) {
  await supabase.from("diagnostico_respostas").update(patch).eq("id", id);
}

// ---- Dedup de fichas (mesma pessoa refez o quiz) ----
function nrmDedup(s: unknown) {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
// canonica = ficha mais completa (envios ja feitos > concluiu); empate: mais antiga
function notaFicha(r: any) {
  return (r.kommo_enviado === true ? 8 : 0) + (r.rd_oportunidade_enviado === true ? 4 : 0) +
    (r.concluiu === true ? 2 : 0) + (r.rd_enviado === true ? 1 : 0);
}

Deno.serve(async (req) => {
  // Chamado por trigger/cron com o Bearer do service role (mesmo padrao dos jobs existentes)
  const auth = req.headers.get("authorization") || "";
  if (!auth.includes(SERVICE_ROLE)) {
    return new Response(JSON.stringify({ erro: "nao autorizado" }), { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const dry = url.searchParams.get("dry") === "1";

    let rows: any[] = [];
    let modo = "sweep";
    if (req.method === "POST") {
      const p = await req.json().catch(() => null);
      const rid = p?.record?.id;
      if (rid) {
        modo = "webhook";
        const { data } = await supabase.from("diagnostico_respostas").select("*").eq("id", rid).limit(1);
        rows = data || [];
      }
    }
    if (modo === "sweep") {
      const { data, error } = await supabase.from("diagnostico_respostas").select("*")
        .order("created_at", { ascending: true }).limit(1000);
      if (error) throw new Error(error.message);
      rows = data || [];
    }

    const rdToken = await getRdPublicToken();
    const acoes: any[] = [];
    const erros: any[] = [];
    const simular = (lead: string, etapa: string) => acoes.push({ lead, etapa, status: "dry" });

    // Dedup automatico: a MESMA pessoa refez o quiz — mesmo e-mail E mesmo
    // primeiro nome — e a linha nova dispararia RD/Kommo em dobro (incidente
    // Bianca, 21/07). O primeiro nome no criterio e obrigatorio: casais dividem
    // e-mail (Carla e Cristiano, posto3palmeiras@) e NAO podem ser fundidos.
    // Canonica = ficha mais completa; a duplicata ganha duplicado_de e o loop
    // de etapas abaixo ja a ignora.
    if (modo === "sweep" && !dry) {
      const grupos = new Map<string, any[]>();
      for (const r of rows) {
        if (r.duplicado_de) continue;
        const em = nrmDedup(r.email);
        const pn = nrmDedup(r.nome).split(/\s+/)[0] || "";
        if (!em.includes("@") || !pn) continue;
        const k = em + "|" + pn;
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k)!.push(r);
      }
      for (const g of grupos.values()) {
        if (g.length < 2) continue;
        g.sort((a, b) => notaFicha(b) - notaFicha(a) || String(a.created_at).localeCompare(String(b.created_at)));
        const canonica = g[0];
        for (const dup of g.slice(1)) {
          await marcar(dup.id, { duplicado_de: canonica.id });
          dup.duplicado_de = canonica.id;
          acoes.push({ lead: dup.nome, etapa: "dedup", detalhe: "duplicata de " + canonica.id });
        }
      }
    }

    // Webhook tambem deduplica (restrito a linha recebida): o trigger de
    // participou_raiox chega ANTES do proximo sweep, e sem esta checagem as
    // etapas 3-5 disparariam RD/Kommo em dobro na janela de corrida (<10min).
    if (modo === "webhook" && !dry && rows.length && !rows[0].duplicado_de) {
      const r0 = rows[0];
      const pn = nrmDedup(r0.nome).split(/\s+/)[0] || "";
      if (temEmail(r0) && pn) {
        // ilike sem % = igualdade case-insensitive; escapa curingas do e-mail
        const padrao = String(r0.email).replace(/([%_\\])/g, "\\$1");
        const { data: irm } = await supabase.from("diagnostico_respostas")
          .select("*").ilike("email", padrao).is("duplicado_de", null).neq("id", r0.id);
        const grupo = [r0, ...(irm || []).filter((x: any) => (nrmDedup(x.nome).split(/\s+/)[0] || "") === pn)];
        if (grupo.length > 1) {
          grupo.sort((a, b) => notaFicha(b) - notaFicha(a) || String(a.created_at).localeCompare(String(b.created_at)));
          for (const dup of grupo.slice(1)) {
            await marcar(dup.id, { duplicado_de: grupo[0].id });
            if (dup.id === r0.id) r0.duplicado_de = grupo[0].id;
            acoes.push({ lead: dup.nome, etapa: "dedup", detalhe: "duplicata de " + grupo[0].id });
          }
        }
      }
    }

    for (const row of rows) {
      if (row.duplicado_de) continue; // ficha duplicada: quem conta e a canonica
      const jobTitle = relacaoPosto(row);
      try {
        // 1) fez-diagnostico-posto
        if (row.concluiu === true && row.rd_enviado !== true && temEmail(row) && !isFrentista(row) && rdToken) {
          if (dry) { simular(row.nome, "fez-diagnostico"); } else {
            const r = await rdConversion(rdToken, {
              conversion_identifier: "fez-diagnostico-posto",
              email: row.email, name: row.nome ?? undefined, job_title: jobTitle,
              cf_score_diagnostico: asStr(row.score), cf_nivel_diagnostico: asStr(row.nivel),
              cf_dimensao_fraca: dimensaoFraca(row), cf_frente_interesse: asStr(row.interesse),
              tags: ["diagnostico-realizado"],
            });
            if (r.ok) await marcar(row.id, { rd_enviado: true, rd_enviado_em: new Date().toISOString() });
            (r.ok ? acoes : erros).push({ lead: row.nome, etapa: "fez-diagnostico", status: r.status, ...(r.ok ? {} : { erro: r.text }) });
          }
        }
        // 2) confirmou-raiox-posto
        if ((row.raiox_status || "").toLowerCase() === "confirmado" && row.rd_raiox_enviado !== true && temEmail(row) && !isFrentista(row) && rdToken) {
          if (dry) { simular(row.nome, "confirmou-raiox"); } else {
            const r = await rdConversion(rdToken, {
              conversion_identifier: "confirmou-raiox-posto", email: row.email,
              job_title: jobTitle, tags: ["raiox-confirmado"],
            });
            if (r.ok) await marcar(row.id, { rd_raiox_enviado: true });
            (r.ok ? acoes : erros).push({ lead: row.nome, etapa: "confirmou-raiox", status: r.status, ...(r.ok ? {} : { erro: r.text }) });
          }
        }
        // 3) fez-raiox-posto + tag raiox-realizado
        if (row.participou_raiox === true && row.rd_participou_enviado !== true && temEmail(row) && rdToken) {
          if (dry) { simular(row.nome, "fez-raiox"); } else {
            const r = await rdConversion(rdToken, {
              conversion_identifier: "fez-raiox-posto", email: row.email,
              name: row.nome ?? undefined, job_title: jobTitle, tags: ["raiox-realizado"],
            });
            if (r.ok) await marcar(row.id, { rd_participou_enviado: true });
            (r.ok ? acoes : erros).push({ lead: row.nome, etapa: "fez-raiox", status: r.status, ...(r.ok ? {} : { erro: r.text }) });
          }
        }
        // 4) OPORTUNIDADE no RD (participou, nao-cliente, nao-frentista, nao-interno)
        if (row.participou_raiox === true && row.rd_oportunidade_enviado !== true && temEmail(row) && !isFrentista(row) && !ehCliente(row) && !ehFamiliaPires(row)) {
          if (dry) { simular(row.nome, "rd-oportunidade"); } else {
            const r = await rdMarkOpportunity(row.email);
            if (r.ok) await marcar(row.id, { rd_oportunidade_enviado: true, rd_oportunidade_em: new Date().toISOString() });
            (r.ok ? acoes : erros).push({ lead: row.nome, etapa: "rd-oportunidade", status: r.status, ...(r.ok ? {} : { erro: r.text }) });
          }
        }
        // 5b) Card ja enviado + PARTICIPOU DE NOVO depois do envio: se o card
        // esta perdido, reabre no inicio do funil (tag + nota) e re-marca a
        // oportunidade no RD. kommo_enviado_em avanca apos a checagem para nao
        // reconsultar o Kommo a cada varredura.
        if (row.participou_raiox === true && row.kommo_enviado === true && row.kommo_lead_id &&
            !isFrentista(row) && !ehCliente(row) && !ehFamiliaPires(row) &&
            row.ultima_participacao_raiox && row.kommo_enviado_em &&
            Date.parse(row.ultima_participacao_raiox) > Date.parse(row.kommo_enviado_em)) {
          if (dry) { simular(row.nome, "kommo-reabrir?"); } else {
            const ld = await kfetch(`/leads/${row.kommo_lead_id}?with=contacts`);
            if (ld.json?.id) {
              // toque de reconciliacao: garante o select de relacao no contato
              // principal do card (preenche so se estiver vazio)
              const cts = ld.json?._embedded?.contacts || [];
              const contatoId = (cts.find((c: any) => c.is_main) || cts[0])?.id;
              await kommoGarantirRelacao(contatoId, row);
              if (ld.json.status_id === 143) {
                const rb = await kommoReabrir(Number(row.kommo_lead_id));
                if (rb.ok) {
                  await kommoEnsureTag(Number(row.kommo_lead_id));
                  await kfetch(`/leads/${row.kommo_lead_id}/notes`, {
                    method: "POST",
                    body: JSON.stringify([{ note_type: "common", params: {
                      text: `Participou de novo do Raio-X em ${String(row.ultima_participacao_raiox).slice(0, 10)} — card reaberto automaticamente (estava perdido).`
                        + (relacaoPosto(row) ? `\nRelacao com o posto: ${relacaoPosto(row)}` : ""),
                    } }]),
                  });
                  if (temEmail(row)) await rdMarkOpportunity(row.email);
                  acoes.push({ lead: row.nome, etapa: "kommo-reaberto", kommo_lead_id: row.kommo_lead_id });
                } else {
                  erros.push({ lead: row.nome, etapa: "kommo-reaberto", erro: rb.detalhe });
                }
              }
              // checado (reaberto ou nao estava perdido): avanca o marco
              await marcar(row.id, { kommo_enviado_em: new Date().toISOString() });
            }
          }
        }
        // 5) Kommo (participou, nao-cliente, nao-frentista, nao-interno, com contato)
        if (row.participou_raiox === true && row.kommo_enviado !== true && !isFrentista(row) && !ehCliente(row) && !ehFamiliaPires(row) && (temEmail(row) || row.telefone)) {
          if (dry) { simular(row.nome, "kommo"); } else {
            const r = await kommoPush(row);
            if (r.ok) {
              await marcar(row.id, { kommo_enviado: true, kommo_lead_id: r.leadId ?? null, kommo_enviado_em: new Date().toISOString(), kommo_erro: null });
              acoes.push({ lead: row.nome, etapa: "kommo", detalhe: r.detalhe, kommo_lead_id: r.leadId });
            } else {
              await marcar(row.id, { kommo_erro: r.detalhe.slice(0, 500) });
              erros.push({ lead: row.nome, etapa: "kommo", erro: r.detalhe });
            }
          }
        }
      } catch (e) {
        erros.push({ lead: row.nome, etapa: "exception", erro: String(e).slice(0, 300) });
      }
    }

    const resumo = { modo, dry, linhas_avaliadas: rows.length, acoes, erros, quando: new Date().toISOString() };
    if (!dry && (acoes.length || erros.length)) {
      await supabase.from("diagnostico_esteira_log").insert({ resumo });
    }
    return new Response(JSON.stringify(resumo, null, 2), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
