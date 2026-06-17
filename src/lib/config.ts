// Public, client-safe config. Supabase anon key is by design exposed (RLS protects it).
export const CONFIG = {
  CLUBPETRO_WHATSAPP: "5531992697762",
  /* WhatsApp do especialista (Camila) para o CTA secundario do resultado.
     Placeholder ate o numero ser informado: cai no WhatsApp geral por enquanto. */
  WHATSAPP_ESPECIALISTA: "5531992697762",
  SUPABASE_URL: "https://azmtxhjtqodtaeoshrye.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6bXR4aGp0cW9kdGFlb3NocnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI4NTM1ODUsImV4cCI6MjAyODQyOTU4NX0.KvQovDvmATwBPc50oqnY_yJqjqoywZdSXm_bz5qn4V0",
  RD_CONVERSION_FN: "/functions/v1/rd-diagnostico-conversion",
  /* Confirmacao de presenca no Raio X: a Edge Function adiciona o lead como
     convidado do evento UNICO compartilhado e o redireciona para o RSVP.
     Mesma sala para todos, sem gerar Meet dinamico. */
  CONFIRMAR_RAIOX_FN: "/functions/v1/confirmar-raiox",
  RAIOX_MEET_URL: "https://meet.google.com/ado-rhwa-kvx",
  STATE_KEY: "clubpetro_diag_v5_state",
  STATE_TTL_DAYS: 7,
  TRANSITION_MS: 5500,
  VERSION: "v5",
  /* Label exibido na barra superior (oculto do usuário; a versão fica só em payloads). */
  PUBLIC_LABEL: "Diagnóstico",
} as const;
