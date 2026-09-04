/* API de persistência do diagnóstico no Supabase.
   Tudo numa única tabela: `diagnostico_respostas`.
   Cada momento do fluxo dispara um UPDATE/UPSERT parcial dessa linha.
   A telemetria por evento vai por GTM/Meta (tracking.ts); não é persistida aqui. */

import { getSupabase } from "./supabase";
import { CONFIG } from "./config";
import { uuid } from "./format";
import { BLOCKS, BLOCK_ORDER } from "../data/blocks";
import { QUESTIONS } from "../data/questions";
import type { Answer, AppState } from "./state";
import type { RequestContext } from "./context";

const TABLE   = "diagnostico_respostas";
const ID_COL  = "id"; // PK da tabela diagnostico_respostas
const BUCKET  = "diagnostico-pdfs";

/* Persistência da LINHA via PostgREST direto (fetch), não pelo supabase-js.
   Motivo: o caminho via cliente vinha falhando em silêncio no navegador
   enquanto o INSERT passava. O fetch direto é o mesmo caminho REST validado
   manualmente, e `keepalive` garante que os UPDATEs do fim do fluxo (resultado,
   conclusão, RD) não sejam cancelados quando a tela troca. */
const REST_URL = `${CONFIG.SUPABASE_URL}/rest/v1/${TABLE}`;
const REST_HEADERS: Record<string, string> = {
  apikey: CONFIG.SUPABASE_ANON_KEY,
  Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

/* Token secreto da sessão (22/07): nasce no navegador, vai junto do INSERT
   (coluna token_sessao) e autentica cada UPDATE via header x-quiz-token — a
   RLS só deixa atualizar a linha cujo token bate com o header. O id da sessão
   aparece em link de PDF; o token nunca sai do navegador. sessionStorage
   preserva o token num reload; sem storage (modo privado), fica em memória. */
const TOKEN_STORE = "diag_token_sessao";
let tokenMem: string | null = null;
function tokenSessao(): string {
  if (tokenMem) return tokenMem;
  try { tokenMem = sessionStorage.getItem(TOKEN_STORE); } catch { /* sem storage */ }
  if (!tokenMem) {
    /* uuid() de ./format, NUNCA crypto.randomUUID() direto (31/08):
       randomUUID só existe em contexto seguro e a partir do iOS 15.4 /
       Chrome 92, e o in-app browser antigo do Instagram/Facebook não tem.
       Ali a chamada lançava TypeError já na primeira gravação, o safe() do
       createSession engolia o erro em silêncio e a LINHA DO LEAD NUNCA
       NASCIA: a pessoa respondia o quiz inteiro e nada chegava ao banco.
       uuid() tem fallback RFC-4122 v4 por getRandomValues, que existe em
       webview velha. Continuam DOIS uuid() concatenados porque a RLS exige
       token com >=32 chars (ver adoptTokenSessao abaixo). */
    tokenMem = uuid() + uuid();
    try { sessionStorage.setItem(TOKEN_STORE, tokenMem); } catch { /* só memória */ }
  }
  return tokenMem;
}

/* Token da sessão exposto ao app: o boot guarda o token JUNTO do estado salvo
   (localStorage) para uma retomada em OUTRA aba — ou no dia seguinte — poder
   readotá-lo. Sem isso, sessionStorage novo gera token novo, a RLS por token
   não enxerga a linha antiga e todos os PATCHes casam 0 linhas em silêncio
   (lead respondendo o quiz inteiro sem nada ser gravado). */
export function getTokenSessao(): string {
  return tokenSessao();
}
export function adoptTokenSessao(t: string | null | undefined): void {
  if (!t || t.length < 32) return; // RLS exige >=32; ignora lixo
  tokenMem = t;
  try { sessionStorage.setItem(TOKEN_STORE, t); } catch { /* só memória */ }
}
function restHeaders(): Record<string, string> {
  return { ...REST_HEADERS, "x-quiz-token": tokenSessao() };
}

function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  return fn().catch((e) => {
    if (typeof console !== "undefined") console.warn(`[api:${label}]`, e);
    return null;
  });
}

/* ============== Create / Upsert ============== */

/* Colunas de 31/08 (migration 20260831120000_origem_clickid_e_device.sql) já
   recusadas por este navegador. O front (Firebase Hosting) e o banco (Supabase)
   sobem por caminhos independentes: se o site chegar antes da migration, o
   PostgREST devolve 400/PGRST204 e o primeiro INSERT se perde. Marcando o fato
   aqui, os INSERTs seguintes da mesma carga — o de reparo do app.ts, que roda
   quando o primeiro falhou — já saem no formato antigo, sem pagar outro 400. */
let semColunasDeOrigem = false;

/* Retorna true quando o INSERT confirmou (2xx). false = falhou (rede/adblock/
   409 de linha já existente) — o safe engole o erro, então o retorno é o único
   sinal que o chamador tem para decidir reparar com um novo INSERT. */
export async function createSession(id: string, _version: string, context: RequestContext): Promise<boolean> {
  // INSERT mínimo: cria a linha com o id da sessão, o token secreto (a RLS
  // exige token no INSERT e confere nos UPDATEs) e a ORIGEM capturada no boot
  // (UTMs + click ids + source inferido + fingerprint do navegador). Gravada
  // uma vez na criação, antes das respostas.
  const c = context || ({} as RequestContext);

  /* Conjunto ANTIGO de colunas: existe em produção desde 22/07
     (20260722160000_origem_utm_diagnostico_respostas.sql). É o payload que o
     banco aceita HOJE, com ou sem a migration de 31/08 aplicada. */
  const base: Record<string, unknown> = {
    id,
    token_sessao: tokenSessao(),
    utm_source:   c.utm_source ?? null,
    utm_medium:   c.utm_medium ?? null,
    utm_campaign: c.utm_campaign ?? null,
    utm_content:  c.utm_content ?? null,
    utm_term:     c.utm_term ?? null,
    origem_source: c.source ?? null,
    referrer:     c.referrer ?? null,
    landing_url:  c.landing_url ?? null,
  };

  /* Conjunto NOVO (31/08), só existe depois da migration
     20260831120000_origem_clickid_e_device.sql. */
  const novas: Record<string, unknown> = {
    // Click id do anúncio: salva o clique pago que chega SEM utm_* — antes
    // de 31/08 ele virava origem_source=direct e sumia (55% das sessões
    // desde 22/07 chegaram sem query e sem referrer; 29 viraram lead no
    // comercial sem origem nenhuma).
    fbclid:      c.fbclid ?? null,
    gclid:       c.gclid ?? null,
    // Fingerprint do navegador: o captureContext() já coletava isto desde
    // 22/07 e o INSERT jogava fora. Sem persistir, não dá para separar o
    // "direct de verdade" da webview cega do Instagram/Facebook — que é a
    // hipótese principal para os direct sem referrer e sem query.
    user_agent:  c.user_agent ?? null,
    device_type: c.device_type ?? null,
    browser:     c.browser ?? null,
    os:          c.os ?? null,
  };

  const ok = await safe("createSession", async () => {
    const post = (body: Record<string, unknown>) =>
      fetch(REST_URL, {
        method: "POST",
        headers: restHeaders(),
        body: JSON.stringify(body),
        keepalive: true,
      });

    let res = await post(semColunasDeOrigem ? base : { ...base, ...novas });
    if (!res.ok) {
      const detalhe = await res.text();
      /* DEGRADAÇÃO, não desistência (31/08): o PostgREST valida o payload
         inteiro contra o schema cache, então UMA coluna que ele não conhece
         recusa o INSERT TODO com 400/PGRST204 ("Could not find the 'fbclid'
         column of 'diagnostico_respostas' in the schema cache"). Sem este
         retry, subir o front antes da migration não perderia só a origem:
         perderia a LINHA DO LEAD. E em silêncio — o safe() acima só faz um
         console.warn, o PATCH de contato do app.ts casaria 0 linhas, o trigger
         rd_diagnostico_inicio (que dispara no UPDATE do email) nunca rodaria e
         100% dos leads sumiriam sem erro visível para ninguém. Regravando só
         com as colunas antigas, o pior caso volta a ser o de antes de hoje
         (lead gravado, origem cega) e o deploy fica em ordem indiferente.
         Repetir aqui NÃO duplica linha: o 400 é recusa total, nada foi gravado.
         Só este erro é tratado — 409 (linha já existe), 401 (RLS) e falha de
         rede continuam subindo para o safe(), que devolve false e deixa o
         chamador decidir o reparo. */
      const colunaInexistente =
        res.status === 400 && /PGRST204|could not find the .* column/i.test(detalhe);
      if (!colunaInexistente) throw new Error(`createSession HTTP ${res.status}: ${detalhe}`);

      semColunasDeOrigem = true;
      if (typeof console !== "undefined") {
        console.warn(
          "[api:createSession] banco sem as colunas de origem de 31/08 (migration " +
          "20260831120000_origem_clickid_e_device.sql não aplicada). Regravando a " +
          "sessão sem click id/device — o lead é salvo, a origem fica cega.",
          detalhe,
        );
      }
      res = await post(base);
      if (!res.ok) throw new Error(`createSession HTTP ${res.status}: ${await res.text()}`);
    }
    return true;
  });
  return ok === true;
}

async function updateRow(id: string, patch: Record<string, unknown>): Promise<void> {
  if (!id) return;
  await safe("updateRow", async () => {
    const res = await fetch(`${REST_URL}?${ID_COL}=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: restHeaders(),
      body: JSON.stringify(patch),
      keepalive: true,
    });
    if (!res.ok) throw new Error(`updateRow HTTP ${res.status}: ${await res.text()}`);
  });
}

/* ============== Lead ============== */

export async function setSessionContact(id: string, name: string, email: string, phone: string): Promise<void> {
  await updateRow(id, {
    nome:     name,
    email:    email,
    telefone: phone,
  });
}

/* Marca a conclusão do diagnóstico (chegou ao fim da análise) e se virou MQL
   (dono ou gerente que deixou contato). created_at já marca o início.
   OBS: a coluna `concluiu` é GERADA no banco (calculada automaticamente), então
   NÃO pode ser setada aqui (PostgREST rejeita o PATCH inteiro com 400). Gravamos
   só concluido_em + mql; o `concluiu` se resolve sozinho no banco. */
export async function completeSession(id: string, mql: boolean): Promise<void> {
  await updateRow(id, {
    concluido_em: new Date().toISOString(),
    mql,
  });
}

/* Âncora de conversão da tela final ("Sua análise está pronta", id
   #analise-pronta). PATCH separado do resultado e condicional (filtro
   resultado_visto_em=is.null): a primeira abertura grava o horário, retomadas
   e re-renders não sobrescrevem, e um erro aqui não derruba o persistResult. */
export async function markResultadoVisto(id: string): Promise<void> {
  if (!id) return;
  await safe("markResultadoVisto", async () => {
    const res = await fetch(
      `${REST_URL}?${ID_COL}=eq.${encodeURIComponent(id)}&resultado_visto_em=is.null`,
      {
        method: "PATCH",
        headers: restHeaders(),
        body: JSON.stringify({ resultado_visto_em: new Date().toISOString() }),
        keepalive: true,
      },
    );
    if (!res.ok) throw new Error(`markResultadoVisto HTTP ${res.status}: ${await res.text()}`);
  });
}

/* markRdSent REMOVIDO (05/08): a coluna rd_enviado pertence ao backend (Edge
   Function + esteira marcam só após 2xx do RD). O front marcava true após uma
   chamada que não enviava nada, silenciando o retry do sweep. */

/* ============== Respostas ============== */

/* Acumula respostas client-side e grava na coluna `respostas` jsonb da tabela
   diagnostico_respostas. Modelo enxuto: tudo no jsonb, sem colunas por pergunta.
   As 3 perguntas qualificadoras (S1, Z1, Z2) sobem para colunas separadas
   (papel, conhece, interesse) que já existiam na tabela legada. */
const localRespostas: Record<string, unknown> = {};

/* Monta a entrada do jsonb `respostas` para uma resposta. Compartilhado entre
   persistAnswer (fluxo normal) e hydrateLocalAnswers (retomada). */
function respostaEntry(q: (typeof QUESTIONS)[number], answer: Answer): Record<string, unknown> {
  const dim = q.block;
  const dimLabel = dim === "qualif" ? "Qualificação" : BLOCKS[dim]?.name ?? dim;
  const labelStr =
    answer.kind === "multi" ? answer.labels.join(" | ")
      : answer.kind === "text" ? answer.text
        : answer.label;
  return {
    kind: answer.kind,
    label: labelStr,
    value: answer.kind === "multi" ? answer.values
      : answer.kind === "text" ? answer.text
        : answer.value,
    pts: answer.kind === "score" ? answer.pts : null,
    vague: answer.kind === "score" ? answer.vague === true : false,
    dimension_key: dim,
    dimension_label: dimLabel,
    question_text: q.text,
  };
}

/* Reidrata o buffer local a partir das respostas do estado salvo (retomada de
   sessão). Sem isso, o buffer nasce vazio após um reload e o PRÓXIMO
   persistAnswer/persistResult sobrescreve o jsonb `respostas` do banco só com
   o que veio depois — apagando as respostas anteriores da linha. */
export function hydrateLocalAnswers(answers: Record<string, Answer>): void {
  resetLocalAnswers();
  for (const [qid, answer] of Object.entries(answers || {})) {
    const q = QUESTIONS.find((x) => x.id === qid);
    if (!q || !answer) continue;
    localRespostas[qid] = respostaEntry(q, answer);
  }
}

export async function persistAnswer(
  sessionId: string,
  questionId: string,
  answer: Answer,
): Promise<void> {
  const q = QUESTIONS.find((x) => x.id === questionId);
  if (!q) return;

  localRespostas[questionId] = respostaEntry(q, answer);

  const patch: Record<string, unknown> = {
    respostas: { ...localRespostas },
  };

  // Qualifications expostas em colunas próprias (já existiam na tabela v5).
  // Cada trilha tem sua pergunta-equivalente, mapeadas aqui no mesmo campo.
  if (questionId === "S1" && answer.kind !== "multi" && answer.kind !== "text") patch.papel = answer.value;

  // "conhece" (já conhecia ClubPetro): D_CONHECE / G_CONHECE / sem equivalente em frentista.
  if (
    (questionId === "D_CONHECE" || questionId === "G_CONHECE") &&
    answer.kind !== "multi" && answer.kind !== "text"
  ) {
    patch.conhece = answer.value;
  }

  // "interesse" (o que quer resolver / dor principal): D_DOR / G_DOR / F_MELHORIA.
  if (
    (questionId === "D_DOR" || questionId === "G_DOR") &&
    answer.kind !== "multi" && answer.kind !== "text"
  ) {
    patch.interesse = answer.value;
  } else if (questionId === "F_MELHORIA" && answer.kind === "text") {
    // F_MELHORIA é pergunta aberta (kind "text"): grava o texto na coluna
    // dedicada `interesse`, que antes ficava sempre nula para o frentista (B-04).
    patch.interesse = answer.text;
  }

  // Servicos alem do combustivel (multi) em coluna dedicada `servicos_extras`
  // (array de slugs). Mesma pergunta padronizada nas tres trilhas.
  if (
    (questionId === "D_PT_MIX" || questionId === "G_PT_MIX" || questionId === "F_PT_SERVICOS") &&
    answer.kind === "multi"
  ) {
    patch.servicos_extras = answer.values;
  }

  await updateRow(sessionId, patch);
}

export function resetLocalAnswers(): void {
  for (const k of Object.keys(localRespostas)) delete localRespostas[k];
}

/* ============== Resultado consolidado ============== */

export interface ResultSnapshot {
  overall_score: number;
  score_range_label: string;
  urgency_tone: string;
  signal: string | null;
  dimensions: Record<string, { earned: number; possible: number; pct: number }>;
  strongest_dimension_key: string | null;
  strongest_dimension_label: string | null;
  strongest_dimension_score: number | null;
  weakest_dimension_key: string | null;
  weakest_dimension_label: string | null;
  weakest_dimension_score: number | null;
  main_pain_title: string;
  main_pain_description: string;
  main_pain_risk: string;
  radar_summary: string;
  radar_summary_extra: string;
  next_improvement_title: string;
  next_improvement_description: string;
  recommendations_open: unknown[];
  recommendations_locked: unknown[];
  clubpetro_solutions: unknown[];
  commercial_summary: string;
  commercial_reading: unknown;
  approach_message: string;
  readiness: string | null;
}

export async function persistResult(sessionId: string, r: ResultSnapshot): Promise<void> {
  // Mantém a estrutura no jsonb `respostas` com score por frente + meta extra.
  const respostasMeta = {
    ...localRespostas,
    _meta: {
      urgency_tone: r.urgency_tone,
      signal: r.signal,
      readiness: r.readiness,
      dimensions: r.dimensions,
      strongest: r.strongest_dimension_label,
      weakest: r.weakest_dimension_label,
      radar_summary: r.radar_summary,
      radar_summary_extra: r.radar_summary_extra,
    },
  };

  // Pontuação por pilar em coluna dedicada: { "pessoas": 70, "marca": 60, ... }
  const pontuacaoPilares: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.dimensions)) pontuacaoPilares[k] = v.pct;

  const patch: Record<string, unknown> = {
    score: r.overall_score,
    nivel: r.score_range_label,
    respostas: respostasMeta,
    pontuacao_pilares: pontuacaoPilares,
    resumo_diagnostico: r.commercial_summary || r.main_pain_description,
    dor_principal: r.main_pain_description,
    proxima_melhoria: r.next_improvement_title,
    recomendacoes: r.recommendations_open,
    leitura_comercial: r.commercial_reading,
  };

  await updateRow(sessionId, patch);
}

/* ============== Report (PDF) ============== */

async function uploadPdf(sessionId: string, blob: Blob, fileName: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  const path = `diagnosticos/${sessionId}/${fileName}`;
  const result = await safe(`uploadPdf:${fileName}`, async () => {
    const r = await client.storage.from(BUCKET).upload(path, blob, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (r.error) throw r.error;
    return r.data;
  });
  return result ? result.path : null;
}

/* URL pública e permanente do PDF (bucket público). O caminho tem o UUID da
   sessão, então o link não é adivinhável/listável. Sem token, sem expirar,
   abre direto, sem o problema de assinatura (InvalidJWT) dos links assinados. */
function publicUrl(path: string | null): string | null {
  if (!path) return null;
  return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/* Sobe os dois PDFs (comercial + cliente) no bucket privado, grava os caminhos
   e um link assinado clicável de cada um (pra abrir direto da tabela). */
export async function uploadReports(sessionId: string, comercial: Blob, cliente: Blob): Promise<void> {
  const comercialPath = await uploadPdf(sessionId, comercial, "comercial.pdf");
  const clientePath   = await uploadPdf(sessionId, cliente, "cliente.pdf");
  const comercialUrl = publicUrl(comercialPath);
  const clienteUrl   = publicUrl(clientePath);
  const now = new Date().toISOString();
  await updateRow(sessionId, {
    pdf_status: (comercialPath || clientePath) ? "gerado" : "erro",
    pdf_bucket: BUCKET,
    pdf_comercial_path: comercialPath,
    pdf_comercial_gerado_em: comercialPath ? now : null,
    pdf_comercial_url: comercialUrl,
    pdf_cliente_path: clientePath,
    pdf_cliente_gerado_em: clientePath ? now : null,
    pdf_cliente_url: clienteUrl,
    pdf_liberado: false,
  });
}

export async function markReportFailed(sessionId: string, _error: string): Promise<void> {
  await updateRow(sessionId, {
    pdf_status: "erro",
  });
}

/* ============== Especialista ==============

   O Raio-X saiu do fluxo em 04/09/2026 (evento semanal descontinuado). Com ele
   saiu o persistAgendouRaiox e todo o agendamento automatico em calendario.
   As colunas de raiox (agendou_raiox, raiox_status, raiox_data,
   participou_raiox) seguem no banco com o HISTORICO, mas o app nao escreve
   mais nelas. A conversao da tela final agora e o contato com o especialista. */


export async function persistSpecialistCta(sessionId: string, _score: number): Promise<void> {
  // Marca no banco que a pessoa acionou o contato com o especialista — a
  // conversao da tela final. Libera tambem o PDF do cliente: essa liberacao
  // vinha do agendamento do Raio-X, que nao existe mais.
  await updateRow(sessionId, {
    contato_especialista: true,
    contato_especialista_em: new Date().toISOString(),
    pdf_liberado: true,
  });
}
