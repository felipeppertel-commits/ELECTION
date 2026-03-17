// =============================================================
// Fetch Google News RSS — Headlines + sentiment
// Usage: npm run fetch:news
// =============================================================
import { createClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";
import { analyzeSentiment, aggregateSentiment } from "../src/lib/sentiment.js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const today = new Date().toISOString().split("T")[0];
const hora = new Date().toTimeString().split(" ")[0].slice(0, 5) + ":00";
const parser = new XMLParser();

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source?: string;
}

async function fetchGoogleNews(query: string): Promise<NewsItem[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const xml = await res.text();
    const parsed = parser.parse(xml);
    const items = parsed?.rss?.channel?.item;

    if (!items) return [];
    const list = Array.isArray(items) ? items : [items];

    return list.map((item: any) => ({
      title: item.title ?? "",
      link: item.link ?? "",
      pubDate: item.pubDate ?? "",
      source: typeof item.source === "string" ? item.source : item.source?.["#text"] ?? "",
    }));
  } catch (err) {
    console.warn(`⚠ Google News failed for "${query}":`, (err as Error).message);
    return [];
  }
}

async function main() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting Google News collection...`);

  const { data: candidates, error } = await supabase
    .from("candidates")
    .select("id, nome_urna, nome")
    .eq("ativo", true);

  if (error || !candidates) {
    console.error("Failed to fetch candidates:", error);
    process.exit(1);
  }

  let inserted = 0;
  const allVolumes: number[] = [];

  for (const candidate of candidates) {
    // Search by full name and nome_urna
    const [newsByUrna, newsByNome] = await Promise.all([
      fetchGoogleNews(`${candidate.nome_urna} eleição 2026`),
      fetchGoogleNews(`${candidate.nome} política`),
    ]);

    // Deduplicate by title
    const seen = new Set<string>();
    const allNews: NewsItem[] = [];
    for (const item of [...newsByUrna, ...newsByNome]) {
      if (!seen.has(item.title)) {
        seen.add(item.title);
        allNews.push(item);
      }
    }

    const volume = allNews.length;
    allVolumes.push(volume);

    // Sentiment on headlines
    const headlines = allNews.map((n) => n.title);
    const sentiment = aggregateSentiment(headlines);

    // Top sources for metadata
    const sourceCounts: Record<string, number> = {};
    for (const n of allNews) {
      if (n.source) {
        sourceCounts[n.source] = (sourceCounts[n.source] ?? 0) + 1;
      }
    }

    const { error: insertErr } = await supabase
      .from("social_buzz")
      .upsert(
        {
          candidate_id: candidate.id,
          data: today,
          hora,
          source: "google_news",
          volume_raw: volume,
          volume_normalized: 0,
          sentiment_score: sentiment.score,
          sentiment_positive: sentiment.positive_count,
          sentiment_negative: sentiment.negative_count,
          sentiment_neutral: sentiment.neutral_count,
          sample_size: allNews.length,
          metadata: {
            top_sources: Object.entries(sourceCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5),
            sample_headlines: headlines.slice(0, 5),
          },
        },
        { onConflict: "candidate_id,data,hora,source" }
      );

    if (insertErr) {
      console.warn(`⚠ Insert failed for ${candidate.nome_urna}:`, insertErr.message);
    } else {
      inserted++;
      console.log(
        `  ${candidate.nome_urna}: ${allNews.length} headlines, sentiment=${sentiment.score}`
      );
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  // Normalize
  const maxVolume = Math.max(...allVolumes, 1);
  for (let i = 0; i < candidates.length; i++) {
    const normalized = (allVolumes[i] / maxVolume) * 100;
    await supabase
      .from("social_buzz")
      .update({ volume_normalized: Math.round(normalized * 100) / 100 })
      .eq("candidate_id", candidates[i].id)
      .eq("data", today)
      .eq("hora", hora)
      .eq("source", "google_news");
  }

  const duration = Date.now() - startTime;
  console.log(`✓ Google News: ${inserted}/${candidates.length} candidates in ${duration}ms`);

  await supabase.from("collection_log").insert({
    source: "google_news",
    status: inserted === candidates.length ? "success" : "partial",
    records_inserted: inserted,
    duration_ms: duration,
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
