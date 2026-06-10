/* Raio X do Posto: sessao ao vivo, toda terca as 19h (America/Sao_Paulo).
   Sala unica e compartilhada (sem Meet dinamico). A confirmacao de presenca
   passa pela Edge Function `confirmar-raiox`, que adiciona o lead ao evento
   unico do Google Calendar e o redireciona para o RSVP. Aqui ficam apenas os
   helpers de data, usados para exibir a proxima sessao no resultado. */

import { CONFIG } from "./config";

/* Proxima terca-feira as 19h. Se ja passou da terca 19h desta semana, vai para
   a proxima. Mesma regra da spec (Bloco 2.2). */
export function proximaTercaAs19(): Date {
  const agora = new Date();
  const d = new Date(agora);
  const delta = (2 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  d.setHours(19, 0, 0, 0);
  if (d <= agora) d.setDate(d.getDate() + 7);
  return d;
}

/* Data curta da proxima sessao, no formato "DD/MM", para a linha
   "Proxima sessao: terca, {data}, as 19h". */
export function dataProximaSessao(): string {
  const d = proximaTercaAs19();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
}

/* Texto curto do link do Meet (sem o https://), para exibir abaixo do botao. */
export function meetLabel(): string {
  return CONFIG.RAIOX_MEET_URL.replace(/^https?:\/\//, "");
}

/* Formato de data do Google Calendar (hora local, sem Z): YYYYMMDDTHHMMSS.
   Combinado com ctz=America/Sao_Paulo, fixa a sessao em 19h de Brasilia. */
function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
    "T" + p(d.getHours()) + p(d.getMinutes()) + "00";
}

/* Link "Adicionar a agenda" do Google (TEMPLATE). Abre a agenda do proprio
   lead, ja preenchida (titulo, proxima terca 19h, Meet fixo), para ele salvar
   com um clique. Funciona em QUALQUER conta, sem depender de convite por e-mail
   nem de permissao no evento compartilhado. Todos caem na mesma sala do Meet. */
export function linkAgendaRaioX(): string {
  const ini = proximaTercaAs19();
  const fim = new Date(ini.getTime() + 3600000);
  const detalhes =
    "Sessao ao vivo do Raio X do Posto, do ClubPetro." +
    "\n\nEntre pelo link: " + CONFIG.RAIOX_MEET_URL;
  const u = new URL("https://calendar.google.com/calendar/render");
  u.searchParams.set("action", "TEMPLATE");
  u.searchParams.set("text", "Raio X do Posto, ClubPetro");
  u.searchParams.set("dates", fmt(ini) + "/" + fmt(fim));
  u.searchParams.set("ctz", "America/Sao_Paulo");
  u.searchParams.set("details", detalhes);
  u.searchParams.set("location", CONFIG.RAIOX_MEET_URL);
  return u.toString();
}
