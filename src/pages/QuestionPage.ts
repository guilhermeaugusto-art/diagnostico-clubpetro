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
}

/* Ícone padrão por bloco como fallback final. Usa PNG flat colorido. */
const ICONS_BY_BLOCK: Record<string, AnyIcon> = {
  pessoas:     "asset:frentista",
  marca:       "asset:marca",
  comercial:   "asset:real",
  fidelizacao: "asset:qualidade",
  dados:       "asset:dados-base",
  resiliencia: "asset:equipe-mercado",
  qualif:      "asset:alvo",
};

/* Mapa direto por VALUE específico das opções. PNG flat colorido onde
   existir ícone temático; SVG monoline como fallback consistente. */
const VALUE_ICON: Record<string, AnyIcon> = {
  // === Quem responde / quem opera (S1) ===
  // dono: empresário estrategista → apresentação (2 pessoas com gráfico, sugere liderança)
  // gerente: gestor formal → executivo (homem de terno barbado)
  // equipe: frentista de pista
  // outro: lâmpada (perfil livre)
  dono:       "asset:apresentacao",
  gerente:    "asset:executivo",
  equipe:     "asset:frentista",
  outro:      "asset:lampada",

  // === Mix além do combustível ===
  loja:            "asset:cesta",
  servicos:        "asset:lavagem",
  outros_servicos: "asset:lavagem",
  so_pista:        "asset:bomba",

  // === Combustível / bandeira ===
  bandeira:    "asset:posto",

  // === Canal e perfil de cliente ===
  // varejo: cliente que vai à loja → lojista (pessoa com carrinho)
  // prazo: vende com prazo de pagamento → cronômetro
  // misto: equilíbrio entre canais → balança
  varejo:      "asset:lojista",
  misto:       "asset:balanca",
  prazo:       "asset:cronometro",
  diluido:     "asset:repetir",
  concentrado: "asset:aviso-triangulo",
  refem:       "asset:concorrencia",

  // === Fidelização ===
  digital:     "asset:qualidade",
  informal:    "asset:repetir",
  nada:        "asset:atencao-circulo",

  // === Dados ===
  base:        "asset:dados-base",
  vista:       "asset:dados-analise",
  somem:       "asset:atencao-circulo",
  manual:      "asset:aviso-triangulo",
  usa:         "asset:gestao",
  subusa:      "asset:engrenagens",

  // === Resiliência / capital ===
  folego:      "asset:escudo",
  aperto:      "asset:gangorra",
  curto:       "asset:atencao-circulo",
  pronto:      "asset:escudo",
  dificil:     "asset:aviso-triangulo",
  nao_pensei:  "asset:lampada",

  // === Marca / comunicação ===
  preco:       "priceWar",
  diferencial: "asset:marca",
  detalhes:    "asset:engrenagens",

  // === Recarga elétrica ===
  ativo:       "asset:carregador-ev",
  radar:       "asset:visao",
  fora:        "asset:aviso-triangulo",

  // === Comercial / margem ===
  controla:    "asset:check",
  metodo:      "asset:margem",
  feeling:     "asset:atencao-circulo",
  margem:      "asset:real",
  alta:        "asset:crescimento",
  media:       "asset:balanca",
  baixa:       "asset:aviso-triangulo",
  nao_mede:    "asset:atencao-circulo",

  // === Comunidade / praça ===
  comum:       "asset:atendimento",
  afasta:      "asset:aviso-triangulo",
  convida:     "asset:estrela",

  // === Qualidade ANP ===
  ok:          "asset:qualidade",
  atencao:     "asset:aviso-triangulo",
  preocupa:    "asset:atencao-circulo",

  // === Equipe estável / atendimento ===
  estavel:     "asset:frentista",
  moderado:    "asset:repetir",
  trocando:    "asset:aviso-triangulo",
  processo:    "asset:engrenagens",
  basico:      "asset:lampada",
  fazendo:     "asset:aviso-triangulo",
  claro:       "asset:check",

  // === Posicionamento ao cliente local ===
  sabe:        "asset:marca",
  palpite:     "asset:lampada",
  nao_sabe:    "asset:atencao-circulo",

  // === Padrão de identidade ===
  padrao:      "asset:atendimento",
  parecidos:   "asset:lampada",
  solo:        "asset:aviso-triangulo",

  // === Qualificações Z ===
  sim:         "asset:check",
  talvez:      "asset:lampada",
  nao:         "asset:aviso-triangulo",
  conhece:     "asset:check",
  primeira:    "asset:lampada",

  // === Maturidade / status ===
  // apoio: tem rede de apoio → grupo (3 pessoas diversas)
  alto:        "asset:crescimento",
  apoio:       "asset:apresentacao",
  cliente:     "asset:coracao",
  estrutura:   "asset:engrenagens",
  fraco:       "asset:atencao-circulo",
  ruim:        "asset:atencao-circulo",
  bom:         "asset:check",
  boa:         "asset:check",
  oscila:      "asset:gangorra",
  empata:      "asset:balanca",
  segura:      "asset:balanca",

  // === S3 multi-select ===
  // ambos: 2 lados conectados → balança (mais visual que setas)
  ninguem:     "asset:atencao-circulo",
  parte:       "asset:balanca",
  maioria:     "asset:check",
  ambos:       "asset:balanca",
  nos:         "asset:grupo",
  nao_olhei:   "asset:aviso-triangulo",
  nao_olhou:   "asset:aviso-triangulo",

  // === Concorrência ===
  concorrente: "asset:concorrente",
  concorrencia: "asset:concorrencia",
  improviso:   "asset:aviso-triangulo",
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
  "asset:lojista":        ["asset:carrinho", "asset:cesta", "asset:frentista"],
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
  const optionIcons = diversifyIcons(
    q.options.map((opt: any) => iconForOption(blockKey, opt)),
  );

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

  return `
    <div class="shell stage">
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
    </div>
  `;
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
  return `
    <div class="shell stage">
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
    </div>
  `;
}
