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
const ID_COL  = "diag_id"; // chave que mapeia o id da sessão do front
const BUCKET  = "diagnostic-reports";

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

export async function createSession(id: string, version: string, context: RequestContext): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await safe("createSession", async () => {
    const { error } = await (client.from(TABLE).insert({
      diag_id: id,
      started_at: new Date().toISOString(),
      status: "in_progress",
      diagnostic_version: version,
      source: context.source,
      utm_source: context.utm_source,
      utm_medium: context.utm_medium,
      utm_campaign: context.utm_campaign,
      utm_content: context.utm_content,
      utm_term: context.utm_term,
      referrer: context.referrer,
      landing_url: context.landing_url,
      user_agent: context.user_agent,
      device_type: context.device_type,
      browser: context.browser,
      os: context.os,
      screen_width: context.screen_width,
      screen_height: context.screen_height,
      locale: context.locale,
      events: snapshotEvents(),
      event_count: eventBuffer.length,
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
  // Grava nas duas: lead_name (novo) e nome (legado v5)
  await updateRow(id, {
    lead_name: name,
    nome: name,
    events: snapshotEvents(),
    event_count: eventBuffer.length,
  });
}

export async function setSessionContact(id: string, name: string, email: string, phone: string): Promise<void> {
  bufferEvent("contact_form_submitted", "lifecycle", { has_email: !!email, has_phone: !!phone });
  await updateRow(id, {
    // Novos
    lead_name: name,
    lead_email: email,
    lead_whatsapp: phone,
    // Legados (v5)
    nome: name,
    email: email,
    telefone: phone,
    lgpd_consent: true,
    lgpd_consent_at: new Date().toISOString(),
    events: snapshotEvents(),
    event_count: eventBuffer.length,
  });
}

export async function completeSession(id: string): Promise<void> {
  await updateRow(id, {
    status: "completed",
    completed_at: new Date().toISOString(),
  });
}

/* ============== Respostas ============== */

/* Atualiza a coluna `answer_<qid>` correspondente + acumula `answers_full`.
   Mantemos um payload completo client-side em `localAnswersFull` pra
   sobrescrever a coluna jsonb com tudo o que já foi respondido. */
const localAnswersFull: Record<string, unknown> = {};

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

  /* atualiza payload completo client-side */
  localAnswersFull[questionId] = {
    kind: answer.kind,
    label: labelStr,
    value: answer.kind === "multi" ? answer.values : answer.value,
    pts: answer.kind === "score" ? answer.pts : null,
    vague: answer.kind === "score" ? answer.vague === true : false,
    dimension_key: dim,
    dimension_label: dimLabel,
    question_text: q.text,
  };

  const colName = answerColumnFor(questionId);
  const patch: Record<string, unknown> = {
    [colName]: labelStr,
    answers_full: localAnswersFull,
  };

  // qualifications expostas em colunas próprias pra facilitar funil
  if (questionId === "S1")   patch.papel     = answer.kind === "multi" ? null : answer.value;
  if (questionId === "Z1")   patch.conhece   = answer.kind === "multi" ? null : answer.value;
  if (questionId === "Z2")   patch.interesse = answer.kind === "multi" ? null : answer.value;

  bufferEvent("answer_selected", "answer", {
    question_id: questionId,
    dimension: dim,
    is_multi: answer.kind === "multi",
  });
  patch.events = snapshotEvents();
  patch.event_count = eventBuffer.length;

  await updateRow(sessionId, patch);
}

/* Recupera nome da coluna `answer_<qid>` para um question_id.
   Se o id não tem coluna explícita, retorna null (vai só pro jsonb). */
const ANSWER_COLS = new Set([
  "S1","S2","S3",
  "C1","C2","C3","C4",
  "F1","F2","F3",
  "D1","D2","D3","D4",
  "M1","M2","M3",
  "P1","P2","P3",
  "R1","R2",
  "Z1","Z2",
]);
function answerColumnFor(qid: string): string {
  return ANSWER_COLS.has(qid) ? `answer_${qid.toLowerCase()}` : "answers_full";
}

export function resetLocalAnswers(): void {
  for (const k of Object.keys(localAnswersFull)) delete localAnswersFull[k];
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

  const patch: Record<string, unknown> = {
    // Novos
    overall_score: r.overall_score,
    score_range_label: r.score_range_label,
    urgency_tone: r.urgency_tone,
    signal: r.signal,
    // Legados v5 (compatibilidade com pipelines existentes)
    score: r.overall_score,
    nivel: r.score_range_label,
    strongest_dimension_key: r.strongest_dimension_key,
    strongest_dimension_label: r.strongest_dimension_label,
    strongest_dimension_score: r.strongest_dimension_score,
    weakest_dimension_key: r.weakest_dimension_key,
    weakest_dimension_label: r.weakest_dimension_label,
    weakest_dimension_score: r.weakest_dimension_score,
    main_pain_title: r.main_pain_title,
    main_pain_description: r.main_pain_description,
    main_pain_risk: r.main_pain_risk,
    radar_summary: r.radar_summary,
    radar_summary_extra: r.radar_summary_extra,
    next_improvement_title: r.next_improvement_title,
    next_improvement_description: r.next_improvement_description,
    recommendations_open: r.recommendations_open,
    recommendations_locked: r.recommendations_locked,
    clubpetro_solutions: r.clubpetro_solutions,
    commercial_summary: r.commercial_summary,
    commercial_reading: r.commercial_reading,
    approach_message: r.approach_message,
    readiness: r.readiness,
    result_viewed_at: new Date().toISOString(),
    events: snapshotEvents(),
    event_count: eventBuffer.length,
  };

  // expande dimensões em colunas pillar_*
  for (const b of BLOCK_ORDER) {
    const d = r.dimensions[b];
    if (!d) continue;
    patch[`pillar_${b}_pct`]      = d.pct;
    patch[`pillar_${b}_earned`]   = d.earned;
    patch[`pillar_${b}_possible`] = d.possible;
  }

  await updateRow(sessionId, patch);
}

/* ============== Report (PDF) ============== */

export async function uploadReportPdf(sessionId: string, blob: Blob): Promise<{ path: string; size: number } | null> {
  const client = getSupabase();
  if (!client) return null;
  const date = new Date().toISOString().slice(0, 10);
  const path = `${date}/${sessionId}.pdf`;
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

export async function markReportGenerated(sessionId: string, path: string, size: number): Promise<void> {
  bufferEvent("report_generated", "report", { path, size });
  await updateRow(sessionId, {
    report_status: "generated",
    report_storage_bucket: BUCKET,
    report_storage_path: path,
    report_file_name: `diagnostico-${sessionId}.pdf`,
    report_file_size: size,
    report_generated_at: new Date().toISOString(),
    events: snapshotEvents(),
    event_count: eventBuffer.length,
  });
}

export async function markReportFailed(sessionId: string, error: string): Promise<void> {
  bufferEvent("report_generation_failed", "report", { error });
  await updateRow(sessionId, {
    report_status: "failed",
    report_generation_error: error,
    events: snapshotEvents(),
    event_count: eventBuffer.length,
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
    rayx_requested_at: new Date().toISOString(),
    rayx_scheduled_for: scheduledFor,
    rayx_google_meet_url: meetUrl,
    rayx_calendar_provider: "google",
    rayx_status: "scheduled",
    rayx_cta_clicked_at: new Date().toISOString(),
    rayx_cta_count: 1,                // o painel pode incrementar via SQL se quiser histórico
    events: snapshotEvents(),
    event_count: eventBuffer.length,
  });
}

/* ============== CTAs ============== */

export async function persistSpecialistCta(sessionId: string, score: number): Promise<void> {
  bufferEvent("specialist_cta_clicked", "cta", { score_total: score });
  await updateRow(sessionId, {
    specialist_cta_clicked_at: new Date().toISOString(),
    specialist_cta_count: 1,
    events: snapshotEvents(),
    event_count: eventBuffer.length,
  });
}

/* ============== Flush genérico de eventos ============== */

export async function flushEvents(sessionId: string): Promise<void> {
  await updateRow(sessionId, {
    events: snapshotEvents(),
    event_count: eventBuffer.length,
  });
}
