# Diagnóstico de Saúde do Posto · ClubPetro

Aplicação web mobile-first que mede a saúde da operação de um posto de combustíveis
em 8 pilares, gera nota 0-100, mostra recomendações práticas (2 abertas + 8
bloqueadas) e captura o lead via WhatsApp/Supabase/RD Station.

## Stack

- **Front-end:** Vite + TypeScript (módulos ES, sem framework)
- **Hospedagem:** Firebase Hosting (estático em `dist/`)
- **Banco:** Supabase (PostgreSQL) — tabela `diagnostico_respostas` + `diagnostico_eventos`
- **CRM:** RD Station via Edge Function (`/functions/v1/rd-diagnostico-conversion`)

## Estrutura

```
diagnostico-clubpetro/
├── index.html                # entry HTML (Vite)
├── public/                   # assets estáticos copiados pro build
│   ├── supabase.js           # bundle do supabase-js
│   ├── clubpetro-logo.png
│   ├── favicon.svg
│   └── og-banner.jpg
├── src/
│   ├── main.ts               # bootstrap
│   ├── app.ts                # orquestrador (estado, fluxo, eventos)
│   ├── styles/               # design system
│   │   ├── tokens.css        # cores, tipografia, espaçamento, sombras
│   │   ├── reset.css
│   │   ├── base.css
│   │   ├── animations.css
│   │   └── components.css
│   ├── components/           # UI reutilizável
│   │   ├── Header.ts
│   │   ├── ProgressBar.ts
│   │   ├── Logo.ts
│   │   ├── Button.ts
│   │   ├── AnswerCard.ts
│   │   ├── PillarCard.ts
│   │   ├── RecommendationCard.ts
│   │   ├── LockedCard.ts
│   │   └── SectionHeader.ts
│   ├── pages/                # telas
│   │   ├── WelcomePage.ts
│   │   ├── QuestionPage.ts
│   │   ├── PhonePage.ts
│   │   ├── TransitionPage.ts
│   │   └── ResultPage.ts
│   ├── data/                 # dados estáticos do diagnóstico
│   │   ├── blocks.ts         # 8 pilares (id, nome, max, ícone)
│   │   ├── questions.ts      # 17 perguntas tipadas
│   │   ├── levels.ts         # faixas de nota (0-30, 31-60, etc.)
│   │   ├── insights.ts       # leitura por pilar (high/mid/low)
│   │   └── recommendations.ts# pool de recomendações + builder
│   └── lib/                  # núcleo (puro, sem UI)
│       ├── config.ts
│       ├── state.ts
│       ├── scoring.ts
│       ├── storage.ts        # localStorage
│       ├── tracking.ts       # gtag + fbq + Supabase events
│       ├── supabase.ts
│       ├── format.ts         # mask, escape, uuid
│       └── icons.ts          # SVG inline (universo postos)
├── firebase.json             # Hosting → dist/
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Desenvolvimento

```bash
npm install
npm run dev          # http://localhost:5173 (HMR)
npm run build        # type-check + bundle em dist/
npm run preview      # serve dist/ em http://localhost:4173
npm run deploy       # build + firebase deploy --only hosting
```

## Configuração

As constantes ficam em `src/lib/config.ts`:

| Chave | Descrição |
|---|---|
| `CLUBPETRO_WHATSAPP` | Número (DDI+DDD+número, sem máscara) |
| `SUPABASE_URL` | URL base do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave `anon` (pública por design — RLS protege) |
| `RD_CONVERSION_FN` | Caminho da Edge Function que envia ao RD Station |
| `RAIOX_MEET_LINK` | Link do Meet do RaioX semanal |
| `STATE_KEY` / `STATE_TTL_DAYS` | Chave/expiração do `localStorage` |
| `TRANSITION_MS` | Duração da transição visual antes do resultado |

## Como funciona o fluxo

1. **Welcome** — Tela inicial com hero, identidade ClubPetro, pillar chips e CTA principal.
2. **17 perguntas** — Cards de resposta com ícone, título e descrição. Toque seleciona e avança automaticamente após ~380ms.
3. **Telefone** — Captura do WhatsApp com máscara, validação e botão habilitado quando válido.
4. **Transição** — ~2.2s de "calculando" com frases sequenciais.
5. **Resultado** — Hero escuro com nota animada (0→target), nível, 8 pilares com barras (2 abertos / 6 bloqueados), 2 recomendações práticas abertas e 8 bloqueadas/borradas, dois CTAs (WhatsApp do especialista + RaioX no Calendar).

## Persistência

Estado salvo em `localStorage` a cada interação. Se o usuário fechar e voltar em até 7 dias,
o banner "Continuar de onde parei" aparece na tela inicial.

## Notas

- A copy do CTA principal é sempre **"Fale com um Especialista ClubPetro"** — nunca nome de operador.
- Alinhamento rigoroso em grid 4/8/12/16/24/32/48 (sem números fora do padrão).
- Animações respeitam `prefers-reduced-motion`.
