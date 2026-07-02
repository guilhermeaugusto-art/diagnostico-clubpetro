# MAPA COMPLETO · Diagnóstico de Saúde do Posto — ClubPetro v5

## 1. STACK E BUILD

**Frontend:**
- Vite v5.4.10 (ES2020 build target)
- TypeScript v5.6.3 (strict mode, no emit, only type-checking in build)
- Vanilla JavaScript (sem React, sem framework UI)
- Módulos ESNext (no require, import statements)

**Hospedagem e Integração:**
- Firebase Hosting (dist/ como raiz estática)
- Supabase (PostgreSQL, cliente-side via CDN /supabase.js)
- Google Tag Manager (GTM-MKSG5N5R)
- Meta Pixel (ID: 1301228559974191)

**Runtime Dependency:**
- jsPDF v4.2.1 (lazy import na geração de PDF)

**Desenvolvimento:**
```
npm run dev       → Vite HMR em http://localhost:5173
npm run build     → tsc --noEmit + vite build (dist/)
npm run preview   → Serve dist em http://localhost:4173
npm run deploy    → build + firebase deploy --only hosting
```

**Build Output:**
- entry: assets/app-[hash].js
- chunks: assets/chunk-[hash].js
- assets: assets/[name]-[hash][extname]
- CSS inlined (cssCodeSplit: false)

---

## 2. ÁRVORE DE SRC/ COM RESPONSABILIDADES

```
src/
├── main.ts                          Entrypoint: aguarda DOMContentLoaded e chama boot()
├── app.ts                           Orquestrador: máquina de estado imperativa (1140+ linhas)
│                                    - Renderização do DOM a cada mudança de state
│                                    - Listeners de clique (event delegation)
│                                    - Controle de fluxo: Welcome → Question → Transition → Result
│                                    - Integração com API/Supabase/RD/WhatsApp
│
├── components/
│   ├── Header.ts                    Header com contexto (label, progresso de barras)
│   ├── Button.ts                    Componente reutilizável (primary/secondary/ghost, size, icon)
│   ├── AnswerCard.ts                Card de resposta com feedback visual
│   ├── BarsProgress.ts              Gráfico de barras das 6 frentes no header
│   ├── RadarChart.ts                Gráfico radar (SVG) com os 6 pilares
│   ├── Logo.ts                      Logo ClubPetro
│   ├── SectionHeader.ts             Eyebrow + título de seção
│   └── (remoção de LockedCard.ts, RecommendationCard.ts, PillarCard.ts)
│
├── pages/
│   ├── WelcomePage.ts               Tela inicial: nome + WhatsApp + CTA ou resume banner
│   ├── QuestionPage.ts              Pergunta única por tela + AnswerCards + nav anterior/próx
│   ├── TransitionPage.ts            "Calculando..." com frases sequenciais (~2.2s)
│   └── ResultPage.ts                Hero + radar + 6 frentes + recomendações (2 abertas / 6 bloqueadas)
│
├── data/
│   ├── blocks.ts                    6 pilares: pessoas, marca, comercial, fidelização, dados, resiliência
│   ├── questions.ts                 1752 linhas: 40+ perguntas tipadas (S1 + trilhas)
│   ├── levels.ts                    3 faixas: "Improviso" (0–30), "Construção" (31–60), "Consistente" (61–80)
│   ├── recommendations.ts           12+ recomendações práticas (2 abertas, 6+ bloqueadas)
│   ├── radar-reading.ts             Leitura por frente, principais dores, urgência
│   ├── urgency.ts                   Mapeamento de urgência (crítico/neutro/avançado)
│   └── insights.ts                  (não encontrado no projeto atual; lógica em radar-reading.ts)
│
├── lib/
│   ├── config.ts                    Constantes públicas (Supabase, WhatsApp, RD, Raio-X, GTM)
│   ├── state.ts                     Interface AppState, tipos de Answer (Score/Single/Multi/Qualify/Text)
│   ├── storage.ts                   localStorage: save/load/clear state com TTL 7 dias
│   ├── scoring.ts                   Cálculo da nota (ponderada + penalidade dispersão + penalidade vago + teto 85)
│   ├── engine.ts                    Motor adaptativo: trilha, visibilidade de perguntas, sinal crítico/neutro/avançado
│   ├── routing.ts                   Payload para time comercial (nota, nível, frente mais fraca, dor, prontidão)
│   ├── tracking.ts                  Dispara GA/Pixel + bufferiza eventos para Supabase
│   ├── api.ts                       Persistência REST direto ao Supabase (fetch via keepalive)
│   ├── supabase.ts                  Cliente tipado: window.supabase.createClient()
│   ├── context.ts                   Captura RequestContext: UA, referrer, UTM, timestamp
│   ├── format.ts                    Utilities: mask, escape HTML, phone digits, uuid
│   ├── icons.ts                     Mapa SVG inline (não utilizado em Q/A atualmente)
│   ├── renderIcon.ts                Renderização de ícones: asset: ou whatsapp
│   ├── trackImage.ts                Preload + renderização de imagens da trilha DONO
│   ├── trackVideo.ts                Preload + renderização de vídeos MP4 das trilhas frentista/gerente
│   ├── report.ts                    Gerador de PDF client-side (jsPDF)
│   ├── reportContent.ts             Estrutura de conteúdo para PDF
│   └── raiox.ts                     Integração Google Calendar: URL de convite, data próxima sessão
│
└── styles/
    ├── index.css                    Agregador (import de todos os CSS)
    ├── tokens.css                   Design tokens: cores, tipografia, espaçamento (grid 4px), sombras
    ├── reset.css                    CSS reset / normalize
    ├── base.css                     Estilos globais (html, body, inputs)
    ├── animations.css               Keyframes (anim-rise, anim-fade, anim-pulse)
    └── components.css               Classes utilitárias e componentes (.btn-primary, .card, .shell, etc.)
```

---

## 3. FLUXO/ROTAS E MÁQUINA DE ESTADO

**State Principal (AppState):**
```typescript
{
  screen: "welcome" | "question" | "transition" | "result"
  cursor: number                          // índice na lista de perguntas visíveis
  answers: Record<string, Answer>        // respostas por ID de pergunta
  name: string
  phone: string
  email: string
  signal: "critico" | "neutro" | "avancado" | null
  signalLocked: boolean
  startedAt: string | null               // ISO timestamp
  finishedAt: string | null
  diagId: string | null                  // UUID gerado no primeiro mount
}
```

**Transições de Tela:**
```
┌─────────────────────────────────────────────────────────────────┐
│ WELCOME                                                          │
│ - Aceita nome + WhatsApp                                         │
│ - Se tem sessão dentro de 7 dias: "Continuar" vs "Recomeçar"   │
│ - CTA primário: "Quero saber onde meu posto perde dinheiro"     │
├──→ [clica start ou resume] → cursor = 0, screen = "question"
└─────────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────────┐
│ QUESTION LOOP                                                    │
│ - Rendered via QuestionPage.ts                                   │
│ - S1 (pergunta 0): Qual é o seu papel? → define trilha          │
│ - Perguntas 1..N da trilha ativa (dono/gerente/frentista)       │
│ - Auto-avanço após ~380ms se type === "score" ou single         │
│ - Multi-select: botão "Continuar" obrigatório                   │
│ - Voltar sempre disponível (não sai de question)                │
│ - Header mostra: nome da frente atual + barras de progresso     │
│                                                                  │
│ SINAL: após responder os 5 checkpoints (C1, F1, D1, R1, C4):    │
│        - computeSignal() calcula crítico/neutro/avançado        │
│        - state.signalLocked = true                              │
│        - controla visibilidade de perguntas condicionais         │
├──→ [último cursor, clica "Próximo"] → screen = "transition"
└─────────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────────┐
│ TRANSITION                                                       │
│ - Tela de "Calculando..." com frases sequenciais                │
│ - Duração: CONFIG.TRANSITION_MS (5500 ms)                       │
│ - totalScore() executa (ponderação + penalidades)               │
│ - state.finishedAt = now                                        │
│ - Geração de PDF inicia em background                           │
├──→ [timeout] → screen = "result"
└─────────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────────┐
│ RESULT                                                           │
│ - Hero: nota animada 0 → target, nível, leitura                 │
│ - Radar com as 6 frentes (barras)                                │
│ - Seção: 2 recomendações abertas + 6 bloqueadas                │
│ - CTAs: "Fale com Especialista" (WhatsApp) + "Agendar Raio-X"   │
│ - Se não tem telefone/email: gate (campo de contato)            │
│ - Raio-X: integração Google Calendar + confirmar presença       │
│ - PDF: download após conclusão                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. TRILHAS POR PERFIL E DECISÃO

**S1 (Pergunta de Roteamento):**
```
Qual é o seu papel no posto?
├─ "dono" → TRILHA DONO
├─ "gerente" → TRILHA GERENTE
└─ "outro" → TRILHA FRENTISTA
```

**Trilha DONO (D_* questions):**
- Perfil: D_PT_POSTOS (quantos), D_PT_MIX (serviços), D_DOR (o que tira sono)
- Pessoas (peso 18): D_P1–D_P4 (escala, folga, rotatividade, treinamento)
- Marca (peso 12): D_M1–D_M2 (posicionamento, diferencial)
- Comercial (peso 24): D_C1–D_C_LOJA (margem, aditivado, loja, serviços)
- Fidelização (peso 22): D_F1–D_F3 (programa, base, churn, motivo volta)
- Dados (peso 14): D_DA1 (sistema)
- Resiliência (peso 10): D_R1 (guerra de preço)
- Fechamento: D_EXPANDIR, D_CONHECE, D_INTENCAO
- **Visibilidade condicional:** D_C_SERV (se tem troca óleo/lava), D_C_LOJA (se tem loja), D_PADRAO (se 2+ postos)
- **Gera MQL?** Sim, via RD Station + Kommo

**Trilha GERENTE (G_* questions):**
- Perfil: G_PT_TEMPO, G_PT_EQUIPE, G_PT_REDE, G_PT_MIX, G_DOR
- Pessoas (peso 18): G_P1–G_P7 (escala, folga, padrão de atendimento)
- Marca (peso 12): G_M1–G_M2
- Comercial (peso 24): G_C1–G_C_LOJA
- Fidelização (peso 22): G_F1–G_F3
- Dados (peso 14): G_DA1
- Resiliência (peso 10): G_R1
- Fechamento: G_CONHECE
- **Visibilidade condicional:** G_C_SERV, G_C_LOJA
- **Gera MQL?** Sim, via RD Station + Kommo

**Trilha FRENTISTA (F_* questions):**
- Perfil: F_PT_TEMPO, F_PT_AREA, F_PT_TURNO, F_PT_SERVICOS, F_DOR
- Pessoas/dia a dia (peso variável): F_F1–F_P6 (programa, escala, treinamento, ambiente)
- Marca (peso variável): F_M1–F_M2
- Comercial (peso variável): F_C_LOJA, F_C_SERV (condicionais)
- Fidelização (peso variável): F_F1–F_F3
- Fechamento: F_RECLAMA, F_MELHORIA, F_SENTE (campos abertos, sem scoring)
- **Gera MQL?** Não. Pontua para comparação interna apenas.

**Busca da Trilha em app.ts:**
```typescript
const track = currentTrack(state);  // lê state.answers.S1 e faz trackFromS1Value()
```

**Visibilidade de Perguntas:**
```typescript
visibleQuestions(state) → filtra por:
  1. Está na trilha correta
  2. Condição (if q.condition) retorna true
  3. Sinal (se depende de sinal crítico/neutro/avançado)
```

---

## 5. CADEIA DE CÁLCULO DA NOTA

**Função: totalScore(state) em scoring.ts**

1. **blockScores(state):** Para cada frente (pessoas, marca, comercial, etc.)
   - Soma pontos obtidos das respostas score
   - Soma pontos máximos das perguntas score visíveis
   - Normaliza: earned / possible * 100 (por frente)

2. **Ponderação:** Média ponderada das frentes
   ```
   weighted = Σ(pct[frente] × weight[frente])
   base = weighted / sum(weights)
   ```

3. **Penalidade de Dispersão:**
   - Calcula std dev das frentes
   - Penalidade = min(8, stdev × 0.18)
   - Postos desbalanceados recebem desconto

4. **Penalidade por Respostas Vagas:**
   - Conta respostas com vague: true (baixo comprometimento)
   - Penalidade = min(6, vagueCount × 1.5)

5. **Calibração (Teto):**
   ```typescript
   calibrated = base - dispersionPenalty - vaguePenalty
   
   if (calibrated > 70) {
     calibrated = 70 + Math.pow(over, 0.82)
   }
   if (calibrated > 85) {
     calibrated = 85   // teto máximo invisível
   }
   ```

6. **Resultado:** 0–85 (teto interno, nunca 100)

**Componentes Usados:**
- `BLOCKS`: pesos (sempre somam 100)
- `QUESTION_ORDER_BY_TRACK`: perguntas visíveis por trilha
- Visibilidade condicional via `q.condition(read)`

---

## 6. PONTOS DE INTEGRAÇÃO

### **Supabase (LEITURA + ESCRITA)**
- **URL:** https://azmtxhjtqodtaeoshrye.supabase.co
- **Tabela Principal:** diagnostico_respostas
  - id (UUID)
  - nome, email, telefone
  - respostas_json
  - score_total, nivel, sinal
  - events (JSONB, buffer de eventos)
  - status (BOOLEAN — BUG: código trata como string em alguns pontos)
  - created_at, updated_at
- **Acesso:** RLS em modo anon (sem login)
- **Escrita:** REST direto via fetch + keepalive (não supabase-js)
- **Funções:** 
  - createSession(), setSessionName(), setSessionContact(), completeSession()
  - persistAnswer(), persistResult(), persistAgendouRaiox()
  - markRdSent(), resetLocalAnswers(), flushEvents()
  - uploadReports() (PDF para bucket diagnostico-pdfs)

### **RD Station**
- **Edge Function:** `/functions/v1/rd-diagnostico-conversion`
- **Acionado:** Quando lead completa diagnóstico (email + telefone válidos)
- **Payload:** Nota, trilha, dor, frente mais fraca, sinal
- **Saída:** Lead criado como MQL (dono/gerente apenas, não frentista)

### **Kommo (CRM)**
- **Integração:** Via RD Station (webhook)
- **Status:** Lead adicionado como contato no pipeline
- **Campo:** Trilha, nota, próxima ação

### **WhatsApp API**
- **Número Principal:** 5531992697762 (ClubPetro)
- **Número Especialista:** 5531992697762 (Camila, placeholder)
- **Uso:** 
  - WelcomePage CTA → link wa.me
  - ResultPage: "Fale com Especialista" (botão ou badge)
  - Convite para Raio-X após agendamento

### **Google Calendar / Raio-X**
- **Edge Function:** `/functions/v1/confirmar-raiox`
- **Link Meet:** https://meet.google.com/ado-rhwa-kvx (mesmo para todos)
- **Fluxo:**
  1. Usuário clica "Agendar Raio-X"
  2. Abre URL com email pré-preenchido
  3. Edge Function adiciona como convidado
  4. Redirect para RSVP
  5. persistAgendouRaiox() registra confirmação

### **Google Tag Manager (GTM)**
- **ID:** GTM-MKSG5N5R
- **Script:** Injetado em index.html
- **Eventos:** Via gtag('event', name, payload)
- **Rastreio:** página, diagnóstico iniciado, respostas, resultado, CTAs

### **Meta Pixel**
- **ID:** 1301228559974191
- **Script:** Injetado em index.html
- **Eventos:** Via fbq('trackCustom', event, payload)
- **Rastreio:** conversão, lead, resultado

### **Analytics Customizado**
- **Tabela:** diagnostic_events (Supabase)
- **Buffer:** Em-memória durante sessão
- **Flush:** Ao transição, resultado, conclusão
- **Campos:** event_name, event_category, metadata (JSONB), created_at

---

## 7. ASSETS (IMAGENS, ÍCONES, VÍDEOS)

### **Imagens Estáticas (public/)**
- **welcome-hero.mp4** — vídeo loop na Welcome
- **welcome-hero.webm** — fallback WebM
- **welcome-hero.webp** — thumbnail estático
- **favicon.svg** — ícone da aba
- **clubpetro-logo.png** — logo (não encontrado em listagem, assumir public/)
- **og-banner.jpg** — social media card

### **Ícones (public/icons/)**
50+ ícones PNG temáticos:
- Operação: bomba, frentista, atendimento, lavagem
- Gestão: gestao, dados-base, dados-analise, engrenagens
- Financeiro: margem, real, cesta, carrinho
- Cliente: coracao, qualidade, convergencia
- Mercado: concorrencia, equipe-mercado, escudo
- Contexto: lampada, alvo, apresentacao, aviso-triangulo
- Utilidade: whatsapp-color, calendario, cronometro, check-verde

### **Vídeos de Contexto (public/videos/)**

**Trilha Frentista (4 vídeos, ~30s cada):**
- frentista-1-espera.mp4 (poster: frentista-1-espera-poster.jpg)
- frentista-2-abastece.mp4
- frentista-3-limpa.mp4
- frentista-4-acena.mp4

**Trilha Gerente (5 vídeos, ~30s cada):**
- gerente-1-apresenta.mp4
- gerente-2-loja.mp4
- gerente-3-equipe.mp4
- gerente-4-cliente.mp4
- gerente-5-aprova.mp4

**Trilha Dono (5 imagens/blocos WebP, ~200px):**
- dono/dono-1-visao.webp
- dono/dono-2-pessoas.webp
- dono/dono-3-suprimento.webp
- dono/dono-4-dados.webp
- dono/dono-5-expansao.webp

**Renderização:**
- `trackVideo.ts`: mostra vídeo MP4 em bloco lateral (esquerda/direita) conforme pergunta
- `trackImage.ts`: mostra imagem WebP em bloco lateral para trilha DONO
- Preload: `preloadTrackStart()`, `preloadDonoStart()` (em app.ts boot)

---

## 8. DEPENDÊNCIAS E ONDE SÃO USADAS

### **jsPDF v4.2.1**
- **Importação:** Lazy import em report.ts
- **Uso:** generateReportPdf(content) — cria PDF A4 (595×842pt) com capa, qualificação, score, frentes, dor, radar, recomendações
- **Tamanho:** Comprimido (compress: true)
- **Saída:** Blob enviado para upload em Supabase Storage

### **TypeScript v5.6.3**
- **Config:** tsconfig.json (ES2022 lib, strict, no emit)
- **Uso:** Type-checking apenas (tsc --noEmit no build)
- **Diretórios:** src/, vite.config.ts

### **Vite v5.4.10**
- **Config:** vite.config.ts (root: ".", publicDir: "public", outDir: "dist")
- **Build:** ES2020 target, inline CSS (cssCodeSplit: false), asset hashing
- **Dev Server:** HMR em http://localhost:5173

### **window.supabase (CDN via public/supabase.js)**
- **Importação:** Via <script src="/supabase.js" defer> em index.html
- **Uso:** getSupabase() em lib/supabase.ts
- **Operações:** select, insert, update, upsert, storage.upload, createSignedUrl

### **window.gtag (Google Tag Manager)**
- **Importação:** Via GTM script em index.html
- **Uso:** track() em tracking.ts → gtag('event', name, payload)
- **Fallback:** try/catch (não quebra se indisponível)

### **window.fbq (Meta Pixel)**
- **Importação:** Via Pixel script em index.html
- **Uso:** track() em tracking.ts → fbq('trackCustom', event, payload)
- **Fallback:** try/catch

---

## 9. CONFIGURAÇÕES (src/lib/config.ts)

```typescript
export const CONFIG = {
  CLUBPETRO_WHATSAPP: "5531992697762",
  WHATSAPP_ESPECIALISTA: "5531992697762",
  SUPABASE_URL: "https://azmtxhjtqodtaeoshrye.supabase.co",
  SUPABASE_ANON_KEY: "eyJ...",
  RD_CONVERSION_FN: "/functions/v1/rd-diagnostico-conversion",
  CONFIRMAR_RAIOX_FN: "/functions/v1/confirmar-raiox",
  RAIOX_MEET_URL: "https://meet.google.com/ado-rhwa-kvx",
  STATE_KEY: "clubpetro_diag_v5_state",
  STATE_TTL_DAYS: 7,
  TRANSITION_MS: 5500,
  VERSION: "v5",
  PUBLIC_LABEL: "Diagnóstico",
};
```

---

## 10. OBSERVAÇÕES CRÍTICAS E CONHECIDAS

### **Bugs/Problemas Identificados**
1. **status em vm_clientes:** Coluna declarada como BOOLEAN, mas código trata como string em alguns pontos (verificar api.ts)
2. **README menciona "8 pilares":** Documento desatualizado; projeto usa 6 pilares desde v5
3. **Vague responses:** Mecanismo de penalidade presente mas pouco utilizado; perguntas raramente têm vague: true

### **Peculiaridades de Design**
1. **Nota nunca atinge 100:** Teto interno = 85 (invisível). UI mostra máximo "Operação consistente" (61–80)
2. **Frentista não gera MQL:** Trilha frentista pontua internamente, mas não é enviada ao RD Station
3. **Persistência silenciosa:** localStorage com TTL 7 dias, sem aviso visual
4. **Dom imperativo:** app.ts reescreve innerHTML a cada mudança de state (não há VDOM)

### **Integração Pendente**
- Confirmação de Raio-X via Edge Function ainda não valida presença (rayx_attended trigger faltando)
- Envio automático de PDF por email não implementado (usuário baixa manualmente)

---

## 11. MAPA DE ROTAS E ESTADO

| Screen | Componente | State | Listeners | Output |
|--------|-----------|-------|-----------|--------|
| welcome | WelcomePage | name, phone, hasResumable | start, resume, discard | screen→question, diagId criado |
| question | QuestionPage | cursor, answers, signal | answer-selected, prev, next | answers[qId], cursor++/-- |
| transition | TransitionPage | — | timeout (5.5s) | totalScore(), PDF geração inicia |
| result | ResultPage | score, nivel, frentes, recom | specialist_cta, rayx_cta | track(), Supabase upsert, PDF download |

---

## 12. FLUXO DE DADOS COMPLETO (HAPPY PATH)

```
1. Boot (main.ts → app.ts boot())
   └─→ captureContext() [UA, referrer, UTM, timestamp]
   └─→ loadState() [localStorage, TTL check]
   └─→ createSession(diagId) [INSERT em diagnostico_respostas]
   └─→ track('page_viewed', context)
   └─→ preload vídeos/imagens (trackVideo, trackImage)
   └─→ render Welcome

2. Welcome
   └─→ Usuário preenche nome + WhatsApp
   └─→ Clica "Quero saber onde meu posto perde..."
   └─→ state.startedAt = now
   └─→ track('diagnostic_started', { name })
   └─→ setSessionName(diagId, name)
   └─→ render Question (S1)

3. Question Loop
   └─→ S1 (papel) → define track (dono/gerente/frentista)
   └─→ Para cada pergunta (P1..PN):
       └─→ Usuário toca card
       └─→ state.answers[qId] = { kind, ...answer }
       └─→ persistAnswer(diagId, qId, answer)
       └─→ track('answer_selected', { qId, type, time })
       └─→ Sinal? Após 5 checkpoints: computeSignal() → state.signal
       └─→ Auto-avança ou aguarda botão
   └─→ Último cursor: "Próximo" → transition

4. Transition
   └─→ totalScore(state) [ponderação + penalidades + teto]
   └─→ state.finishedAt = now
   └─→ generateReportPdf(reportContent) [lazy jsPDF]
   └─→ persistResult(diagId, score, nivel, frentes)
   └─→ track('result_viewed', { score, nivel, signal })
   └─→ Transição visual 5.5s
   └─→ render Result

5. Result
   └─→ Hero: nota animada 0→score
   └─→ Radar: 6 frentes com barras
   └─→ Recomendações: 2 abertas + 6 bloqueadas
   └─→ CTAs: "Especialista" + "Raio-X"
   └─→ Gate: se não tem phone/email, campo inline
   └─→ Usuário preenche contato
   └─→ setSessionContact(diagId, name, email, phone)
   └─→ buildRoutingPayload(state) [para comercial]
   └─→ fetch(RD_CONVERSION_FN, payload) [async, não bloqueia]
   └─→ track('diagnostic_completed')
   └─→ Usuário clica "Agendar Raio-X"
   └─→ CONFIRMAR_RAIOX_FN [email → Google Calendar invite]
   └─→ persistAgendouRaiox(diagId, meetUrl)
   └─→ track('rayx_scheduled')
   └─→ Usuário baixa PDF
   └─→ uploadReports(diagId, pdfBlob)
   └─→ track('report_generated')
   └─→ flushEvents() [Supabase events JSONB]

6. Fechamento
   └─→ completeSession(diagId) [marcar finais no DB]
   └─→ localStorage.setItem(STATE_KEY, JSON.stringify(state))
   └─→ Navegação segura (keepalive garante requests)
```

---

## 13. ESTRUTURA DO BANCO (RESUMIDO)

### **Tabela: diagnostico_respostas**
```sql
id                          UUID PK
nome                        text
email                       text
telefone                    text
respostas_json              JSONB
score_total                 integer
nivel                       text
sinal                       text
status                      BOOLEAN (BUG: treated as string in some places)
events                      JSONB (array of {at, name, category, metadata})
agendou_raiox               BOOLEAN
rd_enviado                  BOOLEAN
pdf_url                     text
created_at                  timestamp
updated_at                  timestamp
```

### **Tabela: diagnostic_events** (histórico)
```sql
id                          UUID PK
session_id                  UUID FK
created_at                  timestamp
event_name                  text
event_category              text
metadata                    JSONB
```

---

## 14. REGRAS DO PROJETO (RULES.md RESUMO)

### **Copy**
- Sem travessão (— ou –), sem reticências (...)
- Sem emoji, sem inglês fora de jargão
- CTA: benefício em 1ª pessoa ("Quero saber...")
- "Fale com um Especialista ClubPetro" (nunca nome de operador)
- Termos proibidos: "gestão no escuro", "feeling", "sem login", "onde dói"
- Termos canônicos: "6 frentes", "análise das 6 frentes", "plano de ação por frente"

### **Layout**
- Grid base 4px: tokens --sp-*
- Padding card: 20px mobile / 24px desktop
- Line-length: 60ch mobile / 70ch desktop
- Mínimo touch: 48px altura
- Container (.shell): max-width 1180px, padding fluido

### **UX**
- Um único primário por viewport
- Sem duplicação de comando (continuar XOR começar)
- Auto-avanço em score/single após ~300ms
- Multi-select: botão obrigatório
- Voltar sempre possível (exceto welcome)
- Progresso visível discreto (header + radar mini)
- Sem nota numérica durante diagnóstico
- Persistência silenciosa (localStorage)

### **Acessibilidade**
- Foco: outline 2px orange
- Contraste mínimo AA
- prefers-reduced-motion zera animações
- aria-live em score/transições
- role="radiogroup" em opções

---

## 15. RESUMO TÉCNICO

| Aspecto | Detalhe |
|---------|---------|
| **Linguagem** | TypeScript (5.6.3), strict mode |
| **Framework** | Vite (5.4.10), vanilla JS (sem React) |
| **DOM** | Imperativo (innerHTML rewrite por state) |
| **Styling** | CSS puro (tokens + design system) |
| **State** | AppState (localStorage + Supabase) |
| **Build** | ES2020, CSS inlined, asset hashing |
| **Deploy** | Firebase Hosting (dist/) |
| **BD** | Supabase (PostgreSQL, RLS anon) |
| **APIs** | RD Station, Kommo, WhatsApp, Google Calendar |
| **Tracking** | GTM + Meta Pixel + diagnostic_events |
| **PDF** | jsPDF (lazy load, A4, compress) |
| **Moeda** | Real (BRL), sem menção de preço no código |
| **Tempo** | 7-15 min de quiz, ~2.2s transição |

---

**Mapa atualizado:** 2026-07-02 13:30 UTC  
**Versão do projeto:** v5.0.0  
**Stack confirmado:** Vite + TypeScript + Vanilla JS
