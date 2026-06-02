import { CONFIG } from "./config";

interface SupabaseLike {
  from: (table: string) => {
    insert: (payload: unknown) => Promise<{ error: unknown }>;
  };
}

declare global {
  interface Window {
    supabase?: {
      createClient: (url: string, key: string) => SupabaseLike;
    };
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

let sb: SupabaseLike | null = null;

export function getSupabase(): SupabaseLike | null {
  if (sb) return sb;
  if (CONFIG.SUPABASE_URL && window.supabase) {
    try {
      sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    } catch (e) {
      console.error("Supabase init falhou:", e);
    }
  }
  return sb;
}
