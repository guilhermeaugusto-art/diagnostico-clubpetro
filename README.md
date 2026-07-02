# Diagnóstico de Saúde do Posto · ClubPetro

Aplicação web mobile-first que mede a saúde da operação de um posto de combustíveis
em **6 frentes** (comercial, fidelização, equipe/pessoas, dados, marca, resiliência),
gera nota 0-100 e mostra um plano de ação por frente, capturando o lead via
WhatsApp + e-mail (Supabase + RD Station).

## Stack

- **Front-end:** Vite + TypeScript (módulos ES, sem framework)
- **Hospedagem:** Firebase Hosting (estático em `dist/`)
- **Banco:** Supabase (PostgreSQL) — tabela única `diagnostico_respostas`
- **CRM:** RD Station via Edge Function (`/functions/v1/rd-diagnostico-conversion`)
- **Raio-X:** Google Calendar/Meet via Edge Function (`/functions/v1/confirmar-raiox`)

## Estrutura

```
diagnostico-clubpetro/
├── index.html                # entry HTML (Vite) + GTM + Meta Pixel
├── public/                   # assets estáticos servidos direto
│   ├── supabase.js           # lib supabase-js (vendorizada)
│   ├── favicon.svg
│   ├── welcome-hero.*        # vídeo do hero (mp4/webm/webp)
│   ├── videos/               # vídeos das trilhas (frentista/gerente)
│   ├── dono/                 # imagens da trilha do dono
│   └── icons/                # PNGs do catálogo de ícones
├── src/
│   ├── main.ts               # bootstrap
│   ├── app.ts                # orquestrador (estado, fluxo, eventos, integrações)
│   ├── styles/               # design system (tokens, reset, base, animations, components)
│   ├── components/           # UI: AnswerCard, BarsProgress, Button, Header, Logo, RadarChart
│   ├── pages/                # telas: WelcomePage, QuestionPage, TransitionPage, ResultPage
│   ├── data/                 # blocks (6 frentes), questions, levels, radar-reading, recommendations, urgency
│   └── lib/                  # núcleo: config, state, scoring, engine, routing, storage,
│                             #         api, supabase, raiox, report, tracking, format, context
├── supabase/migrations/      # schema de diagnostico_respostas + storage
├── firebase.json             # Hosting → dist/
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Desenvolvimento

```bash
npm install
npm run dev          # http://localhost:5173 (HMR)
npm run build        # type-check (tsc --noEmit) + bundle em dist/
npm run preview      # serve dist/ em http://localhost:4173
npm run deploy       # build + firebase deploy --only hosting
```

## Configuração

As constantes públicas ficam em `src/lib/config.ts`:

| Chave | Descrição |
|---|---|
| `CLUBPETRO_WHATSAPP` | Número geral (DDI+DDD+número, sem máscara) |
| `WHATSAPP_ESPECIALISTA` | Número do CTA "Fale com um Especialista" |
| `SUPABASE_URL` | URL base do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave `anon` (pública por design — RLS protege) |
| `RD_CONVERSION_FN` | Edge Function que envia o lead ao RD Station |
| `CONFIRMAR_RAIOX_FN` | Edge Function que confirma presença no Raio-X |
| `RAIOX_MEET_URL` | Sala do Meet do Raio-X semanal |
| `STATE_KEY` / `STATE_TTL_DAYS` | Chave/expiração do `localStorage` (7 dias) |
| `TRANSITION_MS` | Duração da transição visual antes do resultado |

## Como funciona o fluxo

1. **Welcome** — Nome + WhatsApp (lado a lado no desktop, empilhado no mobile). Preencher libera o quiz e já registra o contato.
2. **Perguntas** — Trilha adaptativa por perfil (dono, gerente, frentista), decidida no S1. Cards de resposta; resposta única avança sozinha, múltipla tem "Continuar".
3. **Transição** — Animação de "calculando" antes do resultado.
4. **Resultado**
   - **Dono/gerente:** um pop-up obrigatório pede o e-mail para liberar a análise; é nesse momento que o lead vai ao RD/Kommo. Em seguida: nota + radar das 6 frentes, plano por frente, bloco do Raio-X (confirmar na agenda) e CTA "Fale com um Especialista ClubPetro".
   - **Frentista:** resultado direto (não gera lead), com CTA para compartilhar o diagnóstico.

A regra de negócio do fluxo (reward-first, portão de e-mail, copy) está em `RULES.md`.

## Persistência

Estado salvo em `localStorage` a cada interação. Se o usuário fechar e voltar em até 7 dias,
o banner "Continuar de onde parei" aparece na tela inicial.

## Notas

- A copy do CTA de contato direto é sempre **"Fale com um Especialista ClubPetro"** — nunca nome de operador.
- Sem travessão, sem reticências, sem emoji e sem anglicismo desnecessário na copy de usuário (ver `RULES.md`).
- Alinhamento em grid base 4 (4/8/12/16/24/32/48).
- Animações respeitam `prefers-reduced-motion`.
