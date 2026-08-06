import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RD_ENDPOINT = "https://api.rd.services/platform/conversions";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const PILAR_LABEL: Record<string, string> = {
  pessoas: "Pessoas",
  marca: "Marca",
  comercial: "Comercial",
  fidelizacao: "Fidelizacao",
  dados: "Dados",
  resiliencia: "Resiliencia",
};

const RELACAO_LABEL: Record<string, string> = {
  dono: "Dono(a) ou Diretor(a)",
  gerente: "Gerente ou Supervisor(a)",
  outro: "Frentista",
  frentista: "Frentista",
};

function safeParse(s: unknown) {
  try { return JSON.parse(String(s)); } catch { return null; }
}

// mesmo criterio de dedup da esteira (minusculo, sem acento)
function nrm(s: unknown) {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Campos custom do RD sao todos do tipo STRING — enviar numero da 400
// (INVALID_DATA_TYPE em cf_score_diagnostico, capturado em 08/07).
function asStr(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

// Valor CURTO para cf_dimensao_fraca (pilar mais fraco), com fallback truncado.
function dimensaoFraca(row: Record<string, unknown>): string | undefined {
  const raw = row.pontuacao_pilares;
  const obj = typeof raw === "string" ? safeParse(raw) : raw;
  if (obj && typeof obj === "object") {
    let worst: string | null = null;
    let min = Infinity;
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

function relacaoPosto(row: Record<string, unknown>): string | undefined {
  const direto = (row.relacao_posto ?? "").toString().trim();
  if (direto) return direto;
  const papel = (row.papel ?? "").toString().trim().toLowerCase();
  return RELACAO_LABEL[papel];
}

// Origem de trafego para atribuicao no RD (e por aqui que o time de trafego
// pago valida a conversao da campanha). utm_source manda; sem UTM, cai no
// source inferido do referrer (origem_source, gravado no INSERT da sessao).
// Campo vazio fica FORA do payload (RD nao aceita null em traffic_*).
function trafficFields(row: Record<string, unknown>): Record<string, string> {
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

// Le o token publico mais recente da tabela Armazena_Token_RD
async function getRdToken(): Promise<string | null> {
  const { data, error } = await supabase
    .from("Armazena_Token_RD")
    .select("Token")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.Token) return null;
  return data.Token as string;
}

async function sendConversion(token: string, body: unknown) {
  const res = await fetch(`${RD_ENDPOINT}?api_key=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

serve(async (req) => {
  try {
    const payload = await req.json();
    // Webhook de UPDATE: o registro atualizado vem em "record".
    const row = payload.record ?? payload;

    const email = (row.email ?? "").toString().trim();
    const concluiu = row.concluiu === true || row.concluiu === "true";
    const jaEnviado = row.rd_enviado === true || row.rd_enviado === "true";
    const raioxJaEnviado = row.rd_raiox_enviado === true || row.rd_raiox_enviado === "true";
    const papel = (row.papel ?? "").toString().trim().toLowerCase();
    const isFrentista = papel === "outro" || papel === "frentista";
    const raioxStatus = (row.raiox_status ?? "").toString().trim().toLowerCase();
    const jobTitle = relacaoPosto(row);

    // Gate basico: precisa de e-mail valido, nao ser frentista (frentista pontua
    // so para comparacao interna, sem MQL no RD) e nao ser ficha duplicada
    // (a canonica da pessoa e quem conversa com o RD).
    if (!email || email.indexOf("@") < 0 || isFrentista || row.duplicado_de) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const token = await getRdToken();
    if (!token) {
      return new Response(JSON.stringify({ error: "token ausente" }), { status: 500 });
    }

    let diagStatus: number | null = null;
    let diagErro: string | null = null;
    let raioxRespStatus: number | null = null;
    let inicioStatus: number | null = null;

    // 0) Conversao de INICIO (iniciou-diagnostico-posto): o e-mail agora entra
    //    na tela inicial do quiz, entao o lead sobe pro RD assim que a coluna
    //    email e preenchida (trigger rd_diagnostico_inicio), com a origem de
    //    trafego junto. Dedup pela coluna rd_inicio_enviado. So roda ANTES da
    //    conclusao: ficha antiga que so aparece aqui no flip de concluiu ja
    //    leva a origem na propria fez-diagnostico-posto, sem "inicio" tardio.
    const inicioJaEnviado = row.rd_inicio_enviado === true || row.rd_inicio_enviado === "true";
    if (!inicioJaEnviado && !concluiu) {
      const r = await sendConversion(token, {
        event_type: "CONVERSION",
        event_family: "CDP",
        payload: {
          conversion_identifier: "iniciou-diagnostico-posto",
          email,
          name: row.nome ?? undefined,
          mobile_phone: asStr(row.telefone),
          ...trafficFields(row),
          tags: ["diagnostico-iniciado"],
        },
      });
      inicioStatus = r.status;
      if (r.ok) {
        await supabase.from("diagnostico_respostas")
          .update({ rd_inicio_enviado: true, rd_inicio_enviado_em: new Date().toISOString() })
          .eq("id", row.id);
      } else {
        console.error("iniciou-diagnostico-posto falhou", r.status, (r.text ?? "").slice(0, 300));
      }
    }

    // 1) Conversao inicial do diagnostico: uma vez, para quem concluiu.
    //    Dedup pela coluna rd_enviado + dedup conservador por ficha irma:
    //    quem REFAZ o quiz gera linha nova (duplicado_de ainda null ate o
    //    sweep da esteira) e reenviava fez-diagnostico (Antonio 03/07,
    //    Bianca 21/07). Ficha irma com MESMO e-mail E MESMO primeiro nome ja
    //    enviada => pula o envio, SEM marcar nada (o sweep marca duplicado_de
    //    depois). Primeiro nome no criterio: casais dividem e-mail
    //    (Carla/Cristiano) e NAO podem se bloquear.
    let irmaJaEnviada = false;
    if (concluiu && !jaEnviado) {
      const pn = nrm(row.nome).split(/\s+/)[0] || "";
      if (pn) {
        const padrao = email.replace(/([%_\\])/g, "\\$1");
        const { data: irms } = await supabase.from("diagnostico_respostas")
          .select("id,nome").ilike("email", padrao).neq("id", row.id).eq("rd_enviado", true);
        irmaJaEnviada = (irms || []).some((x) => (nrm(x.nome).split(/\s+/)[0] || "") === pn);
      }
    }
    if (concluiu && !jaEnviado && !irmaJaEnviada) {
      const diagResp = await sendConversion(token, {
        event_type: "CONVERSION",
        event_family: "CDP",
        payload: {
          conversion_identifier: "fez-diagnostico-posto",
          email,
          name: row.nome ?? undefined,
          job_title: jobTitle,
          mobile_phone: asStr(row.telefone),
          ...trafficFields(row),
          cf_score_diagnostico: asStr(row.score),
          cf_nivel_diagnostico: asStr(row.nivel),
          cf_dimensao_fraca: dimensaoFraca(row),
          cf_frente_interesse: asStr(row.interesse),
          tags: ["diagnostico-realizado"],
        },
      });
      diagStatus = diagResp.status;
      if (diagResp.ok) {
        await supabase.from("diagnostico_respostas")
          .update({ rd_enviado: true, rd_enviado_em: new Date().toISOString() })
          .eq("id", row.id);
      } else {
        diagErro = (diagResp.text ?? "").slice(0, 300);
        console.error("fez-diagnostico-posto falhou", diagStatus, diagErro);
      }
    }

    // 2) Conversao do Raio X: quando a pessoa CONFIRMA. Dedup pela coluna
    //    rd_raiox_enviado (o cron remarca confirmado todo dia).
    //    ('compareceu' removido em 22/07: fez-raiox-posto e exclusivo da
    //    esteira — aqui o dedup usava outra coluna e duplicaria o envio.)
    if (!raioxJaEnviado && raioxStatus === "confirmado") {
      const r = await sendConversion(token, {
        event_type: "CONVERSION",
        event_family: "CDP",
        payload: { conversion_identifier: "confirmou-raiox-posto", email, job_title: jobTitle, tags: ["raiox-confirmado"] },
      });
      raioxRespStatus = r.status;
      if (r.ok) {
        await supabase.from("diagnostico_respostas")
          .update({ rd_raiox_enviado: true })
          .eq("id", row.id);
      } else {
        console.error("confirmou-raiox-posto falhou", r.status, (r.text ?? "").slice(0, 300));
      }
    }

    return new Response(
      JSON.stringify({ inicio: inicioStatus, diag: diagStatus, diag_erro: diagErro, raiox: raioxRespStatus }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
