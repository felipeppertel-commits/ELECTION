// =============================================================
// Sentiment Analysis — Lexicon-based for PT-BR
// =============================================================
// Uses a curated subset of OpLexicon + common political terms.
// Returns score between -1.0 (very negative) and +1.0 (very positive).
// For v2, swap this for Claude API calls.

// Positive words (score: +1)
const POSITIVE = new Set([
  // General positive
  "bom", "boa", "ótimo", "ótima", "excelente", "maravilhoso", "maravilhosa",
  "incrível", "fantástico", "fantástica", "perfeito", "perfeita", "lindo", "linda",
  "melhor", "melhores", "sucesso", "vitória", "conquista", "avanço", "progresso",
  "crescimento", "desenvolvimento", "inovação", "solução", "esperança",
  "confiança", "competente", "eficiente", "honesto", "honesta", "transparente",
  "justo", "justa", "correto", "correta",
  // Political positive
  "aprovação", "aprovado", "aprovada", "eleito", "eleita", "líder", "liderança",
  "proposta", "plano", "projeto", "investimento", "reforma", "melhoria",
  "democracia", "democrático", "democrática", "popular", "apoio", "apoiado",
  "favorito", "favorita", "frente", "cresce", "cresceu", "subiu", "sobe",
  "recuperação", "estabilidade", "segurança", "educação", "saúde",
  // Intensifiers
  "muito", "demais", "super", "mega", "extremamente",
  // Emojis as text
  "parabéns", "obrigado", "obrigada", "bravo", "brava",
]);

// Negative words (score: -1)
const NEGATIVE = new Set([
  // General negative
  "ruim", "péssimo", "péssima", "horrível", "terrível", "pior", "piores",
  "fracasso", "derrota", "desastre", "catástrofe", "crise", "problema",
  "erro", "falha", "mentira", "mentiroso", "mentirosa", "corrupto", "corrupta",
  "corrupção", "escândalo", "fraude", "crime", "criminoso", "criminosa",
  "ladrão", "ladra", "roubo", "roubou", "incompetente", "incapaz",
  // Political negative
  "reprovação", "reprovado", "impeachment", "cassação", "cassado",
  "investigado", "investigada", "indiciado", "indiciada", "preso", "presa",
  "condenado", "condenada", "acusado", "acusada", "denúncia", "denunciado",
  "desvio", "propina", "mensalão", "petrolão", "rachadinha", "orçamento secreto",
  "golpe", "golpista", "ditador", "ditadura", "autoritário", "autoritária",
  "caiu", "cai", "queda", "despenca", "derrete", "perdeu", "perde",
  "inflação", "desemprego", "miséria", "fome", "pobreza", "violência",
  "desigualdade", "destruição", "retrocesso",
  // Common insults in political discourse
  "vagabundo", "vagabunda", "bandido", "bandida", "lixo", "vergonha",
  "picareta", "safado", "safada", "canalha", "traidor", "traidora",
]);

// Negation words (flip next word's polarity)
const NEGATIONS = new Set([
  "não", "nao", "nunca", "jamais", "nem", "nenhum", "nenhuma",
  "nada", "sem", "tampouco",
]);

// Intensifier multipliers
const INTENSIFIERS: Record<string, number> = {
  muito: 1.5,
  demais: 1.5,
  super: 1.5,
  mega: 1.5,
  extremamente: 2.0,
  bastante: 1.3,
  totalmente: 1.5,
  completamente: 1.5,
  absolutamente: 1.8,
  pouco: 0.5,
  levemente: 0.3,
  ligeiramente: 0.3,
};

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents for matching
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export interface SentimentResult {
  score: number; // -1.0 to +1.0
  label: "positive" | "negative" | "neutral";
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  confidence: number; // 0-1, based on how many opinion words found
}

export function analyzeSentiment(text: string): SentimentResult {
  const words = normalize(text);
  let totalScore = 0;
  let opinionWords = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let wordScore = 0;

    // Check if word has polarity
    const normalizedPositive = [...POSITIVE].map(normalizeWord);
    const normalizedNegative = [...NEGATIVE].map(normalizeWord);

    if (normalizedPositive.includes(word)) {
      wordScore = 1;
    } else if (normalizedNegative.includes(word)) {
      wordScore = -1;
    } else {
      continue;
    }

    // Check for negation in previous 1-3 words
    let negated = false;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if ([...NEGATIONS].map(normalizeWord).includes(words[j])) {
        negated = true;
        break;
      }
    }
    if (negated) wordScore *= -0.8; // Negation weakens but doesn't fully reverse

    // Check for intensifier in previous word
    if (i > 0) {
      const prevWord = words[i - 1];
      const intensifier = Object.entries(INTENSIFIERS).find(
        ([k]) => normalizeWord(k) === prevWord
      );
      if (intensifier) {
        wordScore *= intensifier[1];
      }
    }

    totalScore += wordScore;
    opinionWords++;
    if (wordScore > 0) positiveCount++;
    else if (wordScore < 0) negativeCount++;
  }

  // Normalize score to -1..+1
  const score = opinionWords > 0
    ? Math.max(-1, Math.min(1, totalScore / Math.sqrt(opinionWords)))
    : 0;

  // Confidence: how many opinion words relative to total
  const confidence = words.length > 0
    ? Math.min(1, opinionWords / (words.length * 0.3))
    : 0;

  const neutralCount = words.length - positiveCount - negativeCount;

  return {
    score: Math.round(score * 1000) / 1000,
    label: score > 0.1 ? "positive" : score < -0.1 ? "negative" : "neutral",
    positive_count: positiveCount,
    negative_count: negativeCount,
    neutral_count: Math.max(0, neutralCount),
    confidence: Math.round(confidence * 100) / 100,
  };
}

// Analyze multiple texts and aggregate
export function aggregateSentiment(texts: string[]): SentimentResult {
  if (texts.length === 0) {
    return {
      score: 0,
      label: "neutral",
      positive_count: 0,
      negative_count: 0,
      neutral_count: 0,
      confidence: 0,
    };
  }

  const results = texts.map(analyzeSentiment);
  const totalPositive = results.reduce((s, r) => s + r.positive_count, 0);
  const totalNegative = results.reduce((s, r) => s + r.negative_count, 0);
  const totalNeutral = results.reduce((s, r) => s + r.neutral_count, 0);
  const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;
  const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / results.length;

  return {
    score: Math.round(avgScore * 1000) / 1000,
    label: avgScore > 0.1 ? "positive" : avgScore < -0.1 ? "negative" : "neutral",
    positive_count: totalPositive,
    negative_count: totalNegative,
    neutral_count: totalNeutral,
    confidence: Math.round(avgConfidence * 100) / 100,
  };
}
