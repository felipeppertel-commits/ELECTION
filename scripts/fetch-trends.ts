// =============================================================
// Fetch Google Trends — Interest over time by state
// Usage: npm run fetch:trends
// =============================================================
import { createClient } from "@supabase/supabase-js";
// @ts-ignore — no types for this package
import googleTrends from "google-trends-api";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const today = new Date().toISOString().split("T")[0];
const hora = new Date().toTimeString().split(" ")[0].slice(0, 5) + ":00";

interface TrendsResult {
  default: {
    geoMapData: Array<{
      geoCode: string;
      geoName: string;
      value: number[];
      maxValueIndex: number;
    }>;
  };
}

async function fetchTrendsForCandidate(
  candidateId: string,
  searchTerm: string
): Promise<{ volume: number; byState: Record<string, number> }> {
  try {
    const result = await googleTrends.interestByRegion({
      keyword: searchTerm,
      geo: "BR",
      resolution: "REGION",
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
    });

    const parsed: TrendsResult = JSON.parse(result);
    const regions = parsed.default?.geoMapData ?? [];

    // Map Google's region names to UF codes
    const stateMap: Record<string, string> = {
      "State of São Paulo": "SP", "State of Rio de Janeiro": "RJ",
      "State of Minas Gerais": "MG", "State of Bahia": "BA",
      "State of Paraná": "PR", "State of Rio Grande do Sul": "RS",
      "State of Pernambuco": "PE", "State of Ceará": "CE",
      "State of Pará": "PA", "State of Maranhão": "MA",
      "State of Santa Catarina": "SC", "State of Goiás": "GO",
      "State of Amazonas": "AM", "State of Espírito Santo": "ES",
      "State of Paraíba": "PB", "State of Rio Grande do Norte": "RN",
      "State of Mato Grosso": "MT", "State of Alagoas": "AL",
      "State of Piauí": "PI", "State of Sergipe": "SE",
      "State of Mato Grosso do Sul": "MS", "State of Rondônia": "RO",
      "State of Tocantins": "TO", "State of Acre": "AC",
      "State of Amapá": "AP", "State of Roraima": "RR",
      "Federal District": "DF",
    };

    const byState: Record<string, number> = {};
    let totalVolume = 0;

    for (const region of regions) {
      const uf = stateMap[region.geoName];
      if (uf) {
        byState[uf] = region.value[0] ?? 0;
        totalVolume += region.value[0] ?? 0;
      }
    }

    return { volume: totalVolume, byState };
  } catch (err) {
    console.warn(`⚠ Trends failed for "${searchTerm}":`, (err as Error).message);
    return { volume: 0, byState: {} };
  }
}

async function main() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting Google Trends collection...`);

  // Get active candidates
  const { data: candidates, error } = await supabase
    .from("candidates")
    .select("id, nome_urna")
    .eq("ativo", true);

  if (error || !candidates) {
    console.error("Failed to fetch candidates:", error);
    process.exit(1);
  }

  let inserted = 0;
  const allVolumes: number[] = [];

  for (const candidate of candidates) {
    const { volume, byState } = await fetchTrendsForCandidate(
      candidate.id,
      candidate.nome_urna
    );
    allVolumes.push(volume);

    // Store raw data
    const { error: insertErr } = await supabase
      .from("social_buzz")
      .upsert(
        {
          candidate_id: candidate.id,
          data: today,
          hora,
          source: "google_trends",
          volume_raw: volume,
          volume_normalized: 0, // normalized after all candidates collected
          sentiment_score: 0, // Trends doesn't have sentiment
          sample_size: Object.keys(byState).length,
          metadata: { by_state: byState },
        },
        { onConflict: "candidate_id,data,hora,source" }
      );

    if (insertErr) {
      console.warn(`⚠ Insert failed for ${candidate.nome_urna}:`, insertErr.message);
    } else {
      inserted++;
    }

    // Rate limit: wait 2s between requests
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Normalize volumes (0-100 relative to max)
  const maxVolume = Math.max(...allVolumes, 1);
  for (let i = 0; i < candidates.length; i++) {
    const normalized = (allVolumes[i] / maxVolume) * 100;
    await supabase
      .from("social_buzz")
      .update({ volume_normalized: Math.round(normalized * 100) / 100 })
      .eq("candidate_id", candidates[i].id)
      .eq("data", today)
      .eq("hora", hora)
      .eq("source", "google_trends");
  }

  const duration = Date.now() - startTime;
  console.log(`✓ Google Trends: ${inserted}/${candidates.length} candidates collected in ${duration}ms`);

  await supabase.from("collection_log").insert({
    source: "google_trends",
    status: inserted === candidates.length ? "success" : "partial",
    records_inserted: inserted,
    duration_ms: duration,
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
