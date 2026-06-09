/* Constrói o conteúdo COMPLETO do relatório do diagnóstico.
   Não renderiza PDF; só monta o objeto estruturado que será usado pelo
   gerador de PDF e pelo payload de banco (full_result_payload). */

import { BLOCKS, BLOCK_ORDER, type BlockId } from "../data/blocks";
import { QUESTIONS } from "../data/questions";
import { levelFor } from "../data/levels";
import {
  mainPain,
  nextImprovementFor,
  radarReading,
  strongestBlock,
  weakestBlock,
} from "../data/radar-reading";
import { buildResultRecommendations } from "../data/recommendations";
import { urgencyFor } from "../data/urgency";
import {
  blockScores,
  rankedBlocks,
  totalScore,
  weakBlockIds,
} from "./scoring";
import type { AppState } from "./state";

export interface ReportContent {
  lead: {
    name: string;
    email: string;
    whatsapp: string;
    diagnostic_started_at: string | null;
    diagnostic_completed_at: string | null;
  };
  overall: {
    score: number;
    levelName: string;
    levelTagline: string;
    urgencyKey: string;
    urgencyLabel: string;
    urgencyAccent: string;
  };
  dimensions: Array<{
    key: BlockId;
    name: string;
    short: string;
    weight: number;
    pct: number;
    earned: number;
    possible: number;
    insight: string;
  }>;
  strongest: { name: string; pct: number } | null;
  weakest:  { name: string; pct: number } | null;
  pain: {
    title: string;
    description: string;
    risk: string;
  };
  radar: {
    summary: string;
    summaryExtra: string;
  };
  nextImprovement: {
    title: string;
    description: string;
  };
  recommendations: {
    open: ReportRec[];
    locked: ReportRec[];
  };
  questionsAndAnswers: Array<{
    qid: string;
    qtext: string;
    dimension: string;
    answers: Array<{ label: string; value: string; weight: number | null; }>;
  }>;
  commercial: {
    leitura: string;
    frentesCriticas: string[];
    impacto: string;
    oportunidades: string[];
    abordagem: string;
    perguntasParaConversa: string[];
    objecoesProvaveis: string[];
    proximosPassos: string[];
  };
  clubpetroSolutions: Array<{ key: string; title: string; reason: string }>;
}

export interface ReportRec {
  id: string;
  title: string;
  desc: string;
  impact: string;
  block: BlockId;
}

export function buildReportContent(state: AppState): ReportContent {
  const score = totalScore(state);
  const lvl = levelFor(score);
  const ranked = rankedBlocks(state);
  const bs = blockScores(state);
  const urgency = urgencyFor(score);
  const radar = radarReading(state);
  const strong = strongestBlock(state);
  const weak = weakestBlock(state);
  const weakIds = weakBlockIds(state, 4);
  const recs = buildResultRecommendations(weakIds);
  const heroPain = mainPain(state);
  const nextImp = nextImprovementFor(ranked[0]?.id);

  const dimensions = BLOCK_ORDER
    .filter((b) => bs[b].possible > 0)
    .map((b) => ({
      key: b,
      name: BLOCKS[b].name,
      short: BLOCKS[b].short,
      weight: BLOCKS[b].weight,
      pct: bs[b].pct,
      earned: bs[b].earned,
      possible: bs[b].possible,
      insight: dimensionInsight(b, bs[b].pct),
    }));

  const qa = QUESTIONS
    .map((q) => {
      const a = state.answers[q.id];
      if (!a) return null;
      const answers = a.kind === "multi"
        ? a.labels.map((label, i) => ({ label, value: a.values[i], weight: null }))
        : a.kind === "text"
          ? [{ label: a.text, value: a.text, weight: null }]
          : [{ label: a.label, value: a.value, weight: a.kind === "score" ? a.pts : null }];
      const dim = q.block === "qualif" ? "Qualificação" : BLOCKS[q.block].name;
      return { qid: q.id, qtext: q.text, dimension: dim, answers };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    lead: {
      name: state.name,
      email: state.email,
      whatsapp: state.phone,
      diagnostic_started_at: state.startedAt,
      diagnostic_completed_at: state.finishedAt,
    },
    overall: {
      score,
      levelName: lvl.name,
      levelTagline: lvl.tagline,
      urgencyKey: urgency.key,
      urgencyLabel: urgency.statusLabel,
      urgencyAccent: urgency.accent,
    },
    dimensions,
    strongest: strong,
    weakest: weak,
    pain: {
      title: ranked[0] ? `Frente crítica: ${BLOCKS[ranked[0].id].name}` : "Diagnóstico geral",
      description: heroPain,
      risk: riskFor(ranked[0]?.id),
    },
    radar: {
      summary: radar.p1,
      summaryExtra: radar.p2,
    },
    nextImprovement: {
      title: nextImp,
      description: nextImprovementDescription(ranked[0]?.id),
    },
    recommendations: {
      open: recs.open.map(simplifyRec),
      locked: recs.locked.map(simplifyRec),
    },
    questionsAndAnswers: qa,
    commercial: buildCommercialReading(state, ranked.slice(0, 2).map((x) => x.id)),
    clubpetroSolutions: clubpetroSolutionsFor(ranked.slice(0, 3).map((x) => x.id)),
  };
}

function simplifyRec(r: { id: string; title: string; desc: string; impact: string; block: BlockId }): ReportRec {
  return { id: r.id, title: r.title, desc: r.desc, impact: r.impact, block: r.block };
}

function dimensionInsight(b: BlockId, pct: number): string {
  const tier = pct >= 70 ? "high" : pct >= 35 ? "mid" : "low";
  const MAP: Record<BlockId, Record<string, string>> = {
    pessoas: {
      high: "Equipe estável e processo claro. Sustenta qualquer programa de evolução.",
      mid:  "Equipe oscila e a rotatividade incomoda. O custo aparece todo mês.",
      low:  "Pessoas no improviso. Sem base, qualquer ação perde força logo no início.",
    },
    marca: {
      high: "Posicionamento claro além do preço. Cliente reconhece motivo de escolha.",
      mid:  "Detalhes diferenciam, mas o posicionamento ainda não está afiado.",
      low:  "Preço é o que segura o cliente. Concorrente novo tira movimento na hora.",
    },
    comercial: {
      high: "Margem sob controle e mix puxando lucro. Aqui o resultado se decide.",
      mid:  "Acompanha parte da margem, mas deixa pontos cegos. Cada lacuna pesa em centavos por litro.",
      low:  "Margem no escuro e preço no instinto. Resultado refém da bomba mais barata.",
    },
    fidelizacao: {
      high: "Programa estruturado e motivo de volta conhecido. Base pronta pra escalar.",
      mid:  "Fidelização informal. Sabe quem volta, não sabe por quê.",
      low:  "Sem programa e sem motivo de volta mapeado. Cliente abastece e some.",
    },
    dados: {
      high: "Sistema rodando, dado virando decisão. Esse é o elo que destrava tudo.",
      mid:  "Sistema existe, mas dado não vira ação. Falta apertar o ciclo.",
      low:  "Cliente some, gestão na planilha na mão. Sem dado, fidelização não roda.",
    },
    resiliencia: {
      high: "Pouca exposição à concorrência irregular. Caixa preparado.",
      mid:  "Exposição moderada. Vale blindar o caixa antes da pressão apertar.",
      low:  "Alta exposição à concorrência desleal e fôlego de caixa curto.",
    },
  };
  return MAP[b][tier];
}

function riskFor(b: BlockId | undefined): string {
  if (!b) return "Sem leitura específica de risco.";
  const MAP: Record<BlockId, string> = {
    pessoas: "Atendimento inconsistente cria experiência variável. Risco: perda de cliente por experiência ruim e custo recorrente de rotatividade.",
    marca: "Disputa só por preço comprime margem. Risco: chegada de concorrente derruba movimento rapidamente.",
    comercial: "Margem sem método deixa dinheiro na mesa todo mês. Risco: prejuízo composto que só aparece no balanço.",
    fidelizacao: "Cliente anônimo limita recorrência. Risco: programa do concorrente leva sua base inteira.",
    dados: "Decisão por instinto cria oportunidade invisível. Risco: oportunidades de venda e ajuste de margem passam despercebidas.",
    resiliencia: "Caixa apertado deixa o posto reativo. Risco: qualquer pressão de mercado vira sufoco operacional.",
  };
  return MAP[b];
}

function nextImprovementDescription(b: BlockId | undefined): string {
  if (!b) return "Estruturar a próxima camada da operação com método e dado.";
  const MAP: Record<BlockId, string> = {
    pessoas: "Implementar escala de pista em 1 página, com folga prevista e gatilho para hora extra. Acelera a estabilidade da equipe.",
    marca: "Construir um diferencial além do preço em 1 página, validado no cliente fiel. Sai da disputa só por preço.",
    comercial: "Acompanhar margem por litro toda semana e ativar oferta na pista com script simples. Margem visível, decisão informada.",
    fidelizacao: "Programa de fidelização rodando em 7 dias: cadastro no caixa, acúmulo por litro, oferta direta no WhatsApp.",
    dados: "Painel diário em 1 tela: litros, ticket médio, mix e meta da equipe. Decisão com o número na mão.",
    resiliencia: "Plano de fôlego de caixa de 90 dias com mapa simples de entradas e saídas e gatilho de proteção.",
  };
  return MAP[b];
}

function buildCommercialReading(state: AppState, weakest: BlockId[]): ReportContent["commercial"] {
  const score = totalScore(state);
  const lvl = levelFor(score);
  const ranked = rankedBlocks(state);
  const top = weakest[0];
  const top2 = weakest[1];

  const leitura = `Lead na faixa "${lvl.name}" (${score}/100). ${
    top ? `Frente que mais puxa o resultado pra baixo é ${BLOCKS[top].name.toLowerCase()} (${ranked[0]?.pct}/100).` : ""
  }${top2 ? ` Em seguida, ${BLOCKS[top2].name.toLowerCase()} também aparece como ponto sensível.` : ""}`;

  const frentesCriticas = ranked.slice(0, 2).map((r) => `${BLOCKS[r.id].name} (${r.pct}/100)`);
  const impacto = riskFor(top);

  const oportunidadesMap: Record<BlockId, string[]> = {
    pessoas: ["Onboarding de equipe", "Plano de retenção e clima"],
    marca: ["Construção de diferencial além do preço", "Posicionamento de marca local"],
    comercial: ["Método de margem", "Mix de pista e loja", "Aditivado com script"],
    fidelizacao: ["Programa de fidelidade ClubPetro", "Captura de base própria via WhatsApp"],
    dados: ["Inteligência de dados aplicada ao posto", "Painel diário ClubPetro"],
    resiliencia: ["Plano de fôlego e blindagem comercial", "Diagnóstico de risco regulatório"],
  };
  const oportunidades = top ? oportunidadesMap[top] : [];

  const perguntasMap: Record<BlockId, string[]> = {
    pessoas: [
      "Como está a rotatividade dos frentistas nos últimos 90 dias?",
      "Existe escala estruturada com folga prevista?",
      "Como é feita a integração de um novo funcionário?",
    ],
    marca: [
      "Por que o cliente escolhe o seu posto em vez do concorrente da esquina?",
      "Você consegue identificar 3 coisas que diferenciam seu posto além do preço?",
      "Quando um cliente novo chega, o que ele percebe primeiro?",
    ],
    comercial: [
      "Você acompanha margem por litro semanalmente?",
      "Quanto representa a venda de aditivado hoje?",
      "Qual o mix entre pista e loja na receita?",
    ],
    fidelizacao: [
      "Você sabe quantos clientes voltam pelo menos uma vez por semana?",
      "Existe um programa de fidelidade ativo?",
      "Você tem o telefone ou e-mail dos seus clientes fiéis?",
    ],
    dados: [
      "Quais indicadores você acompanha todo dia?",
      "Existe um painel ou sistema integrando bombas, loja e gestão?",
      "Você consegue identificar um cliente quando ele volta?",
    ],
    resiliencia: [
      "Quanto tempo o caixa do posto aguenta sem entradas novas?",
      "Você tem reserva de capital pra fazer movimentos defensivos?",
      "Há posto bandeira branca operando próximo de você?",
    ],
  };
  const perguntasParaConversa = top ? perguntasMap[top] : [];

  const abordagem = top
    ? `Comece pela dor real: "${BLOCKS[top].name.toLowerCase()} está puxando o resultado pra baixo". ` +
      `Não venda solução de cara. Pergunte como o posto trata esse ponto hoje e ouça. ` +
      `Em seguida, traga um caso concreto de outro posto que evoluiu nessa frente com método. ` +
      `Só depois apresente como o ClubPetro entra.`
    : "Comece entendendo a operação atual e o que mais incomoda no dia a dia.";

  const objecoes = [
    "Já tentei programa de fidelidade e não funcionou.",
    "Meu posto é pequeno, isso não faz sentido pra mim.",
    "Não tenho tempo de implementar nada novo agora.",
    "Tenho contrato com a bandeira e não posso mexer.",
  ];

  const proximosPassos = [
    "Confirmar participação no Raio-X (próxima terça, ao vivo).",
    "Enviar PDF completo do diagnóstico por e-mail após confirmação do Raio-X.",
    "Agendar follow-up em 7 dias caso não compareça.",
  ];

  return {
    leitura,
    frentesCriticas,
    impacto,
    oportunidades,
    abordagem,
    perguntasParaConversa,
    objecoesProvaveis: objecoes,
    proximosPassos,
  };
}

function clubpetroSolutionsFor(weakIds: BlockId[]): Array<{ key: string; title: string; reason: string }> {
  const SOLUTIONS: Record<BlockId, { key: string; title: string; reason: string }> = {
    pessoas:     { key: "operacao", title: "Apoio à operação e gestão de pista", reason: "Estrutura escala, treinamento e padronização." },
    marca:       { key: "comunicacao", title: "Comunicação e posicionamento de marca local", reason: "Constrói motivo de escolha além do preço." },
    comercial:   { key: "margem", title: "Método de margem e ativação de pista", reason: "Acompanhamento de margem por litro + script de oferta." },
    fidelizacao: { key: "fidelidade", title: "Programa de fidelidade ClubPetro", reason: "Cadastro, recorrência e relacionamento direto com o cliente." },
    dados:       { key: "inteligencia", title: "Inteligência de dados ClubPetro", reason: "Dados do cliente, painel diário e decisão informada." },
    resiliencia: { key: "blindagem", title: "Blindagem comercial e fôlego de caixa", reason: "Plano de proteção contra concorrência irregular." },
  };
  const out: Array<{ key: string; title: string; reason: string }> = [];
  const seen = new Set<string>();
  for (const id of weakIds) {
    const s = SOLUTIONS[id];
    if (!s || seen.has(s.key)) continue;
    out.push(s);
    seen.add(s.key);
  }
  return out;
}
