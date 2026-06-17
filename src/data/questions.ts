/* Banco de perguntas do Diagnóstico de Saúde do Posto (ClubPetro).
   Estrutura com três trilhas, definidas pela resposta de S1 (papel):
     - dono       (Dono ou sócio)
     - gerente    (Gerente)
     - frentista  (Outro: frentista, administrativo, financeiro)

   Regras de copy: sem travessão, sem emoji, sem nome de bandeira,
   tom de dono experiente conversando com outro dono. Pesos por frente
   somam 100 (definidos em blocks.ts). Nota é normalizada por perfil:
   pontos obtidos / pontos possíveis das perguntas score VISÍVEIS x 100.

   Frentista pontua apenas para comparação interna, sem MQL e sem
   nota comercial. */

import type { BlockId } from "./blocks";

/* --- Trilhas ------------------------------------------------------------ */

export type TrackId = "dono" | "gerente" | "frentista";

export function trackFromS1Value(v: string | null | undefined): TrackId | null {
  if (v === "dono") return "dono";
  if (v === "gerente") return "gerente";
  if (v === "outro") return "frentista";
  return null;
}

/* --- Tipos auxiliares --------------------------------------------------- */

export type QuestionType =
  | "segmentation-single"
  | "segmentation-multi"
  | "score"
  | "qualify"
  | "open";

export interface ScoreOption {
  label: string;
  desc: string;
  pts: number;
  value?: string;
  vague?: boolean;
}

export interface NoScoreOption {
  label: string;
  desc: string;
  value: string;
}

interface BaseQuestion {
  id: string;
  block: BlockId | "qualif";
  text: string;
  context: string;
  tracks?: TrackId[]; // se ausente, pergunta vale para todas as trilhas
  condition?: ConditionFn;
}

export interface SegmentationSingleQuestion extends BaseQuestion {
  type: "segmentation-single";
  options: NoScoreOption[];
}
export interface SegmentationMultiQuestion extends BaseQuestion {
  type: "segmentation-multi";
  options: NoScoreOption[];
  hint?: string;
}
export interface ScoreQuestion extends BaseQuestion {
  type: "score";
  max: number;
  options: ScoreOption[];
}
export interface QualifyQuestion extends BaseQuestion {
  type: "qualify";
  options: NoScoreOption[];
}
/* Resposta aberta (campo de texto). Não pontua, não roteia: é leitura
   qualitativa, usada hoje na trilha do frentista. */
export interface OpenQuestion extends BaseQuestion {
  type: "open";
  placeholder?: string;
}

export type Question =
  | SegmentationSingleQuestion
  | SegmentationMultiQuestion
  | ScoreQuestion
  | QualifyQuestion
  | OpenQuestion;

export type ConditionFn = (read: ReadAnswers) => boolean;

export interface ReadAnswers {
  single: (id: string) => string | null;
  multi: (id: string) => string[];
  score: (id: string) => { value?: string; pts?: number } | null;
  signal: () => "critico" | "neutro" | "avancado" | null;
  track: () => TrackId | null;
}

/* --- Banco de perguntas ------------------------------------------------- */

export const QUESTIONS: Question[] = [
  /* =========================================================
     S1 · ROTEAMENTO (compartilhada, não pontua)
     ========================================================= */
  {
    id: "S1",
    block: "qualif",
    type: "segmentation-single",
    text: "Qual é o seu <em>papel</em> no posto?",
    context:
      "Para o diagnóstico falar a sua língua, comece dizendo de onde você olha o posto.",
    options: [
      { label: "Dono ou sócio.",
        desc: "A decisão final passa por mim.",
        value: "dono" },
      { label: "Gerente.",
        desc: "Toco a operação no dia a dia.",
        value: "gerente" },
      { label: "Outro papel no posto.",
        desc: "Frentista, administrativo, financeiro ou outra frente.",
        value: "outro" },
    ],
  },

  /* =========================================================
     TRILHA DONO
     ========================================================= */

  /* --- Perfil (não pontua) --- */
  {
    id: "D_PT_POSTOS",
    block: "qualif",
    type: "segmentation-single",
    tracks: ["dono"],
    text: "Quantos <em>postos</em> você tem hoje?",
    context: "O tamanho da sua operação muda o que faz sentido medir.",
    options: [
      { label: "Apenas um.",        desc: "Toco um posto.",        value: "1" },
      { label: "Entre dois e quatro.", desc: "Tenho rede pequena.", value: "2a4" },
      { label: "Cinco ou mais.",    desc: "Tenho rede maior.",     value: "5mais" },
    ],
  },
  {
    id: "D_PT_MIX",
    block: "qualif",
    type: "segmentation-multi",
    tracks: ["dono"],
    text: "O que {{o seu posto oferece|os seus postos oferecem}} <em>além do combustível</em>?",
    context:
      "Marque tudo que {{o seu posto já tem|os seus postos já têm}}, para a gente medir só o que existe.",
    hint: "Marque todas que se aplicam.",
    options: [
      { label: "Loja de conveniência.",            desc: "Loja, conveniência ou lanchonete.",        value: "conveniencia" },
      { label: "Troca de óleo.",                    desc: "Serviço de troca de óleo e filtros.",       value: "troca_oleo" },
      { label: "Lava rápido.",                      desc: "Lavagem de veículos.",                      value: "lava_rapido" },
      { label: "Carregador para carro elétrico.",   desc: "Ponto de recarga elétrica.",                value: "eletrica" },
      { label: "Calibragem e serviços de pista.",   desc: "Calibrador, água, ar e apoio na pista.",    value: "calibragem" },
      { label: "Só combustível por enquanto.",      desc: "Por enquanto só a pista.",                  value: "so_pista" },
    ],
  },
  {
    id: "D_PT_TEMPO",
    block: "qualif",
    type: "segmentation-single",
    tracks: ["dono"],
    text: "Há quanto tempo você <em>toca esse posto</em>?",
    context: "Tempo de casa muda o quanto você vê e o quanto você ainda está descobrindo.",
    options: [
      { label: "Até dois anos.",         desc: "Estou nos primeiros anos.",   value: "ate2" },
      { label: "Entre dois e dez anos.", desc: "Operação consolidada.",        value: "2a10" },
      { label: "Mais de dez anos.",      desc: "Operação madura.",             value: "mais10" },
    ],
  },

  /* --- Pessoas e operação (peso 18) --- */
  {
    id: "D_P1",
    block: "pessoas",
    type: "score",
    max: 3,
    tracks: ["dono"],
    text: "Como funciona a <em>escala</em> da sua equipe de pista hoje?",
    context:
      "A escala define quanto você gasta para manter a pista girando e o quanto fica exposto a uma mudança de regra.",
    options: [
      { label: "Escala desenhada e estável.",
        desc: "Cobre os horários sem hora extra fora do previsto.",
        pts: 3, value: "ok" },
      { label: "Funciona, mas no aperto.",
        desc: "Vivo apagando incêndio com falta e troca de turno.",
        pts: 1, value: "aperto" },
      { label: "É no improviso.",
        desc: "Vou fechando como dá.",
        pts: 0, value: "improviso" },
    ],
  },
  {
    id: "D_P2",
    block: "pessoas",
    type: "score",
    max: 4,
    tracks: ["dono"],
    text: "A PEC do fim da escala 6x1 já está no Senado. Se ela passar e você precisar dar duas <em>folgas por semana</em>, o seu posto está preparado?",
    context:
      "A regra da jornada pode mudar. Quem se preparou antes sente menos no caixa.",
    options: [
      { label: "Já estou preparado.",
        desc: "Sei quanta gente precisaria e o custo disso.",
        pts: 4, value: "pronto" },
      { label: "Daria um aperto, mas eu me viraria.",
        desc: "Não é tranquilo, mas dá pra virar.",
        pts: 2, value: "aperto" },
      { label: "Hoje não teria como cobrir.",
        desc: "Falta gente e custo para isso.",
        pts: 1, value: "dificil" },
      { label: "Ainda não parei para calcular esse impacto.",
        desc: "Não fiz a conta.",
        pts: 0, value: "nao_pensei", vague: true },
    ],
  },
  {
    id: "D_P3",
    block: "pessoas",
    type: "score",
    max: 4,
    tracks: ["dono"],
    text: "Qual a <em>rotatividade</em> da sua equipe de pista?",
    context:
      "Rotatividade alta custa caro: cada frentista novo é treino do zero e atendimento que oscila.",
    options: [
      { label: "Baixa.",
        desc: "A maior parte do time tem mais de um ano de casa.",
        pts: 4, value: "estavel" },
      { label: "Normal.",
        desc: "Troco um ou dois por ano.",
        pts: 2, value: "moderado" },
      { label: "Alta.",
        desc: "A cada poucos meses entra rosto novo, e treinar de novo me custa caro.",
        pts: 0, value: "trocando" },
    ],
  },
  {
    id: "D_P4",
    block: "pessoas",
    type: "score",
    max: 4,
    tracks: ["dono"],
    text: "Quando entra alguém novo, como é a <em>contratação e o treinamento</em>?",
    context:
      "A forma como você contrata e forma a equipe define se o bom atendimento é sorte ou processo.",
    options: [
      { label: "Tenho processo estruturado.",
        desc: "Seleção, treinamento e acompanhamento.",
        pts: 4, value: "processo" },
      { label: "Treinamento básico no começo.",
        desc: "O resto vai no dia a dia.",
        pts: 2, value: "basico" },
      { label: "A pessoa aprende fazendo.",
        desc: "Não tenho processo definido.",
        pts: 0, value: "fazendo" },
    ],
  },
  {
    id: "D_P5",
    block: "pessoas",
    type: "score",
    max: 3,
    tracks: ["dono"],
    text: "A sua equipe ganha <em>parte variável</em> por vender aditivado, lubrificante ou itens da loja?",
    context:
      "Comissão bem desenhada é o que faz o frentista vender aditivado e lubrificante, que é onde a margem está.",
    options: [
      { label: "Tenho plano de comissão claro.",
        desc: "A equipe sabe quanto ganha a mais por vender o que dá margem.",
        pts: 3, value: "claro" },
      { label: "Algo informal de vez em quando.",
        desc: "Sem regra fixa.",
        pts: 1, value: "informal" },
      { label: "Não tenho comissão por venda.",
        desc: "Salário fixo.",
        pts: 0, value: "nao" },
    ],
  },
  {
    id: "D_P6",
    block: "pessoas",
    type: "score",
    max: 2,
    tracks: ["dono"],
    text: "Como você descreveria o <em>ambiente de trabalho</em> da sua equipe?",
    context:
      "Ambiente de trabalho puxa atendimento: equipe bem aparece no jeito de receber o cliente.",
    options: [
      { label: "Bom.",
        desc: "As pessoas gostam de estar aqui, e isso aparece no atendimento.",
        pts: 2, value: "bom" },
      { label: "Tem altos e baixos.",
        desc: "Depende da época e da pressão.",
        pts: 1, value: "oscila" },
      { label: "Pesado.",
        desc: "E isso respinga no cliente.",
        pts: 0, value: "ruim" },
    ],
  },

  /* --- Marca e experiência (peso 12) --- */
  {
    id: "D_M1",
    block: "marca",
    type: "score",
    max: 4,
    tracks: ["dono"],
    text: "Olhando {{o seu posto|os seus postos}} de longe, como quem passa pela primeira vez, <em>o que essa pessoa vê</em>?",
    context:
      "Quem nunca entrou no seu posto decide em segundos se vale parar. Pare a 200 metros e olhe como um estranho olharia.",
    options: [
      { label: "Um posto que convida.",
        desc: "Limpo, iluminado, equipe sinalizando para entrar.",
        pts: 4, value: "convida" },
      { label: "Um posto comum.",
        desc: "Nada que chame nem afaste.",
        pts: 2, value: "comum" },
      { label: "Algo que mais afasta do que atrai.",
        desc: "Sendo sincero, tem coisa a ajustar.",
        pts: 0, value: "afasta" },
    ],
  },
  {
    id: "D_M2",
    block: "marca",
    type: "score",
    max: 8,
    tracks: ["dono"],
    text: "Tirando o preço, por que um cliente <em>escolheria o seu posto</em>?",
    context:
      "Preço não pode ser o seu único diferencial, senão a conta não fecha. O que faz o cliente escolher você por outro motivo?",
    options: [
      { label: "Tenho diferencial claro que ele reconhece.",
        desc: "Atendimento que fideliza, lava jato, conveniência boa.",
        pts: 8, value: "diferencial" },
      { label: "Tenho uns detalhes que ajudam.",
        desc: "Calibrador, água, café, banheiro limpo, mas nada que segure sozinho.",
        pts: 4, value: "detalhes" },
      { label: "Sendo honesto, o que segura é o preço.",
        desc: "É o principal motivo de quem abastece aqui.",
        pts: 0, value: "preco" },
    ],
  },
  {
    id: "D_M3",
    block: "marca",
    type: "score",
    max: 3,
    tracks: ["dono"],
    text: "O cliente volta pela <em>bandeira</em> do posto ou pelo atendimento da sua equipe?",
    context:
      "Vale saber se o que segura o cliente é a bandeira na fachada ou a relação com o seu time.",
    options: [
      { label: "Pelo atendimento.",
        desc: "A relação é com o meu posto e com o meu time.",
        pts: 3, value: "nos" },
      { label: "Um pouco dos dois.",
        desc: "A bandeira ajuda, mas o atendimento conta.",
        pts: 2, value: "ambos" },
      { label: "Pela bandeira.",
        desc: "Se eu trocasse, perderia cliente.",
        pts: 0, value: "bandeira" },
    ],
  },

  /* --- Comercial e margem (peso 24) --- */
  {
    id: "D_C1",
    block: "comercial",
    type: "score",
    max: 6,
    tracks: ["dono"],
    text: "Você sabe quanto sobra de <em>margem em cada litro</em> que vende?",
    context:
      "Na bomba sobra centavos por litro. Quem não sabe a própria margem está dirigindo no escuro.",
    options: [
      { label: "Sei de cabeça.",
        desc: "Acompanho semana a semana.",
        pts: 6, value: "controla" },
      { label: "Tenho uma noção.",
        desc: "Mas não acompanho com frequência.",
        pts: 3, value: "noção" },
      { label: "Não meço a margem por litro.",
        desc: "Isso não está no meu controle hoje.",
        pts: 0, value: "nao_mede", vague: true },
    ],
  },
  {
    id: "D_C2",
    block: "comercial",
    type: "score",
    max: 6,
    tracks: ["dono"],
    text: "Como você decide o <em>preço da bomba</em> no dia a dia?",
    context:
      "Preço no olho derruba margem sem você perceber. Como você decide o preço da bomba?",
    options: [
      { label: "Tenho método.",
        desc: "Olho custo e margem antes de mexer.",
        pts: 6, value: "metodo" },
      { label: "Sigo o concorrente.",
        desc: "Acompanho o vizinho de perto.",
        pts: 3, value: "concorrente" },
      { label: "Vou no olho.",
        desc: "Ajusto quando sinto que precisa.",
        pts: 0, value: "feeling" },
    ],
  },
  {
    id: "D_C3",
    block: "comercial",
    type: "score",
    max: 4,
    tracks: ["dono"],
    text: "Quanto da sua gasolina vendida é <em>aditivada</em>?",
    context:
      "O aditivado costuma ter a melhor margem da pista. Quanto dele você vende diz quanto de margem você deixa na mesa.",
    options: [
      { label: "Mais da metade.",
        desc: "Trabalho ativamente para crescer isso.",
        pts: 4, value: "alta" },
      { label: "Perto de um terço.",
        desc: "Sem muito esforço para aumentar.",
        pts: 2, value: "media" },
      { label: "Pouca coisa.",
        desc: "Não consigo destravar essa frente.",
        pts: 1, value: "baixa" },
      { label: "Não acompanho esse número.",
        desc: "Não tenho como medir hoje.",
        pts: 0, value: "nao_mede", vague: true },
    ],
  },
  {
    id: "D_C4",
    block: "comercial",
    type: "score",
    max: 4,
    tracks: ["dono"],
    text: "Como é a maioria dos <em>pagamentos</em> no seu posto?",
    context:
      "Depender de cliente a prazo é receita travada e risco de calote. Vale saber como o seu caixa gira.",
    options: [
      { label: "À vista: Pix, cartão ou dinheiro.",
        desc: "O cliente paga na hora.",
        pts: 4, value: "varejo" },
      { label: "Equilibrado entre à vista e prazo.",
        desc: "Mix entre os dois.",
        pts: 2, value: "misto" },
      { label: "Na maior parte a prazo.",
        desc: "Frota e empresas no faturado.",
        pts: 1, value: "prazo" },
    ],
  },

  /* --- Cliente e fidelização (peso 22) --- */
  {
    id: "D_F1",
    block: "fidelizacao",
    type: "score",
    max: 12,
    tracks: ["dono"],
    text: "Hoje, o que você faz para o <em>cliente voltar</em>?",
    context:
      "Com a margem apertada, fazer o mesmo cliente voltar mais vezes é mais barato que brigar no preço. É aqui que o posto ganha ou perde no longo prazo.",
    options: [
      { label: "Tenho um programa de fidelidade de verdade.",
        desc: "Com cadastro e recompensa, e eu acompanho.",
        pts: 12, value: "digital" },
      { label: "Faço algo informal.",
        desc: "No caderno ou na base da relação.",
        pts: 6, value: "informal" },
      { label: "Não faço nada.",
        desc: "Quem volta hoje, volta por conta própria.",
        pts: 0, value: "nada" },
    ],
  },
  {
    id: "D_F2",
    block: "fidelizacao",
    type: "score",
    max: 8,
    tracks: ["dono"],
    text: "Você consegue saber <em>quem são os seus clientes</em>?",
    context:
      "Sem saber quem é o seu cliente, não dá para trazer ele de volta. Esse é o elo que liga tudo.",
    options: [
      { label: "Sim, tenho uma base.",
        desc: "Consigo falar com eles.",
        pts: 8, value: "base" },
      { label: "Conheço alguns de nome ou de vista.",
        desc: "Mas sem base organizada.",
        pts: 4, value: "vista" },
      { label: "Não tenho como saber quem são.",
        desc: "Abastecem e eu não registro.",
        pts: 0, value: "somem" },
    ],
  },
  {
    id: "D_FCHURN",
    block: "fidelizacao",
    type: "score",
    max: 8,
    tracks: ["dono"],
    text: "Você sabe por que o cliente <em>abastece uma vez e some</em>?",
    context:
      "Antes de trazer cliente novo, vale saber por onde você está perdendo o que já passou na sua pista.",
    options: [
      { label: "Sei, e ajo pra trazer ele de volta.",
        desc: "Acompanho quem some.",
        pts: 8, value: "sabe" },
      { label: "Tenho um palpite, mas não tenho certeza.",
        desc: "Não meço isso.",
        pts: 4, value: "palpite" },
      { label: "Não sei.",
        desc: "Ele some e eu nem percebo.",
        pts: 0, value: "nao_sabe", vague: true },
    ],
  },
  {
    id: "D_F3",
    block: "fidelizacao",
    type: "score",
    max: 10,
    tracks: ["dono"],
    text: "E o cliente que volta, você sabe o <em>motivo</em> dele voltar?",
    context:
      "Se o cliente volta só por promoção, ele vai embora na primeira promoção do vizinho. Saber o motivo da volta é saber o quanto você está seguro.",
    options: [
      { label: "Sei.",
        desc: "É o atendimento, a relação e a recompensa.",
        pts: 10, value: "sabe" },
      { label: "Acho que é preço ou promoção.",
        desc: "Não tenho certeza.",
        pts: 5, value: "palpite" },
      { label: "Não sei dizer.",
        desc: "Nunca parei pra entender.",
        pts: 0, value: "nao_sabe", vague: true },
    ],
  },

  /* --- Dados e digital (peso 14) --- */
  {
    id: "D_DA1",
    block: "dados",
    type: "score",
    max: 6,
    tracks: ["dono"],
    text: "Você tem <em>sistema</em> que mostra venda, margem e estoque sem depender de planilha?",
    context:
      "Quem depende de planilha na mão não enxerga margem nem estoque a tempo de decidir.",
    options: [
      { label: "Tenho e uso de verdade.",
        desc: "Tomo decisão a partir do sistema.",
        pts: 6, value: "usa" },
      { label: "Tenho, mas uso pouco.",
        desc: "Não está no meu dia a dia.",
        pts: 3, value: "subusa" },
      { label: "Não tenho.",
        desc: "É tudo no controle manual.",
        pts: 0, value: "manual" },
    ],
  },

  /* --- Resiliência e mercado (peso 10) --- */
  {
    id: "D_R1",
    block: "resiliencia",
    type: "score",
    max: 6,
    tracks: ["dono"],
    text: "Na sua praça, você se vê tendo que <em>baixar o preço</em> pra não perder cliente pro posto vizinho?",
    context:
      "Na guerra de preço entre revendedores a margem some dos dois lados, e o cliente passa a ver o posto como de baixo valor.",
    options: [
      { label: "Quase nunca.",
        desc: "Eu seguro o cliente pelo atendimento e pela fidelização, não pelo centavo.",
        pts: 6, value: "ok" },
      { label: "De vez em quando entro nessa.",
        desc: "E me incomoda.",
        pts: 3, value: "segura" },
      { label: "Vivo nessa guerra.",
        desc: "É centavo contra centavo, e a margem vai embora.",
        pts: 0, value: "aperta" },
    ],
  },
  /* --- Condicionais Dono --- */
  {
    id: "D_C_SERV",
    block: "comercial",
    type: "score",
    max: 4,
    tracks: ["dono"],
    text: "O <em>lava rápido</em> e a troca de óleo deixam margem de verdade no seu resultado?",
    context:
      "Lava rápido e troca de óleo têm margem muito maior que o combustível. Importa quanto deixa de lucro, não quanto fatura.",
    condition: (r) =>
      r.multi("D_PT_MIX").includes("troca_oleo") ||
      r.multi("D_PT_MIX").includes("lava_rapido"),
    options: [
      { label: "Deixam margem boa.",
        desc: "Acompanho de perto.",
        pts: 4, value: "boa" },
      { label: "Ajudam um pouco.",
        desc: "Não é o foco.",
        pts: 2, value: "apoio" },
      { label: "Dão trabalho e sobra pouco.",
        desc: "Resultado financeiro pequeno.",
        pts: 1, value: "fraco" },
    ],
  },
  {
    id: "D_C_LOJA",
    block: "comercial",
    type: "score",
    max: 4,
    tracks: ["dono"],
    text: "A sua <em>loja de conveniência</em> deixa margem de verdade?",
    context:
      "Loja cheia de gente não é o mesmo que loja que dá lucro. O que importa é a margem que ela deixa.",
    condition: (r) => r.multi("D_PT_MIX").includes("conveniencia"),
    options: [
      { label: "Deixa margem boa.",
        desc: "Puxa o resultado do posto.",
        pts: 4, value: "boa" },
      { label: "Empata.",
        desc: "Traz gente, mas lucra pouco.",
        pts: 2, value: "empata" },
      { label: "Dá trabalho e sobra pouco.",
        desc: "Resultado fraco hoje.",
        pts: 0, value: "fraco" },
    ],
  },
  {
    id: "D_PADRAO",
    block: "marca",
    type: "score",
    max: 3,
    tracks: ["dono"],
    text: "Seus postos seguem o <em>mesmo padrão</em> de atendimento e processo?",
    context: "Rede só escala bem quando os postos seguem o mesmo padrão.",
    condition: (r) => {
      const v = r.single("D_PT_POSTOS");
      return v === "2a4" || v === "5mais";
    },
    options: [
      { label: "Sim, padrão único em todos.",
        desc: "Atendimento, processos e visual padronizados.",
        pts: 3, value: "padrao" },
      { label: "São parecidos, cada um com seu jeito.",
        desc: "Há base comum, mas com variações.",
        pts: 1, value: "parecidos" },
      { label: "Cada um roda do seu jeito.",
        desc: "Sem padrão definido entre as unidades.",
        pts: 0, value: "solo" },
    ],
  },
  {
    id: "D_EXPANDIR",
    block: "qualif",
    type: "qualify",
    tracks: ["dono"],
    text: "Você pretende <em>abrir ou assumir</em> mais postos nos próximos 12 meses?",
    context: "Saber o seu plano ajuda a desenhar o próximo passo junto.",
    condition: (r) => {
      const v = r.single("D_PT_POSTOS");
      return v === "2a4" || v === "5mais";
    },
    options: [
      { label: "Sim, tenho plano de crescer.",        desc: "Já estou estruturando.", value: "sim" },
      { label: "Talvez, se aparecer a oportunidade.", desc: "Atento ao mercado.",     value: "talvez" },
      { label: "Não, foco em melhorar o que tenho.",  desc: "Concentrar no atual.",   value: "nao" },
    ],
  },

  /* --- Intenção e fechamento Dono (não pontua) --- */
  {
    id: "D_DOR",
    block: "qualif",
    type: "qualify",
    tracks: ["dono"],
    text: "O que mais <em>tira o seu sono</em> {{no posto|nos seus postos}} hoje?",
    context: "Quero entender o que mais pesa para você agora, para o diagnóstico falar disso primeiro.",
    options: [
      { label: "A margem.",          desc: "O lucro que sobra cada vez menor.",              value: "margem" },
      { label: "O cliente que abastece e não volta.", desc: "Movimento que não vira recorrência.", value: "fidelizar" },
      { label: "A equipe.",          desc: "Gente entrando e saindo, pista no improviso.",   value: "equipe" },
      { label: "A concorrência.",    desc: "O vizinho puxando preço para baixo.",            value: "concorrencia" },
    ],
  },
  {
    id: "D_INTENCAO",
    block: "qualif",
    type: "qualify",
    tracks: ["dono"],
    text: "Se existisse um caminho claro para melhorar os <em>resultados do seu posto</em>, você gostaria de conhecer?",
    context: "Sem compromisso. É só para eu saber se faz sentido seguir com você.",
    options: [
      { label: "Sim, quero conhecer.",           desc: "Estou pronto para começar.",  value: "sim" },
      { label: "Talvez, dependeria do caminho.", desc: "Quero ver antes de decidir.", value: "talvez" },
      { label: "Agora não é o momento.",         desc: "Vou deixar para depois.",     value: "nao" },
    ],
  },
  {
    id: "D_CONHECE",
    block: "qualif",
    type: "qualify",
    tracks: ["dono"],
    text: "Já conhecia o <em>ClubPetro</em> antes deste diagnóstico?",
    context: "Para fechar, me diga o seu ponto de partida com a gente.",
    options: [
      { label: "Já sou cliente.",      desc: "Operação já conectada.",       value: "cliente" },
      { label: "Conheço de nome.",     desc: "Já ouvi falar.",                value: "conhece" },
      { label: "É a primeira vez.",    desc: "Estou descobrindo agora.",      value: "primeira" },
    ],
  },

  /* =========================================================
     TRILHA GERENTE
     ========================================================= */

  /* --- Perfil (não pontua) --- */
  {
    id: "G_PT_TEMPO",
    block: "qualif",
    type: "segmentation-single",
    tracks: ["gerente"],
    text: "Há quanto tempo você <em>toca a operação</em> desse posto?",
    context: "Tempo de casa muda o quanto você enxerga e o quanto ainda está descobrindo.",
    options: [
      { label: "Menos de um ano.",        desc: "Cheguei agora.",       value: "menos1" },
      { label: "Entre um e três anos.",   desc: "Já com bagagem.",       value: "1a3" },
      { label: "Mais de três anos.",      desc: "Operação consolidada.", value: "mais3" },
    ],
  },
  {
    id: "G_PT_EQUIPE",
    block: "qualif",
    type: "segmentation-single",
    tracks: ["gerente"],
    text: "Quantas pessoas na pista <em>respondem a você</em>?",
    context: "O tamanho do time muda o tipo de gestão que faz sentido.",
    options: [
      { label: "Até cinco.",              desc: "Time pequeno.",  value: "ate5" },
      { label: "Entre seis e doze.",      desc: "Time médio.",     value: "6a12" },
      { label: "Mais de doze.",           desc: "Time grande.",    value: "mais12" },
    ],
  },
  {
    id: "G_PT_REDE",
    block: "qualif",
    type: "segmentation-single",
    tracks: ["gerente"],
    text: "Você responde por um posto ou por <em>mais de um</em> da rede?",
    context: "Multi-posto exige outro nível de padronização.",
    options: [
      { label: "Um posto.",        desc: "Toco uma unidade.",   value: "1" },
      { label: "Mais de um posto.", desc: "Respondo por vários.", value: "varios" },
    ],
  },
  {
    id: "G_PT_MIX",
    block: "qualif",
    type: "segmentation-multi",
    tracks: ["gerente"],
    text: "O que {{esse posto oferece|esses postos oferecem}} <em>além do combustível</em>?",
    context: "Marque tudo que o posto já tem, para a gente medir só o que existe.",
    hint: "Marque todas que se aplicam.",
    options: [
      { label: "Loja de conveniência.",            desc: "Loja, conveniência ou lanchonete.",        value: "conveniencia" },
      { label: "Troca de óleo.",                    desc: "Serviço de troca de óleo e filtros.",       value: "troca_oleo" },
      { label: "Lava rápido.",                      desc: "Lavagem de veículos.",                      value: "lava_rapido" },
      { label: "Carregador para carro elétrico.",   desc: "Ponto de recarga elétrica.",                value: "eletrica" },
      { label: "Calibragem e serviços de pista.",   desc: "Calibrador, água, ar e apoio na pista.",    value: "calibragem" },
      { label: "Só combustível por enquanto.",      desc: "Por enquanto só pista.",                    value: "so_pista" },
    ],
  },

  /* --- Pessoas e operação (peso 18) --- */
  {
    id: "G_P1",
    block: "pessoas",
    type: "score",
    max: 3,
    tracks: ["gerente"],
    text: "Como você <em>monta a escala</em> da equipe de pista hoje?",
    context:
      "A escala define quanto o posto gasta e o quanto você fica exposto a uma mudança de regra.",
    options: [
      { label: "Escala estável.",
        desc: "Cubro os horários sem hora extra fora do previsto.",
        pts: 3, value: "ok" },
      { label: "Funciona no aperto.",
        desc: "Vivo cobrindo falta e troca de turno.",
        pts: 1, value: "aperto" },
      { label: "É no improviso.",
        desc: "Fecho como dá.",
        pts: 0, value: "improviso" },
    ],
  },
  {
    id: "G_P2",
    block: "pessoas",
    type: "score",
    max: 4,
    tracks: ["gerente"],
    text: "A PEC do fim da 6x1 está no Senado. Se você precisar dar <em>duas folgas por semana</em>, dá para cobrir a escala com a equipe que você tem?",
    context: "A regra da jornada pode mudar. Vale saber se a equipe cobre.",
    options: [
      { label: "Dá, eu sei quanta gente precisaria.",
        desc: "Tenho a conta feita.",
        pts: 4, value: "pronto" },
      { label: "Daria um aperto, mas eu me viraria.",
        desc: "Não é tranquilo, mas dá pra virar.",
        pts: 2, value: "aperto" },
      { label: "Hoje não teria como cobrir.",
        desc: "Equipe no limite.",
        pts: 1, value: "dificil" },
      { label: "Ainda não pensei nisso.",
        desc: "Não fiz a conta.",
        pts: 0, value: "nao_pensei", vague: true },
    ],
  },
  {
    id: "G_P3",
    block: "pessoas",
    type: "score",
    max: 4,
    tracks: ["gerente"],
    text: "Qual a <em>rotatividade</em> da sua equipe de pista?",
    context:
      "Rotatividade alta dá trabalho: cada frentista novo é treino do zero e atendimento que oscila.",
    options: [
      { label: "Baixa.",
        desc: "A maior parte do time tem mais de um ano de casa.",
        pts: 4, value: "estavel" },
      { label: "Normal.",
        desc: "Troco um ou dois por ano.",
        pts: 2, value: "moderado" },
      { label: "Alta.",
        desc: "A cada poucos meses entra rosto novo, e treinar de novo dá trabalho.",
        pts: 0, value: "trocando" },
    ],
  },
  {
    id: "G_P4",
    block: "pessoas",
    type: "score",
    max: 4,
    tracks: ["gerente"],
    text: "Quando entra alguém novo, como é a <em>integração e o treinamento</em>?",
    context:
      "A forma como você forma a equipe define se o bom atendimento é sorte ou processo.",
    options: [
      { label: "Sigo um processo estruturado.",
        desc: "Treinamento e acompanhamento.",
        pts: 4, value: "processo" },
      { label: "Treinamento básico no começo.",
        desc: "O resto no dia a dia.",
        pts: 2, value: "basico" },
      { label: "A pessoa aprende fazendo.",
        desc: "Sem processo definido.",
        pts: 0, value: "fazendo" },
    ],
  },
  {
    id: "G_P5",
    block: "pessoas",
    type: "score",
    max: 3,
    tracks: ["gerente"],
    text: "A sua equipe tem <em>meta ou parte variável</em> por vender aditivado, lubrificante ou loja?",
    context:
      "Meta clara é o que faz o frentista vender aditivado e lubrificante, que é onde a margem está.",
    options: [
      { label: "Sim, a equipe tem meta clara.",
        desc: "Sabe o que ganha por bater.",
        pts: 3, value: "claro" },
      { label: "Existe algo informal.",
        desc: "Sem regra fixa.",
        pts: 1, value: "informal" },
      { label: "Não, é só o fixo.",
        desc: "Salário sem variável.",
        pts: 0, value: "nao" },
    ],
  },
  {
    id: "G_P6",
    block: "pessoas",
    type: "score",
    max: 2,
    tracks: ["gerente"],
    text: "Como você descreveria o <em>ambiente de trabalho</em> da sua equipe?",
    context: "Ambiente de trabalho puxa atendimento: equipe bem aparece no jeito de receber o cliente.",
    options: [
      { label: "Bom.",
        desc: "As pessoas gostam de estar aqui, e isso aparece no atendimento.",
        pts: 2, value: "bom" },
      { label: "Tem altos e baixos.",
        desc: "Depende da época e da pressão.",
        pts: 1, value: "oscila" },
      { label: "Pesado.",
        desc: "E isso respinga no cliente.",
        pts: 0, value: "ruim" },
    ],
  },
  {
    id: "G_P7",
    block: "pessoas",
    type: "score",
    max: 3,
    tracks: ["gerente"],
    text: "A equipe segue um <em>padrão de atendimento</em> na pista, ou cada um atende do seu jeito?",
    context:
      "Padrão de atendimento separa um posto que tem método de um posto que vai improvisando.",
    options: [
      { label: "Todos seguem o mesmo padrão.",
        desc: "Atendimento consistente.",
        pts: 3, value: "padrao" },
      { label: "Há uma base comum, mas varia bastante.",
        desc: "Padrão informal.",
        pts: 1, value: "parecidos" },
      { label: "Cada um atende do seu jeito.",
        desc: "Sem padrão definido.",
        pts: 0, value: "solo" },
    ],
  },

  /* --- Marca e experiência (peso 12) --- */
  {
    id: "G_M1",
    block: "marca",
    type: "score",
    max: 4,
    tracks: ["gerente"],
    text: "Para quem passa pela primeira vez, o seu posto <em>convida a entrar</em>?",
    context:
      "Quem nunca entrou decide em segundos se vale parar. Olhe como um estranho olharia.",
    options: [
      { label: "Convida.",
        desc: "Limpo, iluminado, equipe sinalizando.",
        pts: 4, value: "convida" },
      { label: "É comum.",
        desc: "Nada que chame nem afaste.",
        pts: 2, value: "comum" },
      { label: "Mais afasta do que atrai.",
        desc: "Tem coisa a ajustar.",
        pts: 0, value: "afasta" },
    ],
  },
  {
    id: "G_M2",
    block: "marca",
    type: "score",
    max: 8,
    tracks: ["gerente"],
    text: "Tirando o preço, qual o motivo do cliente <em>escolher o seu posto</em>?",
    context:
      "Preço como único motivo aperta a margem. Qual o motivo extra que segura o cliente?",
    options: [
      { label: "Tem diferencial claro.",
        desc: "Atendimento que fideliza, lava jato, conveniência boa.",
        pts: 8, value: "diferencial" },
      { label: "Uns detalhes que ajudam.",
        desc: "Calibrador, água, café, banheiro limpo, nada que segure sozinho.",
        pts: 4, value: "detalhes" },
      { label: "O que segura é o preço.",
        desc: "É o principal motivo.",
        pts: 0, value: "preco" },
    ],
  },

  /* --- Comercial e margem (peso 24) --- */
  {
    id: "G_C1",
    block: "comercial",
    type: "score",
    max: 6,
    tracks: ["gerente"],
    text: "Você tem <em>visibilidade da margem</em> por litro do posto?",
    context:
      "Quem não enxerga a margem não consegue cobrar a equipe pelas frentes certas.",
    options: [
      { label: "Sim, acompanho de perto.",
        desc: "Vejo o número.",
        pts: 6, value: "controla" },
      { label: "Tenho uma noção.",
        desc: "Sei mais ou menos.",
        pts: 3, value: "noção" },
      { label: "Não tenho acesso a esse número.",
        desc: "Margem fica com o dono.",
        pts: 0, value: "nao_mede", vague: true },
    ],
  },
  {
    id: "G_C2",
    block: "comercial",
    type: "score",
    max: 4,
    tracks: ["gerente"],
    text: "Quanto da gasolina que vocês vendem é <em>aditivada</em>?",
    context:
      "Aditivado é a frente de margem da pista. O quanto você puxa diz quanto deixa na mesa.",
    options: [
      { label: "Mais da metade.",
        desc: "Eu puxo essa venda na pista.",
        pts: 4, value: "alta" },
      { label: "Perto de um terço.",
        desc: "Sem trabalhar muito.",
        pts: 2, value: "media" },
      { label: "Pouca coisa.",
        desc: "Não destrava.",
        pts: 1, value: "baixa" },
      { label: "Não acompanho.",
        desc: "Sem visibilidade.",
        pts: 0, value: "nao_mede", vague: true },
    ],
  },
  {
    id: "G_C3",
    block: "comercial",
    type: "score",
    max: 4,
    tracks: ["gerente"],
    text: "Como é a maioria dos <em>pagamentos</em> no posto?",
    context:
      "Depender de cliente a prazo trava receita. Vale saber como o caixa do posto gira.",
    options: [
      { label: "À vista: Pix, cartão ou dinheiro.",
        desc: "O cliente paga na hora.",
        pts: 4, value: "varejo" },
      { label: "Equilibrado entre à vista e prazo.",
        desc: "Mix entre os dois.",
        pts: 2, value: "misto" },
      { label: "Na maior parte a prazo.",
        desc: "Frota e empresas no faturado.",
        pts: 1, value: "prazo" },
    ],
  },

  /* --- Cliente e fidelização (peso 22) --- */
  {
    id: "G_F1",
    block: "fidelizacao",
    type: "score",
    max: 12,
    tracks: ["gerente"],
    text: "O que vocês fazem hoje para o <em>cliente voltar</em>?",
    context:
      "Cliente que volta mais vezes é mais barato que disputar movimento novo. É aqui que o posto ganha ou perde.",
    options: [
      { label: "Temos programa de fidelização.",
        desc: "Eu rodo de verdade na pista.",
        pts: 12, value: "digital" },
      { label: "Algo informal.",
        desc: "No caderno ou na relação.",
        pts: 6, value: "informal" },
      { label: "Não fazemos nada.",
        desc: "Quem volta, volta sozinho.",
        pts: 0, value: "nada" },
    ],
  },
  {
    id: "G_F2",
    block: "fidelizacao",
    type: "score",
    max: 8,
    tracks: ["gerente"],
    text: "Você consegue identificar quem são os <em>clientes que voltam</em>?",
    context:
      "Identificação é o que separa fidelização de papel de fidelização real.",
    options: [
      { label: "Sim, temos uma base e eu reconheço.",
        desc: "Sei quem volta.",
        pts: 8, value: "base" },
      { label: "Conheço alguns de vista.",
        desc: "Sem base estruturada.",
        pts: 4, value: "vista" },
      { label: "Abastecem e a gente não sabe quem são.",
        desc: "Sem como saber.",
        pts: 0, value: "somem" },
    ],
  },
  {
    id: "G_FCHURN",
    block: "fidelizacao",
    type: "score",
    max: 8,
    tracks: ["gerente"],
    text: "Você sabe por que o cliente <em>abastece uma vez e some</em>?",
    context:
      "Antes de buscar movimento novo, vale saber por onde o posto está perdendo quem já passou na pista.",
    options: [
      { label: "Sei, e a gente age pra trazer de volta.",
        desc: "Acompanhamos quem some.",
        pts: 8, value: "sabe" },
      { label: "Tenho um palpite.",
        desc: "Sem certeza.",
        pts: 4, value: "palpite" },
      { label: "Não sei.",
        desc: "Ele some e a gente nem percebe.",
        pts: 0, value: "nao_sabe", vague: true },
    ],
  },
  {
    id: "G_F3",
    block: "fidelizacao",
    type: "score",
    max: 10,
    tracks: ["gerente"],
    text: "E o cliente que volta, você sabe o <em>motivo</em> dele voltar?",
    context:
      "Saber o motivo da volta é saber o quanto o posto está seguro contra a concorrência.",
    options: [
      { label: "Sei.",
        desc: "É o atendimento, a relação e a recompensa.",
        pts: 10, value: "sabe" },
      { label: "Acho que é preço ou promoção.",
        desc: "Sem certeza.",
        pts: 5, value: "palpite" },
      { label: "Não sei dizer.",
        desc: "Nunca parei pra entender.",
        pts: 0, value: "nao_sabe", vague: true },
    ],
  },

  /* --- Dados e digital (peso 14) --- */
  {
    id: "G_DA1",
    block: "dados",
    type: "score",
    max: 6,
    tracks: ["gerente"],
    text: "Você usa algum <em>sistema</em> que mostra venda e estoque, ou é tudo na planilha e no caderno?",
    context:
      "Sem sistema na mão, decisão depende do instinto, e isso custa a margem.",
    options: [
      { label: "Uso sistema e tomo decisão por ele.",
        desc: "Sistema vivo no dia a dia.",
        pts: 6, value: "usa" },
      { label: "Tem sistema, mas uso pouco.",
        desc: "Subutilizado.",
        pts: 3, value: "subusa" },
      { label: "É tudo manual.",
        desc: "Planilha e caderno.",
        pts: 0, value: "manual" },
    ],
  },

  /* --- Condicionais Gerente --- */
  {
    id: "G_C_SERV",
    block: "comercial",
    type: "score",
    max: 4,
    tracks: ["gerente"],
    text: "O <em>lava rápido</em> e a troca de óleo rendem de verdade aqui?",
    context:
      "Lava rápido e troca de óleo têm margem maior que o combustível. Importa o quanto deixa de resultado.",
    condition: (r) =>
      r.multi("G_PT_MIX").includes("troca_oleo") ||
      r.multi("G_PT_MIX").includes("lava_rapido"),
    options: [
      { label: "Rendem bem.",
        desc: "É uma frente que a equipe trabalha.",
        pts: 4, value: "boa" },
      { label: "Ajudam um pouco.",
        desc: "Sem foco.",
        pts: 2, value: "apoio" },
      { label: "Dá pouco retorno.",
        desc: "Resultado fraco.",
        pts: 1, value: "fraco" },
      { label: "Quase não trabalhamos isso.",
        desc: "Não opero essa frente.",
        pts: 0, value: "nao" },
    ],
  },
  {
    id: "G_C_LOJA",
    block: "comercial",
    type: "score",
    max: 4,
    tracks: ["gerente"],
    text: "A <em>loja de conveniência</em> puxa resultado?",
    context: "Loja cheia não é loja lucrativa. O que importa é margem.",
    condition: (r) => r.multi("G_PT_MIX").includes("conveniencia"),
    options: [
      { label: "Sim, deixa margem boa.",
        desc: "Puxa o resultado.",
        pts: 4, value: "boa" },
      { label: "Empata.",
        desc: "Traz gente, sem lucrar.",
        pts: 2, value: "empata" },
      { label: "Sobra pouco.",
        desc: "Resultado fraco.",
        pts: 0, value: "fraco" },
    ],
  },

  /* --- Resiliência e mercado (peso 10) --- */
  {
    id: "G_R1",
    block: "resiliencia",
    type: "score",
    max: 6,
    tracks: ["gerente"],
    text: "Na sua praça, vocês se veem tendo que <em>baixar o preço</em> pra não perder cliente pro vizinho?",
    context:
      "Na guerra de preço entre revendedores a margem some dos dois lados, e o posto vira opção de baixo valor.",
    options: [
      { label: "Quase nunca.",
        desc: "A gente segura pelo atendimento e pela fidelização.",
        pts: 6, value: "ok" },
      { label: "De vez em quando entra nessa.",
        desc: "Acontece e incomoda.",
        pts: 3, value: "segura" },
      { label: "Vive nessa guerra.",
        desc: "Centavo contra centavo, e a margem vai embora.",
        pts: 0, value: "aperta" },
    ],
  },

  /* --- Qualificação Gerente (não pontua) --- */
  {
    id: "G_DOR",
    block: "qualif",
    type: "qualify",
    tracks: ["gerente"],
    text: "O que mais <em>tira o seu sono</em> na operação hoje?",
    context: "Quero entender o que mais pesa para você agora, para o diagnóstico falar disso primeiro.",
    options: [
      { label: "Falta de gente.",        desc: "Escala no improviso.",                value: "equipe" },
      { label: "O cliente que abastece e não volta.", desc: "Movimento que não vira recorrência.", value: "fidelizar" },
      { label: "A equipe sem padrão de atendimento.", desc: "Cada um atende do seu jeito.", value: "padrao" },
      { label: "A pressão de preço do vizinho.",     desc: "Concorrência apertando.",     value: "concorrencia" },
    ],
  },
  {
    id: "G_CONHECE",
    block: "qualif",
    type: "qualify",
    tracks: ["gerente"],
    text: "Já conhecia o <em>ClubPetro</em> antes deste diagnóstico?",
    context: "Para fechar, me diga o seu ponto de partida com a gente.",
    options: [
      { label: "Já somos clientes.",   desc: "Operação conectada.",       value: "cliente" },
      { label: "Conheço de nome.",     desc: "Já ouvi falar.",             value: "conhece" },
      { label: "É a primeira vez.",    desc: "Descobrindo agora.",         value: "primeira" },
    ],
  },

  /* =========================================================
     TRILHA FRENTISTA E OUTRO (não gera MQL; pontua só para
     comparação interna)
     ========================================================= */

  /* --- Perfil (não pontua) --- */
  {
    id: "F_PT_TEMPO",
    block: "qualif",
    type: "segmentation-single",
    tracks: ["frentista"],
    text: "Há quanto tempo você <em>trabalha</em> nesse posto?",
    context: "Tempo de casa muda o quanto você vê do posto.",
    options: [
      { label: "Menos de seis meses.",      desc: "Cheguei agora.",         value: "menos6m" },
      { label: "Entre seis meses e dois anos.", desc: "Já com bagagem.",     value: "6ma2a" },
      { label: "Mais de dois anos.",        desc: "Veterano da pista.",      value: "mais2a" },
    ],
  },
  {
    id: "F_PT_AREA",
    block: "qualif",
    type: "segmentation-single",
    tracks: ["frentista"],
    text: "Onde você atua no <em>dia a dia</em>?",
    context: "Cada área da operação enxerga uma parte diferente.",
    options: [
      { label: "Pista.",                       desc: "Atendimento na bomba.", value: "pista" },
      { label: "Loja ou caixa.",               desc: "Atendo no balcão.",     value: "loja" },
      { label: "Troca de óleo ou serviços.",   desc: "Atuo nos serviços.",    value: "servicos" },
      { label: "Outro.",                       desc: "Administrativo ou outro.", value: "outro" },
    ],
  },
  {
    id: "F_PT_TURNO",
    block: "qualif",
    type: "segmentation-single",
    tracks: ["frentista"],
    text: "Quantos <em>colegas</em> trabalham no seu turno?",
    context: "Tamanho do time muda o ritmo do posto.",
    options: [
      { label: "Um ou dois.",          desc: "Time pequeno.", value: "1a2" },
      { label: "Entre três e cinco.",  desc: "Time médio.",   value: "3a5" },
      { label: "Mais de cinco.",       desc: "Time grande.",  value: "mais5" },
    ],
  },
  {
    id: "F_PT_SERVICOS",
    block: "qualif",
    type: "segmentation-multi",
    tracks: ["frentista"],
    text: "O que o posto oferece <em>além do combustível</em>?",
    context: "Marque tudo que tem aqui. Assim eu pergunto só do que existe no seu posto.",
    hint: "Marque todas que se aplicam.",
    options: [
      { label: "Loja de conveniência.",            desc: "Loja, conveniência ou lanchonete.",     value: "conveniencia" },
      { label: "Troca de óleo.",                    desc: "Serviço de troca de óleo e filtros.",    value: "troca_oleo" },
      { label: "Lava rápido.",                      desc: "Lavagem de veículos.",                   value: "lava_rapido" },
      { label: "Carregador para carro elétrico.",   desc: "Ponto de recarga elétrica.",             value: "eletrica" },
      { label: "Calibragem e serviços de pista.",   desc: "Calibrador, água, ar e apoio na pista.", value: "calibragem" },
      { label: "Só combustível por enquanto.",      desc: "Sem serviços extras.",                   value: "so_pista" },
    ],
  },

  /* --- O dia a dia, escala e jornada (pessoas) --- */
  {
    id: "F_P1",
    block: "pessoas",
    type: "score",
    max: 3,
    tracks: ["frentista"],
    text: "A sua <em>escala</em> te dá folga certa, ou vive mudando em cima da hora?",
    context: "Escala que muda toda hora afeta o atendimento e o seu descanso.",
    options: [
      { label: "Folga certa, eu sei meus dias.",
        desc: "Escala estável.",
        pts: 3, value: "ok" },
      { label: "Muda às vezes, mas dá para se organizar.",
        desc: "Sem perder o controle.",
        pts: 1, value: "aperto" },
      { label: "Vive mudando, nunca sei direito.",
        desc: "Escala incerta.",
        pts: 0, value: "improviso" },
    ],
  },
  {
    id: "F_P2",
    block: "pessoas",
    type: "score",
    max: 3,
    tracks: ["frentista"],
    text: "Se a lei mudar e todo mundo passar a ter mais folga, o seu turno vai ter <em>gente suficiente</em>?",
    context: "Mudança de jornada pode apertar o turno.",
    options: [
      { label: "Acho que sim.",
        desc: "Hoje já somos um time bom.",
        pts: 3, value: "pronto" },
      { label: "Ia apertar.",
        desc: "Já falta gente às vezes.",
        pts: 1, value: "aperto" },
      { label: "Não, já vivemos no limite.",
        desc: "Equipe no fio.",
        pts: 0, value: "dificil" },
    ],
  },
  {
    id: "F_P3",
    block: "pessoas",
    type: "score",
    max: 3,
    tracks: ["frentista"],
    text: "No seu posto, <em>gente entra e sai</em> com frequência?",
    context: "Rotatividade afeta o atendimento e a sua rotina.",
    options: [
      { label: "Quase ninguém sai.",
        desc: "O time é o mesmo.",
        pts: 3, value: "estavel" },
      { label: "Sai um ou outro de vez em quando.",
        desc: "Rotatividade normal.",
        pts: 2, value: "moderado" },
      { label: "Vive trocando.",
        desc: "Sempre tem rosto novo.",
        pts: 0, value: "trocando" },
    ],
  },
  {
    id: "F_P4",
    block: "pessoas",
    type: "score",
    max: 3,
    tracks: ["frentista"],
    text: "Quando você entrou, recebeu <em>treinamento de verdade</em>?",
    context: "Treinamento define se o frentista chega seguro ou aprende no susto.",
    options: [
      { label: "Sim, me ensinaram direito.",
        desc: "Antes de soltar na pista.",
        pts: 3, value: "processo" },
      { label: "Mais ou menos.",
        desc: "Aprendi muita coisa fazendo.",
        pts: 1, value: "basico" },
      { label: "Fui aprendendo sozinho.",
        desc: "Sem treinamento estruturado.",
        pts: 0, value: "fazendo" },
    ],
  },
  {
    id: "F_P5",
    block: "pessoas",
    type: "score",
    max: 2,
    tracks: ["frentista"],
    text: "Como é o <em>ambiente de trabalho</em> entre a equipe no dia a dia?",
    context: "Ambiente de pista afeta tudo, do atendimento ao seu humor no fim do turno.",
    options: [
      { label: "Bom.",
        desc: "Eu gosto de trabalhar aqui.",
        pts: 2, value: "bom" },
      { label: "Tem dia bom e dia ruim.",
        desc: "Ambiente oscila.",
        pts: 1, value: "oscila" },
      { label: "Pesado.",
        desc: "Difícil ficar a fim.",
        pts: 0, value: "ruim" },
    ],
  },

  /* --- Metas e reconhecimento --- */
  {
    id: "F_P6",
    block: "pessoas",
    type: "score",
    max: 3,
    tracks: ["frentista"],
    text: "Você ganha alguma coisa a mais quando vende <em>aditivado, óleo ou item da loja</em>?",
    context: "Variável é o que separa bater meta de só cumprir tabela.",
    options: [
      { label: "Sim, tenho meta ou comissão.",
        desc: "Sei quanto ganho a mais.",
        pts: 3, value: "claro" },
      { label: "Às vezes rola um agrado.",
        desc: "Sem ser certo.",
        pts: 1, value: "informal" },
      { label: "Não, ganho o fixo e pronto.",
        desc: "Salário sem variável.",
        pts: 0, value: "nao" },
    ],
  },

  /* --- Marca e atendimento na visão da pista --- */
  {
    id: "F_M1",
    block: "marca",
    type: "score",
    max: 3,
    tracks: ["frentista"],
    text: "Na sua visão, o cliente acha o seu posto <em>bonito e convidativo</em>?",
    context: "Quem está na pista vê como o cliente reage à fachada.",
    options: [
      { label: "Acha.",
        desc: "É limpo e organizado.",
        pts: 3, value: "convida" },
      { label: "É normal.",
        desc: "Nem bonito nem feio.",
        pts: 1, value: "comum" },
      { label: "Tem bastante coisa pra arrumar.",
        desc: "Cliente comenta.",
        pts: 0, value: "afasta" },
    ],
  },
  {
    id: "F_M2",
    block: "marca",
    type: "score",
    max: 3,
    tracks: ["frentista"],
    text: "Tirando o preço, você sabe explicar pro cliente por que <em>vale a pena</em> abastecer aqui?",
    context: "Saber o motivo extra é o que sustenta a venda além do preço.",
    options: [
      { label: "Sei.",
        desc: "Tem motivo claro e eu falo.",
        pts: 3, value: "diferencial" },
      { label: "Sei mais ou menos.",
        desc: "Não domino o argumento.",
        pts: 1, value: "detalhes" },
      { label: "O que segura é o preço.",
        desc: "Sinceramente.",
        pts: 0, value: "preco" },
    ],
  },

  /* --- Fidelização no ponto onde acontece --- */
  {
    id: "F_F1",
    block: "fidelizacao",
    type: "score",
    max: 4,
    tracks: ["frentista"],
    text: "O posto tem <em>programa de fidelidade</em> ou desconto, e você consegue usar com o cliente na pista?",
    context: "Programa que trava na pista não fideliza ninguém.",
    options: [
      { label: "Tem e eu uso com facilidade.",
        desc: "Fluxo simples.",
        pts: 4, value: "digital" },
      { label: "Tem, mas é confuso ou trava.",
        desc: "Quase não uso.",
        pts: 2, value: "informal" },
      { label: "Não tem nada disso.",
        desc: "Sem programa no posto.",
        pts: 0, value: "nada" },
    ],
  },
  {
    id: "F_F2",
    block: "fidelizacao",
    type: "score",
    max: 3,
    tracks: ["frentista"],
    text: "Quando o cliente pergunta de <em>desconto ou pontos</em>, você tem resposta?",
    context: "Quem responde com clareza fideliza ali, na hora.",
    options: [
      { label: "Tenho.",
        desc: "Sei explicar na hora.",
        pts: 3, value: "sabe" },
      { label: "Enrolo um pouco.",
        desc: "Não domino o tema.",
        pts: 1, value: "palpite" },
      { label: "Não sei o que responder.",
        desc: "Sem orientação.",
        pts: 0, value: "nao_sabe" },
    ],
  },
  {
    id: "F_F3",
    block: "fidelizacao",
    type: "score",
    max: 3,
    tracks: ["frentista"],
    text: "O cliente costuma <em>voltar e te reconhecer</em>, ou é sempre rosto novo?",
    context: "Reconhecimento na pista é sinal de fidelização real.",
    options: [
      { label: "Muito cliente fiel.",
        desc: "Conheço vários.",
        pts: 3, value: "maioria" },
      { label: "Tem os fiéis e tem os de passagem.",
        desc: "Mistura.",
        pts: 2, value: "parte" },
      { label: "É quase tudo gente de passagem.",
        desc: "Rosto novo o tempo todo.",
        pts: 0, value: "ninguem" },
    ],
  },

  /* --- Mercado e fechamento --- */
  {
    id: "F_R1",
    block: "resiliencia",
    type: "score",
    max: 2,
    tracks: ["frentista"],
    text: "Já apareceu cliente com <em>carro elétrico</em> querendo carregar no posto?",
    context: "Frota elétrica vai aparecer mais. Vale saber se já bateu na pista.",
    condition: (r) => r.multi("F_PT_SERVICOS").includes("eletrica"),
    options: [
      { label: "Já, e mais de uma vez.",
        desc: "Aconteceu várias vezes.",
        pts: 2, value: "ativo" },
      { label: "Raramente.",
        desc: "Aconteceu, mas pouco.",
        pts: 1, value: "radar" },
      { label: "Nunca vi.",
        desc: "Não foi a minha realidade.",
        pts: 0, value: "fora" },
    ],
  },
  {
    id: "F_RECLAMA",
    block: "qualif",
    type: "open",
    tracks: ["frentista"],
    text: "O que o cliente mais <em>reclama pra você</em>?",
    context: "Quem está na pista escuta o que o dono nem fica sabendo. Pode escrever com as suas palavras.",
    placeholder: "Escreva aqui o que você mais ouve do cliente.",
  },
  {
    id: "F_MELHORIA",
    block: "qualif",
    type: "open",
    tracks: ["frentista"],
    text: "Se você pudesse mudar <em>uma coisa</em> no posto pra facilitar o seu dia, o que seria?",
    context: "Quem trabalha na pista sabe onde aperta primeiro.",
    placeholder: "Escreva a primeira coisa que vem à cabeça.",
  },
  {
    id: "F_SENTE",
    block: "qualif",
    type: "qualify",
    tracks: ["frentista"],
    text: "Como você se sente trabalhando <em>neste posto</em>?",
    context: "Sem certo nem errado. É só pra entender o seu dia.",
    options: [
      { label: "Gosto, me sinto valorizado.",        desc: "Bom lugar pra trabalhar.", value: "gosto" },
      { label: "Tá ok, dá pra levar.",               desc: "Nem bom nem ruim.",        value: "ok" },
      { label: "Cansado, queria que fosse diferente.", desc: "Pesa no dia a dia.",     value: "cansado" },
    ],
  },

  /* --- Condicionais Frentista --- */
  {
    id: "F_C_LOJA",
    block: "comercial",
    type: "score",
    max: 3,
    tracks: ["frentista"],
    text: "Você indica a <em>loja de conveniência</em> pro cliente enquanto abastece?",
    context: "Indicar loja na bomba é o gesto que abre venda extra.",
    condition: (r) => r.multi("F_PT_SERVICOS").includes("conveniencia"),
    options: [
      { label: "Sempre que dá.",
        desc: "Faço questão.",
        pts: 3, value: "sempre" },
      { label: "Às vezes.",
        desc: "Quando lembro.",
        pts: 1, value: "as_vezes" },
      { label: "Quase nunca.",
        desc: "Não tenho hábito.",
        pts: 0, value: "quase_nunca" },
    ],
  },
  {
    id: "F_C_SERV",
    block: "comercial",
    type: "score",
    max: 3,
    tracks: ["frentista"],
    text: "O cliente costuma fazer <em>lava rápido ou troca de óleo</em> aqui no posto?",
    context: "Lava rápido e troca de óleo rendem margem maior que combustível.",
    condition: (r) =>
      r.multi("F_PT_SERVICOS").includes("troca_oleo") ||
      r.multi("F_PT_SERVICOS").includes("lava_rapido"),
    options: [
      { label: "Bastante, é movimentado.",
        desc: "Frente ativa.",
        pts: 3, value: "alta" },
      { label: "De vez em quando.",
        desc: "Movimento médio.",
        pts: 1, value: "media" },
      { label: "Quase nada.",
        desc: "Pouca demanda.",
        pts: 0, value: "baixa" },
    ],
  },
];

/* --- Helpers ------------------------------------------------------------ */

/* Índice id -> pergunta, montado uma vez. getQuestionById é chamado muitas
   vezes por render (engine/sinal), então O(1) evita varrer as ~82 perguntas. */
const QUESTION_BY_ID: Map<string, Question> = new Map(
  QUESTIONS.map((q) => [q.id, q]),
);
export function getQuestionById(id: string): Question | undefined {
  return QUESTION_BY_ID.get(id);
}

/* Ordem de exibição por trilha (S1 entra primeiro em todas).
   Cada item é o id da pergunta na ordem em que aparece ao usuário.
   Condicionais são filtradas em runtime pelo engine. */
export const QUESTION_ORDER_BY_TRACK: Record<TrackId, string[]> = {
  dono: [
    "D_PT_POSTOS", "D_PT_MIX", "D_PT_TEMPO", "D_DOR",
    "D_C1", "D_F1", "D_DA1", "D_R1", "D_C2",
    "D_P1", "D_P2", "D_P3", "D_P4", "D_P5", "D_P6",
    "D_M1", "D_M2", "D_M3",
    "D_C3", "D_C4", "D_C_SERV", "D_C_LOJA",
    "D_F2", "D_FCHURN", "D_F3",
    "D_PADRAO", "D_EXPANDIR",
    "D_CONHECE", "D_INTENCAO",
  ],
  gerente: [
    "G_PT_TEMPO", "G_PT_EQUIPE", "G_PT_REDE", "G_PT_MIX", "G_DOR",
    "G_C1", "G_F1", "G_DA1", "G_M2", "G_C2",
    "G_P1", "G_P2", "G_P3", "G_P4", "G_P5", "G_P6", "G_P7",
    "G_M1",
    "G_C3", "G_C_SERV", "G_C_LOJA",
    "G_F2", "G_FCHURN", "G_F3",
    "G_R1",
    "G_CONHECE",
  ],
  frentista: [
    "F_PT_TEMPO", "F_PT_AREA", "F_PT_TURNO", "F_PT_SERVICOS",
    "F_F1", "F_M2", "F_P3", "F_F3", "F_R1",
    "F_P1", "F_P2", "F_P4", "F_P5", "F_P6",
    "F_M1", "F_F2",
    "F_C_LOJA", "F_C_SERV",
    "F_RECLAMA", "F_MELHORIA", "F_SENTE",
  ],
};

/* Checkpoints de sinal por trilha (5 perguntas score iniciais que
   definem CRÍTICO / NEUTRO / AVANÇADO depois da segmentação).
   Para frentista mantemos os 5 primeiros score para gerar sinal interno,
   mesmo que não vire MQL. */
export const SIGNAL_CHECKPOINT_IDS_BY_TRACK: Record<TrackId, string[]> = {
  dono:     ["D_C1", "D_F1", "D_DA1", "D_R1", "D_C2"],
  gerente:  ["G_C1", "G_F1", "G_DA1", "G_M2", "G_C2"],
  frentista:["F_F1", "F_M2", "F_P3", "F_F3", "F_P1"],
};

/* ID da pergunta de "o que mais incomoda / quer resolver" por trilha.
   Usada para o payload de roteamento comercial. Frentista responde F_MELHORIA,
   que é pergunta aberta (texto): não vira MQL e, por ser texto livre, não
   alimenta o z2 do payload (que só lê respostas de opção). */
export const PAIN_QUESTION_ID_BY_TRACK: Record<TrackId, string> = {
  dono:      "D_DOR",
  gerente:   "G_DOR",
  frentista: "F_MELHORIA",
};

/* ID da pergunta de intenção / prontidão (X3/Y2 equivalentes). Só dono tem. */
export const READINESS_QUESTION_ID_BY_TRACK: Record<TrackId, string | null> = {
  dono:      "D_INTENCAO",
  gerente:   null,
  frentista: null,
};
