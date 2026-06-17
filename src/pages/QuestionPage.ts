import { BLOCKS } from "../data/blocks";
import type { Question } from "../data/questions";
import { AnswerCard } from "../components/AnswerCard";
import { Button } from "../components/Button";
import { escHtml, pad2, applyForms } from "../lib/format";
import type { AnyIcon } from "../lib/renderIcon";

interface QuestionPageProps {
  question: Question;
  currentIndex: number;
  totalSteps: number;
  selectedIndex?: number;       // para single / score / qualify
  selectedIndexes?: number[];   // para segmentation-multi
  openText?: string;            // para perguntas type: "open"
  plural?: boolean;             // dois ou mais postos: liga o plural no texto
  barsHtml?: string;            // gráfico de barras por pilar (durante as respostas)
  videoSide?: "left" | "right";        // trilha com vídeo: lado do painel (desktop)
  videoBlock?: number;                 // índice do bloco de vídeo, para a máscara por cena
  videoTrack?: "frentista" | "gerente"; // trilha do vídeo, para casar o creme do fundo
  imageSide?: "left" | "right";        // trilha do dono (imagem em blocos): lado do painel
}

/* Envolve o conteúdo da pergunta no palco. Na trilha do frentista, monta o
   layout em duas colunas com o slot do vídeo (preenchido pelo controlador, que
   re-anexa o vídeo persistente). Sem vídeo, mantém o palco simples de sempre. */
function frameStage(inner: string, p: QuestionPageProps): string {
  if (p.videoSide) {
    return `
    <div class="shell stage">
      <div class="q-stage q-stage-${p.videoSide}">
        <div class="fvideo-panel" id="fvideoMount" data-fb="${p.videoBlock ?? 0}" data-track="${p.videoTrack ?? "frentista"}" aria-hidden="true"></div>
        ${inner}
      </div>
    </div>
  `;
  }
  if (p.imageSide) {
    return `
    <div class="shell stage">
      <div class="q-stage q-stage-${p.imageSide}">
        <div class="fimg-panel" id="fimgMount" aria-hidden="true"></div>
        ${inner}
      </div>
    </div>
  `;
  }
  return `
    <div class="shell stage">
      ${inner}
    </div>
  `;
}

/* Ícone padrão por bloco como fallback final. Usa PNG flat colorido. */
const ICONS_BY_BLOCK: Record<string, AnyIcon> = {
  pessoas:     "asset:frentista",
  marca:       "asset:marca",
  comercial:   "asset:margem",
  fidelizacao: "asset:coracao",
  dados:       "asset:dados-analise",
  resiliencia: "asset:escudo",
  qualif:      "asset:alvo",
};

/* Mapa direto por VALUE de cada opção, escolhido pelo SIGNIFICADO da resposta
   (não pelo bloco). Usa só os PNGs disponíveis em /public/icons. As opções de
   uma mesma pergunta caem em ícones distintos (bom / meio / ruim), e o
   diversifyIcons resolve eventuais empates. */
const VALUE_ICON: Record<string, AnyIcon> = {
  // === S1 · quem responde ===
  dono:       "asset:apresentacao",   // dono estrategista (liderança)
  gerente:    "asset:executivo",      // gestor formal
  outro:      "asset:outro",          // outro papel (atendente generico)

  // === Porte da rede / nº de postos ===
  "1":        "asset:bomba",          // um posto
  "2a4":      "asset:posto",          // rede pequena
  "5mais":    "asset:crescimento",    // rede maior
  varios:     "asset:posto",          // responde por vários

  // === Mix além do combustível (multi) ===
  conveniencia: "asset:cesta",        // loja de conveniência
  troca_oleo:  "asset:lavagem",       // troca de óleo
  lava_rapido: "asset:lavagem",       // lava rápido
  calibragem:  "asset:engrenagens",   // calibragem e serviços de pista
  eletrica:    "asset:carregador-ev", // carregador de carro elétrico
  so_pista:    "asset:bomba",         // só a pista

  // === Área do frentista ===
  pista:    "asset:bomba",
  loja:     "asset:cesta",
  servicos: "asset:lavagem",

  // === Tempo de casa ===
  ate2:    "asset:lampada", menos6m: "asset:lampada",   // chegou agora
  "2a10":  "asset:calendario", "6ma2a": "asset:calendario", // consolidado
  mais10:  "asset:visao", mais2a:  "asset:visao",         // veterano
  // Tempo de operacao do gerente: icones numerados 1, 2, 3 (combina com as opcoes)
  menos1:  "asset:um", "1a3": "asset:dois", mais3: "asset:tres",

  // === Tamanho de equipe ===
  ate5:  "asset:frentista", "1a2": "asset:frentista",   // time pequeno
  "3a5": "asset:grupo",     "6a12": "asset:grupo",      // time médio
  mais5: "asset:equipe-mercado", mais12: "asset:equipe-mercado", // time grande

  // === Escala / preparo da equipe ===
  ok:        "asset:check",            // escala estável / saudável
  aperto:    "asset:aviso-triangulo",  // no aperto
  improviso: "asset:atencao-circulo",  // improviso
  pronto:    "asset:escudo",           // preparado
  dificil:   "asset:atencao-circulo",  // não cobriria
  nao_pensei:"asset:lampada",          // não calculou

  // === Rotatividade ===
  estavel:  "asset:grupo",             // time estável
  moderado: "asset:balanca",           // rotatividade normal
  trocando: "asset:aviso-triangulo",   // alta rotatividade

  // === Treinamento ===
  processo: "asset:engrenagens",       // processo estruturado
  basico:   "asset:lampada",           // básico
  fazendo:  "asset:aviso-triangulo",   // aprende fazendo

  // === Comissão / meta ===
  claro:    "asset:crescimento",       // comissão clara (ganha mais)
  informal: "asset:aviso-triangulo",   // informal
  nao:      "asset:atencao-circulo",   // sem comissão / não

  // === Clima ===
  bom:     "asset:coracao",            // gostam de estar ali
  oscila:  "asset:gangorra",           // altos e baixos
  ruim:    "asset:atencao-circulo",    // pesado
  gosto:   "asset:coracao",            // frentista gosta
  cansado: "asset:aviso-triangulo",    // cansado

  // === Marca / experiência ===
  convida:     "asset:estrela",        // posto que convida
  comum:       "asset:balanca",        // comum
  afasta:      "asset:aviso-triangulo",// afasta
  diferencial: "asset:marca",          // diferencial claro
  detalhes:    "asset:engrenagens",    // uns detalhes
  preco:       "asset:concorrencia",   // segura só pelo preço
  nos:         "asset:atendimento",    // escolhem pelo atendimento
  ambos:       "asset:balanca",        // bandeira + atendimento
  bandeira:    "asset:posto",          // pela bandeira
  sabe:        "asset:check",          // sabe o motivo / argumento
  palpite:     "asset:lampada",        // tem palpite
  nao_sabe:    "asset:atencao-circulo",// não sabe

  // === Comercial / margem ===
  controla: "asset:margem",            // acompanha margem
  "noção":  "asset:lampada",           // tem uma noção
  nao_mede: "asset:atencao-circulo",   // não mede
  metodo:   "asset:gestao",            // tem método de preço
  concorrente: "asset:concorrente",    // segue o concorrente
  feeling:  "asset:aviso-triangulo",   // vai no olho (chave interna)
  alta:     "asset:crescimento",       // alta participação / movimento
  media:    "asset:balanca",           // média
  baixa:    "asset:aviso-triangulo",   // baixa
  varejo:   "asset:real",              // à vista (Pix/cartão/dinheiro)
  misto:    "asset:balanca",           // mix à vista/prazo
  prazo:    "asset:calendario",        // a prazo / faturado

  // === Fidelização ===
  digital:  "asset:coracao",           // programa de verdade
  nada:     "asset:atencao-circulo",   // não faz nada
  base:     "asset:dados-base",        // tem base de clientes
  vista:    "asset:visao",             // conhece de vista
  somem:    "asset:atencao-circulo",   // abastecem e somem
  maioria:  "asset:grupo",             // muito cliente fiel
  parte:    "asset:balanca",           // fiéis + passagem
  ninguem:  "asset:atencao-circulo",   // tudo passagem

  // === Dados / sistema ===
  usa:    "asset:dados-analise",       // usa o sistema
  subusa: "asset:engrenagens",         // subutiliza
  manual: "asset:aviso-triangulo",     // tudo manual

  // === Resiliência / mercado ===
  segura: "asset:balanca",             // de vez em quando entra na guerra
  aperta: "asset:concorrencia",        // vive na guerra de preço
  ativo:  "asset:carregador-ev",       // recarga ativa / no plano
  radar:  "asset:visao",               // no radar
  fora:   "asset:aviso-triangulo",     // fora da realidade hoje
  boa:    "asset:crescimento",         // serviços/loja rendem bem
  apoio:  "asset:balanca",             // ajudam um pouco
  fraco:  "asset:gangorra",            // sobra pouco
  empata: "asset:balanca",             // empata

  // === Padrão multi-posto ===
  padrao:    "asset:qualidade",        // padrão único
  parecidos: "asset:balanca",          // base comum, varia
  solo:      "asset:aviso-triangulo",  // cada um do seu jeito

  // === Intenção / dores / qualificação ===
  sim:    "asset:check",
  talvez: "asset:lampada",
  margem: "asset:margem",              // dor: a margem
  fidelizar: "asset:repetir",          // dor: cliente não volta
  equipe: "asset:grupo",               // dor: falta de gente
  concorrencia: "asset:concorrencia",  // dor: concorrência

  // === Conhece ClubPetro ===
  cliente:  "asset:check",             // já é cliente
  conhece:  "asset:lampada",           // conhece de nome
  primeira: "asset:estrela",           // primeira vez

  // === Cadastro / frequência / S3 ===
  sempre:      "asset:check",
  as_vezes:    "asset:balanca",
  quase_nunca: "asset:aviso-triangulo",
};

/* Fallback por palavra-chave no texto da opção (PNG flat onde disponível). */
const KEYWORD_ICON: Array<{ rx: RegExp; icon: AnyIcon }> = [
  { rx: /lavag|lavand|trocar?\s+óleo|troca de óleo|lava jato/i, icon: "asset:lavagem" },
  { rx: /loja|conveniência|conveniencia/i, icon: "asset:cesta" },
  { rx: /sacola|carrinho|compras/i, icon: "asset:carrinho" },
  { rx: /aditivado|combustível|bomba|gasolina|diesel|etanol/i, icon: "asset:bomba" },
  { rx: /margem|lucro|ticket/i, icon: "asset:margem" },
  { rx: /venda|receita/i, icon: "asset:real" },
  { rx: /fidelidad|clube|recorrência|recorrencia|programa|cadastro/i, icon: "asset:qualidade" },
  { rx: /whats/i, icon: "asset:whatsapp" },
  { rx: /mensagem|conversa direta|di[áa]logo/i, icon: "asset:conversa" },
  { rx: /e-?mail|envelope|email/i, icon: "asset:envelope" },
  { rx: /dado|painel|sistema|dashboard|planilha/i, icon: "asset:dados-analise" },
  { rx: /gestão|gerencia/i, icon: "asset:gestao" },
  { rx: /equipe|frentista|atendimento|time|funcionário|escala/i, icon: "asset:frentista" },
  { rx: /especialista|consultoria|consultor|head ?set/i, icon: "asset:headset" },
  { rx: /marca|posicionamento|identidade|fachada|comunicação/i, icon: "asset:marca" },
  { rx: /coração|cliente fiel|preferid/i, icon: "asset:coracao" },
  { rx: /caixa|capital|fôlego|reserva|empréstimo|emprestimo/i, icon: "asset:escudo" },
  { rx: /elétric|eletric|recarga|carregador|EV /i, icon: "asset:carregador-ev" },
  { rx: /padrão|processo|método|metodo|rotina|critério/i, icon: "asset:engrenagens" },
  { rx: /sei (de )?cabeça|controla|controle|sob controle|tudo certo/i, icon: "asset:check" },
  { rx: /não (sei|meço|controlo|olh)|improviso|achismo|feeling|no escuro/i, icon: "asset:atencao-circulo" },
  { rx: /atenção|atencao|preocupa|sensível|sensivel/i, icon: "asset:aviso-triangulo" },
  { rx: /risco|qualidade|conformidade|anp/i, icon: "asset:qualidade" },
  { rx: /crescer|abrir|novo posto|expandir|expansão|aumenta/i, icon: "asset:crescimento" },
  { rx: /tempo|prazo|cronômetro|cronometro|urgência|urgencia/i, icon: "asset:cronometro" },
  { rx: /estrela|brilho|destaque|premium/i, icon: "asset:estrela" },
  { rx: /reunião|reuniao|apresenta|consultoria|encontro/i, icon: "asset:apresentacao" },
  { rx: /dono|propriet[áa]rio|empres[áa]rio/i, icon: "asset:apresentacao" },
  { rx: /gerente|gest[oã]r|supervisor|encarregad/i, icon: "asset:executivo" },
  { rx: /concorrent|bandeira branca|disputa/i, icon: "asset:concorrente" },
  { rx: /comunidade|bairro|praça|praca|local|região|regiao/i, icon: "asset:atendimento" },
  { rx: /agenda|calendário|calendario|encontro/i, icon: "asset:calendario" },
  { rx: /idea|ideia|talvez|primeira vez/i, icon: "asset:lampada" },
  { rx: /equilíbrio|equilibrio|empata|oscila|balança|balanca|gangorra/i, icon: "asset:balanca" },
  { rx: /repetir|recorrência|recorrencia|frequência|frequencia/i, icon: "asset:repetir" },
  { rx: /visão|visao|olhar|antever|prever/i, icon: "asset:visao" },
];

/* Resolve ícone para uma opção:
   1) match exato por value (mapa específico)
   2) match por keyword no texto
   3) fallback por bloco */
function iconForOption(
  blockKey: string,
  opt: { label?: string; desc?: string; value?: string },
): AnyIcon {
  if (opt.value && VALUE_ICON[opt.value]) return VALUE_ICON[opt.value];
  const hay = `${opt.label ?? ""} ${opt.desc ?? ""}`;
  for (const { rx, icon } of KEYWORD_ICON) {
    if (rx.test(hay)) return icon;
  }
  return ICONS_BY_BLOCK[blockKey] ?? "info";
}

/* Alternativas por "espírito" do ícone original.
   Quando duas opções da mesma pergunta resolvem pro mesmo ícone, a segunda
   recebe um substituto coerente em vez de repetir. Inclui PNG flat e SVG. */
const ICON_ALTS: Record<string, AnyIcon[]> = {
  // Status positivo (sucesso, controle)
  "asset:check":     ["check", "asset:escudo", "asset:qualidade", "trendUp"],
  check:             ["asset:check", "asset:escudo", "asset:qualidade", "trendUp"],

  // Atenção crítica (vermelho)
  "asset:atencao-circulo": ["asset:aviso-triangulo", "asset:gangorra", "alert", "priceWar"],
  alert:                   ["asset:atencao-circulo", "asset:aviso-triangulo", "asset:gangorra"],

  // Atenção média (laranja)
  "asset:aviso-triangulo": ["asset:atencao-circulo", "asset:gangorra", "asset:balanca"],

  // Info / dica
  "asset:lampada":   ["info", "asset:visao", "clock", "stars"],
  info:              ["asset:lampada", "asset:visao", "clock"],

  // Equilíbrio / oscilação
  "asset:balanca":   ["asset:gangorra", "scale", "asset:repetir"],
  "asset:gangorra":  ["asset:balanca", "scale", "asset:aviso-triangulo"],
  scale:             ["asset:balanca", "asset:gangorra"],

  // Pessoas
  "asset:frentista":      ["asset:headset", "asset:executivo", "asset:equipe-mercado", "asset:grupo", "asset:atendimento", "team", "user"],
  "asset:headset":        ["asset:frentista", "asset:apresentacao", "asset:equipe-mercado", "asset:atendimento"],
  "asset:equipe-mercado": ["asset:grupo", "asset:apresentacao", "asset:frentista", "asset:atendimento", "team"],
  "asset:grupo":          ["asset:equipe-mercado", "asset:apresentacao", "asset:frentista", "team"],
  "asset:apresentacao":   ["asset:executivo", "asset:grupo", "asset:headset", "asset:conversa"],
  "asset:executivo":      ["asset:apresentacao", "asset:headset", "asset:frentista", "user"],
  "asset:conversa":       ["asset:apresentacao", "asset:headset", "asset:atendimento"],
  "asset:atendimento":    ["asset:frentista", "asset:headset", "asset:apresentacao", "asset:equipe-mercado", "stars"],
  team:                   ["asset:grupo", "asset:equipe-mercado", "asset:frentista", "user"],
  user:                   ["asset:executivo", "asset:frentista", "asset:coracao", "team"],

  // Dinheiro / margem
  "asset:real":      ["asset:margem", "asset:carrinho", "asset:cesta", "coin"],
  "asset:margem":    ["asset:real", "trendUp", "asset:dados-analise", "coin"],
  "asset:carrinho":  ["asset:cesta", "asset:real", "shoppingBag"],
  "asset:cesta":     ["asset:carrinho", "shoppingBag", "asset:real"],
  coin:              ["asset:real", "asset:margem"],
  shoppingBag:       ["asset:cesta", "asset:carrinho"],

  // Dados
  "asset:dados-base":     ["asset:dados-analise", "asset:gestao", "asset:engrenagens", "dashboard", "chart"],
  "asset:dados-analise":  ["asset:dados-base", "asset:gestao", "chart", "dashboard"],
  "asset:gestao":         ["asset:engrenagens", "asset:dados-analise", "asset:projetos", "cogs"],
  "asset:engrenagens":    ["asset:gestao", "asset:projetos", "cogs"],
  "asset:projetos":       ["asset:gestao", "asset:engrenagens", "asset:lampada"],
  dashboard:              ["asset:dados-base", "asset:dados-analise"],
  chart:                  ["asset:dados-analise", "asset:dados-base"],
  cogs:                   ["asset:engrenagens", "asset:gestao"],

  // Marca / qualidade / fidelização
  "asset:marca":      ["asset:coracao", "asset:qualidade", "asset:estrela", "stars", "badge"],
  "asset:qualidade":  ["asset:marca", "asset:estrela", "asset:coracao", "stars"],
  "asset:coracao":    ["asset:qualidade", "asset:atendimento", "heart"],
  "asset:estrela":    ["asset:qualidade", "asset:marca", "stars"],
  stars:              ["asset:estrela", "asset:qualidade", "asset:marca", "spark"],
  heart:              ["asset:coracao", "asset:qualidade"],
  badge:              ["asset:marca", "asset:estrela", "stars"],

  // Combustível / posto / pista / EV
  "asset:bomba":         ["asset:posto", "asset:lavagem", "asset:carregador-ev", "fuelPump"],
  "asset:posto":         ["asset:bomba", "asset:lavagem"],
  "asset:lavagem":       ["asset:bomba", "asset:posto"],
  "asset:carregador-ev": ["asset:projetos", "asset:bomba", "bolt"],
  fuelPump:              ["asset:bomba", "asset:posto"],
  wash:                  ["asset:lavagem"],
  bolt:                  ["asset:carregador-ev", "asset:projetos"],

  // Resiliência / proteção
  "asset:escudo":   ["asset:check", "asset:qualidade", "shield"],
  shield:           ["asset:escudo", "asset:qualidade"],
  lock:             ["asset:cadeado"],
  "asset:cadeado":  ["lock", "asset:escudo"],

  // Diagnóstico / próximos passos
  "asset:alvo":         ["asset:diagnostico", "asset:visao", "target"],
  "asset:diagnostico":  ["asset:alvo", "asset:visao"],
  "asset:visao":        ["asset:alvo", "asset:lampada"],
  target:               ["asset:alvo", "asset:diagnostico"],
  spark:                ["asset:lampada", "stars"],

  // Tempo / agenda
  "asset:calendario":   ["asset:cronometro", "calendar", "calendarSolid", "clock"],
  "asset:cronometro":   ["asset:calendario", "clock"],
  calendar:             ["asset:calendario", "asset:cronometro", "clock"],
  clock:                ["asset:cronometro", "asset:calendario", "asset:lampada"],

  // Tendência / crescimento
  "asset:crescimento":  ["asset:margem", "asset:real", "trendUp"],
  trendUp:              ["asset:crescimento", "asset:margem", "asset:real", "spark"],

  // Concorrência / disputa
  "asset:concorrente":   ["asset:concorrencia", "priceWar"],
  "asset:concorrencia":  ["asset:concorrente", "priceWar"],
  priceWar:              ["asset:concorrente", "asset:concorrencia"],

  // Ciclo / recorrência
  "asset:repetir":  ["repeat", "asset:balanca"],
  repeat:           ["asset:repetir"],

  // Comunicação
  "asset:whatsapp":  ["whatsapp", "whatsappBrand", "asset:conversa", "asset:headset"],
  "asset:envelope":  ["mail", "asset:conversa"],
  whatsapp:          ["asset:whatsapp", "asset:conversa", "asset:headset"],
  whatsappBrand:     ["asset:whatsapp", "whatsapp"],
  message:           ["asset:conversa", "asset:whatsapp"],
  mail:              ["asset:envelope", "asset:conversa"],
};

/* Garante variedade dentro da mesma pergunta:
   se duas opções caem no mesmo ícone, a segunda procura alternativa coerente
   na lista ALTS. Se todas as alternativas já foram usadas, mantém o original
   (último recurso). */
function diversifyIcons(icons: AnyIcon[]): AnyIcon[] {
  const used = new Set<string>();
  return icons.map((ic) => {
    if (!used.has(ic)) { used.add(ic); return ic; }
    const alts = ICON_ALTS[ic] ?? [];
    const free = alts.find((a) => !used.has(a as string));
    if (free) { used.add(free as string); return free; }
    used.add(ic);
    return ic;
  });
}

/* Ícones resolvidos são determinísticos pelo conteúdo estático da pergunta.
   Memoiza por id para não reavaliar até ~37 regex por opção a cada render. */
const OPTION_ICON_CACHE: Map<string, AnyIcon[]> = new Map();
function optionIconsFor(q: Question): AnyIcon[] {
  const hit = OPTION_ICON_CACHE.get(q.id);
  if (hit) return hit;
  const icons = diversifyIcons(
    ((q as any).options as any[]).map((opt) => iconForOption(q.block, opt)),
  );
  OPTION_ICON_CACHE.set(q.id, icons);
  return icons;
}

export function QuestionPage(p: QuestionPageProps): string {
  const q = p.question;
  const blockKey = q.block;
  const blockName = blockKey === "qualif"
    ? "Qualificação"
    : BLOCKS[blockKey].name;

  // Pergunta de texto aberto (frentista): layout próprio com textarea.
  if (q.type === "open") {
    return renderOpenQuestion(p, blockName);
  }

  const pl = p.plural === true;

  // Rótulo do tipo na meta line. NUNCA expor pontuação para não induzir
  // o usuário a marcar a alternativa "vencedora".
  const metaLabel = q.type === "segmentation-multi"
    ? "Marque todas que se aplicam"
    : q.type === "qualify" || q.type === "segmentation-single"
      ? "Resposta única"
      : "Resposta única";

  /* Resolve ícones e diversifica para a mesma pergunta não ter dois ícones iguais. */
  const optionIcons = optionIconsFor(q);

  const opts = q.options
    .map((opt: any, i: number) => {
      const isMulti = q.type === "segmentation-multi";
      const selected = isMulti
        ? (p.selectedIndexes || []).includes(i)
        : p.selectedIndex === i;
      return AnswerCard({
        index: i,
        label: applyForms(opt.label, pl),
        desc: applyForms(opt.desc ?? "", pl),
        icon: optionIcons[i],
        selected,
        multi: isMulti,
      });
    })
    .join("");

  const context = q.context
    ? `<p class="q-context anim-fade delay-2">${applyForms(escHtml(q.context), pl)}</p>`
    : "";

  // Tipo de pergunta determina o footer:
  // - score: avança sozinho ao escolher (sem botão "continuar")
  // - segmentation-single / qualify: também avança sozinho
  // - segmentation-multi: precisa do botão "Continuar" porque é multi-resposta
  const showContinue = q.type === "segmentation-multi";
  const continueDisabled = !(p.selectedIndexes && p.selectedIndexes.length > 0);

  const continueBtn = showContinue
    ? Button({
        variant: "primary",
        size: "md",
        label: "Continuar",
        iconRight: "arrow",
        dataAction: "advance-multi",
        id: "btnAdvanceMulti",
        disabled: continueDisabled,
      })
    : "";

  const grouping = q.type === "segmentation-multi" ? "checkbox" : "radio";

  const inner = `
      <section class="question">
        <div class="q-meta anim-fade">
          <span class="q-step-tag">
            <b>${pad2(p.currentIndex + 1)}</b> / ${pad2(p.totalSteps)}
          </span>
          <span class="q-pillar-tag">${escHtml(blockName)} · ${escHtml(metaLabel)}</span>
        </div>
        <h2 class="q-title anim-rise delay-1">${applyForms(q.text, pl)}</h2>
        ${context}
        <div class="answer-grid anim-fade delay-3"
             role="${grouping === "checkbox" ? "group" : "radiogroup"}"
             aria-label="Alternativas">
          ${opts}
        </div>
        <div class="q-nav">
          ${Button({
            variant: "ghost",
            label: "Voltar",
            iconLeft: "arrowBack",
            dataAction: "back",
            disabled: p.currentIndex === 0,
          })}
          ${continueBtn}
        </div>
      </section>
  `;
  return frameStage(inner, p);
}

/* Pergunta de texto aberto: enunciado + textarea + Continuar.
   Não pontua; serve de leitura qualitativa (trilha do frentista). */
function renderOpenQuestion(p: QuestionPageProps, blockName: string): string {
  const q = p.question;
  const pl = p.plural === true;
  const placeholder = "placeholder" in q && q.placeholder ? q.placeholder : "Escreva com as suas palavras.";
  const context = q.context
    ? `<p class="q-context anim-fade delay-2">${applyForms(escHtml(q.context), pl)}</p>`
    : "";
  const inner = `
      <section class="question">
        <div class="q-meta anim-fade">
          <span class="q-step-tag">
            <b>${pad2(p.currentIndex + 1)}</b> / ${pad2(p.totalSteps)}
          </span>
          <span class="q-pillar-tag">${escHtml(blockName)} · Resposta aberta</span>
        </div>
        <h2 class="q-title anim-rise delay-1">${applyForms(q.text, pl)}</h2>
        ${context}
        <div class="open-wrap anim-fade delay-3">
          <textarea
            id="openInput"
            class="open-input"
            rows="4"
            maxlength="600"
            placeholder="${escHtml(placeholder)}"
          >${escHtml(p.openText || "")}</textarea>
        </div>
        <div class="q-nav">
          ${Button({
            variant: "ghost",
            label: "Voltar",
            iconLeft: "arrowBack",
            dataAction: "back",
            disabled: p.currentIndex === 0,
          })}
          ${Button({
            variant: "primary",
            size: "md",
            label: "Continuar",
            iconRight: "arrow",
            dataAction: "advance-open",
            id: "btnAdvanceOpen",
          })}
        </div>
      </section>
  `;
  return frameStage(inner, p);
}
