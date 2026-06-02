// Public, client-safe config. Supabase anon key is by design exposed (RLS protects it).
export const CONFIG = {
  CLUBPETRO_WHATSAPP: "5531992697762",
  SUPABASE_URL: "https://azmtxhjtqodtaeoshrye.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6bXR4aGp0cW9kdGFlb3NocnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI4NTM1ODUsImV4cCI6MjAyODQyOTU4NX0.KvQovDvmATwBPc50oqnY_yJqjqoywZdSXm_bz5qn4V0",
  RD_CONVERSION_FN: "/functions/v1/rd-diagnostico-conversion",
  RAIOX_MEET_LINK: "https://meet.google.com/vrs-okib-yum",
  STATE_KEY: "clubpetro_diag_v5_state",
  STATE_TTL_DAYS: 7,
  TRANSITION_MS: 2200,
  VERSION: "v5",
  /* Label exibido na barra superior (oculto do usuário; a versão fica só em payloads). */
  PUBLIC_LABEL: "Diagnóstico",
} as const;
