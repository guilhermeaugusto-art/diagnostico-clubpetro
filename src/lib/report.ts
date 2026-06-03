/* Gerador de PDF do diagnóstico (client-side, jsPDF).
   Lazy import: o módulo do jsPDF só é carregado quando a geração roda,
   pra não pesar no bundle inicial. */

import type { ReportContent } from "./reportContent";

/* Paleta ClubPetro */
const ORANGE = "#F26600";
const INK    = "#0F1A23";
const INK_MUTED = "#4A5B6D";
const PAPER  = "#F7F4EE";
const RED    = "#D32F1A";

const PAGE_PADDING = 56;       // ~2cm
const PAGE_WIDTH   = 595;      // A4 em pt
const PAGE_HEIGHT  = 842;

interface Cursor {
  y: number;
}

export async function generateReportPdf(content: ReportContent): Promise<Blob> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const c: Cursor = { y: PAGE_PADDING };

  // Capa
  drawCover(doc, content, c);

  // Identificação do lead
  newPage(doc, c);
  drawSection(doc, c, "1. Identificação");
  drawKV(doc, c, "Nome",      content.lead.name || "(não informado)");
  drawKV(doc, c, "WhatsApp",  content.lead.whatsapp || "(não informado)");
  drawKV(doc, c, "E-mail",    content.lead.email || "(não informado)");
  drawKV(doc, c, "Iniciado",  fmtDate(content.lead.diagnostic_started_at));
  drawKV(doc, c, "Concluído", fmtDate(content.lead.diagnostic_completed_at));

  // Score + faixa
  drawSpacer(c, 16);
  drawSection(doc, c, "2. Score geral e faixa");
  drawScoreBlock(doc, c, content);

  // Leitura por frente
  ensureSpace(doc, c, 220);
  drawSection(doc, c, "3. Leitura por frente");
  for (const d of content.dimensions) {
    ensureSpace(doc, c, 80);
    drawDimensionBlock(doc, c, d);
  }

  // Principal dor
  ensureSpace(doc, c, 160);
  drawSection(doc, c, "4. Principal dor identificada");
  drawTitleParagraph(doc, c, content.pain.title, content.pain.description);
  drawSpacer(c, 10);
  drawParagraph(doc, c, "Risco operacional", INK_MUTED, "small");
  drawParagraph(doc, c, content.pain.risk, INK, "body");

  // Leitura do radar
  ensureSpace(doc, c, 120);
  drawSection(doc, c, "5. Leitura do radar");
  drawParagraph(doc, c, content.radar.summary, INK, "body");
  drawSpacer(c, 6);
  drawParagraph(doc, c, content.radar.summaryExtra, INK, "body");

  // Próxima melhoria
  ensureSpace(doc, c, 160);
  drawSection(doc, c, "6. Próxima melhoria recomendada");
  drawTitleParagraph(doc, c, content.nextImprovement.title, content.nextImprovement.description);

  // Recomendações abertas
  ensureSpace(doc, c, 200);
  drawSection(doc, c, "7. Recomendações que o posto pode aplicar agora");
  for (const r of content.recommendations.open) {
    ensureSpace(doc, c, 90);
    drawRecBlock(doc, c, r, false);
  }

  // Recomendações adicionais (locked → no PDF do comercial, SEM blur)
  ensureSpace(doc, c, 120);
  drawSection(doc, c, "8. Próximas melhorias identificadas");
  for (const r of content.recommendations.locked) {
    ensureSpace(doc, c, 80);
    drawRecBlock(doc, c, r, true);
  }

  // Soluções ClubPetro
  ensureSpace(doc, c, 140);
  drawSection(doc, c, "9. Como o ClubPetro pode ajudar");
  for (const s of content.clubpetroSolutions) {
    ensureSpace(doc, c, 60);
    drawTitleParagraph(doc, c, s.title, s.reason);
    drawSpacer(c, 8);
  }

  // Leitura comercial
  newPage(doc, c);
  drawSection(doc, c, "10. Leitura comercial do diagnóstico");
  drawParagraph(doc, c, content.commercial.leitura, INK, "body");
  drawSpacer(c, 12);

  drawSubsection(doc, c, "Frentes críticas");
  for (const f of content.commercial.frentesCriticas) drawBullet(doc, c, f);
  drawSpacer(c, 8);

  drawSubsection(doc, c, "Impacto provável na operação");
  drawParagraph(doc, c, content.commercial.impacto, INK, "body");
  drawSpacer(c, 8);

  drawSubsection(doc, c, "Oportunidades para o ClubPetro");
  for (const o of content.commercial.oportunidades) drawBullet(doc, c, o);
  drawSpacer(c, 8);

  drawSubsection(doc, c, "Abordagem sugerida");
  drawParagraph(doc, c, content.commercial.abordagem, INK, "body");
  drawSpacer(c, 8);

  drawSubsection(doc, c, "Perguntas para a conversa");
  for (const p of content.commercial.perguntasParaConversa) drawBullet(doc, c, p);
  drawSpacer(c, 8);

  drawSubsection(doc, c, "Objeções prováveis");
  for (const o of content.commercial.objecoesProvaveis) drawBullet(doc, c, o);
  drawSpacer(c, 8);

  drawSubsection(doc, c, "Próximos passos");
  for (const p of content.commercial.proximosPassos) drawBullet(doc, c, p);

  // Perguntas e respostas completas
  newPage(doc, c);
  drawSection(doc, c, "11. Respostas completas do diagnóstico");
  for (const qa of content.questionsAndAnswers) {
    ensureSpace(doc, c, 80);
    drawParagraph(doc, c, `${qa.qid} · ${qa.dimension}`, INK_MUTED, "small");
    drawParagraph(doc, c, qa.qtext, INK, "body-bold");
    for (const a of qa.answers) {
      drawBullet(doc, c, `${a.label}${a.weight !== null ? `  (${a.weight} pts)` : ""}`);
    }
    drawSpacer(c, 6);
  }

  // Rodapé com paginação
  paginate(doc);

  return doc.output("blob");
}

/* ============== PDF DO CLIENTE ==============
   Versão limpa, focada no valor para o dono do posto: nota, leitura por frente,
   por onde começar, próximas melhorias e como o ClubPetro ajuda. SEM leitura
   comercial, SEM respostas cruas, SEM marca de documento interno. */
export async function generateClientPdf(content: ReportContent): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const c: Cursor = { y: PAGE_PADDING };

  drawClientCover(doc, content, c);

  newPage(doc, c);
  drawSection(doc, c, "Leitura por frente");
  for (const d of content.dimensions) {
    ensureSpace(doc, c, 80);
    drawDimensionBlock(doc, c, d);
  }

  ensureSpace(doc, c, 140);
  drawSection(doc, c, "Por onde começar");
  drawTitleParagraph(
    doc, c,
    content.weakest ? `Comece por: ${content.weakest.name}` : "Próximo passo",
    content.pain.description,
  );

  ensureSpace(doc, c, 180);
  drawSection(doc, c, "Próximas melhorias para o seu posto");
  for (const r of content.recommendations.open) {
    ensureSpace(doc, c, 90);
    drawRecBlock(doc, c, r, false);
  }

  ensureSpace(doc, c, 140);
  drawSection(doc, c, "Como o ClubPetro ajuda");
  for (const s of content.clubpetroSolutions) {
    ensureSpace(doc, c, 60);
    drawTitleParagraph(doc, c, s.title, s.reason);
    drawSpacer(c, 8);
  }

  ensureSpace(doc, c, 80);
  drawSpacer(c, 10);
  drawParagraph(
    doc, c,
    "Fale com um Especialista ClubPetro para colocar essas melhorias em prática no seu posto.",
    INK, "body-bold",
  );

  paginate(doc);
  return doc.output("blob");
}

function drawClientCover(doc: any, content: ReportContent, c: Cursor) {
  doc.setFillColor(ORANGE);
  doc.rect(0, 0, PAGE_WIDTH, 6, "F");

  doc.setFontSize(11);
  doc.setTextColor(INK_MUTED);
  doc.setFont("helvetica", "normal");
  doc.text("ClubPetro · Diagnóstico de Saúde do Posto", PAGE_PADDING, 56);

  doc.setFontSize(28);
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  const headline = content.lead.name
    ? `Diagnóstico de ${content.lead.name.split(/\s+/)[0]}`
    : "Diagnóstico do seu posto";
  doc.text(headline, PAGE_PADDING, 110);

  doc.setFontSize(13);
  doc.setTextColor(INK_MUTED);
  doc.setFont("helvetica", "normal");
  let y = 140;
  for (const line of wrap(doc, content.overall.levelTagline, PAGE_WIDTH - PAGE_PADDING * 2)) {
    doc.text(line, PAGE_PADDING, y); y += 18;
  }

  doc.setFontSize(72);
  doc.setTextColor(scoreColor(content.overall.score));
  doc.setFont("helvetica", "bold");
  doc.text(`${content.overall.score}`, PAGE_PADDING, y + 96);
  doc.setFontSize(22);
  doc.setTextColor(INK_MUTED);
  doc.text("/100", PAGE_PADDING + 110, y + 96);

  doc.setFontSize(14);
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.text(`Faixa atual: ${content.overall.levelName}`, PAGE_PADDING, y + 136);

  doc.setFontSize(9);
  doc.setTextColor(INK_MUTED);
  doc.setFont("helvetica", "normal");
  doc.text("A leitura do seu posto: por onde o lucro está vazando e por onde começar.",
    PAGE_PADDING, PAGE_HEIGHT - 40);

  c.y = PAGE_HEIGHT;
}

/* ============== Helpers de desenho ============== */

function newPage(doc: any, c: Cursor) {
  doc.addPage();
  c.y = PAGE_PADDING;
}

function ensureSpace(doc: any, c: Cursor, needed: number) {
  if (c.y + needed > PAGE_HEIGHT - PAGE_PADDING) {
    newPage(doc, c);
  }
}

function drawSpacer(c: Cursor, h: number) {
  c.y += h;
}

function drawCover(doc: any, content: ReportContent, c: Cursor) {
  // Faixa superior laranja
  doc.setFillColor(ORANGE);
  doc.rect(0, 0, PAGE_WIDTH, 6, "F");

  doc.setFontSize(11);
  doc.setTextColor(INK_MUTED);
  doc.setFont("helvetica", "normal");
  doc.text("ClubPetro · Diagnóstico de Saúde do Posto", PAGE_PADDING, 56);

  doc.setFontSize(28);
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  const headline = content.lead.name
    ? `Diagnóstico de ${content.lead.name.split(/\s+/)[0]}`
    : "Diagnóstico do posto";
  doc.text(headline, PAGE_PADDING, 110);

  doc.setFontSize(13);
  doc.setTextColor(INK_MUTED);
  doc.setFont("helvetica", "normal");
  const tagline = wrap(doc, content.overall.levelTagline, PAGE_WIDTH - PAGE_PADDING * 2);
  let y = 140;
  for (const line of tagline) { doc.text(line, PAGE_PADDING, y); y += 18; }

  // Score grande
  doc.setFontSize(72);
  doc.setTextColor(scoreColor(content.overall.score));
  doc.setFont("helvetica", "bold");
  doc.text(`${content.overall.score}`, PAGE_PADDING, y + 96);
  doc.setFontSize(22);
  doc.setTextColor(INK_MUTED);
  doc.text("/100", PAGE_PADDING + 110, y + 96);

  // Tag urgência
  doc.setFillColor(scoreColor(content.overall.score));
  const tagY = y + 116;
  doc.roundedRect(PAGE_PADDING, tagY, 200, 24, 12, 12, "F");
  doc.setFontSize(10);
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.text(content.overall.urgencyLabel.toUpperCase(), PAGE_PADDING + 12, tagY + 16);

  // Faixa atual
  doc.setFontSize(14);
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.text(`Faixa atual: ${content.overall.levelName}`, PAGE_PADDING, tagY + 56);

  // Rodapé da capa
  doc.setFontSize(9);
  doc.setTextColor(INK_MUTED);
  doc.setFont("helvetica", "normal");
  doc.text("Documento interno · uso comercial · não enviar bruto ao usuário",
    PAGE_PADDING, PAGE_HEIGHT - 40);

  c.y = PAGE_HEIGHT; // força newPage no próximo bloco
}

function drawSection(doc: any, c: Cursor, title: string) {
  ensureSpace(doc, c, 36);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(ORANGE);
  doc.text(title, PAGE_PADDING, c.y);
  c.y += 8;
  doc.setDrawColor(0xE0, 0xE0, 0xE0);
  doc.line(PAGE_PADDING, c.y, PAGE_WIDTH - PAGE_PADDING, c.y);
  c.y += 18;
}

function drawSubsection(doc: any, c: Cursor, title: string) {
  ensureSpace(doc, c, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text(title, PAGE_PADDING, c.y);
  c.y += 14;
}

function drawKV(doc: any, c: Cursor, key: string, value: string) {
  ensureSpace(doc, c, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(INK_MUTED);
  doc.text(`${key.toUpperCase()}`, PAGE_PADDING, c.y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text(value, PAGE_PADDING + 90, c.y);
  c.y += 18;
}

function drawTitleParagraph(doc: any, c: Cursor, title: string, body: string) {
  ensureSpace(doc, c, 50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(INK);
  for (const line of wrap(doc, title, PAGE_WIDTH - PAGE_PADDING * 2)) {
    doc.text(line, PAGE_PADDING, c.y); c.y += 16;
  }
  drawParagraph(doc, c, body, INK_MUTED, "body");
}

function drawParagraph(
  doc: any,
  c: Cursor,
  text: string,
  color: string,
  style: "body" | "body-bold" | "small",
) {
  if (!text) return;
  doc.setFont("helvetica", style === "body-bold" ? "bold" : "normal");
  doc.setFontSize(style === "small" ? 9.5 : 11);
  doc.setTextColor(color);
  const lines = wrap(doc, text, PAGE_WIDTH - PAGE_PADDING * 2);
  const lineH = style === "small" ? 13 : 15;
  for (const line of lines) {
    ensureSpace(doc, c, lineH + 2);
    doc.text(line, PAGE_PADDING, c.y);
    c.y += lineH;
  }
}

function drawBullet(doc: any, c: Cursor, text: string) {
  ensureSpace(doc, c, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(INK);
  const lines = wrap(doc, text, PAGE_WIDTH - PAGE_PADDING * 2 - 14);
  doc.setFillColor(ORANGE);
  doc.circle(PAGE_PADDING + 3, c.y - 3, 2, "F");
  let first = true;
  for (const line of lines) {
    ensureSpace(doc, c, 14);
    doc.text(line, PAGE_PADDING + 14, c.y);
    c.y += 14;
    first = false;
  }
  void first;
}

function drawScoreBlock(doc: any, c: Cursor, content: ReportContent) {
  ensureSpace(doc, c, 110);
  const x = PAGE_PADDING;
  doc.setFillColor(PAPER);
  doc.roundedRect(x, c.y, PAGE_WIDTH - PAGE_PADDING * 2, 90, 10, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(42);
  doc.setTextColor(scoreColor(content.overall.score));
  doc.text(`${content.overall.score}`, x + 16, c.y + 56);
  doc.setFontSize(14);
  doc.setTextColor(INK_MUTED);
  doc.text("/100", x + 90, c.y + 56);

  doc.setFontSize(10);
  doc.setTextColor(INK_MUTED);
  doc.text("FAIXA ATUAL", x + 160, c.y + 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK);
  doc.text(content.overall.levelName, x + 160, c.y + 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(INK_MUTED);
  doc.text(`Ponto mais forte: ${content.strongest?.name ?? "—"} (${content.strongest?.pct ?? 0})`,
    x + 160, c.y + 68);
  doc.text(`Ponto de atenção: ${content.weakest?.name ?? "—"} (${content.weakest?.pct ?? 0})`,
    x + 160, c.y + 80);

  c.y += 100;
}

function drawDimensionBlock(doc: any, c: Cursor, d: ReportContent["dimensions"][number]) {
  ensureSpace(doc, c, 70);
  const w = PAGE_WIDTH - PAGE_PADDING * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text(d.name, PAGE_PADDING, c.y);

  doc.setFontSize(12);
  doc.setTextColor(scoreColor(d.pct));
  doc.text(`${d.pct}/100`, PAGE_PADDING + w - 60, c.y);

  c.y += 8;
  // barra de fundo
  doc.setFillColor(0xEE, 0xEE, 0xEE);
  doc.roundedRect(PAGE_PADDING, c.y, w, 6, 3, 3, "F");
  // barra preenchida
  doc.setFillColor(scoreColor(d.pct));
  doc.roundedRect(PAGE_PADDING, c.y, Math.max(2, (w * d.pct) / 100), 6, 3, 3, "F");

  c.y += 14;
  drawParagraph(doc, c, d.insight, INK_MUTED, "body");
  drawSpacer(c, 10);
}

function drawRecBlock(doc: any, c: Cursor, r: { title: string; desc: string; impact: string }, lockedLabel: boolean) {
  ensureSpace(doc, c, 70);
  if (lockedLabel) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(ORANGE);
    doc.text("PRÓXIMA MELHORIA", PAGE_PADDING, c.y);
    c.y += 12;
  }
  drawTitleParagraph(doc, c, r.title, r.desc);
  if (r.impact) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(0x1F, 0x8A, 0x5C);
    doc.text(`Impacto: ${r.impact}`, PAGE_PADDING, c.y);
    c.y += 14;
  }
  drawSpacer(c, 6);
}

function wrap(doc: any, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text || "", maxWidth);
}

function scoreColor(pct: number): string {
  if (pct < 40) return RED;
  if (pct < 60) return "#E2541B";
  if (pct < 75) return "#F08A1C";
  if (pct < 90) return "#1F8A5C";
  return "#0E7D4E";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "(não informado)";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function paginate(doc: any) {
  const count = doc.internal.pages.length - 1;
  for (let i = 1; i <= count; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(INK_MUTED);
    doc.text(
      `ClubPetro · Diagnóstico · ${i}/${count}`,
      PAGE_PADDING,
      PAGE_HEIGHT - 24,
    );
  }
}
