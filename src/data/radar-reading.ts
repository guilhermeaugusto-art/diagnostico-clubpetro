/* Gera a "Leitura do radar" do hero do resultado.
   Dois parágrafos consultivos, montados a partir das frentes mais altas e
   mais baixas do diagnóstico. Texto adaptativo, sem cair em frases genéricas. */

import { BLOCKS, type BlockId } from "./blocks";
import { rankedBlocks } from "../lib/scoring";
import type { AppState } from "../lib/state";

/* Tema curto de cada frente, usado no segundo parágrafo:
   "conectar melhor X, Y e Z". Cada frente vira um substantivo concreto. */
const THEME: Record<BlockId, string> = {
  pessoas:     "gente e atendimento",
  marca:       "posicionamento",
  comercial:   "rotina comercial",
  fidelizacao: "relacionamento com clientes",
  dados:       "informações da operação",
  resiliencia: "fôlego financeiro",
};

/* Dor isolada por frente, com risco operacional e impacto no resultado.
   Tom consultivo, forte, sem alarmismo. */
const PAIN_SINGLE: Record<BlockId, string> = {
  pessoas:
    "Suas respostas indicam que a operação ainda depende muito de esforço individual. Sem rotina padronizada, treinamento contínuo e consistência da equipe, o atendimento oscila do cliente para o cliente e processos importantes ficam no improviso. Isso compromete experiência, gera retrabalho e trava qualquer plano de evolução que dependa de execução de pista.",
  marca:
    "As respostas mostram um posto que compete principalmente pelo preço. Sem motivo de escolha claro, a marca não constrói preferência, e qualquer concorrente novo na praça puxa movimento com facilidade. A operação fica refém da bomba mais barata da esquina, num jogo que pressiona margem todo mês.",
  comercial:
    "O comercial aparece como o ponto mais frágil do diagnóstico. Margem acompanhada sem método, mix de pista pouco trabalhado e oferta sem ativação na pista deixam dinheiro na mesa todo mês, sem que o dono perceba onde está vazando. Cada centavo de margem perdido por litro vira prejuízo composto no fim do mês.",
  fidelizacao:
    "As respostas indicam que o cliente abastece e some. Sem programa estruturado de fidelização e sem captura do dado do cliente, o caixa depende de movimento novo o tempo todo. Quando um concorrente próximo lança um programa de verdade, ele leva embora a base que hoje volta no informal, e o posto perde recorrência sem nem saber.",
  dados:
    "Suas respostas mostram uma operação que ainda roda no achismo. Sem dado integrado e sem painel claro, decisão depende do feeling do dono no dia a dia. Comportamento de cliente, frequência de retorno, ticket médio e oportunidades de ação comercial passam despercebidos. O posto trabalha mais do que precisaria pra entregar o mesmo resultado.",
  resiliencia:
    "O diagnóstico mostra pouco fôlego para os próximos meses. Caixa apertado e exposição à concorrência irregular deixam o posto reativo, sem espaço pra planejar movimentos próprios. Qualquer pressão de mercado vira sufoco operacional e empurra a gestão pro curto prazo.",
};

/* Dor combinada: quando duas frentes fracas se reforçam, o texto entende
   a sinergia entre elas em vez de tratar como problemas separados. */
function painCombined(a: BlockId, b: BlockId): string | null {
  const pair = [a, b].sort().join("+");
  switch (pair) {
    case "comercial+dados":
      return "Falta de dado e falta de método comercial se reforçam: o posto não enxerga onde a margem vaza e não tem rotina pra ativar oferta na pista. O resultado é decisão por intuição e oportunidade de venda perdida todo dia.";
    case "comercial+fidelizacao":
      return "Comercial sem método e fidelização informal: cada cliente que entra rende menos do que poderia, e o que abastece hoje não tem motivo claro pra voltar amanhã. Movimento novo precisa cobrir o que escapa.";
    case "dados+fidelizacao":
      return "Sem dado do cliente e sem programa de recorrência, o posto não sabe quem é o seu cliente fiel. Cada um abastece e some, e o caixa depende de movimento novo o tempo todo.";
    case "dados+pessoas":
      return "Equipe que oscila e dado que não vira decisão deixam a operação dependente do dono na rotina. Cada dia precisa ser refeito do zero, e a evolução fica travada na execução.";
    case "comercial+marca":
      return "O posto disputa cliente só por preço, sem método comercial pra extrair mais por litro. É a pior combinação para enfrentar concorrente novo, porque tanto o motivo de escolha quanto a margem ficam pressionados.";
    case "comercial+resiliencia":
      return "Margem no escuro e caixa apertado: o posto não tem fôlego nem método pra atravessar pressão de mercado. Qualquer aperto na praça vira sufoco operacional.";
    case "fidelizacao+marca":
      return "O cliente não tem motivo pra escolher seu posto nem pra voltar. Sem diferencial e sem recorrência, a operação compete só por preço e fica refém do movimento de passagem.";
    case "marca+pessoas":
      return "Atendimento oscilante e posicionamento fraco se reforçam: o cliente passa pelo posto e nada faz lembrança dele. Falta o motivo de escolha que vem da experiência no balcão e na pista.";
    default:
      return null;
  }
}

/* Texto da dor principal do diagnóstico, baseada na combinação das duas frentes
   mais fracas, ou na frente isolada se a segunda já estiver saudável. */
export function mainPain(state: AppState): string {
  const ranked = rankedBlocks(state);
  if (ranked.length === 0) {
    return "Ainda não há respostas suficientes para uma leitura completa da operação.";
  }
  const low1 = ranked[0];
  const low2 = ranked[1];
  /* Se a segunda frente já está em zona saudável (>= 60), o quadro é "uma
     frente puxando o resultado", não combinação. */
  if (!low2 || low2.pct >= 60) {
    return PAIN_SINGLE[low1.id];
  }
  const combined = painCombined(low1.id, low2.id);
  if (combined) return combined;
  /* Fallback consultivo: junção dos temas. */
  return `${PAIN_SINGLE[low1.id]} Isso se intensifica porque ${THEME[low2.id]} também aparece como ponto de atenção, e as duas frentes acabam se reforçando no dia a dia da operação.`;
}

/* Lê o radar em duas frases. */
export function radarReading(state: AppState): { p1: string; p2: string } {
  const ranked = rankedBlocks(state); // do mais fraco ao mais forte
  if (ranked.length === 0) {
    return { p1: "Ainda não há dados suficientes para uma leitura do radar.", p2: "" };
  }

  const lows = ranked.slice(0, 2).map((x) => x.id);
  const highs = ranked.slice(-2).map((x) => x.id).reverse();

  const lowNames = lows.map((id) => BLOCKS[id].short.toLowerCase());
  const highNames = highs.map((id) => BLOCKS[id].short.toLowerCase());

  /* Caracteriza o desempenho geral pra abrir o parágrafo de forma adequada. */
  const pcts = ranked.map((r) => r.pct);
  const spread = (pcts[pcts.length - 1] || 0) - (pcts[0] || 0);
  const opener =
    spread >= 30 ? "O radar mostra uma operação com desempenho desigual entre as frentes."
      : spread >= 15 ? "O radar mostra uma operação com forças e fragilidades bem distribuídas."
        : "O radar mostra uma operação ainda em construção, com forças e fragilidades próximas.";

  const p1 =
    `${opener} ` +
    `${cap(joinAnd(highNames))} ${highNames.length > 1 ? "aparecem" : "aparece"} mais ${highNames.length > 1 ? "desenvolvidas" : "desenvolvida"}, ` +
    `enquanto ${joinAnd(lowNames)} ${lows.length > 1 ? "indicam" : "indica"} oportunidades importantes de evolução.`;

  /* Segundo parágrafo: foca onde o avanço acontece, usando os temas
     das frentes mais fracas. */
  const themes = lows.map((id) => THEME[id]);
  const themesText = joinAnd(themes);

  const p2 =
    `Isso sugere que o próximo avanço não está apenas em fazer mais ações, ` +
    `mas em conectar melhor ${themesText} para que a operação saia da rotina e ganhe previsibilidade.`;

  return { p1, p2 };
}

/* Próxima melhoria recomendada em uma frase curta, ligada ao bloco mais fraco. */
const NEXT_IMPROVEMENT: Record<BlockId, string> = {
  pessoas:     "Estabilizar equipe e padronizar o atendimento na pista",
  marca:       "Construir motivo de escolha além do preço",
  comercial:   "Acompanhar margem e ativar venda na pista",
  fidelizacao: "Estruturar fidelização e relacionamento próprio com o cliente",
  dados:       "Organizar dados e transformar rotina em decisão",
  resiliencia: "Proteger caixa e blindar contra concorrência irregular",
};

export function nextImprovementFor(blockId: BlockId | null | undefined): string {
  if (!blockId) return "Estruturar a próxima camada da operação";
  return NEXT_IMPROVEMENT[blockId];
}

export function strongestBlock(state: AppState): { name: string; pct: number } | null {
  const ranked = rankedBlocks(state);
  if (ranked.length === 0) return null;
  const top = ranked[ranked.length - 1];
  return { name: BLOCKS[top.id].short, pct: top.pct };
}

export function weakestBlock(state: AppState): { name: string; pct: number } | null {
  const ranked = rankedBlocks(state);
  if (ranked.length === 0) return null;
  const low = ranked[0];
  return { name: BLOCKS[low.id].short, pct: low.pct };
}

function joinAnd(arr: string[]): string {
  if (arr.length === 0) return "";
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} e ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")} e ${arr[arr.length - 1]}`;
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
