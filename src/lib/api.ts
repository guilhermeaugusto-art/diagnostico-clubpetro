/* API de persistência do diagnóstico no Supabase.
   Tudo numa única tabela: `diagnostico_respostas`.
   Cada momento do fluxo dispara um UPDATE/UPSERT parcial dessa linha.
   A telemetria por evento vai por GTM/Meta (tracking.ts); não é persistida aqui. */

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
    tokenMem = crypto.randomUUID() + crypto.randomUUID();
    try { sessionStorage.setItem(TOKEN_STORE, tokenMem); } catch { /* só memória */ }
  }
  return tokenMem;
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

export async function createSession(id: string, _version: string, _context: RequestContext): Promise<void> {
  // INSERT mínimo: cria a linha com o id da sessão e o token secreto (a RLS
  // exige token no INSERT e confere o mesmo token nos UPDATEs seguintes).
  await safe("createSession", async () => {
    const res = await fetch(REST_URL, {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({ id, token_sessao: tokenSessao() }),
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

/* Marca a conclusão do diagnóstico (chegou ao fim do raio-x) e se virou MQL
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

/* ============== Raio X ============== */

/* Lead clicou em "Garantir minha vaga no Raio X" no app.
   Regra de negocio (opcao A): agendar JA conta como CONFIRMADO. Entao grava
   agendou_raiox + raiox_status='confirmado' + raiox_data, o que dispara a tag
   `raiox-confirmado` no RD (via o gatilho de conversao). Libera tambem o PDF.
   O cron `?sync=confirmados` segue marcando participou_raiox para quem de fato
   aceita o convite (presenca real). */
export async function persistAgendouRaiox(sessionId: string): Promise<void> {
  await updateRow(sessionId, {
    agendou_raiox: true,
    raiox_status: "confirmado",
    raiox_data: new Date().toISOString(),
    // Ao garantir a vaga no Raio X, o PDF do cliente fica liberado para envio.
    pdf_liberado: true,
  });
}

export async function persistSpecialistCta(sessionId: string, score: number): Promise<void> {
  // Marca no banco que a pessoa acionou o contato direto com o especialista.
  await updateRow(sessionId, {
    contato_especialista: true,
    contato_especialista_em: new Date().toISOString(),
  });
}
