/* API de persistência do diagnóstico no Supabase.
   Tudo numa única tabela: `diagnostic_sessions`.
   Cada momento do fluxo dispara um UPDATE/UPSERT parcial dessa linha.
   Eventos são bufferizados localmente e flushados em momentos-chave. */

import { getSupabase } from "./supabase";
import { CONFIG } from "./config";
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

function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  return fn().catch((e) => {
    if (typeof console !== "undefined") console.warn(`[api:${label}]`, e);
    return null;
  });
}

/* ============== Buffer local de eventos ==============
   Eventos são empurrados aqui durante o fluxo e gravados na coluna
   `events jsonb` da sessão a cada flush. */
interface BufferedEvent {
  at: string;
  name: string;
  category?: string;
  metadata?: Record<string, unknown>;
}
const eventBuffer: BufferedEvent[] = [];

export function bufferEvent(name: string, category?: string, metadata?: Record<string, unknown>): void {
  eventBuffer.push({ at: new Date().toISOString(), name, category, metadata });
}

export function snapshotEvents(): BufferedEvent[] {
  return [...eventBuffer];
}

/* ============== Create / Upsert ============== */

export async function createSession(id: string, _version: string, _context: RequestContext): Promise<void> {
  // INSERT mínimo: cria a linha com o id da sessão. O resto entra via UPDATE.
  await safe("createSession", async () => {
    const res = await fetch(REST_URL, {
      method: "POST",
      headers: REST_HEADERS,
      body: JSON.stringify({ id }),
      keepalive: true,
    });
    if (!res.ok) throw new Error(`createSession HTTP ${res.status}: ${await res.text()}`);
  });
}

async function updateRow(id: string, patch: Record<string, unknown>): Promise<void> {
  if (!id) return;
  await safe("updateRow", async () => {
    const res = await fetch(`${REST_URL}?${ID_COL}=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: REST_HEADERS,
      body: JSON.stringify(patch),
      keepalive: true,
    });
    if (!res.ok) throw new Error(`updateRow HTTP ${res.status}: ${await res.text()}`);
  });
}

/* ============== Lead ============== */

export async function setSessionName(id: string, name: string): Promise<void> {
  bufferEvent("name_submitted", "lifecycle", { name });
  await updateRow(id, { nome: name });
}

export async function setSessionContact(id: string, name: string, email: string, phone: string): Promise<void> {
  bufferEvent("contact_form_submitted", "lifecycle", { has_email: !!email, has_phone: !!phone });
  await updateRow(id, {
    nome:     name,
    email:    email,
    telefone: phone,
  });
}

/* Marca a conclusão do diagnóstico (chegou ao fim do raio-x) e se virou MQL
   (dono ou gerente que deixou contato). created_at já marca o início. */
export async function completeSession(id: string, mql: boolean): Promise<void> {
  await updateRow(id, {
    concluido_em: new Date().toISOString(),
    mql,
  });
}

/* Marca que o lead já foi enviado ao RD Station (após o POST na Edge Function). */
export async function markRdSent(id: string): Promise<void> {
  await updateRow(id, {
    rd_enviado: true,
    rd_enviado_em: new Date().toISOString(),
  });
}

/* ============== Respostas ============== */

/* Acumula respostas client-side e grava na coluna `respostas` jsonb da tabela
   diagnostico_respostas. Modelo enxuto: tudo no jsonb, sem colunas por pergunta.
   As 3 perguntas qualificadoras (S1, Z1, Z2) sobem para colunas separadas
   (papel, conhece, interesse) que já existiam na tabela legada. */
const localRespostas: Record<string, unknown> = {};

export async function persistAnswer(
  sessionId: string,
  questionId: string,
  answer: Answer,
): Promise<void> {
  const q = QUESTIONS.find((x) => x.id === questionId);
  if (!q) return;
  const dim = q.block;
  const dimLabel = dim === "qualif" ? "Qualificação" : BLOCKS[dim]?.name ?? dim;

  const labelStr =
    answer.kind === "multi" ? answer.labels.join(" | ")
      : answer.kind === "text" ? answer.text
        : answer.label;

  localRespostas[questionId] = {
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
    (questionId === "D_DOR" || questionId === "G_DOR" || questionId === "F_MELHORIA") &&
    answer.kind !== "multi" && answer.kind !== "text"
  ) {
    patch.interesse = answer.value;
  }

  bufferEvent("answer_selected", "answer", {
    question_id: questionId,
    dimension: dim,
    is_multi: answer.kind === "multi",
  });

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
  bufferEvent("result_viewed", "result", {
    score: r.overall_score,
    level: r.score_range_label,
    urgency: r.urgency_tone,
  });

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

/* Gera um link assinado (validade longa) pra abrir o PDF direto, sem ceremônia. */
async function signUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const ONE_YEAR = 60 * 60 * 24 * 365;
  const r = await safe("signUrl", async () => {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
      method: "POST",
      headers: REST_HEADERS,
      body: JSON.stringify({ expiresIn: ONE_YEAR }),
    });
    if (!res.ok) throw new Error(`signUrl HTTP ${res.status}: ${await res.text()}`);
    return (await res.json()) as { signedURL?: string };
  });
  if (!r || !r.signedURL) return null;
  return `${CONFIG.SUPABASE_URL}/storage/v1${r.signedURL}`;
}

/* Sobe os dois PDFs (comercial + cliente) no bucket privado, grava os caminhos
   e um link assinado clicável de cada um (pra abrir direto da tabela). */
export async function uploadReports(sessionId: string, comercial: Blob, cliente: Blob): Promise<void> {
  const comercialPath = await uploadPdf(sessionId, comercial, "comercial.pdf");
  const clientePath   = await uploadPdf(sessionId, cliente, "cliente.pdf");
  const [comercialUrl, clienteUrl] = await Promise.all([signUrl(comercialPath), signUrl(clientePath)]);
  bufferEvent("report_generated", "report", { comercial: comercialPath, cliente: clientePath });
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
  bufferEvent("report_generation_failed", "report", { error: _error });
  await updateRow(sessionId, {
    pdf_status: "erro",
  });
}

/* ============== Raio-X ============== */

export async function persistRayxRequest(
  sessionId: string,
  scheduledFor: string,
  meetUrl: string,
): Promise<void> {
  bufferEvent("rayx_scheduled", "rayx", { scheduled_for: scheduledFor, meet_url: meetUrl });
  await updateRow(sessionId, {
    raiox_data: scheduledFor,
    raiox_status: "agendado",
    raiox_observacao: `Meet: ${meetUrl}`,
  });
}

export async function persistSpecialistCta(_sessionId: string, score: number): Promise<void> {
  bufferEvent("specialist_cta_clicked", "cta", { score_total: score });
  // Não há coluna específica de CTA no modelo enxuto; só GA/Pixel via track().
}

/* Flush sem efeito no modelo enxuto (não tem coluna `events`). Mantido pra
   compat com o app.ts que chama no pagehide. */
export async function flushEvents(_sessionId: string): Promise<void> {
  return;
}
