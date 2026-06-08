/* Faixas de resultado. Estrutura consultiva:
   - name: título curto da faixa
   - tagline: leitura geral do momento
   - reading: leitura mais densa do estado da operação
   - attention: principais pontos de atenção identificados
   - path: caminho sugerido para evoluir
   - clubpetroFit: como o ClubPetro contribui nesse momento da operação */

export interface Level {
  min: number;
  max: number;
  name: string;
  tagline: string;
  reading: string;
  attention: string;
  path: string;
  clubpetroFit: string;
}

export const LEVELS: Level[] = [
  {
    min: 0,
    max: 30,
    name: "Operação em improviso",
    tagline: "A operação roda no esforço diário e na disputa por preço na esquina.",
    reading:
      "Sua operação ainda funciona sem rotina estruturada de gestão, sem dado do cliente e com forte dependência do volume puxado pelo preço. O esforço é grande, a margem é estreita.",
    attention:
      "Margem que vaza no mês, cliente que abastece e some, e ausência de dados claros para decidir. Qualquer concorrente novo na praça já tira movimento.",
    path:
      "Começar pela gestão visível do dia (litros, mix e margem em uma tela só) e por um motivo de volta claro para o cliente, ainda neste mês.",
    clubpetroFit:
      "Estruturar fidelização, integrar gestão e ativar relacionamento por WhatsApp para o cliente parar de ser anônimo.",
  },
  {
    min: 31,
    max: 60,
    name: "Em construção",
    tagline: "Algumas frentes estão maduras, mas o conjunto ainda não rende.",
    reading:
      "Você acerta em pontos importantes, mas a operação ainda perde rendimento por falta de integração entre gestão, fidelização e dado do cliente. O resultado escapa em detalhes.",
    attention:
      "Fidelização informal, dado de cliente incompleto e acompanhamento de margem fragmentado. O posto trabalha mais do que precisaria para entregar o mesmo resultado.",
    path:
      "Amarrar o que já funciona em rotinas semanais, profissionalizar o programa de fidelização e organizar o dado do cliente para virar decisão.",
    clubpetroFit:
      "Programa de recorrência integrado, base própria do posto e painel de acompanhamento da operação.",
  },
  {
    min: 61,
    max: 80,
    name: "Operação consistente",
    tagline: "Base sólida. O próximo degrau exige método fino e dado integrado.",
    reading:
      "Sua operação já apresenta consistência nas frentes principais. O próximo movimento é refinar processos, aprofundar a relação com o cliente e fazer dado fino render mais por litro.",
    attention:
      "Crescimento começa a depender de método: cliente conhecido virando recorrência previsível, mix de pista e loja extraindo mais margem.",
    path:
      "Desenhar a próxima camada: campanhas segmentadas para clientes, mix de pista com método e leitura de dado por turno.",
    clubpetroFit:
      "Inteligência de dados aplicada ao seu posto, campanhas segmentadas e relacionamento integrado em escala.",
  },
];

export function levelFor(score: number): Level {
  const last = LEVELS[LEVELS.length - 1];
  if (score >= last.max) return last;
  return LEVELS.find((l) => score >= l.min && score <= l.max) || LEVELS[0];
}
