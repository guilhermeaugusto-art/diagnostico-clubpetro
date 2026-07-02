# Regras do Diagnóstico ClubPetro

Lei do projeto. Toda alteração de UI, UX ou copy precisa passar por essas regras
antes de ser publicada. Se alguma regra for inconveniente em um caso específico,
revisa-se a regra aqui, não se ignora caso a caso.

## 1. Layout

1.1 **Grid base 4.** Todo espaçamento é múltiplo de 4 px: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96. Usar os tokens `--sp-*`.

1.2 **Vertical rhythm.** Três níveis de pausa, sempre via token:
- `--stack-tight` (8 px): dentro de um componente.
- `--stack-block` (24 px mobile, 32 px desktop): entre elementos de uma seção (título → conteúdo).
- `--stack-section` (48 px mobile, 64 px desktop): entre seções.

1.3 **Padding de card.** Mínimo 20 px mobile / 24 px desktop. Hero usa 32 px / 48 px. Nada de padding visual inconsistente.

1.4 **Gap entre cards de mesma natureza.** 12 px mobile, 16 px desktop.

1.5 **Line-length.** Texto corrido respeita `--measure` (60 ch mobile, 70 ch desktop). Acima disso, leitura quebra.

1.6 **Área de toque.** Mínimo 48 px de altura para tudo clicável (`--touch`).

1.7 **Container.** `.shell` com `--shell-max` (1180 px) e padding lateral fluido: 20 / 32 / 48.

1.8 **Hierarquia tipográfica por tela.** Máximo 3 níveis (display + h2 + body) por viewport. Quarto nível só em estados raros (e via eyebrow ou tag).

## 2. UX

2.1 **Um único primário por viewport.** Se há mais de uma ação possível, apenas a principal é `btn-primary`; o resto é `btn-secondary` ou `btn-ghost`.

2.2 **Sem duplicação de comando.** Se "Continuar de onde parei" está visível, "Começar diagnóstico" some. Se não há sessão, "Começar diagnóstico" aparece e o banner não.

2.3 **Avanço automático onde a resposta é uma só.** Score e single-select avançam sozinhos após ~300 ms. Multi-select tem botão "Continuar".

2.4 **Sem reload entre etapas.** Toda transição é SPA, com fade/rise sutil.

2.5 **Voltar é sempre possível** (exceto na tela inicial). Botão "Voltar" usa variante `ghost` e nunca compete com o primário.

2.6 **Progresso visível mas discreto.** Régua de steps no header e radar mini com as 6 frentes evoluindo. A nota numérica NÃO é exposta durante o diagnóstico; só aparece no resultado.

2.6.1 **Sem V5.** Nenhuma menção a versão na UI. Versão só fica em payloads internos e no `package.json`.

2.7 **Nada de checklist técnico exposto ao usuário.** Lógica de sinal, lacunas, payload de roteamento são internos.

2.8 **Persistência silenciosa.** Estado salvo no `localStorage` a cada interação, TTL 7 dias, sem aviso intrusivo.

## 3. Copy (inegociável)

3.1 Sem travessão (— ou –) e sem reticências (...). Reescreve com vírgula, ponto, parênteses ou dois pontos.

3.2 Sem emoji em lugar nenhum.

3.3 Sem citar nome de bandeira ou distribuidora. Usar "bandeirado", "bandeira branca", "bandeira do posto" genericamente.

3.4 Sem floreio. Fora: "premium", "estratégico", "elegante", "experiência inesquecível", "transformador". Dentro: linguagem de dono de posto, direta.

3.5 Frase curta. Máximo 20 palavras por frase. Acima disso, quebra.

3.6 CTAs são frase de benefício em primeira pessoa (o que a pessoa ganha), nunca descrição de tarefa nem venda crua. Fora: "compre agora", "contrate", "saiba mais", "Iniciar diagnóstico". Dentro: "Quero saber onde meu posto perde dinheiro", "Quero analisar meu posto no Raio X", "Quero destravar meu plano de ação".

3.7 "Fale com um Especialista ClubPetro" é a copy oficial do CTA de contato direto (secundário no resultado). Nunca personalizar com nome de operador.

3.8 Português do Brasil. Sem anglicismo desnecessário ("dashboard" é aceito quando é jargão do mercado, mas "insight" vira "leitura", "feature" vira "função", "lead" só em texto técnico).

3.9 Sem afirmação numérica de caso ClubPetro. Dados de mercado são pano de fundo, não viram afirmação.

3.10 Nunca repetir a mesma palavra três vezes em duas frases seguidas (regra anti-IA). Se "posto" apareceu duas vezes, a terceira vira "operação" ou "negócio".

3.11 **Termos proibidos na UI.** "Sem login", "sem cadastro", "nota de 0 a 6", "onde dói" (usar "onde o posto perde dinheiro"), "gancho de resolução", "oportunidade adicional", "gestão no escuro", "feeling", "no escuro". Palavra em inglês fora de jargão de mercado.

3.12 **Termos canônicos.** A chamada da home é "As 6 frentes que definem o lucro do posto" (o termo "6 frentes" é permitido, revisa a regra anterior que o proibia). "Análise das 6 frentes" no lugar de "diagnóstico" onde couber (o identificador interno segue "diagnóstico"). "Plano de ação por frente" no lugar de "relatório". "Próxima melhoria", "Leitura por frente", "Caminho sugerido", "Como o ClubPetro ajuda".

3.13 **Pontuação.** A nota tem um teto interno (mecânica de vendas) e nunca chega a 100: isso NUNCA aparece na UI, e o número do teto nunca é citado. Onde precisar comunicar, usar "nenhum posto está totalmente otimizado". A faixa máxima visível é "Operação consistente" (61–80). Resultados acima de 70 só saem quando frentes estão de fato altas e equilibradas.

3.14 **Registro de voz.** Português do Brasil com contrações do dia a dia ("pra", "tá"). Saudação "Fala, PRIMEIRO_NOME" assim que o nome estiver disponível. Vocabulário nativo de pista quando couber: pista, bomba, frentista, galonagem, ticket médio, aditivada.

3.15 **Portão de e-mail nas trilhas comerciais (revisto em 02/07/2026).** A nota é
calculada e o resultado é montado antes de qualquer venda. Nas trilhas comerciais
(dono e gerente), um pop-up obrigatório pede o e-mail para liberar o resultado: é
nesse momento que o lead é enviado ao RD/Kommo, então o contato entra na base mesmo
que a pessoa não marque a agenda depois. O WhatsApp segue sendo exigido na entrada.
Na trilha do frentista NÃO há portão: o resultado abre direto (frentista não vira
lead). O bloco do Raio-X, dentro do resultado, mantém a única ação de confirmar a
presença na agenda, com o e-mail já pré-preenchido. (Versão anterior era reward-first
sem portão, com e-mail opcional; a decisão de produto passou a exigir o e-mail para
liberar a análise nas trilhas comerciais.)

## 4. Componentes

4.1 **Card.** Sempre tem: background, sombra ou borda sutil, padding mínimo, radius do design system. Nunca tem só borda chapada.

4.2 **AnswerCard.** Título + descrição opcional + indicador de seleção. Sem ícone: os ícones foram removidos por somarem carga visual sem ajudar a decisão. O card inteiro é área de toque (mínimo confortável para o polegar) e responde ao toque.

4.3 **Botão primário.** Apenas para a ação principal. Inclui seta direita quando avança fluxo.

4.4 **Eyebrow.** Texto de acima de título, uppercase, fino, laranja. Usado uma vez por seção.

4.5 **Tag/chip.** Para metainformação curta. Não confundir com botão.

## 5. Acessibilidade

5.1 Foco visível com `outline 2px var(--cp-orange-500)`.

5.2 Contraste mínimo AA em texto sobre fundo. Texto secundário não cai abaixo de `--ink-500` sobre paper.

5.3 `prefers-reduced-motion` zera animações.

5.4 `aria-live="polite"` em mudanças de score e em transições.

5.5 `role="radiogroup"` / `role="group"` para grupos de opção, `aria-checked` no item.

## 6. Antes de fazer commit

6.1 Rodar `npm run build`. Falhou? Conserta.

6.2 Conferir no preview, mobile primeiro, depois desktop.

6.3 Bater contra essas regras. Se uma foi quebrada, ou consertar, ou revisar a regra aqui.
