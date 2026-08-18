// diagnostico-esteira: reconciliador do funil do Diagnostico/Raio-X.
// Roda por trigger (linha unica) e por cron (varredura ?sweep=1). Cada etapa tem
// dedup por coluna e so marca apos 2xx — falha fica pendente e a proxima
// varredura retenta. Fichas com duplicado_de preenchido sao ignoradas (a
// canonica da pessoa e quem conta). Etapas:
//   1) RD conversao fez-diagnostico-posto        (concluiu && !rd_enviado)
//   2) RD conversao confirmou-raiox-posto        (confirmado && !rd_raiox_enviado)
//   3) RD conversao fez-raiox-posto + tag        (participou && !rd_participou_enviado)
//   4) RD evento OPPORTUNITY (funil default)     (elegivel && !rd_oportunidade_enviado)
//   5) Kommo lead com tag conforme o estagio     (elegivel && !kommo_enviado)
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
// v13 (22/07, varredura completa): releitura fresca antes de agir (corrida
// sweep x webhook), falhas de gravacao de flag visiveis em erros[], token RD
// ausente logado, e 5b so avanca o marco com a checagem concluida.
// v14 (29/07): OPORTUNIDADE (RD + Kommo) dispara na CONCLUSAO do quiz para
// fichas criadas a partir do corte OPORTUNIDADE_AO_CONCLUIR_DESDE — decisao do
// dono; a base anterior segue pela participacao (senao a primeira varredura
// despejaria o historico inteiro no RD/Kommo). Novo trigger de banco em
// concluiu chama com ?gatilho=concluiu e este webhook PULA a etapa 1 (a
// rd-diagnostico-conversion dispara no MESMO update e ja envia fez-diagnostico
// — dois remetentes seria a corrida dupla de novo). Card Kommo criado sem
// participacao nasce com tag diagnostico-realizado e ganha raiox-realizado +
// nota quando a presenca e registrada (5b).
// v15 (29/07, 5c): o PDF comercial e IMPORTADO como arquivo anexo do card
// (pedido do dono) — o link na nota continua, mas o comercial abre o arquivo
// direto no Kommo. Reconciliacao com flag kommo_pdf_enviado: a URL do PDF pode
// aparecer DEPOIS do card (geracao assincrona), entao 5c roda sempre que card
// e PDF existem e a flag esta vazia; falha fica em erros[] e retenta no sweep.
// v16 (29/07, rapport obrigatorio): TODO card sobe com PDF — o RAPPORT DE
// ABORDAGEM, gerado no servidor pela funcao diagnostico-rapport (funciona
// para quiz concluido OU parado no meio, com as respostas ate onde foi).
// 5c agora dispara para QUALQUER card sem anexo: gera o rapport se ainda nao
// existe (pdf_rapport_url) e anexa. O comercial do app segue so como link na
// nota; os cards que ja subiram com o comercial (29/07) ficam como estao.
// v17 (29/07): anexo tambem vira NOTA de anexo na timeline do card — arquivo
// so pela files API fica na aba Arquivos e o comercial nao ve (caso Vinicius).
// v18 (30/07): reabertura de card perdido leva a TAG no MESMO PATCH da mudanca
// de status — antes a tag entrava num segundo PATCH ~1s depois, e automacao do
// Kommo que dispara na entrada do estagio via o card sem identificacao (caso
// Gladson, 30/07). kommoEnsureTag continua depois como rede de seguranca.
// v19 (31/07): acao manual ?reativar=<ficha_id> (botao da ESTRELA de
// reincidencia no BI, via funil-kommo-bi): o dono decide devolver a fila quem
// refez o diagnostico (3+ vezes) ou voltou ao Raio-X. Reabre card perdido (ou
// acha/cria por contato exato via kommoPush), anexa o rapport da ficha MAIS
// RECENTE, escreve nota de reincidencia e re-marca a oportunidade no RD.
// Exclusoes de sempre valem; nada automatico — so dispara pelo botao.
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
// Origem de trafego para atribuicao no RD (mesma regra da
// rd-diagnostico-conversion): utm_source manda, senao o source inferido do
// referrer. Campo vazio fica FORA do payload.
function trafficFields(row: any): Record<string, string> {
  const out: Record<string, string> = {};
  const source = asStr(row.utm_source) ?? asStr(row.origem_source);
  if (source) out.traffic_source = source;
  const medium = asStr(row.utm_medium);
  if (medium) out.traffic_medium = medium;
  const campaign = asStr(row.utm_campaign);
  if (campaign) out.traffic_campaign = campaign;
  const term = asStr(row.utm_term);
  if (term) out.traffic_value = term;
  return out;
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
// Regra de oportunidade v14 (29/07/2026, decisao do dono): quem CONCLUI o quiz
// ja e oportunidade — sem esperar a presenca no Raio-X. So para fichas criadas
// a partir do corte; a base antiga segue precisando de participacao. As
// exclusoes (cliente/frentista/interno/sem contato) ficam nas etapas 4 e 5.
const OPORTUNIDADE_AO_CONCLUIR_DESDE = Date.parse("2026-07-29T00:00:00Z");
function elegivelOportunidade(row: any) {
  if (row.participou_raiox === true) return true;
  return row.concluiu === true && Date.parse(row.created_at) >= OPORTUNIDADE_AO_CONCLUIR_DESDE;
}

async function vmGet(keys: string[]) {
  const { data, error } = await supabase.from("vm_app_keys").select("key,value").in("key", keys);
  if (error) throw new Error("vm_app_keys: " + error.message);
  const m: Record<string, string> = {};
  for (const r of data || []) m[r.key] = r.value;
  return m;
}
async function vmSet(key: string, value: string) {
  const { error } = await supabase.from("vm_app_keys").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
  // refresh OAuth novo que nao persiste = proxima execucao usa refresh velho
  // (se o RD rotacionar, a etapa 4 morre em silencio) — falha tem que subir
  if (error) throw new Error(`persistir ${key}: ${error.message}`);
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

// Tag do card conforme o estagio real: com presenca no Raio-X e
// raiox-realizado; card aberto na conclusao do quiz (v14) e
// diagnostico-realizado — o comercial enxerga a diferenca de estagio.
function tagKommo(row: any) {
  return row.participou_raiox === true ? "raiox-realizado" : "diagnostico-realizado";
}
// added=true quando a tag foi REALMENTE adicionada agora (5b usa isso para
// escrever a nota de participacao uma unica vez por card)
async function kommoEnsureTag(leadId: number, tagName = "raiox-realizado") {
  const d = await kfetch(`/leads/${leadId}`);
  const tags = (d.json?._embedded?.tags || []).map((t: any) => ({ name: t.name }));
  if (tags.some((t: any) => t.name === tagName)) return { ok: true, status: 200, text: "tag ja presente", added: false };
  tags.push({ name: tagName });
  const r = await kfetch(`/leads/${leadId}`, { method: "PATCH", body: JSON.stringify({ _embedded: { tags } }) });
  return { ...r, added: r.ok };
}
function notaKommo(row: any): string {
  // relacaoPosto (nao o campo cru): cai para o papel (dono/gerente/frentista)
  // quando relacao_posto esta vazio — antes a relacao sumia da nota
  const rel = relacaoPosto(row);
  const partes = [
    row.participou_raiox === true
      ? `Participou do Raio-X do Posto (diagnostico ClubPetro).`
      : `Concluiu o Diagnostico do Posto (quiz ClubPetro) — oportunidade aberta na conclusao (regra 29/07/2026).`,
    rel ? `Relacao com o posto: ${rel}` : null,
    row.score !== null && row.score !== undefined ? `Score do diagnostico: ${row.score} (${row.nivel ?? "sem nivel"})` : null,
    row.interesse ? `Frente de interesse: ${row.interesse}` : null,
    row.telefone ? `Telefone: ${row.telefone}` : null,
    row.email ? `E-mail: ${row.email}` : null,
    row.pdf_comercial_url ? `PDF comercial: ${row.pdf_comercial_url}` : null,
  ].filter(Boolean);
  return partes.join("\n");
}
// ---- Anexo do PDF no card (5c) ----
// Drive do Kommo: descoberto uma vez por execucao via /account?with=drive_url.
let kommoDriveCache: string | null = null;
async function kommoDriveUrl(): Promise<string | null> {
  if (kommoDriveCache) return kommoDriveCache;
  const d = await kfetch(`/account?with=drive_url`);
  const u = d.json?.drive_url;
  if (typeof u === "string" && u.startsWith("http")) {
    kommoDriveCache = u.replace(/\/+$/, "");
    return kommoDriveCache;
  }
  return null;
}
// Baixa o PDF do Storage e sobe pro drive do Kommo (sessao -> partes ->
// uuid), depois PENDURA no card via PUT /leads/{id}/files. Parte respeita o
// max_part_size da sessao (nossos PDFs tem centenas de KB, normalmente vai em
// parte unica). Qualquer degrau falhando devolve detalhe pro erros[] — a flag
// so avanca com o anexo confirmado.
async function kommoAnexarPdf(row: any, url: string, nome: string): Promise<{ ok: boolean; detalhe: string }> {
  if (!url.startsWith("http")) return { ok: false, detalhe: "url de pdf invalida" };
  const pdfRes = await fetch(url);
  if (!pdfRes.ok) return { ok: false, detalhe: `baixar pdf: HTTP ${pdfRes.status}` };
  const bytes = new Uint8Array(await pdfRes.arrayBuffer());
  if (!bytes.length) return { ok: false, detalhe: "pdf vazio no storage" };
  const drive = await kommoDriveUrl();
  if (!drive) return { ok: false, detalhe: "drive_url indisponivel na conta" };
  const { token } = await kommoCreds();
  const ses = await fetch(`${drive}/v1.0/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ file_name: nome, file_size: bytes.length, content_type: "application/pdf" }),
  });
  const sj = await ses.json().catch(() => null);
  if (!ses.ok || !sj?.upload_url) {
    return { ok: false, detalhe: `sessao de upload: HTTP ${ses.status} ${JSON.stringify(sj).slice(0, 200)}` };
  }
  const partMax = Number(sj.max_part_size) > 0 ? Number(sj.max_part_size) : bytes.length;
  let next = String(sj.upload_url);
  let fj: any = null;
  for (let ofs = 0; ofs < bytes.length; ) {
    const parte = bytes.slice(ofs, ofs + partMax);
    const up = await fetch(next, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", Authorization: "Bearer " + token },
      body: parte,
    });
    fj = await up.json().catch(() => null);
    if (!up.ok) return { ok: false, detalhe: `upload parte ${ofs}: HTTP ${up.status} ${JSON.stringify(fj).slice(0, 200)}` };
    ofs += parte.length;
    if (ofs < bytes.length && fj?.next_url) next = String(fj.next_url);
  }
  const uuid = fj?.uuid;
  if (!uuid) return { ok: false, detalhe: "upload sem uuid na resposta final: " + JSON.stringify(fj).slice(0, 200) };
  const at = await kfetch(`/leads/${row.kommo_lead_id}/files`, {
    method: "PUT",
    body: JSON.stringify([{ file_uuid: uuid }]),
  });
  if (!at.ok) return { ok: false, detalhe: `pendurar no card: HTTP ${at.status} ${at.text}` };
  // Nota de anexo na TIMELINE: arquivo so pela files API cai na aba Arquivos,
  // que o comercial nao abre — a nota poe o PDF no feed do card (descoberto
  // com o Vinicius, 29/07). Exige version_uuid; se o upload nao devolver,
  // busca no metadata do drive. Nao-fatal: o arquivo ja esta no card.
  let versao = String(fj?.version_uuid || "");
  if (!versao) {
    const meta2 = await fetch(`${drive}/v1.0/files/${uuid}`, { headers: { Authorization: "Bearer " + token } });
    const mj = await meta2.json().catch(() => null);
    versao = String(mj?.version_uuid || "");
    if (!versao) {
      const href = String(mj?._links?.download_version?.href || "");
      const m = href.match(new RegExp(uuid + "/([0-9a-f-]{36})/"));
      if (m) versao = m[1];
    }
  }
  let notaOk = false;
  if (versao) {
    const nt = await kfetch(`/leads/${row.kommo_lead_id}/notes`, {
      method: "POST",
      body: JSON.stringify([{ note_type: "attachment", params: { file_uuid: uuid, version_uuid: versao, file_name: nome } }]),
    });
    notaOk = nt.ok;
  }
  return { ok: true, detalhe: "pdf anexado ao card" + (notaOk ? " + nota na timeline" : " (sem nota na timeline)") };
}
// Gera (ou regenera) o rapport de abordagem da ficha no servidor — a funcao
// diagnostico-rapport monta o PDF com o que a ficha tiver (concluida ou parada
// no meio), grava pdf_rapport_url e devolve a URL publica.
async function gerarRapport(id: string): Promise<{ ok: boolean; url?: string; detalhe: string }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/diagnostico-rapport`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + SERVICE_ROLE },
    body: JSON.stringify({ id }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.url) return { ok: false, detalhe: `gerar rapport: HTTP ${res.status} ${JSON.stringify(j).slice(0, 200)}` };
  return { ok: true, url: String(j.url), detalhe: "rapport gerado" };
}

// Card PERDIDO (status 143) de quem participou volta ao INICIO do pipeline
// Fidelidade — regra do dono (21/07): perdido no passado nao segura o lead
// fora; se participou do Raio-X, e prospeccao ativa de novo.
// v18: a tag de identificacao vai no MESMO PATCH da reabertura — automacao do
// Kommo disparada na entrada do estagio ja ve o card identificado (antes
// havia ~1s de card reaberto sem tag; caso Gladson, 30/07). Se o GET das tags
// atuais falhar, reabre sem tags no corpo (nunca sobrescrever com lista
// parcial) e o kommoEnsureTag do chamador cobre em seguida.
async function kommoReabrir(leadId: number, tagName?: string): Promise<{ ok: boolean; detalhe: string }> {
  const meta = await kommoMeta();
  const body: any = { pipeline_id: KOMMO_PIPELINE, status_id: meta.statusId };
  if (tagName) {
    const d = await kfetch(`/leads/${leadId}`);
    if (d.json?.id) {
      const tags = (d.json._embedded?.tags || []).map((t: any) => ({ name: t.name }));
      if (!tags.some((t: any) => t.name === tagName)) tags.push({ name: tagName });
      body._embedded = { tags };
    }
  }
  const r = await kfetch(`/leads/${leadId}`, { method: "PATCH", body: JSON.stringify(body) });
  if (!r.ok) return { ok: false, detalhe: `reabrir lead ${leadId}: HTTP ${r.status} ${r.text}` };
  return { ok: true, detalhe: "lead perdido reaberto no inicio do funil" };
}

async function kommoPush(row: any): Promise<{ ok: boolean; leadId?: number; detalhe: string }> {
  const existente = await kommoFindLead(row);
  if (existente?.id) {
    let detalhe = "lead existente atualizado com tag";
    if (existente.status_id === 143) {
      const rb = await kommoReabrir(existente.id, tagKommo(row));
      if (!rb.ok) return { ok: false, detalhe: rb.detalhe };
      detalhe = rb.detalhe;
    }
    const r = await kommoEnsureTag(existente.id, tagKommo(row));
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
  // Sub Origem do card = identificador da conversao principal no RD: e por
  // esse valor que o funil Vende Mais pendura MQL/SQL/agenda/venda no evento
  // (era "diagnostico-raiox", que nao casa com evento nenhum — tela zerada).
  if (meta.suborigem?.type === "text") cf.push({ field_id: CF_SUBORIGEM, values: [{ value: "fez-diagnostico-posto" }] });
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
      tags: [{ name: tagKommo(row) }],
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

// devolve a mensagem de erro (ou null): flag que nao grava apos envio 2xx
// significa RE-ENVIO da conversao na proxima varredura — precisa ficar visivel
async function marcar(id: string, patch: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.from("diagnostico_respostas").update(patch).eq("id", id);
  return error ? error.message : null;
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
    // origem do webhook: o trigger de concluiu chama com ?gatilho=concluiu
    // (a etapa 1 e pulada nesse caso — ver comentario la)
    const gatilho = url.searchParams.get("gatilho") || "";

    // ---- v19: reativacao manual pela estrela de reincidencia do BI ----
    // A pessoa refez o diagnostico (3+) ou voltou ao Raio-X e o dono DECIDIU
    // devolve-la a fila (botao no painel, proxy funil-kommo-bi). Mexe SO na
    // ficha pedida; exclusoes de sempre valem.
    const reativarId = url.searchParams.get("reativar");
    if (reativarId) {
      const resp = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json" } });
      const { data: f0 } = await supabase.from("diagnostico_respostas").select("*").eq("id", reativarId).maybeSingle();
      if (!f0) return resp({ ok: false, motivo: "ficha nao encontrada" }, 404);
      // pediram uma ficha refeita? quem conta e a canonica
      let canon = f0;
      if (f0.duplicado_de) {
        const { data: c } = await supabase.from("diagnostico_respostas").select("*").eq("id", f0.duplicado_de).maybeSingle();
        if (c) canon = c;
      }
      if (isFrentista(canon)) return resp({ ok: false, motivo: "frentista nao vai para o Kommo (regra da esteira)" });
      if (ehCliente(canon)) return resp({ ok: false, motivo: "ja e cliente: nao vira card (regra da esteira)" });
      if (ehFamiliaPires(canon)) return resp({ ok: false, motivo: "pessoal interno nao vira card (regra da esteira)" });
      if (!temEmail(canon) && !canon.telefone) return resp({ ok: false, motivo: "ficha sem e-mail e sem telefone: nao da para casar nem criar card" });
      const { data: refeitas } = await supabase.from("diagnostico_respostas")
        .select("id, concluiu, concluido_em, created_at, score, nivel, interesse, telefone, pdf_rapport_url")
        .eq("duplicado_de", canon.id);
      const grupo = [canon, ...(refeitas || [])];
      const vezes = grupo.filter((g: any) => g.concluiu === true).length;
      const maisRecente = grupo.filter((g: any) => g.concluiu === true)
        .sort((a: any, b: any) => String(b.concluido_em ?? b.created_at).localeCompare(String(a.concluido_em ?? a.created_at)))[0] ?? canon;
      // nota e rapport falam do AGORA da pessoa: dados frescos por cima da canonica
      const row = {
        ...canon,
        score: maisRecente.score ?? canon.score,
        nivel: maisRecente.nivel ?? canon.nivel,
        interesse: maisRecente.interesse ?? canon.interesse,
        telefone: maisRecente.telefone || canon.telefone,
      };
      const feito: string[] = [];
      const falhas: string[] = [];
      const push = await kommoPush(row);
      if (!push.ok || !push.leadId) return resp({ ok: false, motivo: "Kommo: " + push.detalhe });
      feito.push(push.detalhe);
      const ultimaData = String(maisRecente.concluido_em ?? maisRecente.created_at ?? "").slice(0, 10);
      try {
        const nt = await kfetch(`/leads/${push.leadId}/notes`, {
          method: "POST",
          body: JSON.stringify([{ note_type: "common", params: {
            text: `REINCIDENTE: fez o diagnostico ${vezes}x (ultima em ${ultimaData}).`
              + `\nDevolvida a fila pelo painel do funil — a pessoa esta interagindo de novo com a gente.`,
          } }]),
        });
        if (nt.ok) feito.push("nota de reincidencia no card");
        else falhas.push(`nota de reincidencia: HTTP ${nt.status} ${nt.text}`);
      } catch (e) { falhas.push("nota de reincidencia: " + String(e).slice(0, 200)); }
      // rapport da ficha MAIS RECENTE (gera na hora se a refeita ainda nao tem)
      let pdfOk = false;
      try {
        let urlPdf = String(maisRecente.pdf_rapport_url || "").trim();
        if (!urlPdf) {
          const g = await gerarRapport(String(maisRecente.id));
          if (g.ok && g.url) urlPdf = g.url;
          else falhas.push(g.detalhe);
        }
        if (urlPdf) {
          const nomeArq = `Rapport - ${String(row.nome || row.email || "lead").slice(0, 60)}.pdf`;
          const ax = await kommoAnexarPdf({ kommo_lead_id: push.leadId }, urlPdf, nomeArq);
          if (ax.ok) { pdfOk = true; feito.push("rapport mais recente anexado ao card"); }
          else falhas.push("anexo do rapport: " + ax.detalhe);
        }
      } catch (e) { falhas.push("anexo do rapport: " + String(e).slice(0, 200)); }
      let rdOk = false;
      if (temEmail(row)) {
        try {
          const ro = await rdMarkOpportunity(row.email);
          if (ro.ok) { rdOk = true; feito.push("oportunidade re-marcada no RD"); }
          else falhas.push(`oportunidade no RD: HTTP ${ro.status} ${ro.text}`);
        } catch (e) { falhas.push("oportunidade no RD: " + String(e).slice(0, 200)); }
      }
      const patch: Record<string, unknown> = {
        kommo_enviado: true, kommo_lead_id: push.leadId, kommo_enviado_em: new Date().toISOString(), kommo_erro: null,
      };
      if (pdfOk) patch.kommo_pdf_enviado = true;
      if (rdOk) { patch.rd_oportunidade_enviado = true; patch.rd_oportunidade_em = new Date().toISOString(); }
      const eFlag = await marcar(canon.id, patch);
      if (eFlag) falhas.push("flags na ficha: " + eFlag);
      await supabase.from("diagnostico_esteira_log").insert({ resumo: {
        modo: "reativar", lead: canon.nome, ficha: canon.id, kommo_lead_id: push.leadId,
        vezes_diagnostico: vezes, acoes: feito, erros: falhas, quando: new Date().toISOString(),
      } });
      return resp({ ok: true, lead_id: push.leadId, vezes_diagnostico: vezes, feito, falhas });
    }

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
    // grava flag e registra falha do UPDATE (antes era silenciosa)
    const marcarLog = async (row: any, etapa: string, patch: Record<string, unknown>) => {
      const e = await marcar(row.id, patch);
      if (e) erros.push({ lead: row.nome, etapa: etapa + "-flag", erro: e });
    };
    if (!rdToken) {
      // sem token as etapas 1-3 pulam TODAS as fichas — antes sem nenhum sinal
      erros.push({ etapa: "rd-token", erro: "Armazena_Token_RD vazio/ilegivel: conversoes RD pausadas nesta execucao" });
    }

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
          await marcarLog(dup, "dedup", { duplicado_de: canonica.id });
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
            await marcarLog(dup, "dedup", { duplicado_de: grupo[0].id });
            if (dup.id === r0.id) r0.duplicado_de = grupo[0].id;
            acoes.push({ lead: dup.nome, etapa: "dedup", detalhe: "duplicata de " + grupo[0].id });
          }
        }
      }
    }

    for (let row of rows) {
      if (row.duplicado_de) continue; // ficha duplicada: quem conta e a canonica
      // Releitura FRESCA antes de agir (so quando a ficha pode gerar acao):
      // o sweep leva ~2,5 min e nas tercas dois crons disparam no mesmo
      // minuto — snapshot velho reenviaria conversao ja feita pelo webhook.
      if (modo === "sweep" && !dry) {
        const podeAgir =
          (row.concluiu === true && row.rd_enviado !== true) ||
          ((row.raiox_status || "").toLowerCase() === "confirmado" && row.rd_raiox_enviado !== true) ||
          (row.participou_raiox === true && (
            row.rd_participou_enviado !== true ||
            (row.kommo_lead_id && row.ultima_participacao_raiox && row.kommo_enviado_em &&
              Date.parse(row.ultima_participacao_raiox) > Date.parse(row.kommo_enviado_em))
          )) ||
          (elegivelOportunidade(row) && (row.rd_oportunidade_enviado !== true || row.kommo_enviado !== true)) ||
          (row.kommo_enviado === true && row.kommo_lead_id && row.kommo_pdf_enviado !== true);
        if (podeAgir) {
          const { data: fresco } = await supabase.from("diagnostico_respostas")
            .select("*").eq("id", row.id).maybeSingle();
          if (!fresco) continue;
          row = fresco;
          if (row.duplicado_de) continue;
        }
      }
      const jobTitle = relacaoPosto(row);
      try {
        // 1) fez-diagnostico-posto — PULADA no webhook do gatilho de concluiu:
        // a rd-diagnostico-conversion dispara no MESMO update e ja envia esta
        // conversao; dois remetentes na mesma janela = envio em dobro no RD.
        // O sweep (a cada 10 min) continua cobrindo o retry se ela falhar.
        if (row.concluiu === true && row.rd_enviado !== true && temEmail(row) && !isFrentista(row) && rdToken &&
            !(modo === "webhook" && gatilho === "concluiu")) {
          if (dry) { simular(row.nome, "fez-diagnostico"); } else {
            const r = await rdConversion(rdToken, {
              conversion_identifier: "fez-diagnostico-posto",
              email: row.email, name: row.nome ?? undefined, job_title: jobTitle,
              // cf_relacao_com_o_posto: campo do contato que abastece o
              // BD_Conversoes_RD.relacao_posto (funil Vende Mais).
              cf_relacao_com_o_posto: jobTitle,
              mobile_phone: asStr(row.telefone), ...trafficFields(row),
              cf_score_diagnostico: asStr(row.score), cf_nivel_diagnostico: asStr(row.nivel),
              cf_dimensao_fraca: dimensaoFraca(row), cf_frente_interesse: asStr(row.interesse),
              // Mesmo campo custom da rd-diagnostico-conversion: URL do quiz no
              // evento (a API do RD nao tem "URL da Conversao" nativo).
              cf_url_do_diagnostico: "https://diagnostico-clubpetro.web.app/",
              tags: ["diagnostico-realizado"],
            });
            if (r.ok) await marcarLog(row, "fez-diagnostico", { rd_enviado: true, rd_enviado_em: new Date().toISOString() });
            (r.ok ? acoes : erros).push({ lead: row.nome, etapa: "fez-diagnostico", status: r.status, ...(r.ok ? {} : { erro: r.text }) });
          }
        }
        // 2) confirmou-raiox-posto
        if ((row.raiox_status || "").toLowerCase() === "confirmado" && row.rd_raiox_enviado !== true && temEmail(row) && !isFrentista(row) && rdToken) {
          if (dry) { simular(row.nome, "confirmou-raiox"); } else {
            const r = await rdConversion(rdToken, {
              conversion_identifier: "confirmou-raiox-posto", email: row.email,
              job_title: jobTitle, cf_relacao_com_o_posto: jobTitle, tags: ["raiox-confirmado"],
            });
            if (r.ok) await marcarLog(row, "confirmou-raiox", { rd_raiox_enviado: true });
            (r.ok ? acoes : erros).push({ lead: row.nome, etapa: "confirmou-raiox", status: r.status, ...(r.ok ? {} : { erro: r.text }) });
          }
        }
        // 3) fez-raiox-posto + tag raiox-realizado
        if (row.participou_raiox === true && row.rd_participou_enviado !== true && temEmail(row) && rdToken) {
          if (dry) { simular(row.nome, "fez-raiox"); } else {
            const r = await rdConversion(rdToken, {
              conversion_identifier: "fez-raiox-posto", email: row.email,
              name: row.nome ?? undefined, job_title: jobTitle, cf_relacao_com_o_posto: jobTitle, tags: ["raiox-realizado"],
            });
            if (r.ok) await marcarLog(row, "fez-raiox", { rd_participou_enviado: true });
            (r.ok ? acoes : erros).push({ lead: row.nome, etapa: "fez-raiox", status: r.status, ...(r.ok ? {} : { erro: r.text }) });
          }
        }
        // 4) OPORTUNIDADE no RD (elegivel = concluiu apos o corte OU participou;
        //    nao-cliente, nao-frentista, nao-interno)
        if (elegivelOportunidade(row) && row.rd_oportunidade_enviado !== true && temEmail(row) && !isFrentista(row) && !ehCliente(row) && !ehFamiliaPires(row)) {
          if (dry) { simular(row.nome, "rd-oportunidade"); } else {
            const r = await rdMarkOpportunity(row.email);
            if (r.ok) await marcarLog(row, "rd-oportunidade", { rd_oportunidade_enviado: true, rd_oportunidade_em: new Date().toISOString() });
            (r.ok ? acoes : erros).push({ lead: row.nome, etapa: "rd-oportunidade", status: r.status, ...(r.ok ? {} : { erro: r.text }) });
          }
        }
        // 5b) Card ja enviado + PARTICIPOU depois do envio: card aberto ganha a
        // tag raiox-realizado + nota (uma vez); card perdido reabre no inicio do
        // funil (tag + nota) e re-marca a oportunidade no RD. kommo_enviado_em
        // avanca apos a checagem para nao reconsultar o Kommo a cada varredura.
        if (row.participou_raiox === true && row.kommo_enviado === true && row.kommo_lead_id &&
            !isFrentista(row) && !ehCliente(row) && !ehFamiliaPires(row) &&
            row.ultima_participacao_raiox && row.kommo_enviado_em &&
            Date.parse(row.ultima_participacao_raiox) > Date.parse(row.kommo_enviado_em)) {
          if (dry) { simular(row.nome, "kommo-reabrir?"); } else {
            const ld = await kfetch(`/leads/${row.kommo_lead_id}?with=contacts`);
            if (!ld.json?.id) {
              // GET falho ficava mudo e o marco nao avancava nunca — registra
              erros.push({ lead: row.nome, etapa: "kommo-reabrir", erro: `GET lead ${row.kommo_lead_id}: HTTP ${ld.status} ${ld.text}` });
            } else {
              // toque de reconciliacao: garante o select de relacao no contato
              // principal do card (preenche so se estiver vazio)
              const cts = ld.json?._embedded?.contacts || [];
              const contatoId = (cts.find((c: any) => c.is_main) || cts[0])?.id;
              await kommoGarantirRelacao(contatoId, row);
              let tudoOk = true;
              if (ld.json.status_id !== 143) {
                // Card ABERTO com participacao posterior ao envio: garante a
                // tag raiox-realizado (cards criados na conclusao do quiz, v14,
                // nascem so com diagnostico-realizado) e anota a presenca UMA
                // vez por card (added=false nas proximas participacoes).
                const tg = await kommoEnsureTag(Number(row.kommo_lead_id));
                if (!tg.ok) {
                  tudoOk = false;
                  erros.push({ lead: row.nome, etapa: "kommo-tag-raiox", erro: `HTTP ${tg.status} ${tg.text}` });
                } else if (tg.added) {
                  await kfetch(`/leads/${row.kommo_lead_id}/notes`, {
                    method: "POST",
                    body: JSON.stringify([{ note_type: "common", params: {
                      text: `Participou do Raio-X em ${String(row.ultima_participacao_raiox).slice(0, 10)}.`
                        + (relacaoPosto(row) ? `\nRelacao com o posto: ${relacaoPosto(row)}` : ""),
                    } }]),
                  });
                  acoes.push({ lead: row.nome, etapa: "kommo-tag-raiox", kommo_lead_id: row.kommo_lead_id });
                }
              }
              if (ld.json.status_id === 143) {
                const rb = await kommoReabrir(Number(row.kommo_lead_id), tagKommo(row));
                if (rb.ok) {
                  const tg = await kommoEnsureTag(Number(row.kommo_lead_id));
                  if (!tg.ok) { tudoOk = false; erros.push({ lead: row.nome, etapa: "kommo-reaberto-tag", erro: `HTTP ${tg.status} ${tg.text}` }); }
                  await kfetch(`/leads/${row.kommo_lead_id}/notes`, {
                    method: "POST",
                    body: JSON.stringify([{ note_type: "common", params: {
                      text: `Participou de novo do Raio-X em ${String(row.ultima_participacao_raiox).slice(0, 10)} — card reaberto automaticamente (estava perdido).`
                        + (relacaoPosto(row) ? `\nRelacao com o posto: ${relacaoPosto(row)}` : ""),
                    } }]),
                  });
                  if (temEmail(row)) {
                    const ro = await rdMarkOpportunity(row.email);
                    if (!ro.ok) { tudoOk = false; erros.push({ lead: row.nome, etapa: "kommo-reaberto-rd", erro: `HTTP ${ro.status} ${ro.text}` }); }
                  }
                  acoes.push({ lead: row.nome, etapa: "kommo-reaberto", kommo_lead_id: row.kommo_lead_id });
                } else {
                  tudoOk = false;
                  erros.push({ lead: row.nome, etapa: "kommo-reaberto", erro: rb.detalhe });
                }
              }
              // avanca o marco SO com a checagem concluida sem falha (senao retenta)
              if (tudoOk) await marcarLog(row, "kommo-marco", { kommo_enviado_em: new Date().toISOString() });
            }
          }
        }
        // 5) Kommo (elegivel = concluiu apos o corte OU participou; nao-cliente,
        //    nao-frentista, nao-interno, com contato)
        if (elegivelOportunidade(row) && row.kommo_enviado !== true && !isFrentista(row) && !ehCliente(row) && !ehFamiliaPires(row) && (temEmail(row) || row.telefone)) {
          if (dry) { simular(row.nome, "kommo"); } else {
            const r = await kommoPush(row);
            if (r.ok) {
              await marcarLog(row, "kommo", { kommo_enviado: true, kommo_lead_id: r.leadId ?? null, kommo_enviado_em: new Date().toISOString(), kommo_erro: null });
              acoes.push({ lead: row.nome, etapa: "kommo", detalhe: r.detalhe, kommo_lead_id: r.leadId });
              // espelha no snapshot local: a 5c logo abaixo ja anexa o PDF
              // nesta MESMA passada quando a URL ja estiver gerada
              row.kommo_enviado = true;
              row.kommo_lead_id = r.leadId ?? row.kommo_lead_id;
            } else {
              await marcar(row.id, { kommo_erro: r.detalhe.slice(0, 500) });
              erros.push({ lead: row.nome, etapa: "kommo", erro: r.detalhe });
            }
          }
        }
        // 5c) TODO card sobe com PDF (regra do dono, 29/07): o RAPPORT DE
        // ABORDAGEM e gerado no servidor (concluido ou parado no meio) e
        // anexado ao card. Se a ficha ainda nao tem pdf_rapport_url, gera na
        // hora; falha nao trava as outras etapas e retenta no proximo sweep.
        if (row.kommo_enviado === true && row.kommo_lead_id && row.kommo_pdf_enviado !== true) {
          if (dry) { simular(row.nome, "kommo-pdf"); } else {
            let urlPdf = String(row.pdf_rapport_url || "").trim();
            if (!urlPdf) {
              const g = await gerarRapport(row.id);
              if (g.ok && g.url) { urlPdf = g.url; row.pdf_rapport_url = g.url; }
              else erros.push({ lead: row.nome, etapa: "rapport", erro: g.detalhe });
            }
            if (urlPdf) {
              const nomeArq = `Rapport - ${String(row.nome || row.email || "lead").slice(0, 60)}.pdf`;
              const r = await kommoAnexarPdf(row, urlPdf, nomeArq);
              if (r.ok) {
                await marcarLog(row, "kommo-pdf", { kommo_pdf_enviado: true });
                acoes.push({ lead: row.nome, etapa: "kommo-pdf", detalhe: r.detalhe, kommo_lead_id: row.kommo_lead_id });
              } else {
                erros.push({ lead: row.nome, etapa: "kommo-pdf", erro: r.detalhe });
              }
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
