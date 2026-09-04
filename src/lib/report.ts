/* Gerador de PDF do diagnóstico (client-side, jsPDF).
   Lazy import: o módulo do jsPDF só é carregado quando a geração roda,
   pra não pesar no bundle inicial.

   Dois PDFs saem daqui:
   - generateReportPdf: a ANÁLISE COMERCIAL do lead (interno, sobe pro Kommo).
     Reestruturado em 29/07/2026 a pedido do dono: página 1 é um dossiê de
     uma olhada (quem é, onde dói, onde é forte e como abrir a ligação);
     página 2 são as 6 frentes da pior pra melhor + leitura comercial;
     página 3+ traz TODAS as respostas com semáforo por resposta.
   - generateClientPdf: versão limpa para o dono do posto (inalterada). */

import type { ReportContent } from "./reportContent";

/* Paleta ClubPetro (padrão oficial: Primary laranja + Secondary slate) */
const ORANGE = "#F26600";
const INK    = "#1F2028";
const INK_MUTED = "#555A74";
const PAPER  = "#F6F7F9";
const RED    = "#D32F1A";
const GREEN  = "#1F8A5C";
const GRAY   = "#9AA0B5";

const PAGE_PADDING = 56;       // ~2cm
const PAGE_WIDTH   = 595;      // A4 em pt
const PAGE_HEIGHT  = 842;

interface Cursor {
  y: number;
}

/* ============== PDF COMERCIAL (análise do lead) ============== */

export async function generateReportPdf(content: ReportContent): Promise<Blob> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const c: Cursor = { y: PAGE_PADDING };

  /* Página 1 — dossiê: tudo que o comercial precisa antes de discar. */
  drawDossier(doc, content, c);

  /* Página 2 — as 6 frentes (da mais crítica para a mais forte). */
  newPage(doc, c);
  drawSection(doc, c, "As 6 frentes do posto");
  drawParagraph(doc, c, "Ordenadas da mais crítica para a mais forte.", INK_MUTED, "small");
  drawSpacer(c, 10);
  const dims = [...content.dimensions].sort((a, b) => a.pct - b.pct);
  dims.forEach((d, i) => {
    ensureSpace(doc, c, 88);
    drawDimensionBlock(doc, c, d, i === 0);
  });

  ensureSpace(doc, c, 200);
  drawSection(doc, c, "Leitura comercial");
  drawParagraph(doc, c, content.commercial.leitura, INK, "body");
  drawSpacer(c, 12);
  drawSubsection(doc, c, "Perguntas para a conversa");
  for (const p of content.commercial.perguntasParaConversa) drawBullet(doc, c, p);
  drawSpacer(c, 8);
  drawSubsection(doc, c, "Objeções prováveis");
  for (const o of content.commercial.objecoesProvaveis) drawBullet(doc, c, o);
  drawSpacer(c, 8);
  drawSubsection(doc, c, "Oportunidades para o ClubPetro");
  for (const o of content.commercial.oportunidades) drawBullet(doc, c, o);

  /* Página 3+ — tudo o que o lead respondeu, com semáforo por resposta.
     Agrupado por frente (uma pergunta de qualificação que aparece no fim do
     quiz volta para o grupo dela, em vez de repetir o cabeçalho). */
  newPage(doc, c);
  drawSection(doc, c, "Tudo o que o lead respondeu");
  drawParagraph(doc, c,
    "Semáforo: vermelho aponta dor, laranja é meio-termo, verde é ponto forte, cinza é contexto (não pontua).",
    INK_MUTED, "small");
  drawSpacer(c, 4);
  const grupos = new Map<string, ReportContent["questionsAndAnswers"]>();
  for (const qa of content.questionsAndAnswers) {
    if (!grupos.has(qa.dimension)) grupos.set(qa.dimension, []);
    grupos.get(qa.dimension)!.push(qa);
  }
  for (const [dim, itens] of grupos) {
    drawAnswerGroupHeader(doc, c, dim, content);
    for (const qa of itens) {
      ensureSpace(doc, c, 48);
      drawParagraph(doc, c, qa.qtext, INK, "body-bold");
      drawSpacer(c, 2);
      for (const a of qa.answers) drawAnswerLine(doc, c, a);
      drawSpacer(c, 10);
    }
  }

  paginate(doc);

  return doc.output("blob");
}

/* Página 1 do comercial: dossiê do lead. */
function drawDossier(doc: any, content: ReportContent, c: Cursor) {
  const W = PAGE_WIDTH - PAGE_PADDING * 2;

  // Faixa superior laranja
  doc.setFillColor(ORANGE);
  doc.rect(0, 0, PAGE_WIDTH, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(ORANGE);
  doc.text("CLUBPETRO · DIAGNÓSTICO DO POSTO · ANÁLISE DO LEAD", PAGE_PADDING, 46);

  // Nome + linha de qualificação
  doc.setFontSize(25);
  doc.setTextColor(INK);
  const nome = content.lead.name || "(sem nome)";
  let y = 80;
  for (const line of wrap(doc, nome, W)) { doc.text(line, PAGE_PADDING, y); y += 29; }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(INK_MUTED);
  const q = content.qualificacao;
  doc.text(`${q.perfil}  ·  ${q.mqlLabel}  ·  ${q.sinalLabel}`, PAGE_PADDING, y + 2);
  y += 34;

  // Contato em 3 colunas
  const cols: Array<[string, string, number]> = [
    ["WHATSAPP", content.lead.whatsapp || "(não informado)", W * 0.26],
    ["E-MAIL", content.lead.email || "(não informado)", W * 0.44],
    ["CONCLUIU O DIAGNÓSTICO EM", fmtDate(content.lead.diagnostic_completed_at), W * 0.30],
  ];
  let cx = PAGE_PADDING;
  for (const [k, v, colW] of cols) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(INK_MUTED);
    doc.text(k, cx, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(INK);
    doc.text(wrap(doc, v, colW - 14)[0] || "", cx, y + 15);
    cx += colW;
  }
  y += 40;

  doc.setDrawColor(0xE0, 0xD8, 0xC8);
  doc.setLineWidth(0.7);
  doc.line(PAGE_PADDING, y, PAGE_WIDTH - PAGE_PADDING, y);
  y += 32;

  // Score grande + faixa + urgência
  doc.setFont("helvetica", "bold");
  doc.setFontSize(60);
  doc.setTextColor(scoreColor(content.overall.score));
  const scoreStr = `${content.overall.score}`;
  doc.text(scoreStr, PAGE_PADDING, y + 46);
  const sw = doc.getTextWidth(scoreStr);
  doc.setFontSize(17);
  doc.setTextColor(INK_MUTED);
  doc.text("/100", PAGE_PADDING + sw + 9, y + 46);

  const rx = PAGE_PADDING + 190;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(INK_MUTED);
  doc.text("FAIXA ATUAL", rx, y + 10);
  doc.setFontSize(15.5);
  doc.setTextColor(INK);
  doc.text(content.overall.levelName, rx, y + 29);
  doc.setFontSize(9);
  const uTxt = content.overall.urgencyLabel.toUpperCase();
  const uw = doc.getTextWidth(uTxt) + 22;
  doc.setFillColor(scoreColor(content.overall.score));
  doc.roundedRect(rx, y + 40, uw, 21, 10.5, 10.5, "F");
  doc.setTextColor("#FFFFFF");
  doc.text(uTxt, rx + 11, y + 54);
  c.y = y + 88;

  // Onde dói / onde é forte
  const ordenadas = [...content.dimensions].sort((a, b) => a.pct - b.pct);
  const fraca = ordenadas[0] || null;
  const forte = ordenadas.length ? ordenadas[ordenadas.length - 1] : null;

  drawRailCard(doc, c, {
    accent: RED,
    bg: [0xFC, 0xEE, 0xEC],
    kicker: fraca ? `ONDE DÓI · ${fraca.name.toUpperCase()} ${fraca.pct}/100` : "ONDE DÓI",
    paragraphs: [
      content.pain.description,
      `Risco se nada mudar: ${content.pain.risk}`,
    ],
  });
  drawSpacer(c, 16);
  drawRailCard(doc, c, {
    accent: GREEN,
    bg: [0xEA, 0xF5, 0xEF],
    kicker: forte ? `ONDE ELE É FORTE · ${forte.name.toUpperCase()} ${forte.pct}/100` : "ONDE ELE É FORTE",
    paragraphs: [forte ? forte.insight : "Sem leitura de força."],
  });
  drawSpacer(c, 16);

  // Como abrir a ligação: uma sugestão pela dor, outra pela força.
  const primeiroNome = (content.lead.name || "").trim().split(/\s+/)[0] || "";
  const trato = primeiroNome ? `${primeiroNome}, ` : "";
  const perguntaDor = content.commercial.perguntasParaConversa[0]
    || "Como vocês cuidam desse ponto hoje?";
  const aberturaDor = fraca
    ? `Pela dor: "${trato}no seu diagnóstico, ${fraca.name.toLowerCase()} foi a frente que mais puxou o resultado para baixo (${fraca.pct}/100). ${perguntaDor}"`
    : `Pela dor: "${trato}o que mais incomoda na operação do posto hoje?"`;
  const aberturaForca = forte && fraca
    ? `Pela força: "${trato}poucos postos têm ${forte.name.toLowerCase()} no nível do seu (${forte.pct}/100). Com essa base, o diagnóstico mostra que o próximo salto está em ${fraca.name.toLowerCase()}. Posso te mostrar o que apareceu?"`
    : `Pela força: "${trato}seu diagnóstico trouxe pontos bem interessantes. Posso te mostrar os dois principais?"`;

  drawRailCard(doc, c, {
    accent: ORANGE,
    bg: [0xFD, 0xF3, 0xEA],
    kicker: "COMO ABRIR A LIGAÇÃO",
    numbered: [aberturaDor, aberturaForca],
  });

  // Vai para o rodapé, alinhado à direita (o paginate escreve à esquerda).
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(INK_MUTED);
  doc.text("Uso interno do time comercial", PAGE_WIDTH - PAGE_PADDING, PAGE_HEIGHT - 24, { align: "right" });

  c.y = PAGE_HEIGHT; // força página nova no próximo bloco
}

/* Card com trilho colorido à esquerda; altura medida antes de desenhar. */
function drawRailCard(doc: any, c: Cursor, opts: {
  accent: string;
  bg: [number, number, number];
  kicker: string;
  paragraphs?: string[];
  numbered?: string[];
}) {
  const W = PAGE_WIDTH - PAGE_PADDING * 2;
  const innerW = W - 34;

  doc.setFontSize(10.5);
  doc.setFont("helvetica", "normal");
  const paraLines: string[][] = (opts.paragraphs || []).map((p) => wrap(doc, p, innerW));
  const numLines: string[][] = (opts.numbered || []).map((p) => wrap(doc, p, innerW - 16));
  let h = 24 + 16; // padding topo + kicker
  for (const ls of paraLines) h += ls.length * 15 + 5;
  for (const ls of numLines) h += ls.length * 15 + 8;
  h += 8;
  ensureSpace(doc, c, h + 6);

  const x = PAGE_PADDING;
  doc.setFillColor(opts.bg[0], opts.bg[1], opts.bg[2]);
  doc.roundedRect(x, c.y, W, h, 8, 8, "F");
  doc.setFillColor(opts.accent);
  doc.roundedRect(x, c.y, 4, h, 2, 2, "F");

  let ty = c.y + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(opts.accent);
  doc.text(opts.kicker, x + 16, ty);
  ty += 16;
  doc.setFontSize(10.5);
  doc.setTextColor(INK);
  for (const ls of paraLines) {
    doc.setFont("helvetica", "normal");
    for (const line of ls) { doc.text(line, x + 16, ty); ty += 15; }
    ty += 5;
  }
  numLines.forEach((ls, i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}.`, x + 16, ty);
    doc.setFont("helvetica", "normal");
    for (const line of ls) { doc.text(line, x + 30, ty); ty += 15; }
    ty += 8;
  });

  c.y += h;
}

/* Cabeçalho de grupo na lista de respostas (nome da frente + nota). */
function drawAnswerGroupHeader(doc: any, c: Cursor, dim: string, content: ReportContent) {
  ensureSpace(doc, c, 40);
  drawSpacer(c, 8);
  const d = content.dimensions.find((x) => x.name === dim) || null;
  const titulo = dim === "Qualificação" ? "Sobre o posto e o contato" : dim;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text(titulo, PAGE_PADDING, c.y);
  if (d) {
    doc.setTextColor(scoreColor(d.pct));
    doc.text(`${d.pct}/100`, PAGE_WIDTH - PAGE_PADDING, c.y, { align: "right" });
  }
  c.y += 8;
  doc.setDrawColor(0xE0, 0xD8, 0xC8);
  doc.setLineWidth(0.6);
  doc.line(PAGE_PADDING, c.y, PAGE_WIDTH - PAGE_PADDING, c.y);
  c.y += 16;
}

/* Uma resposta com bolinha de semáforo pelo peso (0..4). */
function drawAnswerLine(doc: any, c: Cursor, a: { label: string; weight: number | null }) {
  const cor = a.weight === null ? GRAY
    : a.weight <= 1 ? RED
    : a.weight === 2 ? "#F08A1C"
    : GREEN;
  ensureSpace(doc, c, 15);
  doc.setFillColor(cor);
  doc.circle(PAGE_PADDING + 4, c.y - 3.5, 3, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(INK);
  const sufixo = a.weight !== null ? `   (${a.weight} pts)` : "";
  const lines = wrap(doc, `${a.label}${sufixo}`, PAGE_WIDTH - PAGE_PADDING * 2 - 18);
  for (const line of lines) {
    ensureSpace(doc, c, 14);
    doc.text(line, PAGE_PADDING + 16, c.y);
    c.y += 14;
  }
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
  // Faixa superior laranja
  doc.setFillColor(ORANGE);
  doc.rect(0, 0, PAGE_WIDTH, 6, "F");

  // Eyebrow
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(INK_MUTED);
  doc.text("CLUBPETRO · DIAGNÓSTICO DE SAÚDE DO POSTO", PAGE_PADDING, 70);

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(INK);
  const headline = content.lead.name
    ? `Diagnóstico de ${content.lead.name.split(/\s+/)[0]}`
    : "Diagnóstico do seu posto";
  doc.text(headline, PAGE_PADDING, 120);

  // Subtítulo (tagline da faixa)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(INK_MUTED);
  let y = 150;
  for (const line of wrap(doc, content.overall.levelTagline, PAGE_WIDTH - PAGE_PADDING * 2 - 30)) {
    doc.text(line, PAGE_PADDING, y); y += 19;
  }

  // Nota grande, com "/100" alinhado pela largura real do número
  y += 58;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(80);
  doc.setTextColor(scoreColor(content.overall.score));
  const scoreStr = `${content.overall.score}`;
  doc.text(scoreStr, PAGE_PADDING, y);
  const sw = doc.getTextWidth(scoreStr);
  doc.setFontSize(22);
  doc.setTextColor(INK_MUTED);
  doc.text("/100", PAGE_PADDING + sw + 12, y);

  // Faixa atual
  y += 34;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(INK_MUTED);
  doc.text("FAIXA ATUAL", PAGE_PADDING, y);
  doc.setFontSize(17);
  doc.setTextColor(INK);
  doc.text(content.overall.levelName, PAGE_PADDING, y + 22);

  // Rodapé da capa
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(INK_MUTED);
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

function drawSection(doc: any, c: Cursor, title: string) {
  // Respiro antes do título (não aplica no topo da página).
  if (c.y > PAGE_PADDING + 6) c.y += 20;
  ensureSpace(doc, c, 44);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(ORANGE);
  doc.text(title, PAGE_PADDING, c.y);
  c.y += 11;
  doc.setDrawColor(0xE0, 0xD8, 0xC8);
  doc.setLineWidth(0.7);
  doc.line(PAGE_PADDING, c.y, PAGE_WIDTH - PAGE_PADDING, c.y);
  c.y += 22;
}

function drawSubsection(doc: any, c: Cursor, title: string) {
  ensureSpace(doc, c, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text(title, PAGE_PADDING, c.y);
  c.y += 14;
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
  for (const line of lines) {
    ensureSpace(doc, c, 14);
    doc.text(line, PAGE_PADDING + 14, c.y);
    c.y += 14;
  }
}

/* Bloco de dimensão (nome, nota, barra e insight). No PDF comercial a
   primeira da lista (mais fraca) ganha o selo FRENTE MAIS CRÍTICA. */
function drawDimensionBlock(
  doc: any,
  c: Cursor,
  d: ReportContent["dimensions"][number],
  critical = false,
) {
  ensureSpace(doc, c, critical ? 78 : 66);
  const w = PAGE_WIDTH - PAGE_PADDING * 2;

  if (critical) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(RED);
    doc.text("FRENTE MAIS CRÍTICA", PAGE_PADDING, c.y);
    c.y += 15;
  }

  // Nome à esquerda, nota alinhada à direita (mesma linha de base).
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(INK);
  doc.text(d.name, PAGE_PADDING, c.y);

  doc.setTextColor(scoreColor(d.pct));
  doc.text(`${d.pct}/100`, PAGE_WIDTH - PAGE_PADDING, c.y, { align: "right" });

  // Barra de progresso fina e arredondada.
  c.y += 10;
  doc.setFillColor(0xEC, 0xE6, 0xDA);
  doc.roundedRect(PAGE_PADDING, c.y, w, 5, 2.5, 2.5, "F");
  doc.setFillColor(scoreColor(d.pct));
  doc.roundedRect(PAGE_PADDING, c.y, Math.max(3, (w * d.pct) / 100), 5, 2.5, 2.5, "F");

  c.y += 18;
  drawParagraph(doc, c, d.insight, INK_MUTED, "small");
  drawSpacer(c, 18);
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
  if (pct < 90) return GREEN;
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
