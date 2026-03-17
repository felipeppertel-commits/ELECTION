// =============================================================
// CandidateRanking — Horizontal bar ranking of candidates
// =============================================================
import type { PresidenteLatest } from "../lib/types";

interface Props {
  candidates: PresidenteLatest[];
  title: string;
  showAvgType?: "simples" | "ponderada";
}

export default function CandidateRanking({
  candidates,
  title,
  showAvgType = "ponderada",
}: Props) {
  const maxPct = Math.max(
    ...candidates.map((c) =>
      showAvgType === "ponderada"
        ? (c.media_ponderada ?? 0)
        : (c.media_simples ?? 0)
    ),
    1
  );

  return (
    <div class="ranking">
      <div class="ranking-header">
        <h3 class="section-title">{title}</h3>
        <span class="ranking-count mono">{candidates.length} candidatos</span>
      </div>

      <div class="ranking-list">
        {candidates.map((c, i) => {
          const pct =
            showAvgType === "ponderada"
              ? (c.media_ponderada ?? 0)
              : (c.media_simples ?? 0);
          const barWidth = (pct / maxPct) * 100;

          return (
            <div key={c.id} class="ranking-item">
              <div class="ranking-position mono">{i + 1}</div>
              <div class="ranking-info">
                <div class="ranking-name">
                  <strong>{c.nome_urna}</strong>
                  <span class="ranking-party" style={{ color: c.cor_partido ?? "var(--text-secondary)" }}>
                    {c.partido}
                  </span>
                </div>
                <div class="ranking-bar-wrapper">
                  <div
                    class="ranking-bar"
                    style={{
                      width: `${barWidth}%`,
                      background: c.cor_partido ?? "var(--accent)",
                      opacity: 0.8,
                    }}
                  />
                </div>
              </div>
              <div class="ranking-pct mono">{pct.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>

      <style>{`
        .ranking-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ranking-count {
          font-size: 0.7rem;
          color: var(--text-tertiary);
        }

        .ranking-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .ranking-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border);
        }

        .ranking-item:last-child {
          border-bottom: none;
        }

        .ranking-position {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          width: 20px;
          text-align: center;
          flex-shrink: 0;
        }

        .ranking-info {
          flex: 1;
          min-width: 0;
        }

        .ranking-name {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
        }

        .ranking-name strong {
          font-weight: 500;
        }

        .ranking-party {
          font-size: 0.7rem;
          font-family: var(--font-mono);
          font-weight: 500;
        }

        .ranking-bar-wrapper {
          height: 4px;
          background: var(--bg-tertiary);
          border-radius: 2px;
          overflow: hidden;
        }

        .ranking-bar {
          height: 100%;
          border-radius: 2px;
          transition: width 0.5s ease;
        }

        .ranking-pct {
          font-size: 1rem;
          font-weight: 600;
          flex-shrink: 0;
          width: 50px;
          text-align: right;
        }
      `}</style>
    </div>
  );
}
