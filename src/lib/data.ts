// =============================================================
// Data fetching — used at build time by Astro pages
// =============================================================
import { supabase } from "./supabase";
import type {
  PresidenteLatest,
  GovernadorLatest,
  BuzzLatest,
  StateSummary,
} from "./types";

export async function getPresidenteRanking(): Promise<PresidenteLatest[]> {
  const { data, error } = await supabase
    .from("v_presidente_latest")
    .select("*")
    .order("media_ponderada", { ascending: false });

  if (error) {
    console.error("Failed to fetch presidente ranking:", error);
    return [];
  }
  return data ?? [];
}

export async function getGovernadorRanking(
  uf?: string
): Promise<GovernadorLatest[]> {
  let query = supabase
    .from("v_governador_latest")
    .select("*")
    .order("media_ponderada", { ascending: false });

  if (uf) {
    query = query.eq("uf", uf.toUpperCase());
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch governador ranking:", error);
    return [];
  }
  return data ?? [];
}

export async function getBuzzRanking(
  cargo?: string
): Promise<BuzzLatest[]> {
  let query = supabase
    .from("v_buzz_latest")
    .select("*")
    .order("volume_composto", { ascending: false });

  if (cargo) {
    query = query.eq("cargo", cargo);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch buzz ranking:", error);
    return [];
  }
  return data ?? [];
}

export async function getStateSummaries(): Promise<StateSummary[]> {
  const { data, error } = await supabase.rpc("get_state_summary");
  if (error) {
    console.error("Failed to fetch state summaries:", error);
    return [];
  }
  return data ?? [];
}

export async function getPollHistory(
  candidateId: string,
  days: number = 90
): Promise<Array<{ data: string; media_simples: number; media_ponderada: number }>> {
  const { data, error } = await supabase.rpc("get_poll_history", {
    p_candidate_id: candidateId,
    p_days: days,
  });
  if (error) {
    console.error("Failed to fetch poll history:", error);
    return [];
  }
  return data ?? [];
}

export async function getBuzzHistory(
  candidateId: string,
  days: number = 30
): Promise<Array<{ data: string; volume_composto: number; sentimento_composto: number }>> {
  const { data, error } = await supabase.rpc("get_buzz_history", {
    p_candidate_id: candidateId,
    p_days: days,
  });
  if (error) {
    console.error("Failed to fetch buzz history:", error);
    return [];
  }
  return data ?? [];
}

export async function getLastCollectionTime(): Promise<string | null> {
  const { data } = await supabase
    .from("collection_log")
    .select("created_at")
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data?.created_at ?? null;
}
