/* Faixas de resultado (Seção 6 da spec).
   Cada faixa traz a leitura, onde dói e o gancho de resolução.
   Copy direta, na voz do dono, sem venda crua. */

export interface Level {
  min: number;
  max: number;
  name: string;        // título curto da faixa
  tagline: string;     // frase de sub-cabeçalho
  reading: string;     // "leitura"
  pain: string;        // "onde dói"
  hook: string;        // "gancho"
}

export const LEVELS: Level[] = [
  {
    min: 0,
    max: 30,
    name: "Sobrevivendo no preço",
    tagline: "O posto opera no improviso e disputa cada cliente na bomba mais barata da esquina.",
    reading:
      "Sua operação roda sem dado, sem fidelização e refém de preço. Esforço enorme para uma margem que sempre escapa.",
    pain:
      "Margem que vaza todo mês e cliente que não volta. Qualquer concorrente novo na praça tira movimento.",
    hook:
      "Mostrar, numa conversa curta, as duas fugas de margem mais caras do seu posto e fechar a primeira ainda neste mês.",
  },
  {
    min: 31,
    max: 60,
    name: "Roda, mas vaza",
    tagline: "O posto acerta em partes, perde no conjunto.",
    reading:
      "Você já estruturou alguns pontos, mas o retorno escapa. Falta amarrar fidelização e dado do cliente.",
    pain:
      "Fidelização informal e ausência de dado do cliente. O esforço existe, o resultado escapa.",
    hook:
      "Conectar o que já funciona a um plano simples de recorrência, para o mesmo movimento render mais sem depender de baixar preço.",
  },
  {
    min: 61,
    max: 80,
    name: "Posto saudável",
    tagline: "Base sólida. O próximo degrau só sobe com método e dado fino.",
    reading:
      "Você fez o básico bem feito em gente, margem e operação. Bateu no teto do que dá para crescer no braço.",
    pain:
      "Crescimento travado por falta de dado fino do cliente e de um programa de recorrência que escale.",
    hook:
      "Desenhar o próximo degrau: clientes conhecidos virando recorrência previsível e mais margem nos serviços.",
  },
  {
    min: 81,
    max: 100,
    name: "Referência na praça",
    tagline: "Opera com método, conhece o cliente e tem margem sob controle.",
    reading:
      "Posto pronto para padronizar e escalar. Você é referência na sua praça e tem maturidade para o próximo movimento.",
    pain:
      "Manter a vantagem e replicar o padrão sem perder qualidade na expansão.",
    hook:
      "Levar o que funciona para um patamar de rede, com dado e fidelização sustentando a expansão.",
  },
];

export function levelFor(score: number): Level {
  return LEVELS.find((l) => score >= l.min && score <= l.max) || LEVELS[0];
}
