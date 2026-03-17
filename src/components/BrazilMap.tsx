// =============================================================
// BrazilMap — Interactive SVG map with state coloring
// Preact island component (hydrates on client)
// =============================================================
import { useState, useMemo } from "preact/hooks";
import { BRAZIL_STATES } from "../data/brazil-states";
import type { StateSummary } from "../lib/types";

interface Props {
  states: StateSummary[];
  mode: "pesquisas" | "buzz" | "sentimento";
}

function getColor(state: StateSummary | undefined, mode: string): string {
  if (!state) return "#1a1a25";

  if (mode === "pesquisas") {
    return state.lider_cor ?? "#3b82f6";
  }

  if (mode === "buzz") {
    const v = state.buzz_volume ?? 0;
    // Blue ramp by intensity
    if (v > 75) return "#2563eb";
    if (v > 50) return "#3b82f6";
    if (v > 25) return "#60a5fa";
    return "#1e3a5f";
  }

  if (mode === "sentimento") {
    const s = state.buzz_sentimento ?? 0;
    if (s > 0.3) return "#22c55e";
    if (s > 0.1) return "#4ade80";
    if (s > -0.1) return "#eab308";
    if (s > -0.3) return "#f97316";
    return "#ef4444";
  }

  return "#1a1a25";
}

function getOpacity(state: StateSummary | undefined, mode: string): number {
  if (!state) return 0.3;
  if (mode === "pesquisas") {
    const pct = state.lider_percentual ?? 0;
    return Math.max(0.4, Math.min(1, pct / 50));
  }
  return 0.85;
}

export default function BrazilMap({ states, mode: initialMode }: Props) {
  const [mode, setMode] = useState(initialMode);
  const [hoveredUf, setHoveredUf] = useState<string | null>(null);
  const [selectedUf, setSelectedUf] = useState<string | null>(null);

  const stateMap = useMemo(() => {
    const map: Record<string, StateSummary> = {};
    for (const s of states) map[s.uf] = s;
    return map;
  }, [states]);

  const hoveredState = hoveredUf ? stateMap[hoveredUf] : null;
  const selectedState = selectedUf ? stateMap[selectedUf] : null;

  return (
    <div class="map-container">
      {/* Mode toggle */}
      <div class="map-modes">
        <button
          class={`mode-btn ${mode === "pesquisas" ? "active" : ""}`}
          onClick={() => setMode("pesquisas")}
        >
          Pesquisas
        </button>
        <button
          class={`mode-btn ${mode === "buzz" ? "active" : ""}`}
          onClick={() => setMode("buzz")}
        >
          Volume
        </button>
        <button
          class={`mode-btn ${mode === "sentimento" ? "active" : ""}`}
          onClick={() => setMode("sentimento")}
        >
          Sentimento
        </button>
      </div>

      <div class="map-wrapper">
        {/* SVG Map */}
        <svg
          viewBox="0 0 800 800"
          class="brazil-svg"
          role="img"
          aria-label="Mapa do Brasil com dados eleitorais"
        >
          {BRAZIL_STATES.map((state) => {
            const data = stateMap[state.uf];
            const isHovered = hoveredUf === state.uf;
            const isSelected = selectedUf === state.uf;

            return (
              <g
                key={state.uf}
                onMouseEnter={() => setHoveredUf(state.uf)}
                onMouseLeave={() => setHoveredUf(null)}
                onClick={() => setSelectedUf(selectedUf === state.uf ? null : state.uf)}
                style={{ cursor: "pointer" }}
              >
                <path
                  d={state.path}
                  fill={getColor(data, mode)}
                  fillOpacity={getOpacity(data, mode)}
                  stroke={isHovered || isSelected ? "#e8e6e1" : "rgba(255,255,255,0.15)"}
                  strokeWidth={isHovered || isSelected ? 2 : 0.5}
                  style={{
                    transition: "all 0.2s ease",
                    filter: isHovered ? "brightness(1.2)" : "none",
                  }}
                />
                <text
                  x={state.cx}
                  y={state.cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#e8e6e1"
                  fontSize={state.uf === "DF" ? 8 : 11}
                  fontFamily="var(--font-mono)"
                  fontWeight={500}
                  style={{ pointerEvents: "none", opacity: 0.9 }}
                >
                  {state.uf}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredState && (
          <div class="map-tooltip">
            <div class="tooltip-uf">{hoveredUf}</div>
            {hoveredState.lider_nome && (
              <div class="tooltip-leader">
                <span
                  class="tooltip-dot"
                  style={{ background: hoveredState.lider_cor ?? "#3b82f6" }}
                />
                {hoveredState.lider_nome} ({hoveredState.lider_partido})
                {hoveredState.lider_percentual && (
                  <span class="tooltip-pct">
                    {hoveredState.lider_percentual.toFixed(1)}%
                  </span>
                )}
              </div>
            )}
            {hoveredState.buzz_volume != null && (
              <div class="tooltip-buzz">
                Buzz: {hoveredState.buzz_volume.toFixed(0)}/100
                <span
                  class="tooltip-sentiment"
                  style={{
                    color:
                      (hoveredState.buzz_sentimento ?? 0) > 0.1
                        ? "var(--positive)"
                        : (hoveredState.buzz_sentimento ?? 0) < -0.1
                          ? "var(--negative)"
                          : "var(--neutral)",
                  }}
                >
                  {(hoveredState.buzz_sentimento ?? 0) > 0 ? "+" : ""}
                  {(hoveredState.buzz_sentimento ?? 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div class="map-legend">
        {mode === "pesquisas" && (
          <p>Cor = partido do líder nas pesquisas. Opacidade = vantagem.</p>
        )}
        {mode === "buzz" && (
          <div class="legend-ramp">
            <span style={{ background: "#1e3a5f" }} /> Baixo
            <span style={{ background: "#60a5fa" }} />
            <span style={{ background: "#3b82f6" }} />
            <span style={{ background: "#2563eb" }} /> Alto
          </div>
        )}
        {mode === "sentimento" && (
          <div class="legend-ramp">
            <span style={{ background: "#ef4444" }} /> Negativo
            <span style={{ background: "#eab308" }} /> Neutro
            <span style={{ background: "#22c55e" }} /> Positivo
          </div>
        )}
      </div>

      {/* Selected state detail */}
      {selectedState && selectedUf && (
        <div class="state-detail card">
          <div class="flex-between">
            <h3>{selectedUf} — Governador</h3>
            <button
              class="close-btn"
              onClick={() => setSelectedUf(null)}
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
          {selectedState.lider_nome ? (
            <div class="detail-leader">
              <span
                class="detail-dot"
                style={{ background: selectedState.lider_cor ?? "#3b82f6" }}
              />
              <div>
                <strong>{selectedState.lider_nome}</strong>
                <span class="detail-party">{selectedState.lider_partido}</span>
              </div>
              {selectedState.lider_percentual && (
                <span class="detail-pct mono">
                  {selectedState.lider_percentual.toFixed(1)}%
                </span>
              )}
            </div>
          ) : (
            <p class="detail-empty">Sem dados de pesquisa disponíveis</p>
          )}
          <a href={`/estado/${selectedUf.toLowerCase()}`} class="detail-link">
            Ver detalhes →
          </a>
        </div>
      )}

      <style>{`
        .map-container {
          position: relative;
        }

        .map-modes {
          display: flex;
          gap: 0.25rem;
          margin-bottom: 1rem;
          background: var(--bg-tertiary);
          padding: 0.25rem;
          border-radius: var(--radius-sm);
          width: fit-content;
        }

        .mode-btn {
          padding: 0.4rem 0.8rem;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-family: var(--font-mono);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .mode-btn:hover {
          color: var(--text-primary);
        }

        .mode-btn.active {
          background: var(--bg-card);
          color: var(--text-primary);
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        .map-wrapper {
          position: relative;
        }

        .brazil-svg {
          width: 100%;
          max-height: 600px;
        }

        .map-tooltip {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: var(--bg-card);
          border: 1px solid var(--border-hover);
          border-radius: var(--radius-sm);
          padding: 0.75rem 1rem;
          min-width: 180px;
          pointer-events: none;
          z-index: 10;
        }

        .tooltip-uf {
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 0.4rem;
        }

        .tooltip-leader {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
        }

        .tooltip-dot, .detail-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .tooltip-pct {
          font-family: var(--font-mono);
          font-weight: 600;
          margin-left: auto;
        }

        .tooltip-buzz {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-top: 0.4rem;
          display: flex;
          justify-content: space-between;
          font-family: var(--font-mono);
        }

        .tooltip-sentiment {
          font-weight: 600;
        }

        .map-legend {
          margin-top: 0.75rem;
          font-size: 0.75rem;
          color: var(--text-tertiary);
          font-family: var(--font-mono);
        }

        .legend-ramp {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .legend-ramp span {
          display: inline-block;
          width: 16px;
          height: 16px;
          border-radius: 3px;
        }

        .state-detail {
          margin-top: 1rem;
          animation: slideUp 0.2s ease;
        }

        .state-detail h3 {
          font-size: 1rem;
          font-weight: 500;
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          font-size: 1rem;
          padding: 0.25rem;
        }

        .detail-leader {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 0.75rem;
        }

        .detail-party {
          display: block;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .detail-pct {
          font-size: 1.5rem;
          font-weight: 600;
          margin-left: auto;
        }

        .detail-empty {
          color: var(--text-tertiary);
          font-size: 0.85rem;
          margin-top: 0.5rem;
        }

        .detail-link {
          display: block;
          margin-top: 0.75rem;
          font-size: 0.8rem;
          font-family: var(--font-mono);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
