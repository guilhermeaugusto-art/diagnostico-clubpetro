/* Banco de perguntas do Diagnóstico de Saúde do Posto (ClubPetro)
   Estrutura segue a Seção 5 da spec.
   Cada pergunta tem: id, frente, tipo (score/segmentation/qualify), peso,
   contexto, enunciado, opções e (opcional) condição de exibição.
   Copy obedece à Seção 1: sem travessão, sem emoji, sem nome de bandeira.
*/

import type { BlockId } from "./blocks";

/* --- Tipos auxiliares ---------------------------------------------------- */

export type QuestionType =
  | "segmentation-single"
  | "segmentation-multi"
  | "score"
  | "qualify";

export interface ScoreOption {
  label: string;       // texto curto do card
  desc: string;        // descrição complementar
  pts: number;         // pontos atribuídos
  value?: string;      // identificador estável (snake_case)
  vague?: boolean;     // marca lacuna ("não sei", "não acompanho", "nunca olhei")
}

export interface NoScoreOption {
  label: string;
  desc: string;
  value: string;       // identificador estável
}

interface BaseQuestion {
  id: string;
  block: BlockId | "qualif";
  text: string;        // enunciado, pode conter <em>
  context: string;     // frase de contexto exibida acima
  condition?: ConditionFn; // se ausente, sempre aparece
}

export interface SegmentationSingleQuestion extends BaseQuestion {
  type: "segmentation-single";
  options: NoScoreOption[];
}
export interface SegmentationMultiQuestion extends BaseQuestion {
  type: "segmentation-multi";
  options: NoScoreOption[];
  hint?: string; // "marque todas que se aplicam"
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

export type Question =
  | SegmentationSingleQuestion
  | SegmentationMultiQuestion
  | ScoreQuestion
  | QualifyQuestion;

/* Condição: recebe um leitor de respostas, retorna true se a pergunta
   deve ser apresentada. Não-puro propositalmente (leitor injetado). */
export type ConditionFn = (read: ReadAnswers) => boolean;

export interface ReadAnswers {
  single: (id: string) => string | null;          // resposta de single-choice
  multi: (id: string) => string[];                // resposta de multi
  score: (id: string) => { value?: string; pts?: number } | null;
  signal: () => "critico" | "neutro" | "avancado" | null;
}

/* --- Banco --------------------------------------------------------------- */

export const QUESTIONS: Question[] = [
  /* ============== SEGMENTAÇÃO (não pontua) ============== */
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
        desc: "Não sou dono nem gerente, atuo em outra frente.",
        value: "outro" },
    ],
  },
  {
    id: "S2",
    block: "qualif",
    type: "segmentation-single",
    text: "Quantos <em>postos</em> você toca hoje?",
    context: "O tamanho da sua operação muda o que faz sentido medir.",
    options: [
      { label: "Apenas um.",         desc: "Toco um posto.",              value: "1" },
      { label: "Entre dois e quatro.", desc: "Tenho rede pequena.",       value: "2a4" },
      { label: "Cinco ou mais.",     desc: "Tenho rede maior.",           value: "5mais" },
    ],
  },
  {
    id: "S3",
    block: "qualif",
    type: "segmentation-multi",
    text: "O que o seu posto tem hoje, <em>além da pista</em>?",
    context:
      "Marque o que o seu posto já oferece, para a gente medir só o que existe.",
    hint: "Marque todas que se aplicam.",
    options: [
      { label: "Loja de conveniência.",          desc: "Tenho loja no posto.",                   value: "loja" },
      { label: "Troca de óleo ou serviços.",     desc: "Faço troca de óleo, lubrificação ou serviços de pista.", value: "servicos" },
      { label: "Lavanderia ou outros serviços.", desc: "Tenho serviços adicionais como lavanderia ou similar.", value: "outros_servicos" },
      { label: "Só a pista de combustível.",     desc: "Por enquanto só a pista.",               value: "so_pista" },
    ],
  },

  /* ============== PRIORITÁRIAS para SINAL (as 5 primeiras pontuadas) ====== */

  /* C1, dimensão Comercial, 6 pts */
  {
    id: "C1",
    block: "comercial",
    type: "score",
    max: 6,
    text: "Você sabe quanto sobra de <em>margem em cada litro</em> que vende?",
    context:
      "Na bomba sobra centavos por litro. Quem não sabe a própria margem está dirigindo no escuro.",
    options: [
      { label: "Sei de cabeça.",            desc: "Acompanho de perto, semana a semana.",    pts: 6, value: "controla" },
      { label: "Tenho uma noção.",          desc: "Sei mais ou menos, mas não acompanho com frequência.", pts: 3, value: "noção" },
      { label: "Não meço a margem por litro.", desc: "Isso não está no meu controle hoje.",  pts: 0, value: "nao_mede", vague: true },
    ],
  },
  /* F1, dimensão Fidelização, 12 pts (maior peso individual) */
  {
    id: "F1",
    block: "fidelizacao",
    type: "score",
    max: 12,
    text: "Hoje, o que você faz para o <em>cliente voltar</em>?",
    context:
      "Com a margem apertada, fazer o mesmo cliente voltar mais vezes é mais barato que brigar no preço. É aqui que o posto ganha ou perde no longo prazo.",
    options: [
      { label: "Tenho programa de fidelização digital.",
        desc: "Acompanho e uso de verdade.",
        pts: 12, value: "digital" },
      { label: "Faço algo informal.",
        desc: "No caderno ou na base da relação.",
        pts: 6, value: "informal" },
      { label: "Não faço nada para o cliente voltar.",
        desc: "Hoje quem volta, volta por conta própria.",
        pts: 0, value: "nada" },
    ],
  },
  /* D1, dimensão Dados, 8 pts */
  {
    id: "D1",
    block: "dados",
    type: "score",
    max: 8,
    text: "Você consegue saber <em>quem são os seus clientes</em>, ou eles abastecem e somem?",
    context:
      "Sem saber quem é o seu cliente, não dá para trazer ele de volta. Esse é o elo que liga tudo.",
    options: [
      { label: "Tenho uma base de clientes.",
        desc: "Consigo falar com eles.",
        pts: 8, value: "base" },
      { label: "Conheço alguns de vista ou de nome.",
        desc: "Mas não tenho base estruturada.",
        pts: 4, value: "vista" },
      { label: "Abastecem e somem.",
        desc: "Não tenho como saber quem são.",
        pts: 0, value: "somem" },
    ],
  },
  /* R1, dimensão Resiliência, 6 pts */
  {
    id: "R1",
    block: "resiliencia",
    type: "score",
    max: 6,
    text: "Tem concorrente na sua praça vendendo a um <em>preço que não fecha</em> para ninguém honesto?",
    context:
      "O posto honesto disputa com quem vende a um preço que não fecha a conta. Dá para perder cliente para o irregular sem perceber.",
    options: [
      { label: "Não tenho esse problema na minha região.",
        desc: "Concorrência funciona dentro do esperado.",
        pts: 6, value: "ok" },
      { label: "Tem, mas eu seguro sem entrar na guerra de preço.",
        desc: "Resisto pela relação e pelo serviço.",
        pts: 3, value: "segura" },
      { label: "Tem, e isso me aperta de verdade.",
        desc: "Sinto perda de movimento por causa disso.",
        pts: 0, value: "aperta" },
    ],
  },
  /* C4, dimensão Comercial, 6 pts */
  {
    id: "C4",
    block: "comercial",
    type: "score",
    max: 6,
    text: "Como você define o <em>preço da bomba</em> no dia a dia?",
    context:
      "Preço no feeling derruba margem sem você perceber. Como você decide o preço da bomba?",
    options: [
      { label: "Tenho método.",
        desc: "Olho custo e margem antes de definir.",
        pts: 6, value: "metodo" },
      { label: "Olho o concorrente.",
        desc: "Acompanho ele de perto.",
        pts: 3, value: "concorrente" },
      { label: "Vou no feeling.",
        desc: "Ajusto quando sinto que precisa.",
        pts: 0, value: "feeling" },
    ],
  },

  /* ============== APROFUNDAMENTO CRÍTICO (abre por sinal) ============== */
  /* X1 pontua, X2 e X3 qualificam */
  {
    id: "X1",
    block: "resiliencia",
    type: "score",
    max: 4,
    text: "Se o movimento cair por dois ou três meses, o <em>caixa do posto</em> aguenta?",
    context:
      "Margem apertada com pouco caixa é uma combinação perigosa. Vale medir o seu fôlego.",
    condition: (r) => r.signal() === "critico",
    options: [
      { label: "Aguento, tenho fôlego.",
        desc: "Capital de giro está em ordem.",
        pts: 4, value: "folego" },
      { label: "Seguraria, mas com aperto.",
        desc: "Dá para virar, sem conforto.",
        pts: 2, value: "aperto" },
      { label: "Não aguentaria muito tempo.",
        desc: "O caixa não tem essa reserva.",
        pts: 0, value: "curto" },
    ],
  },
  {
    id: "X2",
    block: "qualif",
    type: "qualify",
    text: "O que mais <em>tira o seu sono</em> no posto hoje?",
    context: "Quero entender o que mais pesa para você agora.",
    condition: (r) => r.signal() === "critico",
    options: [
      { label: "Margem e lucro.",       desc: "Conta que não fecha.",        value: "margem" },
      { label: "Cliente que não volta.", desc: "Movimento que não cresce.",   value: "cliente" },
      { label: "Equipe e operação.",    desc: "Falta gente, sobra incêndio.", value: "equipe" },
      { label: "Concorrência e preço.", desc: "Pressão de quem vende abaixo.", value: "concorrencia" },
    ],
  },
  {
    id: "X3",
    block: "qualif",
    type: "qualify",
    text: "Se existisse um caminho claro, você toparia <em>testar nos próximos 30 dias</em>?",
    context: "Se houver um caminho claro para resolver isso, vale saber o seu apetite.",
    condition: (r) => r.signal() === "critico",
    options: [
      { label: "Sim, quero resolver isso logo.", desc: "Estou pronto para começar.", value: "sim" },
      { label: "Talvez, dependeria do caminho.", desc: "Quero ver a proposta antes.", value: "talvez" },
      { label: "Agora não é o momento.",         desc: "Vou deixar para depois.",    value: "nao" },
    ],
  },

  /* ============== APROFUNDAMENTO AVANÇADO (abre por sinal) ============== */
  /* Y1 só aparece se S2 >= 2 postos; Y2 e Y3 qualificam */
  {
    id: "Y1",
    block: "pessoas",
    type: "score",
    max: 3,
    text: "Seus postos seguem o <em>mesmo padrão</em> de atendimento e processo?",
    context: "Rede só escala bem quando os postos seguem o mesmo padrão.",
    condition: (r) =>
      r.signal() === "avancado" &&
      (r.single("S2") === "2a4" || r.single("S2") === "5mais"),
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
    id: "Y2",
    block: "qualif",
    type: "qualify",
    text: "Você pretende <em>abrir ou assumir</em> mais postos nos próximos 12 meses?",
    context: "Saber o seu plano ajuda a desenhar o próximo passo junto.",
    condition: (r) => r.signal() === "avancado",
    options: [
      { label: "Sim, tenho plano de crescer.",        desc: "Já estou estruturando.", value: "sim" },
      { label: "Talvez, se aparecer a oportunidade.", desc: "Atento ao mercado.",     value: "talvez" },
      { label: "Não, foco em melhorar o que tenho.",  desc: "Concentrar no atual.",   value: "nao" },
    ],
  },
  {
    id: "Y3",
    block: "qualif",
    type: "qualify",
    text: "Onde o <em>crescimento</em> do seu posto mais trava hoje?",
    context: "Mesmo um posto saudável tem um ponto que trava o próximo degrau.",
    condition: (r) => r.signal() === "avancado",
    options: [
      { label: "Falta dado fino do cliente.", desc: "Não enxergo a base.",       value: "dado" },
      { label: "Margem que não cresce.",      desc: "Preciso destravar lucro.",  value: "margem" },
      { label: "Equipe e padronização.",      desc: "Gente é o gargalo.",         value: "equipe" },
      { label: "Estrutura e investimento.",    desc: "Falta capital para o passo.", value: "estrutura" },
    ],
  },

  /* ============== PESSOAS E OPERAÇÃO (peso 18) ============== */
  {
    id: "P1",
    block: "pessoas",
    type: "score",
    max: 3,
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
    id: "P2",
    block: "pessoas",
    type: "score",
    max: 4,
    text: "Se a <em>jornada mudar</em> e exigir mais folgas, o seu posto aguenta?",
    context:
      "A regra da jornada de trabalho pode mudar e passar a exigir mais folgas. Quem se preparar antes sofre menos no caixa.",
    options: [
      { label: "Já estou preparado.",
        desc: "Sei quanta gente precisaria e o custo disso.",
        pts: 4, value: "pronto" },
      { label: "Daria um aperto.",
        desc: "Mas eu me viraria.",
        pts: 2, value: "aperto" },
      { label: "Hoje não teria como cobrir.",
        desc: "Falta gente e custo para isso.",
        pts: 1, value: "dificil" },
      { label: "Não parei para pensar nisso.",
        desc: "Ainda não calculei o impacto.",
        pts: 0, value: "nao_pensei", vague: true },
    ],
  },
  {
    id: "P3",
    block: "pessoas",
    type: "score",
    max: 4,
    text: "Com que frequência você precisa <em>repor gente</em> na pista?",
    context:
      "Frentista que entra e sai toda hora custa caro e derruba o atendimento que faz o cliente voltar.",
    options: [
      { label: "Equipe estável.",
        desc: "A maioria está comigo há mais de um ano.",
        pts: 4, value: "estavel" },
      { label: "Troco algumas vezes ao ano.",
        desc: "Dentro do normal.",
        pts: 2, value: "moderado" },
      { label: "Vivo trocando.",
        desc: "Mal treino um e já sai outro.",
        pts: 0, value: "trocando" },
    ],
  },
  {
    id: "P4",
    block: "pessoas",
    type: "score",
    max: 4,
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
    id: "P5",
    block: "pessoas",
    type: "score",
    max: 3,
    text: "A sua equipe ganha <em>parte variável</em> por vender aditivado, lubrificante ou itens da loja?",
    context:
      "Comissão bem desenhada é o que faz o frentista vender aditivado e lubrificante, que é onde a margem está.",
    options: [
      { label: "Plano de comissão claro.",
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
    id: "P6",
    block: "pessoas",
    type: "score",
    max: 2,
    text: "Como você descreveria o <em>clima da sua equipe</em> hoje?",
    context:
      "Quando a equipe não para em pé, vale entender o ambiente que faz a pessoa querer ficar ou sair.",
    condition: (r) => r.score("P3")?.value === "trocando",
    options: [
      { label: "A equipe gosta de trabalhar aqui.",
        desc: "Sinto isso no dia a dia.",
        pts: 2, value: "bom" },
      { label: "Tem altos e baixos.",
        desc: "Depende da época.",
        pts: 1, value: "oscila" },
      { label: "Clima pesado.",
        desc: "Isso atrapalha o resultado.",
        pts: 0, value: "ruim" },
    ],
  },

  /* ============== MARCA E EXPERIÊNCIA (peso 12) ============== */
  {
    id: "M1",
    block: "marca",
    type: "score",
    max: 4,
    text: "Olhando o seu posto de longe, como quem passa pela primeira vez, <em>o que essa pessoa vê</em>?",
    context:
      "Quem nunca entrou no seu posto decide em segundos se vale parar. Pare a 200 metros e olhe como um estranho olharia.",
    options: [
      { label: "Posto que convida.",
        desc: "Limpo, iluminado, equipe sinalizando para entrar.",
        pts: 4, value: "convida" },
      { label: "Posto comum.",
        desc: "Nada que chame nem afaste.",
        pts: 2, value: "comum" },
      { label: "Algo que mais afasta do que atrai.",
        desc: "Sinceramente, tem coisa a ajustar.",
        pts: 0, value: "afasta" },
      { label: "Nunca parei para olhar assim.",
        desc: "Não fiz esse exercício.",
        pts: 0, value: "nao_olhei", vague: true },
    ],
  },
  {
    id: "M2",
    block: "marca",
    type: "score",
    max: 8,
    text: "Tirando o preço, por que um cliente <em>escolheria o seu posto</em>?",
    context:
      "Preço não pode ser o seu único diferencial, senão a conta não fecha. O que faz o cliente escolher você por outro motivo?",
    options: [
      { label: "Tenho diferencial claro.",
        desc: "Serviços, conveniência ou atendimento que o cliente reconhece.",
        pts: 8, value: "diferencial" },
      { label: "Tenho alguns detalhes a mais.",
        desc: "Nada que eu chamaria de diferencial.",
        pts: 4, value: "detalhes" },
      { label: "O que segura é o preço.",
        desc: "Sendo honesto, é o principal motivo.",
        pts: 0, value: "preco" },
    ],
  },
  {
    id: "M3",
    block: "marca",
    type: "score",
    max: 3,
    text: "O cliente volta mais pela <em>bandeira</em> do posto ou por você e pelo seu time?",
    context:
      "Vale saber se o cliente é fiel ao posto por causa da bandeira ou por causa de você e da sua equipe.",
    /* opcional na spec: vamos exibir sempre que M2 não for "preco" para extrair sinal de relacionamento.
       Quando M2 for "preco", já temos o sinal e M3 fica de fora. */
    condition: (r) => r.score("M2")?.value !== "preco",
    options: [
      { label: "Por nós.",
        desc: "A relação é com o posto e com a equipe.",
        pts: 3, value: "nos" },
      { label: "Um pouco dos dois.",
        desc: "Bandeira ajuda, mas a relação conta.",
        pts: 2, value: "ambos" },
      { label: "Pela bandeira.",
        desc: "Se eu trocasse, perderia cliente.",
        pts: 0, value: "bandeira" },
    ],
  },

  /* ============== COMERCIAL E MARGEM, complementares (C2, C3, C5, C6, C7) === */
  {
    id: "C2",
    block: "comercial",
    type: "score",
    max: 4,
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
    id: "C3",
    block: "comercial",
    type: "score",
    max: 4,
    text: "Troca de óleo e lubrificantes deixam <em>margem de verdade</em> no seu resultado?",
    context:
      "Troca de óleo e lubrificante têm margem muito maior que o combustível. Importa quanto isso deixa de lucro, não quanto fatura.",
    /* Aprofunda se S3 marcou troca de óleo. Quando não marcou, mantém versão geral. */
    options: [
      { label: "Deixam margem boa.",
        desc: "Acompanho esse resultado de perto.",
        pts: 4, value: "boa" },
      { label: "Ajudam um pouco.",
        desc: "Não é foco do meu posto.",
        pts: 2, value: "apoio" },
      { label: "Trabalho, mas dá pouco retorno.",
        desc: "O resultado financeiro é pequeno.",
        pts: 1, value: "fraco" },
      { label: "Quase não trabalho com isso.",
        desc: "Não opero essa frente hoje.",
        pts: 0, value: "nao" },
    ],
  },
  {
    id: "C5",
    block: "comercial",
    type: "score",
    max: 4,
    text: "Quem pesa mais: o <em>consumidor que paga na hora</em> ou o cliente a prazo?",
    context:
      "Depender de cliente a prazo é receita travada e risco de calote. Vale saber quem move o seu caixa.",
    options: [
      { label: "Quase tudo é consumidor que paga na hora.",
        desc: "Caixa gira no varejo.",
        pts: 4, value: "varejo" },
      { label: "É equilibrado entre os dois.",
        desc: "Mix entre varejo e a prazo.",
        pts: 2, value: "misto" },
      { label: "A maioria é cliente a prazo.",
        desc: "Frota e empresas seguram o caixa.",
        pts: 1, value: "prazo" },
    ],
  },
  {
    id: "C6",
    block: "comercial",
    type: "score",
    max: 4,
    text: "O quanto o seu caixa depende de <em>poucos clientes a prazo</em>?",
    context:
      "Faturado concentrado é risco. Se um grande cliente atrasa ou sai, o caixa sente na hora.",
    condition: (r) => r.score("C5")?.value === "prazo",
    options: [
      { label: "Tenho faturado, mas pulverizado.",
        desc: "Nenhum cliente sozinho me derruba.",
        pts: 4, value: "diluido" },
      { label: "Alguns clientes grandes pesam bastante.",
        desc: "Há concentração relevante.",
        pts: 2, value: "concentrado" },
      { label: "Dependo muito de um ou dois clientes.",
        desc: "Se um sair, o caixa sente.",
        pts: 0, value: "refem" },
    ],
  },
  {
    id: "C7",
    block: "comercial",
    type: "score",
    max: 4,
    text: "A sua <em>loja de conveniência</em> deixa margem de verdade?",
    context:
      "Loja cheia de gente não é o mesmo que loja que dá lucro. O que importa é a margem que ela deixa.",
    condition: (r) => r.multi("S3").includes("loja"),
    options: [
      { label: "Deixa margem boa.",
        desc: "Puxa o resultado do posto.",
        pts: 4, value: "boa" },
      { label: "Empata.",
        desc: "Traz gente, mas não lucra muito.",
        pts: 2, value: "empata" },
      { label: "Dá trabalho e sobra pouco.",
        desc: "Resultado fraco hoje.",
        pts: 0, value: "fraco" },
    ],
  },

  /* ============== CLIENTE E FIDELIZAÇÃO complementares (F2, F3) ========= */
  {
    id: "F2",
    block: "fidelizacao",
    type: "score",
    max: 10,
    text: "Você sabe <em>por que</em> o cliente que volta, volta?",
    context:
      "Se o cliente volta só por promoção, ele vai embora na primeira promoção do concorrente. Saber o motivo da volta é saber o quanto você está seguro.",
    options: [
      { label: "Sei o motivo.",
        desc: "Uso isso a meu favor, é relação e experiência.",
        pts: 10, value: "sabe" },
      { label: "Tenho um palpite.",
        desc: "Mas não tenho certeza.",
        pts: 5, value: "palpite" },
      { label: "Não sei dizer.",
        desc: "Acho que é preço ou promoção.",
        pts: 0, value: "nao_sabe", vague: true },
    ],
  },
  {
    id: "F3",
    block: "fidelizacao",
    type: "score",
    max: 6,
    text: "No seu programa, quantos clientes você <em>consegue identificar</em> quando abastecem?",
    context:
      "Ter programa é uma coisa, usar é outra. O que vale é quantos clientes você realmente reconhece a cada abastecida.",
    condition: (r) => r.score("F1")?.value === "digital",
    options: [
      { label: "A maioria.",
        desc: "Sei quem está na pista.",
        pts: 6, value: "maioria" },
      { label: "Uma parte.",
        desc: "Ainda é pouco.",
        pts: 3, value: "parte" },
      { label: "Quase ninguém.",
        desc: "O programa existe, mas quase não roda.",
        pts: 0, value: "ninguem" },
    ],
  },

  /* ============== DADOS E DIGITAL complementares (D2, D3) ============== */
  {
    id: "D2",
    block: "dados",
    type: "score",
    max: 6,
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
  {
    id: "D3",
    block: "dados",
    type: "score",
    max: 4,
    text: "As suas <em>taxas de cartão</em> e a fatia de Pix estão sob controle?",
    context:
      "Taxa de cartão alta e Pix mal aproveitado comem margem todo mês, em silêncio.",
    condition: (r) =>
      r.score("D1")?.value === "base" || r.score("D2")?.value === "usa",
    options: [
      { label: "Acompanho de perto.",
        desc: "Negocio as minhas taxas.",
        pts: 4, value: "controla" },
      { label: "Mais ou menos.",
        desc: "Sei que dá para melhorar.",
        pts: 2, value: "parcial" },
      { label: "Nunca parei para olhar isso.",
        desc: "Não acompanho esse custo.",
        pts: 0, value: "nao_olhou", vague: true },
    ],
  },

  /* ============== RESILIÊNCIA E MERCADO complementares (R3, R2) ======== */
  {
    id: "R3",
    block: "resiliencia",
    type: "score",
    max: 4,
    text: "<em>Qualidade do combustível</em> e conformidade com a ANP tiram o seu sono?",
    context:
      "Com a gasolina E30 e a fiscalização mais dura, qualidade e conformidade viraram risco real, não detalhe.",
    options: [
      { label: "Tenho tudo em dia.",
        desc: "Não me preocupo com isso.",
        pts: 4, value: "ok" },
      { label: "Cuido, mas dá trabalho acompanhar.",
        desc: "Demanda atenção constante.",
        pts: 2, value: "atencao" },
      { label: "Isso me preocupa.",
        desc: "Confesso que é um ponto sensível.",
        pts: 0, value: "preocupa" },
    ],
  },
  {
    id: "R2",
    block: "resiliencia",
    type: "score",
    max: 3,
    text: "Recarga de <em>carro elétrico</em> já passou pela sua cabeça como serviço?",
    context:
      "A frota elétrica cresce. Recarga pode virar serviço e atrair um cliente novo para o ponto.",
    /* condicional de mercado: aparece quando o posto demonstra alguma maturidade
       (cliente premium ou base de dados, sinal não crítico). */
    condition: (r) =>
      r.signal() !== "critico" &&
      (r.score("D1")?.value === "base" || r.score("M2")?.value === "diferencial"),
    options: [
      { label: "Já estudo ou já tenho recarga.",
        desc: "Está no meu planejamento atual.",
        pts: 3, value: "ativo" },
      { label: "Está no meu radar.",
        desc: "Para os próximos anos.",
        pts: 2, value: "radar" },
      { label: "Não é a minha realidade hoje.",
        desc: "Não vejo encaixe agora.",
        pts: 0, value: "fora" },
    ],
  },

  /* ============== QUALIFICAÇÃO FINAL (não pontua) ============== */
  {
    id: "Z1",
    block: "qualif",
    type: "qualify",
    text: "Você já <em>conhecia o ClubPetro</em> antes deste diagnóstico?",
    context: "Para fechar, me diga o seu ponto de partida com a gente.",
    options: [
      { label: "Já sou cliente.",      desc: "Operação já conectada.",       value: "cliente" },
      { label: "Conheço de nome.",     desc: "Já ouvi falar.",                value: "conhece" },
      { label: "É a primeira vez.",    desc: "Estou descobrindo agora.",      value: "primeira" },
    ],
  },
  {
    id: "Z2",
    block: "qualif",
    type: "qualify",
    text: "O que você mais quer <em>resolver primeiro</em>?",
    context:
      "Se desse para resolver uma coisa no seu posto agora, por onde você começaria?",
    options: [
      { label: "Margem e lucro.",          desc: "Conta do posto fechando melhor.", value: "margem" },
      { label: "Equipe e atendimento.",    desc: "Time funcionando como motor.",    value: "equipe" },
      { label: "Fidelizar e reter cliente.", desc: "Cliente voltando mais vezes.",  value: "fidelizar" },
      { label: "Loja e serviços.",         desc: "Receita além da bomba.",         value: "loja" },
      { label: "Dados e gestão.",          desc: "Decisão saindo do escuro.",      value: "dados" },
    ],
  },
];

/* --- Helpers ------------------------------------------------------------- */

export const SIGNAL_CHECKPOINT_IDS = ["C1", "F1", "D1", "R1", "C4"] as const;

export function getQuestionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

/* Lista padrão de IDs do questionário, na ordem em que aparecem ao usuário.
   A ordem coloca as 5 pontuadas do sinal logo após a segmentação,
   depois os aprofundamentos (que filtram pela condition),
   depois o restante das pontuadas e por fim a qualificação. */
export const QUESTION_ORDER: string[] = [
  "S1", "S2", "S3",
  ...SIGNAL_CHECKPOINT_IDS,
  "X1", "X2", "X3",
  "Y1", "Y2", "Y3",
  "P1", "P2", "P3", "P6", "P4", "P5",
  "M1", "M2", "M3",
  "C2", "C3", "C5", "C6", "C7",
  "F2", "F3",
  "D2", "D3",
  "R3", "R2",
  "Z1", "Z2",
];
