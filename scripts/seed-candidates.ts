// =============================================================
// Seed Candidates — Pré-candidatos 2026 (março/2026)
// Usage: npm run seed:candidates
// Fonte: pesquisas Quaest, AtlasIntel, Datafolha, Real Time Big Data
// =============================================================
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const CANDIDATES = [
  // ═══════════════════════════════════════════════════════════
  // PRESIDENTE — nomes que aparecem nas pesquisas até mar/2026
  // ═══════════════════════════════════════════════════════════

  // Cenário principal
  { nome: "Luiz Inácio Lula da Silva", nome_urna: "Lula", cargo: "presidente", uf: null, partido: "PT", cor_partido: "#ED1C24" },
  { nome: "Flávio Bolsonaro", nome_urna: "Flávio Bolsonaro", cargo: "presidente", uf: null, partido: "PL", cor_partido: "#003DA5" },
  { nome: "Tarcísio Gomes de Freitas", nome_urna: "Tarcísio", cargo: "presidente", uf: null, partido: "REPUBLICANOS", cor_partido: "#00529B" },
  { nome: "Ciro Ferreira Gomes", nome_urna: "Ciro Gomes", cargo: "presidente", uf: null, partido: "PDT", cor_partido: "#C41E3A" },
  { nome: "Simone Nassar Tebet", nome_urna: "Simone Tebet", cargo: "presidente", uf: null, partido: "MDB", cor_partido: "#FFD700" },
  { nome: "Carlos Roberto Massa Júnior", nome_urna: "Ratinho Junior", cargo: "presidente", uf: null, partido: "PSD", cor_partido: "#FF8C00" },
  { nome: "Ronaldo Ramos Caiado", nome_urna: "Ronaldo Caiado", cargo: "presidente", uf: null, partido: "UNIÃO", cor_partido: "#00BFFF" },
  { nome: "Romeu Zema Neto", nome_urna: "Romeu Zema", cargo: "presidente", uf: null, partido: "NOVO", cor_partido: "#FF6600" },
  { nome: "Fernando Haddad", nome_urna: "Haddad", cargo: "presidente", uf: null, partido: "PT", cor_partido: "#ED1C24" },
  { nome: "Pablo Marçal", nome_urna: "Pablo Marçal", cargo: "presidente", uf: null, partido: "PRTB", cor_partido: "#006400" },
  { nome: "Michelle Bolsonaro", nome_urna: "Michelle Bolsonaro", cargo: "presidente", uf: null, partido: "PL", cor_partido: "#003DA5" },
  { nome: "Guilherme Boulos", nome_urna: "Boulos", cargo: "presidente", uf: null, partido: "PSOL", cor_partido: "#FFCC00" },
  { nome: "Helder Barbalho", nome_urna: "Helder Barbalho", cargo: "presidente", uf: null, partido: "MDB", cor_partido: "#FFD700" },

  // Jair Bolsonaro — INELEGÍVEL até 2030, mas aparece em pesquisas
  { nome: "Jair Messias Bolsonaro", nome_urna: "Jair Bolsonaro", cargo: "presidente", uf: null, partido: "PL", cor_partido: "#003DA5" },

  // ═══════════════════════════════════════════════════════════
  // GOVERNADORES — por estado (conforme pesquisas existentes)
  // Adicionar mais conforme pesquisas estaduais surgirem
  // ═══════════════════════════════════════════════════════════

  // SP — cenários de pesquisa
  { nome: "Tarcísio Gomes de Freitas", nome_urna: "Tarcísio", cargo: "governador", uf: "SP", partido: "REPUBLICANOS", cor_partido: "#00529B" },
  { nome: "Fernando Haddad", nome_urna: "Haddad", cargo: "governador", uf: "SP", partido: "PT", cor_partido: "#ED1C24" },
  { nome: "Guilherme Boulos", nome_urna: "Boulos", cargo: "governador", uf: "SP", partido: "PSOL", cor_partido: "#FFCC00" },

  // RJ
  { nome: "Cláudio Castro", nome_urna: "Cláudio Castro", cargo: "governador", uf: "RJ", partido: "PL", cor_partido: "#003DA5" },
  { nome: "Eduardo Paes", nome_urna: "Eduardo Paes", cargo: "governador", uf: "RJ", partido: "PSD", cor_partido: "#FF8C00" },

  // MG
  { nome: "Nikolas Ferreira", nome_urna: "Nikolas Ferreira", cargo: "governador", uf: "MG", partido: "PL", cor_partido: "#003DA5" },

  // ES
  { nome: "Renato Casagrande", nome_urna: "Casagrande", cargo: "governador", uf: "ES", partido: "PSB", cor_partido: "#FF4500" },

  // BA
  { nome: "Jerônimo Rodrigues", nome_urna: "Jerônimo", cargo: "governador", uf: "BA", partido: "PT", cor_partido: "#ED1C24" },
  { nome: "ACM Neto", nome_urna: "ACM Neto", cargo: "governador", uf: "BA", partido: "UNIÃO", cor_partido: "#00BFFF" },

  // RS
  { nome: "Eduardo Leite", nome_urna: "Eduardo Leite", cargo: "governador", uf: "RS", partido: "PSDB", cor_partido: "#0080FF" },

  // PE
  { nome: "Raquel Lyra", nome_urna: "Raquel Lyra", cargo: "governador", uf: "PE", partido: "PSDB", cor_partido: "#0080FF" },

  // CE
  { nome: "Elmano de Freitas", nome_urna: "Elmano", cargo: "governador", uf: "CE", partido: "PT", cor_partido: "#ED1C24" },

  // PA
  { nome: "Helder Barbalho", nome_urna: "Helder Barbalho", cargo: "governador", uf: "PA", partido: "MDB", cor_partido: "#FFD700" },

  // MT
  { nome: "Mauro Mendes", nome_urna: "Mauro Mendes", cargo: "governador", uf: "MT", partido: "UNIÃO", cor_partido: "#00BFFF" },

  // AP
  { nome: "Clécio Luís", nome_urna: "Clécio", cargo: "governador", uf: "AP", partido: "SOLIDARIEDADE", cor_partido: "#FF8C42" },
];

async function seed() {
  console.log(`Seeding ${CANDIDATES.length} candidates...`);

  // First, check if unique constraint exists on the right columns
  // Upsert using nome_urna + cargo + uf as natural key
  let inserted = 0;
  let updated = 0;

  for (const candidate of CANDIDATES) {
    // Check if exists
    const { data: existing } = await supabase
      .from("candidates")
      .select("id")
      .eq("nome_urna", candidate.nome_urna)
      .eq("cargo", candidate.cargo)
      .eq("uf", candidate.uf ?? "")
      .maybeSingle();

    if (existing) {
      // Update
      await supabase
        .from("candidates")
        .update({ ...candidate, ativo: true, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      updated++;
    } else {
      // Insert
      const { error } = await supabase
        .from("candidates")
        .insert({ ...candidate, ativo: true });
      if (error) {
        console.warn(`  ⚠ Falha ao inserir ${candidate.nome_urna} (${candidate.cargo}/${candidate.uf}):`, error.message);
      } else {
        inserted++;
      }
    }
  }

  console.log(`✓ ${inserted} inseridos, ${updated} atualizados (${CANDIDATES.length} total)`);
  process.exit(0);
}

seed();
