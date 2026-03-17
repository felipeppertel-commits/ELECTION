// =============================================================
// Fetch Polls — Eleição em Dados API + HTML fallback + TSE
// Usage: npm run fetch:polls
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

// ─── Types ───────────────────────────────────────────────────

interface E2DPoll {
  id: number;
  numero_tse: string;
  instituto: string;
  data_coleta: string;
  amostra: number | null;
  margem_erro: number | null;
  escopo: string;
  tipo: string;
  candidatos?: Record<string, number>;
}

interface PollRow {
  data: string;
  numero: string;
  instituto: string;
  escopo: string;
  tipo: string;
  amostra: number | null;
  margem: number | null;
  detalhe_url: string;
}

// ─── Strategy 1: E2D API ─────────────────────────────────────

async function tryE2DAPI(): Promise<E2DPoll[]> {
  console.log("  [1/3] Tentando Eleição em Dados API...");

  const endpoints = [
    `${E2D_BASE}/api/v1/polls`,
    `${E2D_BASE}/api/v1/polls?limit=100`,
    `${E2D_BASE}/api/polls`,
    `${E2D_BASE}/api/pesquisas`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Eleicoes2026-OpenSource/1.0",
        },
      });

      if (!res.ok) {
        console.log(`    ${url} → ${res.status}`);
        continue;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) {
        console.log(`    ${url} → not JSON (${contentType})`);
        continue;
      }

      const data = await res.json();
      console.log(`    ✓ API respondeu: ${url}`);
      console.log(`    Estrutura:`, JSON.stringify(data).slice(0, 500));

      const polls = Array.isArray(data)
        ? data
        : data.polls ?? data.data ?? data.results ?? data.items ?? [];

      if (Array.isArray(polls) && polls.length > 0) {
        console.log(`    ✓ ${polls.length} pesquisas via API`);
        return polls.map(normalizePollFromAPI);
      }
    } catch (err) {
      console.log(`    ${url} → erro: ${(err as Error).message}`);
    }
  }

  console.log("    ⚠ API indisponível, fallback HTML");
  return [];
}

function normalizePollFromAPI(raw: any): E2DPoll {
  return {
    id: raw.id ?? raw.poll_id ?? 0,
    numero_tse: raw.numero_tse ?? raw.numero ?? raw.registration_number ?? raw.tse_number ?? "",
    instituto: raw.instituto ?? raw.institute ?? raw.pollster ?? raw.company ?? "Desconhecido",
    data_coleta: raw.data_coleta ?? raw.collection_date ?? raw.date ?? raw.data ?? "",
    amostra: raw.amostra ?? raw.sample_size ?? raw.sample ?? raw.n ?? null,
    margem_erro: raw.margem_erro ?? raw.margin_of_error ?? raw.margin ?? raw.moe ?? null,
    escopo: raw.escopo ?? raw.scope ?? raw.geography ?? raw.geo ?? "Nacional",
    tipo: raw.tipo ?? raw.type ?? raw.poll_type ?? "Pesquisa de candidatos",
    candidatos: raw.candidatos ?? raw.candidates ?? raw.results ?? undefined,
  };
}

// ─── Strategy 2: E2D HTML scraping ───────────────────────────

async function scrapeE2DList(): Promise<PollRow[]> {
  console.log("  [2/3] Scraping Eleição em Dados HTML...");
  const allRows: PollRow[] = [];

  for (let page = 1; page <= 10; page++) {
    const url = `${E2D_BASE}/pesquisas?page=${page}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Eleicoes2026-OpenSource/1.0", Accept: "text/html" },
      });

      if (!res.ok) break;
      const html = await res.text();
      const $ = cheerio.load(html);

      const rows: PollRow[] = [];

      $("table tbody tr").each((_, tr) => {
        const cells = $(tr).find("td");
        if (cells.length < 5) return;

        const dataText = $(cells[0]).text().trim();
        const numero = $(cells[1]).text().trim();
        const pesquisaText = $(cells[2]).text().trim();
        const amostraText = $(cells[3]).text().trim();
        const margemText = $(cells[4]).text().trim();
        const linkEl = $(cells[5]).find("a");
        const detailHref = linkEl.attr("href") ?? "";

        const [instituto, ...restParts] = pesquisaText.split("·").map((s) => s.trim());
        const restText = restParts.join("·").trim();
        const [escopo, tipo] = restText.split(" - ").map((s) => s.trim());

        const dateMatch = dataText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        const isoDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : dataText;

        rows.push({
          data: isoDate,
          numero,
          instituto: instituto || "Desconhecido",
          escopo: escopo || "Nacional",
          tipo: tipo || "Pesquisa de candidatos",
          amostra: parseInt(amostraText.replace(/\D/g, "")) || null,
          margem: parseFloat(margemText.replace(",", ".").replace("%", "")) || null,
          detalhe_url: detailHref.startsWith("http") ? detailHref : `${E2D_BASE}${detailHref}`,
        });
      });

      if (rows.length === 0) break;
      allRows.push(...rows);
      console.log(`    Página ${page}: ${rows.length} pesquisas`);

      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.warn(`    ⚠ Página ${page}:`, (err as Error).message);
      break;
    }
  }

  console.log(`    ✓ Total: ${allRows.length} pesquisas via HTML`);
  return allRows;
}

async function scrapeE2DDetail(url: string): Promise<Record<string, number>> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Eleicoes2026-OpenSource/1.0", Accept: "text/html" },
    });

    if (!res.ok) return {};
    const html = await res.text();
    const $ = cheerio.load(html);

    const candidates: Record<string, number> = {};

    // Strategy A: table rows with candidate name + percentage
    $("table tbody tr").each((_, tr) => {
      const cells = $(tr).find("td");
      if (cells.length >= 2) {
        const name = $(cells[0]).text().trim();
        const pctText = $(cells[1]).text().trim();
        const pct = parseFloat(pctText.replace(",", ".").replace("%", ""));

        if (name && !isNaN(pct) && pct > 0 && pct <= 100 && name.length < 50) {
          // Skip aggregate rows like "Branco/Nulo", "NS/NR", "Indecisos"
          const skip = /branco|nulo|ns\/?nr|indecis|não sabe|nenhum|outros/i;
          if (!skip.test(name)) {
            candidates[name] = pct;
          }
        }
      }
    });

    // Strategy B: card/list layouts
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

    // Strategy C: try to find JSON data embedded in Next.js __NEXT_DATA__
    if (Object.keys(candidates).length === 0) {
      const nextDataScript = $('script#__NEXT_DATA__').html();
      if (nextDataScript) {
        try {
          const nextData = JSON.parse(nextDataScript);
          const pageProps = nextData?.props?.pageProps;
          if (pageProps) {
            // Look for candidate arrays in any property
            const findCandidates = (obj: any, depth = 0): void => {
              if (depth > 5 || !obj) return;
              if (Array.isArray(obj)) {
                for (const item of obj) {
                  if (item?.candidato && typeof item?.percentual === "number") {
                    candidates[item.candidato] = item.percentual;
                  } else if (item?.name && typeof item?.value === "number") {
                    candidates[item.name] = item.value;
                  } else if (item?.candidate && typeof item?.percentage === "number") {
                    candidates[item.candidate] = item.percentage;
                  }
                }
              }
              if (typeof obj === "object") {
                for (const val of Object.values(obj)) {
                  findCandidates(val, depth + 1);
                }
              }
            };
            findCandidates(pageProps);
          }
        } catch {
          // JSON parse failed, ignore
        }
      }
    }

    return candidates;
  } catch {
    return {};
  }
}

// ─── Strategy 3: TSE Dados Abertos ──────────────────────────

async function fetchTSEMetadata(): Promise<Array<{ numero: string; instituto: string; uf: string }>> {
  console.log("  [3/3] Consultando TSE Dados Abertos...");

  try {
    const res = await fetch(`${TSE_CKAN}/package_show?id=pesquisas-eleitorais-atual`);
    if (!res.ok) {
      console.log(`    ⚠ TSE CKAN ${res.status}`);
      return [];
    }

    const data = await res.json();
    const resources = data?.result?.resources ?? [];

    const csvResource = resources.find(
      (r: any) => r.format?.toLowerCase() === "csv" && (r.name?.toLowerCase().includes("pesquisa") || r.url?.includes("pesquisa"))
    );

    if (!csvResource?.url) {
      // Try first CSV resource
      const anyCsv = resources.find((r: any) => r.format?.toLowerCase() === "csv");
      if (!anyCsv?.url) {
        console.log("    ⚠ Nenhum CSV encontrado no dataset TSE");
        console.log(`    Resources: ${resources.map((r: any) => `${r.name} (${r.format})`).join(", ")}`);
        return [];
      }
      console.log(`    Usando CSV: ${anyCsv.name}`);
    }

    const csvUrl = csvResource?.url ?? resources.find((r: any) => r.format?.toLowerCase() === "csv")?.url;
    if (!csvUrl) return [];

    const csvRes = await fetch(csvUrl);
    if (!csvRes.ok) return [];

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

    console.log(`    ✓ ${records.length} registros TSE`);
    return records;
  } catch (err) {
    console.warn("    ⚠ TSE falhou:", (err as Error).message);
    return [];
  }
}

// ─── Utilities ───────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function matchCandidate(
  name: string,
  candidates: Array<{ id: string; nome_urna: string; nome: string }>
): string | null {
  const normalized = normalizeStr(name);

  const exact = candidates.find((c) => normalizeStr(c.nome_urna) === normalized);
  if (exact) return exact.id;

  const partial = candidates.find((c) => {
    const normUrna = normalizeStr(c.nome_urna);
    const normNome = normalizeStr(c.nome);
    const lastName = normalizeStr(c.nome.split(" ").pop()!);
    return (
      normalized.includes(normUrna) || normUrna.includes(normalized) ||
      normalized.includes(lastName) || lastName.includes(normalized)
    );
  });

  return partial?.id ?? null;
}

function parseScope(escopo: string): { cargo: string; uf: string | null } {
  const upper = escopo.toUpperCase().trim();
  if (upper === "NACIONAL" || upper.includes("NACIONAL") || upper === "BR") {
    return { cargo: "presidente", uf: null };
  }
  const ufMatch = upper.match(/^([A-Z]{2})$/);
  if (ufMatch) return { cargo: "governador", uf: ufMatch[1] };
  const ufPrefix = upper.match(/^([A-Z]{2})\s*[-–]/);
  if (ufPrefix) return { cargo: "governador", uf: ufPrefix[1] };
  return { cargo: "presidente", uf: null };
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Coletando pesquisas eleitorais...`);

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, nome_urna, nome, cargo, uf")
    .eq("ativo", true);

  if (!candidates || candidates.length === 0) {
    console.error("✗ Nenhum candidato. Rode: npm run seed:candidates");
    process.exit(1);
  }

  console.log(`  ${candidates.length} candidatos ativos\n`);

  let totalInserted = 0;

  // ── Strategy 1: E2D API ──
  const apiPolls = await tryE2DAPI();

  if (apiPolls.length > 0 && apiPolls.some((p) => p.candidatos && Object.keys(p.candidatos).length > 0)) {
    console.log("\n  Processando dados da API...");

    for (const poll of apiPolls) {
      if (!poll.candidatos) continue;
      const { cargo, uf } = parseScope(poll.escopo);

      for (const [name, pct] of Object.entries(poll.candidatos)) {
        const cid = matchCandidate(name, candidates);
        if (!cid) {
          console.log(`    ⚠ Não encontrado: "${name}"`);
          continue;
        }

        const { error } = await supabase.from("polls").upsert(
          {
            candidate_id: cid,
            instituto: poll.instituto,
            data_pesquisa: poll.data_coleta,
            data_publicacao: poll.data_coleta,
            percentual: pct,
            margem_erro: poll.margem_erro,
            amostra: poll.amostra,
            tipo: "estimulada",
            turno: 1,
            registro_tse: poll.numero_tse,
            fonte_url: `${E2D_BASE}/pesquisas/${poll.id}`,
            cargo,
            uf,
          },
          { onConflict: "candidate_id,instituto,data_pesquisa,tipo,turno" }
        );

        if (!error) totalInserted++;
      }
    }
  } else {
    // ── Strategy 2: E2D HTML ──
    const htmlRows = await scrapeE2DList();

    if (htmlRows.length > 0) {
      const candidatePolls = htmlRows.filter((r) => r.tipo.toLowerCase().includes("candidato"));
      console.log(`\n  ${candidatePolls.length} pesquisas de candidatos para detalhar...\n`);

      for (const row of candidatePolls) {
        console.log(`    ${row.instituto} (${row.data}) [${row.escopo}]`);

        const results = await scrapeE2DDetail(row.detalhe_url);
        const { cargo, uf } = parseScope(row.escopo);
        const numResults = Object.keys(results).length;

        if (numResults === 0) {
          console.log(`      ⚠ Sem percentuais extraídos`);
          continue;
        }

        console.log(`      ${numResults} candidatos: ${Object.entries(results).map(([n, p]) => `${n}=${p}%`).join(", ")}`);

        for (const [name, pct] of Object.entries(results)) {
          const cid = matchCandidate(name, candidates);
          if (!cid) continue;

          const { error } = await supabase.from("polls").upsert(
            {
              candidate_id: cid,
              instituto: row.instituto,
              data_pesquisa: row.data,
              data_publicacao: row.data,
              percentual: pct,
              margem_erro: row.margem,
              amostra: row.amostra,
              tipo: "estimulada",
              turno: 1,
              registro_tse: row.numero,
              fonte_url: row.detalhe_url,
              cargo,
              uf,
            },
            { onConflict: "candidate_id,instituto,data_pesquisa,tipo,turno" }
          );

          if (!error) totalInserted++;
        }

        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  // ── Strategy 3: TSE cross-check ──
  const tseRecords = await fetchTSEMetadata();
  if (tseRecords.length > 0) {
    console.log(`\n  ✓ TSE: ${tseRecords.length} registros disponíveis para validação`);
  }

  const duration = Date.now() - startTime;
  console.log(`\n✓ Pesquisas: ${totalInserted} registros em ${duration}ms`);

  await supabase.from("collection_log").insert({
    source: "polls_e2d",
    status: totalInserted > 0 ? "success" : "partial",
    records_inserted: totalInserted,
    duration_ms: duration,
    metadata: { api_tried: apiPolls.length > 0, tse_records: tseRecords.length },
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
