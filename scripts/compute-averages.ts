// =============================================================
// Compute Averages + Buzz Index — Aggregation step
// Usage: npm run compute:averages
// =============================================================
import { createClient } from "@supabase/supabase-js";
import { computeAverage, filterRecentPolls } from "../src/lib/poll-average.js";
import { BUZZ_WEIGHTS } from "../src/lib/types.js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const today = new Date().toISOString().split("T")[0];

async function computePollAverages() {
  console.log("Computing poll averages...");

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, cargo, uf")
    .eq("ativo", true);

  if (!candidates) return 0;

  let updated = 0;

  for (const candidate of candidates) {
    // Get all polls for this candidate in the last 30 days
    const { data: polls } = await supabase
      .from("polls")
      .select("percentual, amostra, data_pesquisa, instituto")
      .eq("candidate_id", candidate.id)
      .eq("tipo", "estimulada")
      .eq("turno", 1)
      .gte("data_pesquisa", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      .order("data_pesquisa", { ascending: false });

    if (!polls || polls.length === 0) continue;

    const result = computeAverage(polls);

    const { error } = await supabase
      .from("poll_averages")
      .upsert(
        {
          candidate_id: candidate.id,
          data: today,
          media_simples: result.media_simples,
          media_ponderada: result.media_ponderada,
          num_pesquisas: result.num_pesquisas,
          cargo: candidate.cargo,
          uf: candidate.uf,
        },
        { onConflict: "candidate_id,data" }
      );

    if (!error) updated++;
  }

  console.log(`  ✓ ${updated} poll averages computed`);
  return updated;
}

async function computeBuzzIndex() {
  console.log("Computing buzz index...");

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, cargo, uf")
    .eq("ativo", true);

  if (!candidates) return 0;

  let updated = 0;

  for (const candidate of candidates) {
    // Get today's buzz data from all sources
    const { data: buzzData } = await supabase
      .from("social_buzz")
      .select("source, volume_normalized, sentiment_score")
      .eq("candidate_id", candidate.id)
      .eq("data", today)
      .order("hora", { ascending: false });

    if (!buzzData || buzzData.length === 0) continue;

    // Get latest entry per source
    const bySource: Record<string, { volume: number; sentiment: number }> = {};
    for (const entry of buzzData) {
      if (!bySource[entry.source]) {
        bySource[entry.source] = {
          volume: entry.volume_normalized,
          sentiment: entry.sentiment_score,
        };
      }
    }

    // Compute weighted composite
    let volumeComposto = 0;
    let sentimentoComposto = 0;
    let totalWeight = 0;

    for (const [source, weight] of Object.entries(BUZZ_WEIGHTS)) {
      const data = bySource[source];
      if (data) {
        volumeComposto += data.volume * weight;
        sentimentoComposto += data.sentiment * weight;
        totalWeight += weight;
      }
    }

    // Normalize if not all sources have data
    if (totalWeight > 0 && totalWeight < 1) {
      volumeComposto /= totalWeight;
      sentimentoComposto /= totalWeight;
    }

    const { error } = await supabase
      .from("buzz_index")
      .upsert(
        {
          candidate_id: candidate.id,
          data: today,
          volume_composto: Math.round(volumeComposto * 100) / 100,
          sentimento_composto: Math.round(sentimentoComposto * 1000) / 1000,
          trends_volume: bySource.google_trends?.volume ?? 0,
          trends_sentiment: bySource.google_trends?.sentiment ?? 0,
          bluesky_volume: bySource.bluesky?.volume ?? 0,
          bluesky_sentiment: bySource.bluesky?.sentiment ?? 0,
          news_volume: bySource.google_news?.volume ?? 0,
          news_sentiment: bySource.google_news?.sentiment ?? 0,
          youtube_volume: bySource.youtube?.volume ?? 0,
          youtube_sentiment: bySource.youtube?.sentiment ?? 0,
          cargo: candidate.cargo,
          uf: candidate.uf,
        },
        { onConflict: "candidate_id,data" }
      );

    if (!error) updated++;
  }

  console.log(`  ✓ ${updated} buzz indices computed`);
  return updated;
}

async function triggerRebuild() {
  const hook = process.env.VERCEL_DEPLOY_HOOK;
  if (!hook) {
    console.log("  ⚠ No VERCEL_DEPLOY_HOOK set, skipping rebuild");
    return;
  }

  try {
    const res = await fetch(hook, { method: "POST" });
    if (res.ok) {
      console.log("  ✓ Vercel rebuild triggered");
    } else {
      console.warn(`  ⚠ Vercel rebuild failed: ${res.status}`);
    }
  } catch (err) {
    console.warn("  ⚠ Vercel rebuild error:", (err as Error).message);
  }
}

async function main() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Computing aggregations...`);

  const pollCount = await computePollAverages();
  const buzzCount = await computeBuzzIndex();
  await triggerRebuild();

  const duration = Date.now() - startTime;
  console.log(`\n✓ Done in ${duration}ms — ${pollCount} averages, ${buzzCount} buzz indices`);

  await supabase.from("collection_log").insert({
    source: "compute_averages",
    status: "success",
    records_inserted: pollCount + buzzCount,
    duration_ms: duration,
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
