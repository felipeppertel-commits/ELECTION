// =============================================================
// Fetch Polls — Eleição em Dados API + Aggregates + TSE
// Usage: npm run fetch:polls
//
// Estratégia:
//   1. Busca metadados das pesquisas via /api/v1/polls (paginado)
//   2. Busca estimativas agregadas via /api/v1/aggregates (resultados por candidato)
//   3. Para cada pesquisa, busca questions e tenta extrair resultados da detail page
//   4. Cross-check com TSE Dados Abertos (2026)
// =============================================================
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const E2D_BASE = "https://eleicaoemdados.com.br";
const TSE_CKAN = "https://dadosabertos.tse.jus.br/api/3/action";
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
  tse_id: string | null;
  has_tse: boolean;
  geography_level: string;
  state_code: string | null;
  city_name: string | null;
  research_type_label: string;
}

interface E2DPaginatedResponse {
  data: E2DPoll[];
  meta: { total: number; page: number; per_page: number; total_pages: number };
  links: { next: string | null };
}

interface E2DQuestion {
  id: number;
  poll_id: number;
  question_type: string;
  round: number;
  scenario_code: string | null;
  prompt: string | null;
}

interface E2DEstimate {
  candidate_id: number;
  candidate_name: string;
  estimate: number;
  uncertainty_low: number;
  uncertainty_high: number;
  top2_prob: number;
  win_prob: number;
}

interface E2DAggregateData {
  election_id: number;
  question_type: string;
  round: number;
  scenario_code: string | null;
  as_of: string;
  geography_level: string;
  state_code: string | null;
  model_run_id: number;
  model_name: string;
  poll_count: number;
  estimates: E2DEstimate[];
  special: Record<string, number>;
}

interface CandidateRow {
  id: string;
  nome_urna: string;
  nome: string;
  cargo: string;
  uf: string | null;
}

// ─── Fetch all polls (paginated) ────────────────────────────

async function fetchAllPolls(): Promise<E2DPoll[]> {
  console.log("  [1/4] Buscando lista de pesquisas via API...");
  const allPolls: E2DPoll[] = [];
  let page = 1;
  const perPage = 50;

  while (true) {
    const url = `${E2D_BASE}/api/v1/polls?page=${page}&per_page=${perPage}`;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      });

      if (!res.ok) {
        console.log(`    ⚠ Página ${page}: HTTP ${res.status}`);
        break;
      }

      const json: E2DPaginatedResponse = await res.json();
      allPolls.push(...json.data);
      console.log(`    Página ${page}/${json.meta.total_pages}: ${json.data.length} pesquisas`);

      if (!json.links.next || page >= json.meta.total_pages) break;
      page++;
    } catch (err) {
      console.log(`    ✗ Erro página ${page}: ${(err as Error).message}`);
      break;
    }
  }

  console.log(`    ✓ Total: ${allPolls.length} pesquisas`);
  return allPolls;
}

// ─── Fetch questions for a poll ─────────────────────────────

async function fetchPollQuestions(pollId: number): Promise<E2DQuestion[]> {
  try {
    const res = await fetch(`${E2D_BASE}/api/v1/polls/${pollId}/questions`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

// ─── Fetch aggregates (model estimates) ─────────────────────

async function fetchAggregates(params: {
  election_id: number;
  question_type: string;
  round: number;
  scenario_code?: string;
  geography_level?: string;
  state_code?: string;
}): Promise<E2DAggregateData | null> {
  const qs = new URLSearchParams({
    election_id: String(params.election_id),
    question_type: params.question_type,
    round: String(params.round),
  });
  if (params.scenario_code) qs.set("scenario_code", params.scenario_code);
  if (params.geography_level) qs.set("geography_level", params.geography_level);
  if (params.state_code) qs.set("state_code", params.state_code);

  try {
    const res = await fetch(`${E2D_BASE}/api/v1/aggregates?${qs}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ─── Scrape detail page for raw per-poll results ────────────

async function scrapeDetailPage(pollId: number): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${E2D_BASE}/pesquisas/${pollId}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    });
    if (!res.ok) return {};
    const html = await res.text();
    const $ = cheerio.load(html);
    const candidates: Record<string, number> = {};

    // Strategy A: tabela com candidato + percentual
    $("table tbody tr").each((_, tr) => {
      const cells = $(tr).find("td");
      if (cells.length >= 2) {
        const name = $(cells[0]).text().trim();
        const pctText = $(cells[1]).text().trim();
        const pct = parseFloat(pctText.replace(",", ".").replace("%", ""));
        if (name && !isNaN(pct) && pct > 0 && pct <= 100 && name.length < 50) {
          const skip = /branco|nulo|ns\/?nr|indecis|não sabe|nenhum|outros/i;
          if (!skip.test(name)) {
            candidates[name] = pct;
          }
        }
      }
    });

    // Strategy B: cards/divs com classes semânticas
    if (Object.keys(candidates).length === 0) {
      $("[class*='candidate'], [class*='result'], [class*='cenario']").each((_, el) => {
        const $el = $(el);
        const nameEl = $el.find("[class*='name'], [class*='nome'], strong, b").first();
        const pctEl = $el.find("[class*='pct'], [class*='percent'], [class*='valor']").first();
        const name = nameEl.text().trim();
        const pctText = pctEl.text().trim();
        const pct = parseFloat(pctText.replace(",", ".").replace("%", ""));
        if (name && !isNaN(pct) && pct > 0 && pct <= 100) {
          candidates[name] = pct;
        }
      });
    }

    // Strategy C: Next.js __next_f streaming data
    if (Object.keys(candidates).length === 0) {
      const scripts = $("script").toArray();
      for (const script of scripts) {
        const content = $(script).html() ?? "";
        // Procura arrays com padrão candidato/percentual no streaming RSC
        const matches = content.matchAll(/"candidate_name"\s*:\s*"([^"]+)"\s*,\s*"(?:estimate|percentage|percentual)"\s*:\s*([\d.]+)/g);
        for (const m of matches) {
          const name = m[1];
          const pct = parseFloat(m[2]);
          if (name && !isNaN(pct) && pct > 0 && pct <= 100) {
            candidates[name] = pct;
          }
        }
      }
    }

    return candidates;
  } catch {
    return {};
  }
}

// ─── TSE Dados Abertos (cross-check) ───────────────────────

async function fetchTSEMetadata(): Promise<Array<{ numero: string; instituto: string; uf: string }>> {
  console.log("  [4/4] Consultando TSE Dados Abertos 2026...");

  // Tenta dataset 2026 primeiro, depois o "atual"
  const datasetIds = ["pesquisas-eleitorais-2026", "pesquisas-eleitorais-atual"];

  for (const datasetId of datasetIds) {
    try {
      const res = await fetch(`${TSE_CKAN}/package_show?id=${datasetId}`);
      if (!res.ok) {
        console.log(`    ⚠ TSE ${datasetId}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const resources = data?.result?.resources ?? [];
      const csvResource = resources.find(
        (r: { format?: string; url?: string }) =>
          r.format?.toLowerCase() === "csv" &&
          r.url?.includes("pesquisa_eleitoral")
      );

      if (!csvResource?.url) {
        console.log(`    ⚠ Sem CSV de pesquisas em ${datasetId}`);
        continue;
      }

      console.log(`    Baixando: ${csvResource.url}`);

      // O CSV vem como .zip — precisamos descompactar
      // Por simplicidade, tentamos o CSV direto primeiro
      const csvRes = await fetch(csvResource.url);
      if (!csvRes.ok) {
        console.log(`    ⚠ CSV download falhou: ${csvRes.status}`);
        continue;
      }

      const contentType = csvRes.headers.get("content-type") ?? "";
      if (contentType.includes("zip")) {
        console.log(`    ⚠ CSV é .zip — precisa de unzip (pular por agora)`);
        continue;
      }

      const csvText = await csvRes.text();
      const lines = csvText.split("\n");
      const header = lines[0]?.toLowerCase() ?? "";
      console.log(`    CSV header: ${header.slice(0, 200)}`);

      const records = lines.slice(1)
        .filter((l) => l.trim())
        .map((line) => {
          const cols = line.split(";").map((c) => c.replace(/"/g, "").trim());
          return { numero: cols[0] ?? "", instituto: cols[1] ?? "", uf: cols[2] ?? "" };
        })
        .filter((r) => r.numero);

      console.log(`    ✓ ${records.length} registros TSE (${datasetId})`);
      return records;
    } catch (err) {
      console.warn(`    ⚠ TSE ${datasetId}:`, (err as Error).message);
    }
  }

  return [];
}

// ─── Utilities ───────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Aliases para variações de nome que aparecem nas pesquisas
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

  // Match parcial (sobrenome, parte do nome)
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

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log(`\n[${new Date().toISOString()}] ═══ Coletando pesquisas eleitorais ═══\n`);

  // Busca candidatos do banco
  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, nome_urna, nome, cargo, uf")
    .eq("ativo", true);

  if (!candidates || candidates.length === 0) {
    console.error("✗ Nenhum candidato no banco. Rode: npm run seed:candidates");
    process.exit(1);
  }
  console.log(`  ${candidates.length} candidatos ativos\n`);

  let totalUpserted = 0;
  let totalAggregates = 0;

  // ══════════════════════════════════════════════════════════
  // ETAPA 1: Buscar todas as pesquisas (metadados)
  // ══════════════════════════════════════════════════════════
  const polls = await fetchAllPolls();

  // ══════════════════════════════════════════════════════════
  // ETAPA 2: Buscar aggregates (estimativas modelo Bayesiano)
  // ══════════════════════════════════════════════════════════
  console.log("\n  [2/4] Buscando estimativas agregadas (modelo Bayesiano)...");

  // Descobrir cenários disponíveis checando as questions
  const scenariosSet = new Set<string>();
  const questionTypesSet = new Set<string>();

  // Amostra de polls para descobrir cenários
  const samplePolls = polls.slice(0, Math.min(10, polls.length));
  for (const poll of samplePolls) {
    const questions = await fetchPollQuestions(poll.id);
    for (const q of questions) {
      questionTypesSet.add(q.question_type);
      if (q.scenario_code) scenariosSet.add(q.scenario_code);
    }
  }

  const scenarios = scenariosSet.size > 0 ? [...scenariosSet] : ["cenario_01"];
  const questionTypes = questionTypesSet.size > 0
    ? [...questionTypesSet].filter((t) => t === "estimulada" || t === "espontanea")
    : ["estimulada"];

  console.log(`    Cenários encontrados: ${scenarios.join(", ")}`);
  console.log(`    Tipos de questão: ${[...questionTypesSet].join(", ")}`);

  // Buscar aggregates nacionais para cada cenário
  for (const scenario of scenarios) {
    for (const qType of questionTypes) {
      const agg = await fetchAggregates({
        election_id: 1,
        question_type: qType,
        round: 1,
        scenario_code: scenario,
        geography_level: "nacional",
      });

      if (!agg || !agg.estimates || agg.estimates.length === 0) continue;

      console.log(`\n    ✓ Agregado nacional ${qType}/${scenario}: ${agg.estimates.length} candidatos (${agg.poll_count} pesquisas)`);

      for (const est of agg.estimates) {
        const cid = matchCandidate(est.candidate_name, candidates);
        if (!cid) {
          console.log(`      ⚠ Não encontrado: "${est.candidate_name}"`);
          continue;
        }

        // Upsert na poll_averages (média ponderada do modelo)
        const { error } = await supabase.from("poll_averages").upsert(
          {
            candidate_id: cid,
            data: agg.as_of,
            media_simples: est.estimate,
            media_ponderada: est.estimate,
            num_pesquisas: agg.poll_count,
            cargo: "presidente",
            uf: null,
          },
          { onConflict: "candidate_id,data" }
        );

        if (error) {
          console.log(`      ✗ Upsert avg erro: ${error.message}`);
        } else {
          totalAggregates++;
        }
      }

      // Candidatos no "special" (baixa intenção, misturados com Branco/Nulo)
      if (agg.special) {
        for (const [name, pct] of Object.entries(agg.special)) {
          const skip = /branco|nulo|ns\/?nr|indecis|não sabe|nenhum|outros/i;
          if (skip.test(name)) continue;
          const cid = matchCandidate(name, candidates);
          if (!cid) continue;

          await supabase.from("poll_averages").upsert(
            {
              candidate_id: cid,
              data: agg.as_of,
              media_simples: pct,
              media_ponderada: pct,
              num_pesquisas: agg.poll_count,
              cargo: "presidente",
              uf: null,
            },
            { onConflict: "candidate_id,data" }
          );
          totalAggregates++;
        }
      }
    }
  }

  // Buscar aggregates segundo turno
  for (const scenario of scenarios) {
    const agg2 = await fetchAggregates({
      election_id: 1,
      question_type: "estimulada",
      round: 2,
      scenario_code: scenario,
    });

    if (agg2?.estimates && agg2.estimates.length > 0) {
      console.log(`\n    ✓ Agregado 2º turno ${scenario}: ${agg2.estimates.length} candidatos`);
      // Salvar como registro separado (turno 2) — por agora só log
      for (const est of agg2.estimates) {
        console.log(`      ${est.candidate_name}: ${est.estimate.toFixed(1)}% (win: ${(est.win_prob * 100).toFixed(1)}%)`);
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // ETAPA 3: Gravar metadados das pesquisas individuais + tentar detail pages
  // ══════════════════════════════════════════════════════════
  console.log("\n  [3/4] Processando pesquisas individuais...");

  // Filtra pesquisas do tipo "candidatos"
  const candidatePolls = polls.filter(
    (p) => p.research_type_label?.toLowerCase().includes("candidato")
  );
  console.log(`    ${candidatePolls.length} pesquisas de candidatos para processar\n`);

  for (const poll of candidatePolls) {
    const { cargo, uf } = mapGeography(poll);
    const instituto = poll.institute.name;
    const data = poll.collection_date;

    // Tenta scrape da detail page para obter resultados brutos
    const results = await scrapeDetailPage(poll.id);
    const numResults = Object.keys(results).length;

    if (numResults > 0) {
      console.log(`    ✓ ${instituto} (${data}) [${poll.geography_level}${poll.state_code ? '/' + poll.state_code : ''}]: ${numResults} candidatos`);

      for (const [name, pct] of Object.entries(results)) {
        const cid = matchCandidate(name, candidates);
        if (!cid) {
          console.log(`      ⚠ Não encontrado: "${name}"`);
          continue;
        }

        const { error } = await supabase.from("polls").upsert(
          {
            candidate_id: cid,
            instituto,
            data_pesquisa: data,
            data_publicacao: poll.published_at,
            percentual: pct,
            margem_erro: poll.margin_error,
            amostra: poll.sample_size,
            tipo: "estimulada",
            turno: 1,
            registro_tse: poll.tse_registration,
            fonte_url: `${E2D_BASE}/pesquisas/${poll.id}`,
            cargo,
            uf,
          },
          { onConflict: "candidate_id,instituto,data_pesquisa,tipo,turno" }
        );

        if (!error) totalUpserted++;
      }
    } else {
      // Sem resultados do scrape — gravar só metadados no log
      console.log(`    ○ ${instituto} (${data}) — sem percentuais extraídos (detail page protegida?)`);
    }

    // Rate limiting: 1s entre requests de detail pages
    await new Promise((r) => setTimeout(r, 1000));
  }

  // ══════════════════════════════════════════════════════════
  // ETAPA 4: TSE cross-check
  // ══════════════════════════════════════════════════════════
  const tseRecords = await fetchTSEMetadata();
  if (tseRecords.length > 0) {
    console.log(`\n  ✓ TSE: ${tseRecords.length} registros para validação cruzada`);
  }

  // ══════════════════════════════════════════════════════════
  // Resultado
  // ══════════════════════════════════════════════════════════
  const duration = Date.now() - startTime;
  console.log(`\n═══ Resultado ═══`);
  console.log(`  Pesquisas encontradas: ${polls.length}`);
  console.log(`  Registros polls upserted: ${totalUpserted}`);
  console.log(`  Registros poll_averages: ${totalAggregates}`);
  console.log(`  TSE registros: ${tseRecords.length}`);
  console.log(`  Duração: ${(duration / 1000).toFixed(1)}s\n`);

  // Log de coleta
  await supabase.from("collection_log").insert({
    source: "polls_e2d",
    status: totalUpserted > 0 || totalAggregates > 0 ? "success" : "partial",
    records_inserted: totalUpserted + totalAggregates,
    duration_ms: duration,
    metadata: {
      polls_found: polls.length,
      polls_upserted: totalUpserted,
      averages_upserted: totalAggregates,
      scenarios: scenarios,
      tse_records: tseRecords.length,
    },
  });
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
