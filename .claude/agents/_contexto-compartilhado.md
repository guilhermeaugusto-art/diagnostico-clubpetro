# Contexto compartilhado (todos os agentes leem antes de agir)

**Stack real (confirmado no package.json, NÃO assumir):** Vite + TypeScript puro (vanilla).
NÃO é React. Sem JSX, sem framework de UI. Entrada `src/main.ts` -> `src/app.ts`
(router e máquina de estado imperativa). Única dependência de runtime: `jspdf`.
CSS em `src/styles/*.css`. Dados do quiz em `src/data/questions.ts`.
Ao falar de "re-render", traduzir para termos de DOM imperativo, não React.

**Produto:** quiz que avalia postos de combustível em 6 frentes
(comercial, fidelização, equipe, dados, marca, resiliência), nota 0 a 100 com
teto interno que NUNCA chega a 100 (mecânica de vendas, invisível na UI).
Trilhas por perfil: dono, gerente, frentista.

**Backend Supabase, SOMENTE LEITURA.** Tabelas: `vm_clientes`, `diagnostico_respostas`,
`BD_Leads_Kommo`. ATENÇÃO: a coluna `status` em `vm_clientes` é BOOLEAN, não string.
Qualquer código tratando `status` como texto é bug. Nenhum agente muta dado.

**Integrações:** RD Station (marketing), Kommo (CRM), WhatsApp API, Google Agenda.
Vídeos: existem `.mp4`/`.webm` locais em `public/videos/`; verificar se há também
embeds de YouTube. Não assumir.

**Copy (RULES.md §3, é lei):** sem travessão (— –) e sem reticências (...); sem emoji;
sem inglês fora de jargão de mercado; CTA sempre frase de benefício em 1ª pessoa;
proibidas as expressões "gestão no escuro", "feeling", "no escuro"; a nota nunca
tem teto visível (usar "nenhum posto está totalmente otimizado"); "Fale com um
Especialista ClubPetro" é o CTA oficial de contato, nunca com nome de operador.

**Regra de ouro dos auditores:** SOMENTE LEITURA. Encontram e reportam, não editam.
A única escrita permitida é o próprio relatório em `audit/`. Nunca tocar em `src/`.
Todo achado aponta arquivo, linha, evidência, impacto e severidade.
