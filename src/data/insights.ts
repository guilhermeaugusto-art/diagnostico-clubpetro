/* Leitura por frente, usada na tela de resultado.
   high  = pct >= 70
   mid   = 35 <= pct < 70
   low   = pct < 35
   Copy obedece à Seção 1: sem travessão, sem emoji, sem nome de bandeira. */

import type { BlockId } from "./blocks";

type Tier = "high" | "mid" | "low";

export const INSIGHTS: Record<BlockId, Record<Tier, string>> = {
  pessoas: {
    high: "Equipe estável, processo claro e clima saudável. Base sólida para qualquer programa de retenção crescer rápido.",
    mid:  "Equipe oscila e a rotatividade incomoda. O custo aparece em cada saída e no atendimento.",
    low:  "Pessoas no improviso. Sem essa base, qualquer ação de fidelização perde força no primeiro mês.",
  },
  marca: {
    high: "Posicionamento claro além do preço. O cliente reconhece um motivo para escolher você.",
    mid:  "Há detalhes que diferenciam, mas o posicionamento ainda não está afiado. Espaço para sair da disputa só por preço.",
    low:  "O preço é o que segura o cliente. Sem outro motivo de escolha, qualquer concorrente novo tira movimento.",
  },
  comercial: {
    high: "Margem sob controle, método de precificação e mix puxando lucro. É aqui que o resultado se decide e você está atento.",
    mid:  "Você acompanha parte da margem, mas deixa pontos cegos. Cada lacuna no método pesa em centavos por litro.",
    low:  "Margem no escuro e preço no instinto. O resultado do posto fica refém da gasolina mais barata da esquina.",
  },
  fidelizacao: {
    high: "Programa estruturado e motivo de volta conhecido. Base pronta para virar recorrência previsível.",
    mid:  "Fidelização informal. Você sabe quem volta, não sabe por quê. O primeiro concorrente com programa leva esse cliente.",
    low:  "Sem programa e sem motivo de volta mapeado. O cliente abastece e some, e o caixa depende de movimento novo o tempo todo.",
  },
  dados: {
    high: "Você sabe quem é o seu cliente e tem sistema rodando. Esse é o elo que destrava fidelização e estanca vazamento de margem.",
    mid:  "Sistema existe, dado existe, mas não viram decisão no dia a dia. Falta apertar o ciclo.",
    low:  "Cliente abastece e some, e a gestão depende de planilha na mão. Sem dado, fidelização não roda.",
  },
  resiliencia: {
    high: "Pouca exposição à concorrência desleal e conformidade em dia. Caixa preparado para atravessar os próximos meses.",
    mid:  "Exposição moderada ao mercado irregular e à pressão de margem. Vale blindar o caixa antes de a pressão apertar.",
    low:  "Alta exposição à concorrência desleal e fôlego de caixa curto. Cenário sensível, primeiro passo é proteger.",
  },
};

export function insightFor(blockId: BlockId, pct: number): string {
  const tier: Tier = pct >= 70 ? "high" : pct >= 35 ? "mid" : "low";
  return INSIGHTS[blockId][tier];
}
