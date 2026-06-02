/* API de persistência do diagnóstico no Supabase.
   Tudo numa única tabela: `diagnostic_sessions`.
   Cada momento do fluxo dispara um UPDATE/UPSERT parcial dessa linha.
   Eventos são bufferizados localmente e flushados em momentos-chave. */

import { getSupabase } from "./supabase";
import { BLOCKS, BLOCK_ORDER } from "../data/blocks";
import { QUESTIONS } from "../data/questions";
import type { Answer, AppState } from "./state";
import type { RequestContext } from "./context";

const TABLE   = "diagnostico_respostas";
const ID_COL  = "id"; // PK da tabela diagnostico_respostas
const BUCKET  = "diagnostico-pdfs";

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
  const client = getSupabase();
  if (!client) return;
  // INSERT mínimo: cria a linha com o id da sessão. A maior parte dos campos
  // vai sendo preenchida via UPDATE conforme o usuário avança. As colunas que
  // não existem na tabela enxuta (utm, device, browser etc.) são ignoradas.
  await safe("createSession", async () => {
    const { error } = await (client.from(TABLE).insert({
      id,
    }) as unknown as Promise<{ error: unknown }>);
    if (error) throw error;
  });
}

async function updateRow(id: string, patch: Record<string, unknown>): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await safe("updateRow", async () => {
    const { error } = await (client.from(TABLE).update(patch).eq(ID_COL, id) as unknown as Promise<{ error: unknown }>);
    if (error) throw error;
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

export async function completeSession(_id: string): Promise<void> {
  // No modelo enxuto não temos coluna `status`/`completed_at`. created_at já
  // marca o momento de criação; o resto é inferido pelos campos preenchidos.
  return;
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
    answer.kind === "multi" ? answer.labels.join(" | ") : answer.label;

  localRespostas[questionId] = {
    kind: answer.kind,
    label: labelStr,
    value: answer.kind === "multi" ? answer.values : answer.value,
    pts: answer.kind === "score" ? answer.pts : null,
    vague: answer.kind === "score" ? answer.vague === true : false,
    dimension_key: dim,
    dimension_label: dimLabel,
    question_text: q.text,
  };

  const patch: Record<string, unknown> = {
    respostas: { ...localRespostas },
  };

  // Qualifications expostas em colunas próprias (já existiam na tabela v5)
  if (questionId === "S1" && answer.kind !== "multi") patch.papel     = answer.value;
  if (questionId === "Z1" && answer.kind !== "multi") patch.conhece   = answer.value;
  if (questionId === "Z2" && answer.kind !== "multi") patch.interesse = answer.value;

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

  const patch: Record<string, unknown> = {
    score: r.overall_score,
    nivel: r.score_range_label,
    respostas: respostasMeta,
    resumo_diagnostico: r.commercial_summary || r.main_pain_description,
    dor_principal: r.main_pain_description,
    proxima_melhoria: r.next_improvement_title,
    recomendacoes: r.recommendations_open,
    leitura_comercial: r.commercial_reading,
  };

  await updateRow(sessionId, patch);
}

/* ============== Report (PDF) ============== */

export async function uploadReportPdf(sessionId: string, blob: Blob): Promise<{ path: string; size: number } | null> {
  const client = getSupabase();
  if (!client) return null;
  // Path padrão: diagnosticos/{id}/diagnostico-completo.pdf
  const path = `diagnosticos/${sessionId}/diagnostico-completo.pdf`;
  const result = await safe("uploadReportPdf", async () => {
    const r = await client.storage.from(BUCKET).upload(path, blob, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (r.error) throw r.error;
    return r.data;
  });
  if (!result) return null;
  return { path: result.path, size: blob.size };
}

export async function markReportGenerated(sessionId: string, path: string, _size: number): Promise<void> {
  bufferEvent("report_generated", "report", { path });
  await updateRow(sessionId, {
    pdf_status: "gerado",
    pdf_bucket: BUCKET,
    pdf_path: path,
    pdf_gerado_em: new Date().toISOString(),
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
