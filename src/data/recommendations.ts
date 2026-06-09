/* Pool de recomendações práticas para a tela de resultado.
   Duas ficam abertas (puxadas pelas frentes mais fracas) e o restante
   é exibido como cards bloqueados, gerando percepção de valor sem
   entregar tudo. Cada uma é amarrada a uma das 6 dimensões da spec.
   Copy obedece à Seção 1. */

import type { BlockId } from "./blocks";
import type { AnyIcon } from "../lib/renderIcon";

export interface Recommendation {
  id: string;
  block: BlockId;
  title: string;
  desc: string;
  icon: AnyIcon;
  impact: string;
  priority: number;
}

export const RECOMMENDATIONS: Recommendation[] = [
  /* --- Pessoas e operação --- */
  { id: "R-P-1", block: "pessoas", priority: 9,
    title: "Escala da pista em 1 página, com folga prevista",
    desc: "Modelo de escala semanal com cobertura mínima por turno, folga programada e gatilho para hora extra. Reduz incêndio e prepara o posto para a mudança de jornada.",
    icon: "asset:projetos",
    impact: "Operação mais previsível no dia a dia" },
  { id: "R-P-2", block: "pessoas", priority: 8,
    title: "Plano de retenção do frentista em 90 dias",
    desc: "Roteiro semanal de feedback, premiação por tempo de casa e treinamento curto. Segura quem já entende o posto.",
    icon: "asset:frentista",
    impact: "Menos rotatividade, mais atendimento" },

  /* --- Marca e experiência --- */
  { id: "R-M-1", block: "marca", priority: 8,
    title: "Foto a 200 metros, checklist de fachada",
    desc: "Lista do que o cliente novo vê primeiro: totem, pintura, identidade, iluminação. Resolução em ordem de impacto.",
    icon: "asset:posto",
    impact: "Imagem que convida o cliente novo" },
  { id: "R-M-2", block: "marca", priority: 6,
    title: "Diferencial além do preço em 1 página",
    desc: "Mapa do que o seu posto entrega que o concorrente não entrega. Construído na pista, validado no cliente fiel.",
    icon: "asset:marca",
    impact: "Sai da disputa só por preço" },

  /* --- Comercial e margem --- */
  { id: "R-C-1", block: "comercial", priority: 10,
    title: "Margem por litro acompanhada toda semana",
    desc: "Planilha pronta para registrar custo, preço e margem por bandeirado e por bandeira branca. 10 minutos por semana, decisão saindo do escuro.",
    icon: "asset:margem",
    impact: "Margem visível, decisão informada" },
  { id: "R-C-2", block: "comercial", priority: 8,
    title: "Comissão da pista em 1 página",
    desc: "Tabela pronta para aditivado, lubrificante e itens da loja. Equipe vê o quanto ganha a mais e passa a oferecer.",
    icon: "asset:real",
    impact: "Mais margem na pista por venda de aditivado" },
  { id: "R-C-3", block: "comercial", priority: 7,
    title: "Script de aditivado na pista",
    desc: "Três frases prontas para o frentista oferecer aditivado sem soar empurrado. Aplicado por turno, medido no fim do dia.",
    icon: "asset:bomba",
    impact: "Mais aditivado vendido na pista" },

  /* --- Cliente e fidelização --- */
  { id: "R-F-1", block: "fidelizacao", priority: 10,
    title: "Programa de fidelização rodando em 7 dias",
    desc: "Cadastro do cliente no caixa, acúmulo por litro abastecido, oferta direta no WhatsApp. Sem investimento em equipamento novo.",
    icon: "asset:qualidade",
    impact: "Recorrência mensurável" },
  { id: "R-F-2", block: "fidelizacao", priority: 8,
    title: "Cadastro do cliente fiel direto no WhatsApp",
    desc: "Frentista pede o telefone no caixa, registra com dois cliques. Em 30 dias você tem base própria para campanha.",
    icon: "whatsapp",
    impact: "Base do posto, não do fornecedor" },
  { id: "R-F-3", block: "fidelizacao", priority: 7,
    title: "Campanha de reativação de inativos do mês",
    desc: "Mensagem padrão para quem não voltou em 21 dias. Um disparo por semana, benefício pequeno e claro.",
    icon: "asset:atendimento",
    impact: "Traz de volta parte dos clientes inativos" },

  /* --- Dados e digital --- */
  { id: "R-D-1", block: "dados", priority: 9,
    title: "Painel diário do posto em 1 tela",
    desc: "Litros, ticket médio, mix e meta da equipe num lugar só. Três minutos por dia, decisão com o número na mão.",
    icon: "asset:dados-analise",
    impact: "Decisão baseada em dado" },
  { id: "R-D-2", block: "dados", priority: 7,
    title: "Revisão de taxas de cartão e fatia de Pix",
    desc: "Roteiro para abrir e renegociar contratos de adquirência, e para incentivar Pix sem perder caixa.",
    icon: "asset:gestao",
    impact: "Menos custo de receber" },

  /* --- Resiliência e mercado --- */
  { id: "R-R-1", block: "resiliencia", priority: 7,
    title: "Plano de fôlego de caixa para 90 dias",
    desc: "Mapa simples de entradas e saídas, com regra para fechar a primeira fuga de margem identificada no diagnóstico.",
    icon: "asset:equipe-mercado",
    impact: "Caixa protegido no curto prazo" },
  { id: "R-R-2", block: "resiliencia", priority: 5,
    title: "Conformidade e qualidade, checklist do mês",
    desc: "Itens críticos de ANP, qualidade do combustível e operação. Roda em meia hora por mês.",
    icon: "asset:diagnostico",
    impact: "Risco regulatório mapeado" },
];

/* Constrói a saída de recomendações para a tela de resultado:
   2 abertas, puxadas das frentes mais fracas, e até 8 bloqueadas. */
export function buildResultRecommendations(weakBlocks: BlockId[]): {
  open: Recommendation[];
  locked: Recommendation[];
} {
  const seen = new Set<string>();
  const open: Recommendation[] = [];

  for (const blockId of weakBlocks) {
    const best = RECOMMENDATIONS
      .filter((r) => r.block === blockId && !seen.has(r.id))
      .sort((a, b) => b.priority - a.priority)[0];
    if (best) {
      open.push(best);
      seen.add(best.id);
    }
    if (open.length === 2) break;
  }

  if (open.length < 2) {
    const remaining = RECOMMENDATIONS
      .filter((r) => !seen.has(r.id))
      .sort((a, b) => b.priority - a.priority);
    while (open.length < 2 && remaining.length) {
      const next = remaining.shift()!;
      open.push(next);
      seen.add(next.id);
    }
  }

  const locked = RECOMMENDATIONS
    .filter((r) => !seen.has(r.id))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8);

  return { open, locked };
}
