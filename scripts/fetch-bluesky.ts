// =============================================================
// Fetch Bluesky — Public AT Protocol search, no auth needed
// Usage: npm run fetch:bluesky
// =============================================================
import { createClient } from "@supabase/supabase-js";
import { analyzeSentiment, aggregateSentiment } from "../src/lib/sentiment.js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const BSKY_API = "https://public.api.bsky.app";
const today = new Date().toISOString().split("T")[0];
const hora = new Date().toTimeString().split(" ")[0].slice(0, 5) + ":00";

interface BskyPost {
  uri: string;
  cid: string;
  author: { handle: string; displayName?: string };
  record: { text: string; createdAt: string };
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
}

interface BskySearchResponse {
  posts: BskyPost[];
  cursor?: string;
}

async function searchBluesky(
  query: string,
  limit: number = 50
): Promise<BskyPost[]> {
  try {
    const url = new URL(`${BSKY_API}/app.bsky.feed.searchPosts`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("lang", "pt");
    // Last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    url.searchParams.set("since", since);

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn(`Bluesky API ${res.status}: ${res.statusText}`);
      return [];
    }

    const data: BskySearchResponse = await res.json();
    return data.posts ?? [];
  } catch (err) {
    console.warn(`⚠ Bluesky search failed for "${query}":`, (err as Error).message);
    return [];
  }
}

async function main() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting Bluesky collection...`);

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
    // Search by nome_urna (most common reference)
    const posts = await searchBluesky(candidate.nome_urna);

    // Engagement-weighted volume
    const volume = posts.reduce((sum, p) => {
      return sum + 1 + (p.likeCount ?? 0) * 0.5 + (p.repostCount ?? 0) * 2;
    }, 0);
    allVolumes.push(volume);

    // Sentiment analysis on post texts
    const texts = posts.map((p) => p.record.text);
    const sentiment = aggregateSentiment(texts);

    const { error: insertErr } = await supabase
      .from("social_buzz")
      .upsert(
        {
          candidate_id: candidate.id,
          data: today,
          hora,
          source: "bluesky",
          volume_raw: volume,
          volume_normalized: 0,
          sentiment_score: sentiment.score,
          sentiment_positive: sentiment.positive_count,
          sentiment_negative: sentiment.negative_count,
          sentiment_neutral: sentiment.neutral_count,
          sample_size: posts.length,
          metadata: {
            total_likes: posts.reduce((s, p) => s + (p.likeCount ?? 0), 0),
            total_reposts: posts.reduce((s, p) => s + (p.repostCount ?? 0), 0),
            unique_authors: new Set(posts.map((p) => p.author.handle)).size,
          },
        },
        { onConflict: "candidate_id,data,hora,source" }
      );

    if (insertErr) {
      console.warn(`⚠ Insert failed for ${candidate.nome_urna}:`, insertErr.message);
    } else {
      inserted++;
      console.log(
        `  ${candidate.nome_urna}: ${posts.length} posts, volume=${Math.round(volume)}, sentiment=${sentiment.score}`
      );
    }

    // Rate limit: 1s between searches
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Normalize volumes
  const maxVolume = Math.max(...allVolumes, 1);
  for (let i = 0; i < candidates.length; i++) {
    const normalized = (allVolumes[i] / maxVolume) * 100;
    await supabase
      .from("social_buzz")
      .update({ volume_normalized: Math.round(normalized * 100) / 100 })
      .eq("candidate_id", candidates[i].id)
      .eq("data", today)
      .eq("hora", hora)
      .eq("source", "bluesky");
  }

  const duration = Date.now() - startTime;
  console.log(`✓ Bluesky: ${inserted}/${candidates.length} candidates in ${duration}ms`);

  await supabase.from("collection_log").insert({
    source: "bluesky",
    status: inserted === candidates.length ? "success" : "partial",
    records_inserted: inserted,
    duration_ms: duration,
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
