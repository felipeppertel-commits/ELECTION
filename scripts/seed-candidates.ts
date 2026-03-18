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

// Cores políticas: vermelho = esquerda, azul = direita, amarelo = centro
const COR = {
  ESQ: "#DC2626",   // vermelho — esquerda
  DIR: "#2563EB",   // azul — direita
  CEN: "#EAB308",   // amarelo — centro/independente
};

const CANDIDATES = [
  // ═══════════════════════════════════════════════════════════
  // PRESIDENTE — nomes que aparecem nas pesquisas até mar/2026
  // ═══════════════════════════════════════════════════════════

  { nome: "Luiz Inácio Lula da Silva", nome_urna: "Lula", cargo: "presidente", uf: null, partido: "PT", cor_partido: COR.ESQ },
  { nome: "Flávio Bolsonaro", nome_urna: "Flávio Bolsonaro", cargo: "presidente", uf: null, partido: "PL", cor_partido: COR.DIR },
  { nome: "Tarcísio Gomes de Freitas", nome_urna: "Tarcísio", cargo: "presidente", uf: null, partido: "REPUBLICANOS", cor_partido: COR.DIR },
  { nome: "Ciro Ferreira Gomes", nome_urna: "Ciro Gomes", cargo: "presidente", uf: null, partido: "PDT", cor_partido: COR.ESQ },
  { nome: "Simone Nassar Tebet", nome_urna: "Simone Tebet", cargo: "presidente", uf: null, partido: "MDB", cor_partido: COR.CEN },
  { nome: "Carlos Roberto Massa Júnior", nome_urna: "Ratinho Junior", cargo: "presidente", uf: null, partido: "PSD", cor_partido: COR.DIR },
  { nome: "Ronaldo Ramos Caiado", nome_urna: "Ronaldo Caiado", cargo: "presidente", uf: null, partido: "UNIÃO", cor_partido: COR.DIR },
  { nome: "Romeu Zema Neto", nome_urna: "Romeu Zema", cargo: "presidente", uf: null, partido: "NOVO", cor_partido: COR.DIR },
  { nome: "Fernando Haddad", nome_urna: "Haddad", cargo: "presidente", uf: null, partido: "PT", cor_partido: COR.ESQ },
  { nome: "Pablo Marçal", nome_urna: "Pablo Marçal", cargo: "presidente", uf: null, partido: "PRTB", cor_partido: COR.DIR },
  { nome: "Michelle Bolsonaro", nome_urna: "Michelle Bolsonaro", cargo: "presidente", uf: null, partido: "PL", cor_partido: COR.DIR },
  { nome: "Guilherme Boulos", nome_urna: "Boulos", cargo: "presidente", uf: null, partido: "PSOL", cor_partido: COR.ESQ },
  { nome: "Helder Barbalho", nome_urna: "Helder Barbalho", cargo: "presidente", uf: null, partido: "MDB", cor_partido: COR.CEN },
  { nome: "Aldo Rebelo", nome_urna: "Aldo Rebelo", cargo: "presidente", uf: null, partido: "MDB", cor_partido: COR.CEN },
  { nome: "Renan Santos", nome_urna: "Renan Santos", cargo: "presidente", uf: null, partido: "NOVO", cor_partido: COR.DIR },

  // Jair Bolsonaro — INELEGÍVEL até 2030, mas aparece em pesquisas
  { nome: "Jair Messias Bolsonaro", nome_urna: "Jair Bolsonaro", cargo: "presidente", uf: null, partido: "PL", cor_partido: COR.DIR },

  // ═══════════════════════════════════════════════════════════
  // GOVERNADORES — nomes que aparecem nas pesquisas reais
  // Fonte: Eleição em Dados /api/v1/polls/{id}/scenarios
  // ═══════════════════════════════════════════════════════════

  // SP
  { nome: "Fernando Haddad", nome_urna: "Fernando Haddad", cargo: "governador", uf: "SP", partido: "PT", cor_partido: COR.ESQ },
  { nome: "Marina Silva", nome_urna: "Marina Silva", cargo: "governador", uf: "SP", partido: "REDE", cor_partido: COR.ESQ },
  { nome: "Capitão Derrite", nome_urna: "Capitão Derrite", cargo: "governador", uf: "SP", partido: "PL", cor_partido: COR.DIR },
  { nome: "Coronel Mello Araujo", nome_urna: "Coronel Mello Araujo", cargo: "governador", uf: "SP", partido: "PL", cor_partido: COR.DIR },
  { nome: "Ricardo Salles", nome_urna: "Ricardo Salles", cargo: "governador", uf: "SP", partido: "PL", cor_partido: COR.DIR },
  { nome: "Mário Frias", nome_urna: "Mário Frias", cargo: "governador", uf: "SP", partido: "PL", cor_partido: COR.DIR },

  // RJ
  { nome: "Cláudio Castro", nome_urna: "Cláudio Castro", cargo: "governador", uf: "RJ", partido: "PL", cor_partido: COR.DIR },
  { nome: "Eduardo Paes", nome_urna: "Eduardo Paes", cargo: "governador", uf: "RJ", partido: "PSD", cor_partido: COR.CEN },

  // MG
  { nome: "Nikolas Ferreira", nome_urna: "Nikolas Ferreira", cargo: "governador", uf: "MG", partido: "PL", cor_partido: COR.DIR },

  // BA
  { nome: "Jerônimo Rodrigues", nome_urna: "Jerônimo Rodrigues", cargo: "governador", uf: "BA", partido: "PT", cor_partido: COR.ESQ },
  { nome: "ACM Neto", nome_urna: "ACM Neto", cargo: "governador", uf: "BA", partido: "UNIÃO", cor_partido: COR.DIR },

  // RS
  { nome: "Luciano Zucco", nome_urna: "Luciano Zucco", cargo: "governador", uf: "RS", partido: "PL", cor_partido: COR.DIR },
  { nome: "Juliana Brizola", nome_urna: "Juliana Brizola", cargo: "governador", uf: "RS", partido: "PDT", cor_partido: COR.ESQ },
  { nome: "Edegar Pretto", nome_urna: "Edegar Pretto", cargo: "governador", uf: "RS", partido: "PT", cor_partido: COR.ESQ },
  { nome: "Gabriel Souza", nome_urna: "Gabriel Souza", cargo: "governador", uf: "RS", partido: "MDB", cor_partido: COR.CEN },
  { nome: "Eduardo Leite", nome_urna: "Eduardo Leite", cargo: "governador", uf: "RS", partido: "PSDB", cor_partido: COR.CEN },

  // PE
  { nome: "João Campos", nome_urna: "João Campos", cargo: "governador", uf: "PE", partido: "PSB", cor_partido: COR.ESQ },
  { nome: "Raquel Lyra", nome_urna: "Raquel Lyra", cargo: "governador", uf: "PE", partido: "PSDB", cor_partido: COR.CEN },
  { nome: "Eduardo Moura", nome_urna: "Eduardo Moura", cargo: "governador", uf: "PE", partido: "PL", cor_partido: COR.DIR },

  // CE
  { nome: "Elmano de Freitas", nome_urna: "Elmano de Freitas", cargo: "governador", uf: "CE", partido: "PT", cor_partido: COR.ESQ },
  { nome: "Ciro Ferreira Gomes", nome_urna: "Ciro Gomes", cargo: "governador", uf: "CE", partido: "PDT", cor_partido: COR.ESQ },
  { nome: "Eduardo Girão", nome_urna: "Eduardo Girão", cargo: "governador", uf: "CE", partido: "NOVO", cor_partido: COR.DIR },
  { nome: "Roberto Cláudio", nome_urna: "Roberto Cláudio", cargo: "governador", uf: "CE", partido: "PDT", cor_partido: COR.CEN },

  // PA
  { nome: "Hana Ghassan", nome_urna: "Hana Ghassan", cargo: "governador", uf: "PA", partido: "MDB", cor_partido: COR.CEN },
  { nome: "Dr. Daniel Santos", nome_urna: "Dr. Daniel Santos", cargo: "governador", uf: "PA", partido: "PSD", cor_partido: COR.CEN },
  { nome: "Mário Couto", nome_urna: "Mário Couto", cargo: "governador", uf: "PA", partido: "PL", cor_partido: COR.DIR },

  // AP
  { nome: "Clécio Luís", nome_urna: "Clécio Luís", cargo: "governador", uf: "AP", partido: "SOLIDARIEDADE", cor_partido: COR.ESQ },
  { nome: "Dr. Furlan", nome_urna: "Dr. Furlan", cargo: "governador", uf: "AP", partido: "MDB", cor_partido: COR.CEN },

  // GO
  { nome: "Daniel Vilela", nome_urna: "Daniel Vilela", cargo: "governador", uf: "GO", partido: "MDB", cor_partido: COR.CEN },
  { nome: "Marconi Perillo", nome_urna: "Marconi Perillo", cargo: "governador", uf: "GO", partido: "PSDB", cor_partido: COR.CEN },
  { nome: "Adriana Accorsi", nome_urna: "Adriana Accorsi", cargo: "governador", uf: "GO", partido: "PT", cor_partido: COR.ESQ },
  { nome: "Wilder Moraes", nome_urna: "Wilder Moraes", cargo: "governador", uf: "GO", partido: "PL", cor_partido: COR.DIR },

  // SE
  { nome: "Alessandro Vieira", nome_urna: "Alessandro Vieira", cargo: "governador", uf: "SE", partido: "MDB", cor_partido: COR.CEN },

  // AC
  { nome: "Alan Rick", nome_urna: "Alan Rick", cargo: "governador", uf: "AC", partido: "UNIÃO", cor_partido: COR.DIR },
  { nome: "Mailza Assis", nome_urna: "Mailza Assis", cargo: "governador", uf: "AC", partido: "PP", cor_partido: COR.DIR },
];

async function seed() {
  console.log(`Seeding ${CANDIDATES.length} candidates...`);

  // First, check if unique constraint exists on the right columns
  // Upsert using nome_urna + cargo + uf as natural key
  let inserted = 0;
  let updated = 0;

  for (const candidate of CANDIDATES) {
    // Check if exists
    let query = supabase
      .from("candidates")
      .select("id")
      .eq("nome_urna", candidate.nome_urna)
      .eq("cargo", candidate.cargo);
    if (candidate.uf) {
      query = query.eq("uf", candidate.uf);
    } else {
      query = query.is("uf", null);
    }
    const { data: existing } = await query.maybeSingle();

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
