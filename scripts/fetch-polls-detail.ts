// =============================================================
// Fetch Polls Detail — Percentuais por candidato via E2D /scenarios
// Usage: npm run fetch:polls-detail
//
// Busca resultados detalhados (percentual por candidato) para cada
// pesquisa registrada, usando o endpoint /api/v1/polls/{id}/scenarios.
// Roda DEPOIS de fetch-polls.ts (que grava os metadados e aggregates).
// =============================================================
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const E2D_BASE = "https://eleicaoemdados.com.br";
const USER_AGENT = "Eleicoes2026-OpenSource/1.0";

// ─── Types ───────────────────────────────────────────────────

interface E2DPoll {
  id: number;
  election_id: number;
  institute: { id: number; name: string; tse_registration: string };
  collection_date: string;
  published_at: string;
  sample_size: number | null;
  margin_error: number | null;
  tse_registration: string | null;
  geography_level: string;
  state_code: string | null;
  research_type_label: string;
}

interface ScenarioResult {
  result_label: string;
  percentage: number;
  candidate_id: number | null;
}

interface Scenario {
  question_id: number;
  question_type: string;
  scenario_code: string | null;
  round: number;
  prompt: string | null;
  label: string;
  results: ScenarioResult[];
}

interface CandidateRow {
  id: string;
  nome_urna: string;
  nome: string;
  cargo: string;
  uf: string | null;
}

// ─── Aliases de nome ────────────────────────────────────────

const NAME_ALIASES: Record<string, string[]> = {
  "ratinho junior": ["ratinho jr.", "ratinho jr"],
  "ciro gomes": ["ciro"],
  "simone tebet": ["tebet", "simone"],
  "ronaldo caiado": ["caiado"],
  "romeu zema": ["zema"],
  "pablo marcal": ["marcal"],
  "michelle bolsonaro": ["michelle"],
  "flavio bolsonaro": ["flavio"],
  "jair bolsonaro": ["bolsonaro"],
  "helder barbalho": ["helder"],
};

// ─── Utilities ───────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function matchCandidate(name: string, candidates: CandidateRow[]): string | null {
  const normalized = normalizeStr(name);

  // Match exato por nome_urna
  const exact = candidates.find((c) => normalizeStr(c.nome_urna) === normalized);
  if (exact) return exact.id;

  // Match via aliases
  for (const c of candidates) {
    const normUrna = normalizeStr(c.nome_urna);
    const aliases = NAME_ALIASES[normUrna] ?? [];
    if (aliases.some((a) => normalizeStr(a) === normalized)) return c.id;
  }

  // Match parcial
  const partial = candidates.find((c) => {
    const normUrna = normalizeStr(c.nome_urna);
    const normNome = normalizeStr(c.nome);
    const lastName = normalizeStr(c.nome.split(" ").pop()!);
    return (
      normalized.includes(normUrna) || normUrna.includes(normalized) ||
      normalized.includes(lastName) || lastName.includes(normalized) ||
      normalized.includes(normNome) || normNome.includes(normalized)
    );
  });

  return partial?.id ?? null;
}

function mapGeography(poll: E2DPoll): { cargo: string; uf: string | null } {
  if (poll.geography_level === "nacional" || !poll.state_code) {
    return { cargo: "presidente", uf: null };
  }
  return { cargo: "governador", uf: poll.state_code.toUpperCase() };
}

function mapQuestionType(qType: string): "estimulada" | "espontanea" {
  if (qType.includes("espontan")) return "espontanea";
  return "estimulada";
}

function mapRound(scenario: Scenario): number {
  if (scenario.round === 2) return 2;
  if (scenario.scenario_code?.includes("2t")) return 2;
  if (scenario.question_type?.includes("2_turno") || scenario.question_type?.includes("segundo_turno")) return 2;
  return 1;
}

// ─── API calls ───────────────────────────────────────────────

async function fetchAllPolls(): Promise<E2DPoll[]> {
  const allPolls: E2DPoll[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(`${E2D_BASE}/api/v1/polls?page=${page}&per_page=50`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) break;

    const json = await res.json();
    allPolls.push(...json.data);
    if (!json.links.next || page >= json.meta.total_pages) break;
    page++;
  }

  return allPolls;
}

async function fetchScenarios(pollId: number): Promise<Scenario[]> {
  try {
    const res = await fetch(`${E2D_BASE}/api/v1/polls/${pollId}/scenarios`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log(`\n[${new Date().toISOString()}] ═══ Fetch Polls Detail (por candidato) ═══\n`);

  // Busca candidatos do banco
  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, nome_urna, nome, cargo, uf")
    .eq("ativo", true);

  if (!candidates || candidates.length === 0) {
    console.error("✗ Nenhum candidato. Rode: npm run seed:candidates");
    process.exit(1);
  }
  console.log(`  ${candidates.length} candidatos ativos\n`);

  // Busca todas as pesquisas
  console.log("  [1/2] Buscando lista de pesquisas...");
  const polls = await fetchAllPolls();
  console.log(`  ✓ ${polls.length} pesquisas\n`);

  // Para cada pesquisa, buscar /scenarios
  console.log("  [2/2] Buscando resultados por pesquisa...\n");
  let totalUpserted = 0;
  let pollsWithData = 0;
  let pollsEmpty = 0;
  const unmatchedNames = new Set<string>();

  for (const poll of polls) {
    const scenarios = await fetchScenarios(poll.id);
    const { cargo, uf } = mapGeography(poll);
    const instituto = poll.institute.name;

    // Filtrar cenários com resultados
    const withResults = scenarios.filter((s) => s.results.length > 0);

    if (withResults.length === 0) {
      pollsEmpty++;
      continue;
    }

    pollsWithData++;
    console.log(`  ✓ ${instituto} (${poll.collection_date}) [${poll.geography_level}${poll.state_code ? '/' + poll.state_code : ''}]`);

    for (const scenario of withResults) {
      const tipo = mapQuestionType(scenario.question_type);
      const turno = mapRound(scenario);

      // Só processar estimulada e espontanea (pular rejeicao, aprovacao, etc.)
      if (scenario.question_type !== "estimulada" && scenario.question_type !== "espontanea") {
        continue;
      }

      const resultsSummary = scenario.results
        .slice(0, 5)
        .map((r) => `${r.result_label}=${r.percentage}%`)
        .join(", ");
      console.log(`    ${scenario.label}: ${resultsSummary}${scenario.results.length > 5 ? "..." : ""}`);

      for (const result of scenario.results) {
        // Pular categorias especiais e dados inválidos (CSS lixo, textos longos)
        const skip = /branco|nulo|ns\/?nr|indecis|não sabe|nenhum|outros|ninguém/i;
        if (skip.test(result.result_label)) continue;
        if (result.result_label.includes("--") || result.result_label.includes("rgba(")) continue;
        if (result.result_label.length > 60) continue;

        const cid = matchCandidate(result.result_label, candidates);
        if (!cid) {
          unmatchedNames.add(result.result_label);
          continue;
        }

        const { error } = await supabase.from("polls").upsert(
          {
            candidate_id: cid,
            instituto,
            data_pesquisa: poll.collection_date,
            data_publicacao: poll.published_at ?? poll.collection_date,
            percentual: result.percentage,
            margem_erro: poll.margin_error,
            amostra: poll.sample_size,
            tipo,
            turno,
            registro_tse: poll.tse_registration,
            fonte_url: `${E2D_BASE}/pesquisas/${poll.id}`,
            cargo,
            uf,
          },
          { onConflict: "candidate_id,instituto,data_pesquisa,tipo,turno" }
        );

        if (error) {
          console.log(`      ✗ Upsert erro: ${error.message}`);
        } else {
          totalUpserted++;
        }
      }
    }

    // Rate limiting: 500ms entre requests
    await new Promise((r) => setTimeout(r, 500));
  }

  // ── Resultado ──
  const duration = Date.now() - startTime;
  console.log(`\n═══ Resultado ═══`);
  console.log(`  Pesquisas com dados: ${pollsWithData}/${polls.length}`);
  console.log(`  Pesquisas sem resultados: ${pollsEmpty}`);
  console.log(`  Registros upserted: ${totalUpserted}`);
  if (unmatchedNames.size > 0) {
    console.log(`  Candidatos não encontrados: ${[...unmatchedNames].join(", ")}`);
  }
  console.log(`  Duração: ${(duration / 1000).toFixed(1)}s\n`);

  // Log
  await supabase.from("collection_log").insert({
    source: "polls_detail_e2d",
    status: totalUpserted > 0 ? "success" : "partial",
    records_inserted: totalUpserted,
    duration_ms: duration,
    metadata: {
      polls_total: polls.length,
      polls_with_data: pollsWithData,
      polls_empty: pollsEmpty,
      unmatched: [...unmatchedNames],
    },
  });
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
