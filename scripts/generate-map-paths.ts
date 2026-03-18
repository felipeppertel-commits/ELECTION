// =============================================================
// Generate Map Paths — Converte GeoJSON do Brasil em SVG paths
// Usage: npx tsx scripts/generate-map-paths.ts
//
// Baixa GeoJSON real dos estados brasileiros e usa d3-geo para
// gerar SVG paths projetados. Salva em src/data/brazil-states.ts.
// =============================================================
import { writeFileSync } from "fs";
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import type { FeatureCollection, Feature, Geometry } from "geojson";

const GEOJSON_URL = "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

// Mapeamento de nomes do GeoJSON para códigos UF
const NAME_TO_UF: Record<string, string> = {
  "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM",
  "Bahia": "BA", "Ceará": "CE", "Distrito Federal": "DF",
  "Espírito Santo": "ES", "Goiás": "GO", "Maranhão": "MA",
  "Mato Grosso": "MT", "Mato Grosso do Sul": "MS", "Minas Gerais": "MG",
  "Pará": "PA", "Paraíba": "PB", "Paraná": "PR", "Pernambuco": "PE",
  "Piauí": "PI", "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS", "Rondônia": "RO", "Roraima": "RR",
  "Santa Catarina": "SC", "São Paulo": "SP", "Sergipe": "SE",
  "Tocantins": "TO",
};

interface StateData {
  uf: string;
  name: string;
  cx: number;
  cy: number;
  path: string;
}

async function main() {
  console.log("Baixando GeoJSON do Brasil...");
  const res = await fetch(GEOJSON_URL);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const geojson: FeatureCollection = await res.json();

  console.log(`  ${geojson.features.length} features encontradas`);

  // Configura projeção Mercator centrada no Brasil
  const width = 800;
  const height = 800;

  const projection = geoMercator()
    .center([-52, -15]) // Centro do Brasil
    .scale(850)
    .translate([width / 2, height / 2]);

  const pathGenerator = geoPath().projection(projection);

  const states: StateData[] = [];

  for (const feature of geojson.features) {
    const name = feature.properties?.name ?? feature.properties?.NAME ?? feature.properties?.estado ?? "";
    const uf = NAME_TO_UF[name];

    if (!uf) {
      console.warn(`  ⚠ Estado não mapeado: "${name}"`);
      continue;
    }

    // Gera o SVG path
    const svgPath = pathGenerator(feature as GeoPermissibleObjects);
    if (!svgPath) {
      console.warn(`  ⚠ Path vazio para: ${uf}`);
      continue;
    }

    // Calcula centróide para posicionamento do label
    const centroid = pathGenerator.centroid(feature as GeoPermissibleObjects);
    const cx = Math.round(centroid[0]);
    const cy = Math.round(centroid[1]);

    states.push({ uf, name, cx, cy, path: svgPath });
  }

  // Ordena por região (Norte, Nordeste, Centro-Oeste, Sudeste, Sul)
  const regionOrder: Record<string, number> = {
    AC: 0, AM: 0, AP: 0, PA: 0, RO: 0, RR: 0, TO: 0, // Norte
    AL: 1, BA: 1, CE: 1, MA: 1, PB: 1, PE: 1, PI: 1, RN: 1, SE: 1, // Nordeste
    DF: 2, GO: 2, MS: 2, MT: 2, // Centro-Oeste
    ES: 3, MG: 3, RJ: 3, SP: 3, // Sudeste
    PR: 4, RS: 4, SC: 4, // Sul
  };

  states.sort((a, b) => (regionOrder[a.uf] ?? 9) - (regionOrder[b.uf] ?? 9) || a.uf.localeCompare(b.uf));

  // Gera o arquivo TypeScript
  const output = `// =============================================================
// Brazil States — SVG paths gerados por d3-geo a partir de GeoJSON real
// Auto-gerado por: npx tsx scripts/generate-map-paths.ts
// Fonte: codeforamerica/click_that_hood (Brazil states GeoJSON)
// Projeção: geoMercator, center [-52, -15], scale 850, viewBox 0 0 800 800
// =============================================================

export interface BrazilState {
  uf: string;
  name: string;
  cx: number;
  cy: number;
  path: string;
}

export const BRAZIL_STATES: BrazilState[] = [
${states.map((s) => `  { uf: "${s.uf}", name: "${s.name}", cx: ${s.cx}, cy: ${s.cy}, path: "${s.path}" },`).join("\n")}
];

// Quick lookup
export const stateByUf = Object.fromEntries(
  BRAZIL_STATES.map((s) => [s.uf, s])
);
`;

  writeFileSync("src/data/brazil-states.ts", output, "utf-8");
  console.log(`\n✓ ${states.length} estados gerados em src/data/brazil-states.ts`);
}

main().catch((err) => {
  console.error("✗ Fatal:", err);
  process.exit(1);
});
