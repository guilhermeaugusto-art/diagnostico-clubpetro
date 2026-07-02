/* Raio X do Posto: sessao ao vivo, toda terca as 11h (America/Sao_Paulo).
   Sala unica e compartilhada (sem Meet dinamico). A confirmacao de presenca
   passa pela Edge Function `confirmar-raiox`, que adiciona o lead ao evento
   unico do Google Calendar e o redireciona para o RSVP. Aqui ficam apenas os
   helpers de data, usados para exibir a proxima sessao no resultado. */

import { CONFIG } from "./config";

/* Proxima terca-feira as 11h. Se ja passou da terca 11h desta semana, vai para
   a proxima. Mesma regra da spec (Bloco 2.2). */
export function proximaTercaAs11(): Date {
  // "Agora" no relogio de Sao Paulo, independente do fuso do navegador do
  // usuario (evita a data sair deslocada para quem acessa de outro fuso).
  const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const d = new Date(agora);
  const delta = (2 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  d.setHours(11, 0, 0, 0);
  if (d <= agora) d.setDate(d.getDate() + 7);
  return d;
}

/* Data curta da proxima sessao, no formato "DD/MM", para a linha
   "Proxima sessao: terca, {data}, as 11h". */
export function dataProximaSessao(): string {
  const d = proximaTercaAs11();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
}

/* Texto curto do link do Meet (sem o https://), para exibir abaixo do botao. */
export function meetLabel(): string {
  return CONFIG.RAIOX_MEET_URL.replace(/^https?:\/\//, "");
}

/* Link "salvar na agenda" do Google Calendar, com o evento do Raio X JA
   pre-preenchido (titulo, proxima terca 11h America/Sao_Paulo, sala do Meet).
   Ao abrir, a pessoa cai direto na tela de criar evento NA AGENDA DELA e e so
   clicar em Salvar, entao o evento fica de verdade no calendario dela (nao
   depende de aceitar convite de convidado). */
export function calendarTemplateUrl(email?: string): string {
  const d = proximaTercaAs11(); // relogio de Sao Paulo (getHours() === 11)
  const pad = (n: number): string => String(n).padStart(2, "0");
  const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const dates = `${ymd}T110000/${ymd}T120000`; // 11h as 12h
  const meet = CONFIG.RAIOX_MEET_URL;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Raio X do Posto · ClubPetro",
    dates,
    details:
      "Sessao ao vivo do Raio X do seu posto com um Especialista ClubPetro.\n" +
      "Entre pela sala do Meet: " + meet,
    location: meet,
    ctz: "America/Sao_Paulo",
  });
  // E-mail do formulario: dica de conta pro Google abrir logado na conta certa
  // (authuser) e reduzir a etapa manual de login. Ignorado se nao logado nela.
  const clean = (email || "").trim();
  if (clean.includes("@")) params.set("authuser", clean);
  return "https://calendar.google.com/calendar/render?" + params.toString();
}
