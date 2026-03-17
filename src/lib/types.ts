// =============================================================
// Eleições 2026 — Core Types
// =============================================================

export type Cargo = "presidente" | "governador" | "senador";
export type PollType = "estimulada" | "espontanea";
export type BuzzSource = "google_trends" | "bluesky" | "google_news" | "youtube";

export interface Candidate {
  id: string;
  nome: string;
  nome_urna: string;
  cargo: Cargo;
  uf: string | null;
  partido: string;
  foto_url: string | null;
  cor_partido: string | null;
  ativo: boolean;
}

export interface Poll {
  id: string;
  candidate_id: string;
  instituto: string;
  data_pesquisa: string;
  data_publicacao: string;
  percentual: number;
  margem_erro: number | null;
  amostra: number | null;
  tipo: PollType;
  turno: number;
  registro_tse: string | null;
  fonte_url: string | null;
  cargo: Cargo;
  uf: string | null;
}

export interface PollAverage {
  id: string;
  candidate_id: string;
  data: string;
  media_simples: number | null;
  media_ponderada: number | null;
  num_pesquisas: number;
  cargo: Cargo;
  uf: string | null;
}

export interface SocialBuzz {
  id: string;
  candidate_id: string;
  data: string;
  hora: string;
  source: BuzzSource;
  volume_raw: number;
  volume_normalized: number;
  sentiment_score: number;
  sentiment_positive: number;
  sentiment_negative: number;
  sentiment_neutral: number;
  sample_size: number;
  metadata: Record<string, unknown>;
}

export interface BuzzIndex {
  id: string;
  candidate_id: string;
  data: string;
  volume_composto: number;
  sentimento_composto: number;
  trends_volume: number;
  trends_sentiment: number;
  bluesky_volume: number;
  bluesky_sentiment: number;
  news_volume: number;
  news_sentiment: number;
  youtube_volume: number;
  youtube_sentiment: number;
  cargo: Cargo;
  uf: string | null;
}

// View types (flattened for frontend)
export interface PresidenteLatest {
  id: string;
  nome: string;
  nome_urna: string;
  partido: string;
  foto_url: string | null;
  cor_partido: string | null;
  media_simples: number | null;
  media_ponderada: number | null;
  num_pesquisas: number;
  ultima_atualizacao: string;
}

export interface GovernadorLatest extends PresidenteLatest {
  uf: string;
}

export interface BuzzLatest {
  id: string;
  nome: string;
  nome_urna: string;
  cargo: Cargo;
  uf: string | null;
  partido: string;
  volume_composto: number;
  sentimento_composto: number;
  trends_volume: number;
  bluesky_volume: number;
  news_volume: number;
  youtube_volume: number;
  ultima_atualizacao: string;
}

export interface StateSummary {
  uf: string;
  lider_nome: string;
  lider_partido: string;
  lider_cor: string | null;
  lider_percentual: number | null;
  buzz_volume: number | null;
  buzz_sentimento: number | null;
}

// Brazilian states
export const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas",
  BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

// Major party colors
export const PARTY_COLORS: Record<string, string> = {
  PT: "#ED1C24",
  PL: "#003DA5",
  MDB: "#FFD700",
  PSDB: "#0080FF",
  PP: "#1E3A5F",
  PSD: "#FF8C00",
  UNIÃO: "#00BFFF",
  REPUBLICANOS: "#00529B",
  PDT: "#C41E3A",
  PSOL: "#FFCC00",
  NOVO: "#FF6600",
  PSB: "#FF4500",
  PODE: "#4169E1",
  AVANTE: "#FF6347",
  CIDADANIA: "#9B59B6",
  SOLIDARIEDADE: "#FF8C42",
  PV: "#228B22",
  REDE: "#2ECC71",
  PCdoB: "#CC0000",
  PCB: "#8B0000",
  PSTU: "#B22222",
  PCO: "#DC143C",
  UP: "#FF0000",
};

// Buzz source weights for composite index
export const BUZZ_WEIGHTS = {
  google_trends: 0.30,
  google_news: 0.30,
  bluesky: 0.20,
  youtube: 0.20,
} as const;
