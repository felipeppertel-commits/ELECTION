// =============================================================
// BuzzThermometer — Volume × Sentiment grid for candidates
// =============================================================
import type { BuzzLatest } from "../lib/types";

interface Props {
  candidates: BuzzLatest[];
}

function getSentimentColor(score: number): string {
  if (score > 0.3) return "var(--positive)";
  if (score > 0.1) return "#4ade80";
  if (score > -0.1) return "var(--neutral)";
  if (score > -0.3) return "#f97316";
  return "var(--negative)";
}

function getSentimentLabel(score: number): string {
  if (score > 0.3) return "Muito positivo";
  if (score > 0.1) return "Positivo";
  if (score > -0.1) return "Neutro";
  if (score > -0.3) return "Negativo";
  return "Muito negativo";
}

function getSourceBar(value: number, color: string): string {
  return `linear-gradient(90deg, ${color} ${value}%, transparent ${value}%)`;
}

export default function BuzzThermometer({ candidates }: Props) {
  // Sort by volume (most talked about first)
  const sorted = [...candidates].sort(
    (a, b) => b.volume_composto - a.volume_composto
  );

  return (
    <div class="buzz-grid">
      {sorted.map((c) => (
        <div key={c.id} class="buzz-card card">
          <div class="buzz-header">
            <strong>{c.nome_urna}</strong>
            <span
              class="buzz-sentiment-pill"
              style={{
                background: `${getSentimentColor(c.sentimento_composto)}22`,
                color: getSentimentColor(c.sentimento_composto),
              }}
            >
              {c.sentimento_composto > 0 ? "+" : ""}
              {c.sentimento_composto.toFixed(2)}
            </span>
          </div>

          {/* Volume meter */}
          <div class="buzz-volume">
            <div class="buzz-volume-label">
              <span>Volume</span>
              <span class="mono">{c.volume_composto.toFixed(0)}</span>
            </div>
            <div class="buzz-volume-bar">
              <div
                class="buzz-volume-fill"
                style={{
                  width: `${c.volume_composto}%`,
                  background: getSentimentColor(c.sentimento_composto),
                }}
              />
            </div>
          </div>

          {/* Source breakdown */}
          <div class="buzz-sources">
            <div class="buzz-source">
              <span class="buzz-source-label">Trends</span>
              <div class="buzz-source-bar">
                <div
                  class="buzz-source-fill"
                  style={{ width: `${c.trends_volume}%`, background: "#4285f4" }}
                />
              </div>
              <span class="buzz-source-val mono">{c.trends_volume.toFixed(0)}</span>
            </div>
            <div class="buzz-source">
              <span class="buzz-source-label">Bluesky</span>
              <div class="buzz-source-bar">
                <div
                  class="buzz-source-fill"
                  style={{ width: `${c.bluesky_volume}%`, background: "#0085ff" }}
                />
              </div>
              <span class="buzz-source-val mono">{c.bluesky_volume.toFixed(0)}</span>
            </div>
            <div class="buzz-source">
              <span class="buzz-source-label">News</span>
              <div class="buzz-source-bar">
                <div
                  class="buzz-source-fill"
                  style={{ width: `${c.news_volume}%`, background: "#34a853" }}
                />
              </div>
              <span class="buzz-source-val mono">{c.news_volume.toFixed(0)}</span>
            </div>
            <div class="buzz-source">
              <span class="buzz-source-label">YouTube</span>
              <div class="buzz-source-bar">
                <div
                  class="buzz-source-fill"
                  style={{ width: `${c.youtube_volume}%`, background: "#ff0000" }}
                />
              </div>
              <span class="buzz-source-val mono">{c.youtube_volume.toFixed(0)}</span>
            </div>
          </div>

          <div class="buzz-sentiment-text">
            {getSentimentLabel(c.sentimento_composto)}
          </div>
        </div>
      ))}

      <style>{`
        .buzz-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .buzz-card {
          padding: 1rem 1.25rem;
        }

        .buzz-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .buzz-header strong {
          font-weight: 500;
          font-size: 0.95rem;
        }

        .buzz-sentiment-pill {
          font-size: 0.7rem;
          font-family: var(--font-mono);
          font-weight: 600;
          padding: 0.2rem 0.5rem;
          border-radius: 99px;
        }

        .buzz-volume {
          margin-bottom: 0.75rem;
        }

        .buzz-volume-label {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-bottom: 0.3rem;
        }

        .buzz-volume-bar {
          height: 8px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          overflow: hidden;
        }

        .buzz-volume-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease;
        }

        .buzz-sources {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .buzz-source {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .buzz-source-label {
          font-size: 0.65rem;
          color: var(--text-tertiary);
          width: 50px;
          flex-shrink: 0;
          font-family: var(--font-mono);
        }

        .buzz-source-bar {
          flex: 1;
          height: 3px;
          background: var(--bg-tertiary);
          border-radius: 2px;
          overflow: hidden;
        }

        .buzz-source-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .buzz-source-val {
          font-size: 0.65rem;
          color: var(--text-tertiary);
          width: 24px;
          text-align: right;
        }

        .buzz-sentiment-text {
          margin-top: 0.75rem;
          font-size: 0.7rem;
          color: var(--text-tertiary);
          text-align: center;
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
}
