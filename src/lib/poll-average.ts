// =============================================================
// Poll Averaging — Simple + Weighted
// =============================================================

interface PollInput {
  percentual: number;
  amostra: number | null;
  data_pesquisa: string; // ISO date
  instituto: string;
}

// Instituto quality ratings (0-1) — based on historical accuracy
// Source: manual curation from TSE data + Atlas Político analysis
// Update these as new data comes in
const INSTITUTO_QUALITY: Record<string, number> = {
  // Tier 1 — consistently accurate
  datafolha: 0.95,
  ibope: 0.92,
  ipec: 0.92,
  quaest: 0.90,
  "atlas politico": 0.88,
  "atlas intel": 0.88,

  // Tier 2 — generally reliable
  mda: 0.80,
  "real time big data": 0.78,
  "poder data": 0.78,
  paraná: 0.75,
  "parana pesquisas": 0.75,
  futura: 0.72,
  gerp: 0.70,

  // Tier 3 — less track record
  default: 0.60,
};

function getInstitutoWeight(instituto: string): number {
  const key = instituto.toLowerCase().trim();
  return (
    INSTITUTO_QUALITY[key] ??
    Object.entries(INSTITUTO_QUALITY).find(([k]) => key.includes(k))?.[1] ??
    INSTITUTO_QUALITY.default
  );
}

// Exponential decay: polls lose 50% weight every 15 days
function getRecencyWeight(dataPesquisa: string, referenceDate: Date): number {
  const pollDate = new Date(dataPesquisa);
  const daysDiff = (referenceDate.getTime() - pollDate.getTime()) / (1000 * 60 * 60 * 24);
  const halfLife = 15; // days
  return Math.pow(0.5, daysDiff / halfLife);
}

// Sample size weight: sqrt(sample) / sqrt(1000) — normalized around 1000 respondents
function getSampleWeight(amostra: number | null): number {
  if (!amostra || amostra <= 0) return 0.5; // unknown sample = half weight
  return Math.sqrt(amostra) / Math.sqrt(1000);
}

export interface AverageResult {
  media_simples: number;
  media_ponderada: number;
  num_pesquisas: number;
}

export function computeAverage(
  polls: PollInput[],
  referenceDate: Date = new Date()
): AverageResult {
  if (polls.length === 0) {
    return { media_simples: 0, media_ponderada: 0, num_pesquisas: 0 };
  }

  // Simple average
  const media_simples =
    polls.reduce((sum, p) => sum + p.percentual, 0) / polls.length;

  // Weighted average
  let weightedSum = 0;
  let totalWeight = 0;

  for (const poll of polls) {
    const institutoW = getInstitutoWeight(poll.instituto);
    const recencyW = getRecencyWeight(poll.data_pesquisa, referenceDate);
    const sampleW = getSampleWeight(poll.amostra);

    // Combined weight = product of all three factors
    const weight = institutoW * recencyW * sampleW;

    weightedSum += poll.percentual * weight;
    totalWeight += weight;
  }

  const media_ponderada = totalWeight > 0 ? weightedSum / totalWeight : media_simples;

  return {
    media_simples: Math.round(media_simples * 100) / 100,
    media_ponderada: Math.round(media_ponderada * 100) / 100,
    num_pesquisas: polls.length,
  };
}

// Filter polls within a time window (default: last 30 days)
export function filterRecentPolls(
  polls: PollInput[],
  days: number = 30,
  referenceDate: Date = new Date()
): PollInput[] {
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - days);

  return polls.filter((p) => new Date(p.data_pesquisa) >= cutoff);
}
