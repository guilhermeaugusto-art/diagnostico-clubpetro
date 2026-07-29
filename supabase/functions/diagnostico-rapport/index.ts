// diagnostico-rapport: gera o PDF de RAPPORT DE ABORDAGEM de uma ficha do
// diagnostico — no SERVIDOR, para TODA ficha (concluida OU parada no meio),
// decisao do dono (29/07/2026): todo card no Kommo sobe com um PDF que ensina
// o comercial a INICIAR a conversa com quem nunca teve contato.
// O PDF do app (jsPDF no navegador, so na conclusao) continua existindo como
// pdf_comercial_url; este aqui e o padrao novo e grava pdf_rapport_url.
// Chamado pela esteira (5c) com o Bearer service role; POST {"id":"<uuid>"}
// (ou ?id=). Upsert em diagnostico-pdfs/diagnosticos/{id}/rapport.pdf —
// regenerar e idempotente e a URL nao muda.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "diagnostico-pdfs";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// ---- paleta (mesma familia visual do app/central) ----
const LARANJA = rgb(0.949, 0.4, 0);
const LARANJA_ESCURO = rgb(0.761, 0.322, 0);
const TINTA = rgb(0.07, 0.082, 0.102);
const CINZA = rgb(0.349, 0.38, 0.427);
const CINZA_CLARO = rgb(0.894, 0.906, 0.925);
const FUNDO_SUAVE = rgb(1, 0.949, 0.91);
const VERDE = rgb(0.129, 0.478, 0.294);
const BRANCO = rgb(1, 1, 1);

const A4: [number, number] = [595.28, 841.89];
const MX = 48; // margem lateral
const LARG = A4[0] - MX * 2;

// WinAnsi-safe: as fontes padrao do pdf-lib nao aceitam fora do CP1252 —
// translitera o comum (aspas/travessao/bullet/emoji) e descarta o resto.
function txt(s: unknown): string {
  let t = String(s ?? "");
  t = t.normalize("NFC")
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/\r/g, "");
  return [...t].filter((ch) => ch === "\n" || (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 255)).join("");
}
// Texto de pergunta vem cru do app: resolve {{singular|plural}} e tira tags.
function limpar(s: unknown): string {
  return txt(String(s ?? "").replace(/\{\{([^|}]*)\|[^}]*\}\}/g, "$1").replace(/<[^>]*>/g, ""));
}

const CONHECE: Record<string, string> = {
  cliente: "Ja e cliente ClubPetro", conhece: "Conhece o ClubPetro de nome", primeira: "Primeiro contato com o ClubPetro",
};
const PAPEL: Record<string, string> = {
  dono: "Dono(a) ou Diretor(a)", gerente: "Gerente ou Supervisor(a)", outro: "Frentista", frentista: "Frentista",
};
const DOR: Record<string, string> = {
  equipe: "Equipe e atendimento", concorrencia: "Pressao da concorrencia", margem: "Margem e caixa",
  fidelizar: "Cliente que nao volta", padrao: "Padrao de atendimento",
};
const PILAR: Record<string, string> = {
  pessoas: "Pessoas", marca: "Marca", comercial: "Comercial", fidelizacao: "Fidelizacao", dados: "Dados", resiliencia: "Resiliencia",
};

function safeParse(s: unknown) { try { return JSON.parse(String(s)); } catch { return null; } }
function pilares(row: any): { nome: string; valor: number }[] {
  const raw = row.pontuacao_pilares;
  const obj = typeof raw === "string" ? safeParse(raw) : raw;
  if (!obj || typeof obj !== "object") return [];
  const out: { nome: string; valor: number }[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const n = Number(v);
    if (!Number.isNaN(n)) out.push({ nome: PILAR[k] ?? k, valor: n });
  }
  return out.sort((a, b) => a.valor - b.valor);
}
function fmtData(iso: unknown): string {
  const d = new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => (n < 10 ? "0" : "") + n;
  // BRT fixo (UTC-3): o time todo le em horario de Brasilia
  const b = new Date(d.getTime() - 3 * 3600000);
  return `${p(b.getUTCDate())}/${p(b.getUTCMonth() + 1)}/${b.getUTCFullYear()}`;
}

// Respostas do quiz agrupadas por dimensao, na ordem em que aparecem.
function respostasAgrupadas(row: any): { dim: string; itens: { q: string; a: string; vaga: boolean }[] }[] {
  const r = row.respostas;
  if (!r || typeof r !== "object") return [];
  const grupos = new Map<string, { q: string; a: string; vaga: boolean }[]>();
  for (const k of Object.keys(r)) {
    if (k.startsWith("_")) continue;
    const it = (r as any)[k];
    if (!it || typeof it !== "object") continue;
    const dim = limpar(it.dimension_label || "Outras");
    if (!grupos.has(dim)) grupos.set(dim, []);
    grupos.get(dim)!.push({ q: limpar(it.question_text), a: limpar(it.label), vaga: it.vague === true });
  }
  return [...grupos.entries()].map(([dim, itens]) => ({ dim, itens }));
}

// ---- o conteudo do rapport (regras deterministicas, sem IA) ----
// Gancho de conversa por dor declarada; fallback pela frente mais fraca.
const GANCHO_DOR: Record<string, { frase: string; proximo: string }> = {
  fidelizar: {
    frase: "o que mais pesa ai e o cliente que abastece uma vez e nao volta",
    proximo: "mandar o resumo de 9 postos que estavam nessa mesma briga e o que mudou, com numero (3 min de leitura)",
  },
  margem: {
    frase: "a dor que voce marcou foi margem e caixa - briga de centavo comendo o resultado",
    proximo: "mostrar o case da Rede Fialla: +30% de margem em 4 meses olhando pra quem ja era cliente",
  },
  concorrencia: {
    frase: "voce marcou a pressao da concorrencia como o que mais aperta",
    proximo: "mandar o material de sair da guerra de preco usando os dados do proprio posto",
  },
  equipe: {
    frase: "o ponto que voce marcou foi equipe e atendimento",
    proximo: "mandar o case da Rede 3M (100% da pista batendo meta em 10 dias) e o treino pronto de frentista",
  },
  padrao: {
    frase: "voce marcou padrao de atendimento como o ponto fraco",
    proximo: "mandar o treinamento pronto de pista que os postos usam com a gente",
  },
};
const GANCHO_PILAR: Record<string, string> = {
  Fidelizacao: "a frente que mais caiu no seu resultado foi fidelizacao - cliente indo embora pelo centavo",
  Pessoas: "a frente que mais caiu foi gente: equipe e atendimento",
  Comercial: "a frente que mais caiu foi a comercial: margem e mix",
  Marca: "a frente que mais caiu foi marca: motivo de escolha alem do preco",
  Dados: "a frente que mais caiu foi dados: decidir sem numero na mao",
  Resiliencia: "a frente que mais caiu foi resiliencia: folego de caixa na guerra de preco",
};

function montarConversa(row: any): { situacao: string; mensagem: string; alternativa: string; seResponder: string[]; evitar: string[] } {
  const nome = String(row.nome || "").trim().split(/\s+/)[0] || "[nome]";
  // dor declarada; sem ela, a frente de interesse usa as mesmas chaves
  const dorKey = String(row.dor_principal || row.interesse || "").trim().toLowerCase();
  const gancho = GANCHO_DOR[dorKey];
  const pil = pilares(row);
  const fraco = pil.length ? pil[0] : null;
  const resp = respostasAgrupadas(row);
  const nResp = resp.reduce((s, g) => s + g.itens.length, 0);
  const ultimaDim = resp.length ? resp[resp.length - 1].dim : "";
  const concluiu = row.concluiu === true;
  const score = row.score !== null && row.score !== undefined ? String(row.score) : "";
  const nivel = String(row.nivel || "").trim();

  let situacao: string;
  let mensagem: string;
  let alternativa: string;

  const anc = gancho ? gancho.frase
    : (fraco && GANCHO_PILAR[fraco.nome]) ? GANCHO_PILAR[fraco.nome]
    : "o diagnostico mostra onde o posto esta deixando resultado na mesa";

  if (concluiu) {
    situacao = `Concluiu o diagnostico${score ? ` com nota ${score}` : ""}${nivel ? ` (nivel ${nivel})` : ""}. Ja recebeu o resultado na tela - a abordagem retoma o que ELE respondeu, nao apresenta a empresa.`;
    mensagem = `Oi ${nome}, tudo bem? Aqui e o [seu nome], da ClubPetro. Vi o Diagnostico do Posto que voce fez${score ? ` - nota ${score}${nivel ? `, nivel ${nivel}` : ""}` : ""} - e ${anc}. Separei 2 ideias praticas pra essa frente, do jeito que outros postos resolveram. Te mando aqui? Se nao for a hora, me diz "agora nao" que eu respeito.`;
    alternativa = `${nome}, aqui e o [seu nome] da ClubPetro. Sobre o seu diagnostico: o ponto que mais chamou atencao foi ${fraco ? fraco.nome.toLowerCase() : (DOR[dorKey] || "a frente mais fraca").toLowerCase()}. Posso te mostrar em 3 minutos o que postos parecidos fizeram nisso?`;
  } else if (nResp > 0) {
    situacao = `PAROU NO MEIO do diagnostico: respondeu ${nResp} pergunta${nResp === 1 ? "" : "s"}${ultimaDim ? ` e parou na parte de ${ultimaDim}` : ""}. Nao recebeu resultado nenhum - a abordagem oferece VALOR (o que as respostas ja mostram), nunca cobranca por ter parado.`;
    mensagem = `Oi ${nome}, tudo bem? Aqui e o [seu nome], da ClubPetro. Voce comecou o Diagnostico do Posto e o dia deve ter engolido - acontece. Pelo que voce ja respondeu${ultimaDim ? ` (parou na parte de ${ultimaDim.toLowerCase()})` : ""}, ${anc}. Quer terminar? Sao 3 minutos e o resultado sai na hora. Se preferir, te mando direto o que as suas respostas ja mostram.`;
    alternativa = `${nome}, aqui e o [seu nome] da ClubPetro. Seu diagnostico ficou pela metade e eu guardei as respostas. Te mando o link pra concluir de onde parou? 3 minutos e sai a nota do posto.`;
  } else {
    situacao = "Abriu o diagnostico e nao chegou a responder. E um contato frio com UM sinal de interesse: clicou. Abordagem leve, sem citar 'voce abandonou'.";
    mensagem = `Oi ${nome}, tudo bem? Aqui e o [seu nome], da ClubPetro. Vi que voce chegou ate o Diagnostico do Posto - deve ter faltado tempo, o dia de posto nao perdoa. Ele leva 3 minutos e sai com a nota do seu posto em 6 frentes (margem, fidelizacao, equipe...). Te mando o link? Se nao fizer sentido agora, sem problema nenhum.`;
    alternativa = `${nome}, [seu nome] da ClubPetro aqui. Uma pergunta rapida, sem venda: segurar o cliente que hoje escolhe posto pelo centavo esta nos seus planos pra esse ano?`;
  }

  const seResponder: string[] = [];
  if (gancho) seResponder.push(`Emendar na mesma conversa: ${gancho.proximo}.`);
  else if (fraco) seResponder.push(`Emendar com material da frente ${fraco.nome.toLowerCase()} (case com numero, nunca "otimos resultados").`);
  if (!concluiu) seResponder.push("Se topar terminar o quiz: mandar o link na hora e avisar que o resultado sai na tela.");
  seResponder.push("Convidar pro Raio-X ao vivo de terca: um posto de verdade analisado na tela, 30 minutos, sem pitch.");
  seResponder.push("Registrar no card as palavras que ele usar - e a materia-prima da proxima conversa.");

  const evitar = [
    "Pitch de produto na primeira mensagem - a dor vem antes do produto.",
    "Textao, audio longo ou link sem contexto antes de conversar.",
    '"So passando pra ver se viu" - toque sem novidade e cobranca.',
    "Prometer desconto ou condicao - isso e etapa de proposta, nao de abertura.",
    "Duas mensagens novas no mesmo dia: sem resposta, 1 linha na manha seguinte, e so.",
  ];
  return { situacao, mensagem, alternativa, seResponder, evitar };
}

// ---- motor de layout ----
type Ctx = {
  doc: PDFDocument; page: PDFPage; y: number;
  fR: PDFFont; fB: PDFFont; fO: PDFFont; // regular, bold, obliqua
};
function novaPagina(ctx: Ctx) {
  ctx.page = ctx.doc.addPage(A4);
  ctx.y = A4[1] - 46;
}
function precisa(ctx: Ctx, h: number) {
  if (ctx.y - h < 52) novaPagina(ctx);
}
function quebra(fonte: PDFFont, texto: string, tam: number, larg: number): string[] {
  const linhas: string[] = [];
  for (const par of texto.split("\n")) {
    const palavras = par.split(/\s+/).filter(Boolean);
    if (!palavras.length) { linhas.push(""); continue; }
    let atual = "";
    for (const p of palavras) {
      const tent = atual ? atual + " " + p : p;
      if (fonte.widthOfTextAtSize(tent, tam) <= larg) atual = tent;
      else {
        if (atual) linhas.push(atual);
        // palavra maior que a linha: corta no braco
        if (fonte.widthOfTextAtSize(p, tam) > larg) {
          let resto = p;
          while (fonte.widthOfTextAtSize(resto, tam) > larg) {
            let i = resto.length;
            while (i > 1 && fonte.widthOfTextAtSize(resto.slice(0, i), tam) > larg) i--;
            linhas.push(resto.slice(0, i));
            resto = resto.slice(i);
          }
          atual = resto;
        } else atual = p;
      }
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}
function paragrafo(ctx: Ctx, texto: string, opts: { tam?: number; fonte?: PDFFont; cor?: any; larg?: number; x?: number; alt?: number } = {}) {
  const tam = opts.tam ?? 9.5;
  const fonte = opts.fonte ?? ctx.fR;
  const cor = opts.cor ?? TINTA;
  const larg = opts.larg ?? LARG;
  const x = opts.x ?? MX;
  const alt = opts.alt ?? tam * 1.45;
  for (const linha of quebra(fonte, texto, tam, larg)) {
    precisa(ctx, alt);
    ctx.page.drawText(linha, { x, y: ctx.y - tam, size: tam, font: fonte, color: cor });
    ctx.y -= alt;
  }
}
function secao(ctx: Ctx, titulo: string) {
  precisa(ctx, 34);
  ctx.y -= 14;
  ctx.page.drawRectangle({ x: MX, y: ctx.y - 3, width: 3.5, height: 12, color: LARANJA });
  ctx.page.drawText(titulo.toUpperCase(), { x: MX + 10, y: ctx.y, size: 10.5, font: ctx.fB, color: TINTA });
  ctx.y -= 8;
  ctx.page.drawLine({ start: { x: MX, y: ctx.y }, end: { x: MX + LARG, y: ctx.y }, thickness: 0.7, color: CINZA_CLARO });
  ctx.y -= 10;
}
function chaveValor(ctx: Ctx, chave: string, valor: string) {
  if (!valor) return;
  const tam = 9.5;
  precisa(ctx, tam * 1.5);
  ctx.page.drawText(chave, { x: MX, y: ctx.y - tam, size: tam, font: ctx.fB, color: CINZA });
  const kw = ctx.fB.widthOfTextAtSize(chave + "  ", tam);
  const linhas = quebra(ctx.fR, valor, tam, LARG - kw);
  let primeira = true;
  for (const l of linhas) {
    precisa(ctx, tam * 1.5);
    ctx.page.drawText(l, { x: MX + kw, y: ctx.y - tam, size: tam, font: ctx.fR, color: TINTA });
    ctx.y -= tam * 1.5;
    if (primeira) primeira = false;
  }
  if (!linhas.length) ctx.y -= tam * 1.5;
}
function caixaMensagem(ctx: Ctx, rotulo: string, texto: string) {
  const tam = 10;
  const pad = 12;
  const larg = LARG - pad * 2;
  const linhas = quebra(ctx.fR, texto, tam, larg);
  const altura = linhas.length * tam * 1.5 + pad * 2 + 14;
  precisa(ctx, altura + 6);
  const topo = ctx.y;
  ctx.page.drawRectangle({ x: MX, y: topo - altura, width: LARG, height: altura, color: FUNDO_SUAVE });
  ctx.page.drawRectangle({ x: MX, y: topo - altura, width: 3, height: altura, color: LARANJA });
  ctx.page.drawText(rotulo.toUpperCase(), { x: MX + pad, y: topo - pad - 8, size: 7.5, font: ctx.fB, color: LARANJA_ESCURO });
  let yy = topo - pad - 22;
  for (const l of linhas) {
    ctx.page.drawText(l, { x: MX + pad, y: yy, size: tam, font: ctx.fR, color: TINTA });
    yy -= tam * 1.5;
  }
  ctx.y = topo - altura - 8;
}
function bullet(ctx: Ctx, texto: string, cor = TINTA) {
  const tam = 9.5;
  const linhas = quebra(ctx.fR, texto, tam, LARG - 14);
  precisa(ctx, tam * 1.5);
  ctx.page.drawText("-", { x: MX + 2, y: ctx.y - tam, size: tam, font: ctx.fB, color: LARANJA });
  linhas.forEach((l, i) => {
    if (i > 0) precisa(ctx, tam * 1.5);
    ctx.page.drawText(l, { x: MX + 14, y: ctx.y - tam, size: tam, font: ctx.fR, color: cor });
    ctx.y -= tam * 1.5;
  });
}

async function gerarPdf(row: any): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fR = await doc.embedFont(StandardFonts.Helvetica);
  const fB = await doc.embedFont(StandardFonts.HelveticaBold);
  const fO = await doc.embedFont(StandardFonts.HelveticaOblique);
  const ctx: Ctx = { doc, page: doc.addPage(A4), y: 0, fR, fB, fO };

  // ---- capa/cabecalho da pagina 1 ----
  const H = 92;
  ctx.page.drawRectangle({ x: 0, y: A4[1] - H, width: A4[0], height: H, color: LARANJA });
  ctx.page.drawText("RAPPORT DE ABORDAGEM", { x: MX, y: A4[1] - 40, size: 19, font: fB, color: BRANCO });
  ctx.page.drawText("Diagnostico do Posto - ClubPetro - uso interno do comercial", { x: MX, y: A4[1] - 58, size: 9.5, font: fR, color: BRANCO });
  const ger = `gerado em ${fmtData(new Date().toISOString())}`;
  ctx.page.drawText(ger, { x: A4[0] - MX - fR.widthOfTextAtSize(ger, 8.5), y: A4[1] - 58, size: 8.5, font: fR, color: BRANCO });
  ctx.y = A4[1] - H - 24;

  const nome = txt(row.nome || row.email || "Lead sem nome");
  paragrafo(ctx, nome, { tam: 16, fonte: fB });
  ctx.y -= 2;

  // ---- identificacao ----
  secao(ctx, "Quem e");
  chaveValor(ctx, "Relacao com o posto:", txt(String(row.relacao_posto || "").trim() || PAPEL[String(row.papel || "").trim().toLowerCase()] || ""));
  chaveValor(ctx, "Conhece o ClubPetro:", txt(CONHECE[String(row.conhece || "").trim().toLowerCase()] || ""));
  chaveValor(ctx, "Telefone:", txt(row.telefone));
  chaveValor(ctx, "E-mail:", txt(row.email));
  chaveValor(ctx, "Cadastro:", fmtData(row.created_at));
  const origem = [row.origem_source, row.utm_source, row.utm_campaign].map((v) => String(v || "").trim()).filter(Boolean).join(" - ");
  chaveValor(ctx, "Origem:", txt(origem));
  const dorLabel = DOR[String(row.dor_principal || "").trim().toLowerCase()] || txt(row.dor_principal);
  chaveValor(ctx, "Dor declarada:", dorLabel || "");
  chaveValor(ctx, "Frente de interesse:", txt(row.interesse));

  // ---- status do diagnostico ----
  const conversa = montarConversa(row);
  secao(ctx, "Onde ele esta no diagnostico");
  paragrafo(ctx, conversa.situacao, { tam: 10 });
  const pil = pilares(row);
  if (pil.length) {
    ctx.y -= 4;
    paragrafo(ctx, "Notas por frente (0 a 100), da mais fraca pra mais forte:", { tam: 9, cor: CINZA });
    ctx.y -= 2;
    for (const p of pil) {
      const tam = 9;
      precisa(ctx, 14);
      ctx.page.drawText(p.nome, { x: MX, y: ctx.y - tam, size: tam, font: fR, color: TINTA });
      const bx = MX + 110, bw = 240;
      ctx.page.drawRectangle({ x: bx, y: ctx.y - tam, width: bw, height: 7, color: CINZA_CLARO });
      const frac = Math.max(0.02, Math.min(1, p.valor / 100));
      ctx.page.drawRectangle({ x: bx, y: ctx.y - tam, width: bw * frac, height: 7, color: p === pil[0] ? LARANJA : CINZA });
      ctx.page.drawText(String(p.valor), { x: bx + bw + 8, y: ctx.y - tam, size: tam, font: fB, color: p === pil[0] ? LARANJA_ESCURO : CINZA });
      ctx.y -= 14;
    }
  }
  if (row.raiox_status || row.participou_raiox === true) {
    const st = row.participou_raiox === true
      ? `Ja participou do Raio-X ao vivo${row.ultima_participacao_raiox ? ` (ultima vez em ${fmtData(row.ultima_participacao_raiox)})` : ""}.`
      : String(row.raiox_status || "").toLowerCase() === "confirmado" ? "Confirmou presenca no Raio-X ao vivo." : "";
    if (st) { ctx.y -= 2; paragrafo(ctx, st, { tam: 9.5, fonte: fB, cor: VERDE }); }
  }

  // ---- como abrir a conversa ----
  secao(ctx, "Como abrir a conversa");
  caixaMensagem(ctx, "Mensagem de abertura sugerida (WhatsApp)", txt(conversa.mensagem));
  caixaMensagem(ctx, "Variacao mais curta", txt(conversa.alternativa));
  paragrafo(ctx, "Se ele responder:", { tam: 9.5, fonte: fB });
  ctx.y -= 2;
  for (const s of conversa.seResponder) bullet(ctx, txt(s));
  ctx.y -= 4;
  paragrafo(ctx, "Evitar:", { tam: 9.5, fonte: fB });
  ctx.y -= 2;
  for (const e of conversa.evitar) bullet(ctx, txt(e), CINZA);

  // ---- leitura pronta (so quando o quiz concluiu e o app gerou) ----
  const leitura = String(row.leitura_comercial || "").trim();
  const resumo = String(row.resumo_diagnostico || "").trim();
  if (resumo || leitura) {
    secao(ctx, "Leitura do diagnostico");
    if (resumo) { paragrafo(ctx, txt(resumo), { tam: 9.5 }); ctx.y -= 4; }
    if (leitura) paragrafo(ctx, txt(leitura), { tam: 9.5 });
  }

  // ---- respostas dadas ----
  const grupos = respostasAgrupadas(row);
  secao(ctx, grupos.length ? "O que ele respondeu, pergunta a pergunta" : "Respostas");
  if (!grupos.length) {
    paragrafo(ctx, "Nenhuma pergunta respondida - abriu o diagnostico e saiu antes da primeira resposta.", { tam: 9.5, fonte: fO, cor: CINZA });
  }
  for (const g of grupos) {
    precisa(ctx, 26);
    ctx.y -= 6;
    paragrafo(ctx, g.dim.toUpperCase(), { tam: 8, fonte: fB, cor: LARANJA_ESCURO });
    ctx.y -= 1;
    for (const it of g.itens) {
      paragrafo(ctx, it.q, { tam: 8.5, cor: CINZA });
      paragrafo(ctx, (it.a || "(sem resposta)") + (it.vaga ? "   [resposta vaga - vale aprofundar]" : ""), { tam: 9.5, fonte: fB, x: MX + 10, larg: LARG - 10 });
      ctx.y -= 4;
    }
  }

  // ---- rodape com paginacao ----
  const paginas = doc.getPages();
  paginas.forEach((pg, i) => {
    pg.drawLine({ start: { x: MX, y: 38 }, end: { x: A4[0] - MX, y: 38 }, thickness: 0.6, color: CINZA_CLARO });
    pg.drawText("ClubPetro - Rapport gerado automaticamente pelo diagnostico", { x: MX, y: 26, size: 7.5, font: fR, color: CINZA });
    const num = `${i + 1} / ${paginas.length}`;
    pg.drawText(num, { x: A4[0] - MX - fR.widthOfTextAtSize(num, 7.5), y: 26, size: 7.5, font: fR, color: CINZA });
  });

  return await doc.save();
}

Deno.serve(async (req) => {
  const auth = req.headers.get("authorization") || "";
  if (!auth.includes(SERVICE_ROLE)) {
    return new Response(JSON.stringify({ erro: "nao autorizado" }), { status: 401 });
  }
  try {
    const url = new URL(req.url);
    let id = url.searchParams.get("id") || "";
    if (!id && req.method === "POST") {
      const p = await req.json().catch(() => null);
      id = p?.id || p?.record?.id || "";
    }
    if (!id) return new Response(JSON.stringify({ erro: "id obrigatorio" }), { status: 400 });

    const { data: row, error } = await supabase.from("diagnostico_respostas").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error("ler ficha: " + error.message);
    if (!row) return new Response(JSON.stringify({ erro: "ficha nao encontrada" }), { status: 404 });

    const bytes = await gerarPdf(row);
    const path = `diagnosticos/${id}/rapport.pdf`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (upErr) throw new Error("upload storage: " + upErr.message);
    const pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    const agora = new Date().toISOString();
    const { error: mErr } = await supabase.from("diagnostico_respostas")
      .update({ pdf_rapport_url: pdfUrl, rapport_gerado_em: agora }).eq("id", id);
    if (mErr) throw new Error("gravar url: " + mErr.message);

    return new Response(JSON.stringify({ ok: true, url: pdfUrl, bytes: bytes.length, gerado_em: agora }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
