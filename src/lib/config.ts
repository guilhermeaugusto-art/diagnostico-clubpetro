// Public, client-safe config. Supabase anon key is by design exposed (RLS protects it).
export const CONFIG = {
  /* WhatsApp do especialista para o CTA de contato direto do resultado.
     Número: +55 35 99839-4401. */
  WHATSAPP_ESPECIALISTA: "5535998394401",
  SUPABASE_URL: "https://azmtxhjtqodtaeoshrye.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6bXR4aGp0cW9kdGFlb3NocnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI4NTM1ODUsImV4cCI6MjAyODQyOTU4NX0.KvQovDvmATwBPc50oqnY_yJqjqoywZdSXm_bz5qn4V0",
  /* RD_CONVERSION_FN removido (05/08): o envio ao RD é 100% do backend, via
     triggers do banco (rd_diagnostico_inicio no e-mail, rd_diagnostico_conversion
     no flip de concluiu) + sweep da esteira. O front não chama mais a função. */
  /* Confirmacao de presenca no Raio X: a Edge Function adiciona o lead como
     convidado do evento UNICO compartilhado e o redireciona para o RSVP.
     Mesma sala para todos, sem gerar Meet dinamico. */
  CONFIRMAR_RAIOX_FN: "/functions/v1/confirmar-raiox",
  RAIOX_MEET_URL: "https://meet.google.com/ado-rhwa-kvx",
  STATE_KEY: "clubpetro_diag_v5_state",
  STATE_TTL_DAYS: 7,
  TRANSITION_MS: 5500,
  VERSION: "v5",
} as const;
