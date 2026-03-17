import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

// Public client (read-only, used by Astro pages at build time)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Service client (read-write, used by collection scripts)
export function getServiceClient(): SupabaseClient {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_KEY is required for write operations");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Helper: log collection run
export async function logCollection(
  client: SupabaseClient,
  source: string,
  status: "success" | "partial" | "error",
  stats: {
    records_inserted?: number;
    records_updated?: number;
    error_message?: string;
    duration_ms?: number;
    metadata?: Record<string, unknown>;
  }
) {
  await client.from("collection_log").insert({
    source,
    status,
    ...stats,
  });
}
