// =============================================================
// Fetch YouTube — Videos + engagement via Data API v3
// Usage: npm run fetch:youtube
// Requires: YOUTUBE_API_KEY (free tier: 10k units/day)
// =============================================================
import { createClient } from "@supabase/supabase-js";
import { analyzeSentiment, aggregateSentiment } from "../src/lib/sentiment.js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const YT_API = "https://www.googleapis.com/youtube/v3";
const API_KEY = process.env.YOUTUBE_API_KEY;
const today = new Date().toISOString().split("T")[0];
const hora = new Date().toTimeString().split(" ")[0].slice(0, 5) + ":00";

interface YTSearchItem {
  id: { videoId: string };
  snippet: { title: string; description: string; publishedAt: string };
}

interface YTVideoStats {
  id: string;
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
}

async function searchYouTube(query: string, maxResults = 10): Promise<YTSearchItem[]> {
  if (!API_KEY) {
    console.warn("⚠ YOUTUBE_API_KEY not set, skipping");
    return [];
  }

  try {
    const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const url = new URL(`${YT_API}/search`);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "video");
    url.searchParams.set("relevanceLanguage", "pt");
    url.searchParams.set("regionCode", "BR");
    url.searchParams.set("publishedAfter", publishedAfter);
    url.searchParams.set("maxResults", String(maxResults));
    url.searchParams.set("key", API_KEY);

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.warn(`YouTube search ${res.status}: ${await res.text()}`);
      return [];
    }

    const data = await res.json();
    return data.items ?? [];
  } catch (err) {
    console.warn(`⚠ YouTube search failed:`, (err as Error).message);
    return [];
  }
}

async function getVideoStats(videoIds: string[]): Promise<YTVideoStats[]> {
  if (!API_KEY || videoIds.length === 0) return [];

  try {
    const url = new URL(`${YT_API}/videos`);
    url.searchParams.set("part", "statistics");
    url.searchParams.set("id", videoIds.join(","));
    url.searchParams.set("key", API_KEY);

    const res = await fetch(url.toString());
    if (!res.ok) return [];

    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function main() {
  if (!API_KEY) {
    console.log("⚠ YOUTUBE_API_KEY not set — skipping YouTube collection");
    process.exit(0);
  }

  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting YouTube collection...`);

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
    // Search: costs 100 quota units per call
    const videos = await searchYouTube(`${candidate.nome_urna} eleição 2026`, 10);
    const videoIds = videos.map((v) => v.id.videoId).filter(Boolean);

    // Get stats: costs 1 unit per video
    const stats = await getVideoStats(videoIds);

    // Calculate volume (views + engagement weighted)
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    for (const s of stats) {
      totalViews += parseInt(s.statistics.viewCount || "0");
      totalLikes += parseInt(s.statistics.likeCount || "0");
      totalComments += parseInt(s.statistics.commentCount || "0");
    }

    const volume = totalViews * 0.001 + totalLikes * 0.5 + totalComments * 2;
    allVolumes.push(volume);

    // Sentiment on titles + descriptions
    const texts = videos.map((v) => `${v.snippet.title} ${v.snippet.description}`);
    const sentiment = aggregateSentiment(texts);

    const { error: insertErr } = await supabase
      .from("social_buzz")
      .upsert(
        {
          candidate_id: candidate.id,
          data: today,
          hora,
          source: "youtube",
          volume_raw: volume,
          volume_normalized: 0,
          sentiment_score: sentiment.score,
          sentiment_positive: sentiment.positive_count,
          sentiment_negative: sentiment.negative_count,
          sentiment_neutral: sentiment.neutral_count,
          sample_size: videos.length,
          metadata: {
            total_views: totalViews,
            total_likes: totalLikes,
            total_comments: totalComments,
            video_count: videos.length,
          },
        },
        { onConflict: "candidate_id,data,hora,source" }
      );

    if (insertErr) {
      console.warn(`⚠ Insert failed for ${candidate.nome_urna}:`, insertErr.message);
    } else {
      inserted++;
      console.log(
        `  ${candidate.nome_urna}: ${videos.length} videos, ${totalViews} views, sentiment=${sentiment.score}`
      );
    }

    // Rate limit
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
      .eq("source", "youtube");
  }

  const duration = Date.now() - startTime;
  console.log(`✓ YouTube: ${inserted}/${candidates.length} candidates in ${duration}ms`);

  await supabase.from("collection_log").insert({
    source: "youtube",
    status: inserted === candidates.length ? "success" : "partial",
    records_inserted: inserted,
    duration_ms: duration,
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
