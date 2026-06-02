/* Cliente Supabase tipado para o diagnóstico.
   Carrega supabase-js do CDN via window.supabase (já incluído em /supabase.js).
   Adiciona helpers tipados para insert/update/select/storage. */

import { CONFIG } from "./config";

type FilterEq = (col: string, val: unknown) => Query;
type QuerySelect = (cols?: string) => Query;
type SingleFn = () => Promise<{ data: unknown; error: unknown }>;

interface Query {
  select: QuerySelect;
  eq: FilterEq;
  order: (col: string, opts?: { ascending?: boolean }) => Query;
  limit: (n: number) => Query;
  single: SingleFn;
  maybeSingle: SingleFn;
  then: (cb: (r: { data: unknown; error: unknown }) => void) => void;
}

interface TableQuery {
  insert: (payload: unknown) => Query;
  update: (payload: unknown) => Query;
  upsert: (payload: unknown, opts?: { onConflict?: string }) => Query;
  select: QuerySelect;
  delete: () => Query;
}

interface StorageBucket {
  upload: (path: string, file: Blob | File, opts?: { contentType?: string; upsert?: boolean }) =>
    Promise<{ data: { path: string } | null; error: unknown }>;
  createSignedUrl: (path: string, expiresIn: number) =>
    Promise<{ data: { signedUrl: string } | null; error: unknown }>;
}

interface SupabaseLike {
  from: (table: string) => TableQuery;
  storage: { from: (bucket: string) => StorageBucket };
}

declare global {
  interface Window {
    supabase?: {
      createClient: (url: string, key: string, opts?: unknown) => SupabaseLike;
    };
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

let sb: SupabaseLike | null = null;

export function getSupabase(): SupabaseLike | null {
  if (sb) return sb;
  if (typeof window === "undefined") return null;
  if (CONFIG.SUPABASE_URL && window.supabase) {
    try {
      sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    } catch (e) {
      console.error("Supabase init falhou:", e);
    }
  }
  return sb;
}
