# Catálogo de Perguntas — Diagnóstico de Saúde do Posto (ClubPetro)

Fonte: `src/data/questions.ts`. Ordem de exibição conforme `QUESTION_ORDER_BY_TRACK`.
`(Npt)` = pontos da opção nas perguntas pontuadas. Perguntas de perfil/qualificação e abertas não pontuam.
`[condicional]` = só aparece se a condição for satisfeita.

> **Enxugamento (fluxo atual).** A fonte da verdade do que aparece é
> `QUESTION_ORDER_BY_TRACK`. Fora do fluxo hoje (objetos ainda no banco, mas não
> exibidos): Dono → `D_PT_TEMPO, D_P1, D_P5, D_P6, D_M3, D_C4, D_F2` (18 base +
> condicionais). Gerente → `G_PT_TEMPO, G_PT_REDE, G_P1, G_P5, G_P6, G_P7,
> G_C3, G_F2` (16 base + condicionais). **Dono (ajuste 26/08/2026):** o fluxo
> abre com 3 perguntas de perfil (`D_PT_POSTOS, D_PT_MIX, D_DOR`) como
> aquecimento — os dados de jul-ago mostraram 44% dos abandonos nas 3 primeiras
> telas, que eram as duas perguntas expositivas de fidelização; a fidelização
> segue como primeiro bloco pontuado e os checkpoints de sinal não mudaram.
> Gerente segue com fidelização primeiro; frentista inalterada. Os 6 pilares
> seguem pontuando em cada trilha (Dados e Resiliência têm um único item cada e
> nunca saem).

---

## Pergunta compartilhada (roteia a trilha)

**S1 · Qual é o seu papel no posto?**
- Dono ou sócio. → trilha DONO
- Gerente. → trilha GERENTE
- Outro papel no posto (frentista, administrativo, financeiro). → trilha FRENTISTA

---

# TRILHA DONO

## Perfil (não pontua)
**D_PT_POSTOS · Quantos postos você tem hoje?** — Apenas um / Entre dois e quatro / Cinco ou mais
**D_PT_MIX · O que o seu posto oferece além do combustível?** (múltipla) — Loja de conveniência / Troca de óleo / Lava rápido / Carregador elétrico / Calibragem e serviços de pista / Só combustível
**D_PT_TEMPO · Há quanto tempo você toca esse posto?** — Até dois anos / Entre dois e dez anos / Mais de dez anos
**D_DOR · O que mais tira o seu sono no posto hoje?** — A margem / O cliente que abastece e não volta / A equipe / A concorrência

## Pessoas e operação (peso 18)
**D_P1 · Como funciona a escala da sua equipe de pista hoje?** — Escala desenhada e estável (3) / Funciona, mas no aperto (1) / É no improviso (0)
**D_P2 · Se a PEC do fim da 6x1 passar e você precisar dar duas folgas por semana, o posto está preparado?** — Já estou preparado (4) / Daria um aperto, mas me viraria (2) / Hoje não teria como cobrir (1) / Ainda não calculei (0)
**D_P3 · Qual a rotatividade da sua equipe de pista?** — Baixa (4) / Normal (2) / Alta (0)
**D_P4 · Quando entra alguém novo, como é a contratação e o treinamento?** — Processo estruturado (4) / Treinamento básico no começo (2) / Aprende fazendo (0)
**D_P5 · A equipe ganha parte variável por vender aditivado, lubrificante ou loja?** — Plano de comissão claro (3) / Algo informal (1) / Não tenho comissão (0)
**D_P6 · Como é o ambiente de trabalho da equipe?** — Bom (2) / Altos e baixos (1) / Pesado (0)

## Marca e experiência (peso 12)
**D_M1 · Quem passa pela primeira vez, o que vê no seu posto?** — Um posto que convida (4) / Um posto comum (2) / Algo que mais afasta (0)
**D_M2 · Tirando o preço, por que um cliente escolheria o seu posto?** — Diferencial claro (8) / Uns detalhes que ajudam (4) / O que segura é o preço (0)
**D_M3 · O cliente volta pela bandeira ou pelo atendimento da equipe?** — Pelo atendimento (3) / Um pouco dos dois (2) / Pela bandeira (0)

## Comercial e margem (peso 24)
**D_C1 · Você sabe quanto sobra de margem em cada litro?** — Sei de cabeça (6) / Tenho uma noção (3) / Não meço (0)
**D_C2 · Como você decide o preço da bomba?** — Tenho método (6) / Sigo o concorrente (3) / Vou no olho (0)
**D_C3 · Quanto da sua gasolina vendida é aditivada?** — Mais da metade (4) / Perto de um terço (2) / Pouca coisa (1) / Não acompanho (0)
**D_C4 · Como é a maioria dos pagamentos?** — À vista (4) / Equilibrado à vista e prazo (2) / Na maior parte a prazo (1)
**D_C_SERV · [condicional: tem troca de óleo/lava rápido] O lava rápido e a troca de óleo deixam margem de verdade?** — Deixam margem boa (4) / Ajudam um pouco (2) / Dão trabalho e sobra pouco (1)
**D_C_LOJA · [condicional: tem conveniência] A sua loja de conveniência deixa margem de verdade?** — Deixa margem boa (4) / Empata (2) / Dá trabalho e sobra pouco (0)

## Cliente e fidelização (peso 22)
**D_F1 · Hoje, o que você faz para o cliente voltar?** — Programa de fidelidade de verdade (12) / Algo informal (6) / Não faço nada (0)
**D_F2 · Você consegue saber quem são os seus clientes?** — Sim, tenho uma base (8) / Conheço alguns de vista (4) / Não tenho como saber (0)
**D_FCHURN · Você sabe por que o cliente abastece uma vez e some?** — Sei e ajo (8) / Tenho um palpite (4) / Não sei (0)
**D_F3 · E o cliente que volta, você sabe o motivo dele voltar?** — Sei (10) / Acho que é preço/promoção (5) / Não sei dizer (0)

## Dados e digital (peso 14)
**D_DA1 · Você tem sistema que mostra venda, margem e estoque sem planilha?** — Tenho e uso de verdade (6) / Tenho, mas uso pouco (3) / Não tenho (0)

## Resiliência e mercado (peso 10)
**D_R1 · Você se vê tendo que baixar o preço pra não perder cliente pro vizinho?** — Quase nunca (6) / De vez em quando (3) / Vivo nessa guerra (0)

## Marca — rede [condicional]
**D_PADRAO · [condicional: 2+ postos] Seus postos seguem o mesmo padrão de atendimento e processo?** — Padrão único (3) / Parecidos, cada um com seu jeito (1) / Cada um do seu jeito (0)

## Intenção e fechamento (não pontua)
**D_EXPANDIR · [condicional: 2+ postos] Pretende abrir ou assumir mais postos em 12 meses?** — Sim, tenho plano / Talvez / Não
**D_CONHECE · Já conhecia o ClubPetro antes deste diagnóstico?** — Já sou cliente / Conheço de nome / É a primeira vez
**D_INTENCAO · Se existisse um caminho claro para melhorar resultados, gostaria de conhecer?** — Sim, quero conhecer / Talvez / Agora não é o momento

---

# TRILHA GERENTE

## Perfil (não pontua)
**G_PT_TEMPO · Há quanto tempo você toca a operação desse posto?** — Menos de um ano / Entre um e três anos / Mais de três anos
**G_PT_EQUIPE · Quantas pessoas na pista respondem a você?** — Até cinco / Entre seis e doze / Mais de doze
**G_PT_REDE · Você responde por um posto ou por mais de um?** — Um posto / Mais de um posto
**G_PT_MIX · O que esse posto oferece além do combustível?** (múltipla) — Conveniência / Troca de óleo / Lava rápido / Carregador elétrico / Calibragem / Só combustível
**G_DOR · O que mais tira o seu sono na operação hoje?** — Falta de gente / Cliente que não volta / Equipe sem padrão / Pressão de preço do vizinho

## Pessoas e operação (peso 18)
**G_P1 · Como você monta a escala hoje?** — Escala estável (3) / Funciona no aperto (1) / É no improviso (0)
**G_P2 · Se precisar dar duas folgas por semana, dá pra cobrir com a equipe atual?** — Dá, tenho a conta (4) / Um aperto, mas viro (2) / Hoje não cobriria (1) / Ainda não pensei (0)
**G_P3 · Qual a rotatividade da equipe de pista?** — Baixa (4) / Normal (2) / Alta (0)
**G_P4 · Quando entra alguém novo, como é a integração e o treinamento?** — Processo estruturado (4) / Básico no começo (2) / Aprende fazendo (0)
**G_P5 · A equipe tem meta ou variável por vender aditivado, lubrificante ou loja?** — Meta clara (3) / Algo informal (1) / Só o fixo (0)
**G_P6 · Como é o ambiente de trabalho da equipe?** — Bom (2) / Altos e baixos (1) / Pesado (0)
**G_P7 · A equipe segue um padrão de atendimento?** — Todos o mesmo padrão (3) / Base comum, mas varia (1) / Cada um do seu jeito (0)

## Marca e experiência (peso 12)
**G_M1 · Para quem passa pela primeira vez, o posto convida a entrar?** — Convida (4) / É comum (2) / Mais afasta (0)
**G_M2 · Tirando o preço, qual o motivo do cliente escolher o seu posto?** — Diferencial claro (8) / Uns detalhes (4) / O que segura é o preço (0)

## Comercial e margem (peso 24)
**G_C1 · Você tem visibilidade da margem por litro?** — Sim, de perto (6) / Uma noção (3) / Não tenho acesso (0)
**G_C2 · Quanto da gasolina vendida é aditivada?** — Mais da metade (4) / Perto de um terço (2) / Pouca coisa (1) / Não acompanho (0)
**G_C3 · Como é a maioria dos pagamentos?** — À vista (4) / Equilibrado (2) / Na maior parte a prazo (1)
**G_C_SERV · [condicional: troca óleo/lava rápido] O lava rápido e a troca de óleo rendem de verdade?** — Rendem bem (4) / Ajudam um pouco (2) / Pouco retorno (1) / Quase não trabalhamos (0)
**G_C_LOJA · [condicional: conveniência] A loja de conveniência puxa resultado?** — Margem boa (4) / Empata (2) / Sobra pouco (0)

## Cliente e fidelização (peso 22)
**G_F1 · O que vocês fazem hoje para o cliente voltar?** — Programa de fidelização (12) / Algo informal (6) / Não fazemos nada (0)
**G_F2 · Você consegue identificar quem são os clientes que voltam?** — Sim, temos base (8) / Alguns de vista (4) / Não sabemos quem são (0)
**G_FCHURN · Você sabe por que o cliente abastece uma vez e some?** — Sei e agimos (8) / Um palpite (4) / Não sei (0)
**G_F3 · E o cliente que volta, você sabe o motivo?** — Sei (10) / Acho que é preço/promoção (5) / Não sei dizer (0)

## Dados e digital (peso 14)
**G_DA1 · Você usa sistema que mostra venda e estoque, ou é tudo planilha/caderno?** — Uso e decido por ele (6) / Tem, mas uso pouco (3) / Tudo manual (0)

## Resiliência e mercado (peso 10)
**G_R1 · Vocês se veem tendo que baixar o preço pra não perder pro vizinho?** — Quase nunca (6) / De vez em quando (3) / Vive nessa guerra (0)

## Fechamento (não pontua)
**G_CONHECE · Já conhecia o ClubPetro antes deste diagnóstico?** — Já somos clientes / Conheço de nome / É a primeira vez

---

# TRILHA FRENTISTA / OUTRO (não gera MQL; pontua só para comparação interna)

## Perfil (não pontua)
**F_PT_TEMPO · Há quanto tempo você trabalha nesse posto?** — Menos de seis meses / Seis meses a dois anos / Mais de dois anos
**F_PT_AREA · Onde você atua no dia a dia?** — Pista / Loja ou caixa / Troca de óleo ou serviços / Outro
**F_PT_TURNO · Quantos colegas trabalham no seu turno?** — Um ou dois / Três a cinco / Mais de cinco
**F_PT_SERVICOS · O que o posto oferece além do combustível?** (múltipla) — Conveniência / Troca de óleo / Lava rápido / Carregador elétrico / Calibragem / Só combustível

## Pessoas / dia a dia
**F_F1 · O posto tem programa de fidelidade/desconto e você consegue usar na pista?** — Tem e uso fácil (4) / Tem, mas trava (2) / Não tem nada (0)
**F_M2 · Tirando o preço, você sabe explicar por que vale a pena abastecer aqui?** — Sei (3) / Mais ou menos (1) / O que segura é o preço (0)
**F_P3 · No seu posto, gente entra e sai com frequência?** — Quase ninguém sai (3) / Um ou outro (2) / Vive trocando (0)
**F_F3 · O cliente costuma voltar e te reconhecer?** — Muito cliente fiel (3) / Fiéis e de passagem (2) / Quase tudo de passagem (0)
**F_R1 · [condicional: elétrica] Já apareceu cliente com carro elétrico querendo carregar?** — Já, várias vezes (2) / Raramente (1) / Nunca vi (0)
**F_P1 · A sua escala te dá folga certa, ou vive mudando?** — Folga certa (3) / Muda às vezes (1) / Vive mudando (0)
**F_P2 · Se a lei mudar e todos tiverem mais folga, o turno terá gente suficiente?** — Acho que sim (3) / Ia apertar (1) / Já vivemos no limite (0)
**F_P4 · Quando você entrou, recebeu treinamento de verdade?** — Sim, me ensinaram (3) / Mais ou menos (1) / Aprendi sozinho (0)
**F_P5 · Como é o ambiente de trabalho no dia a dia?** — Bom (2) / Dia bom e dia ruim (1) / Pesado (0)
**F_P6 · Você ganha algo a mais ao vender aditivado, óleo ou loja?** — Meta ou comissão (3) / Às vezes um agrado (1) / Só o fixo (0)
**F_M1 · Na sua visão, o cliente acha o posto bonito e convidativo?** — Acha (3) / É normal (1) / Tem coisa a arrumar (0)
**F_F2 · Quando o cliente pergunta de desconto ou pontos, você tem resposta?** — Tenho (3) / Enrolo um pouco (1) / Não sei responder (0)
**F_C_LOJA · [condicional: conveniência] Você indica a loja pro cliente enquanto abastece?** — Sempre que dá (3) / Às vezes (1) / Quase nunca (0)
**F_C_SERV · [condicional: troca óleo/lava rápido] O cliente costuma fazer lava rápido ou troca de óleo aqui?** — Bastante (3) / De vez em quando (1) / Quase nada (0)

## Fechamento (perguntas abertas / percepção — não pontuam)
**F_RECLAMA · O que o cliente mais reclama pra você?** (texto livre)
**F_MELHORIA · Se pudesse mudar uma coisa no posto pra facilitar o seu dia, o que seria?** (texto livre)
**F_SENTE · Como você se sente trabalhando neste posto?** — Gosto, me sinto valorizado / Tá ok, dá pra levar / Cansado, queria diferente
