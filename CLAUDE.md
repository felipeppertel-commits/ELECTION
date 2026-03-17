# CLAUDE.md — Eleições 2026

## Projeto
Painel público de eleições brasileiras 2026: pesquisas eleitorais agregadas + termômetro social.
- **Stack:** Astro 5 (SSG) + Preact islands + Supabase + Vercel
- **Repo:** https://github.com/felipeppertel-commits/ELECTION.git
- **Status:** Scaffold pronto, precisa reescrever o scraper de pesquisas e integrar fontes reais.

## Contexto crítico
O `scripts/fetch-polls.ts` original usava Wikipedia como fonte — isso é ERRADO e já foi descartado.
As fontes corretas, em ordem de prioridade:

### 1. Eleição em Dados — API pública gratuita (FONTE PRIMÁRIA)
- **Base URL:** `https://eleicaoemdados.com.br/api/v1`
- **Endpoints conhecidos:**
  - `GET /api/v1/polls` — lista de pesquisas (paginada)
  - `GET /api/v1/aggregates` — médias ponderadas já calculadas
  - `GET /api/v1/models` — modelos estatísticos
  - `GET /api/v1/ask` — endpoint de consulta
- **Dados disponíveis por pesquisa:** número TSE, instituto, data coleta, amostra, margem erro, escopo geográfico (Nacional/UF/Cidade), resultados por candidato
- **Metodologia deles:** média ponderada com recência (meia-vida 30 dias), √n da amostra, score de qualidade do instituto, house effects com shrinkage, Monte Carlo 10k simulações
- **43 pesquisas registradas para 2026 até março/2026**
- **Importante:** A API não tem documentação formal acessível (o link /docs retorna 404). É necessário fazer engenharia reversa dos endpoints testando chamadas. Comece com `fetch('https://eleicaoemdados.com.br/api/v1/polls')` e analise o JSON.

### 2. TSE Dados Abertos (FALLBACK / VALIDAÇÃO)
- **Portal:** https://dadosabertos.tse.jus.br/
- **Dataset:** `pesquisas-eleitorais-atual` — CSVs com todas as pesquisas registradas
- **Tem API CKAN** (padrão do portal): `https://dadosabertos.tse.jus.br/api/3/action/package_show?id=pesquisas-eleitorais-atual`
- **Dados:** registro TSE, instituto, UF, cargo, amostra, margem erro, metodologia
- **Limitação:** NÃO contém os resultados/percentuais por candidato — só metadados da pesquisa

### 3. TSE PesqEle (SCRAPING COMPLEMENTAR)
- **URL:** https://pesqele-divulgacao.tse.jus.br/app/pesquisa/listar.xhtml
- **É um app JSF** — precisa de Puppeteer/Playwright pra interagir (não é HTML estático)
- **Tem todos os dados** incluindo questionários, resultados e detalhamento por município
- **Referência de scraper existente:** https://github.com/conre3/pesqEle (R, mas lógica portável)

### 4. Gazeta do Povo (SCRAPING SECUNDÁRIO)
- **URL:** https://www.gazetadopovo.com.br/eleicoes/2026/pesquisa-eleitoral-2026/
- **Publica todas as pesquisas** dos principais institutos com dados estruturados
- **Tem dados de cenários, segundo turno, rejeição, etc.**

## Tarefas para Claude Code

### TAREFA 1: Reescrever `scripts/fetch-polls.ts` (PRIORIDADE MÁXIMA)
Substituir o scraper de Wikipedia por integração com as fontes reais.

**Estratégia de coleta (waterfall):**
1. Tentar Eleição em Dados API (`/api/v1/polls`) — se retornar dados, usar como fonte primária
2. Se API falhar ou retornar incompleto, fazer scraping do HTML de `eleicaoemdados.com.br/pesquisas` (já sabemos a estrutura da tabela — ver abaixo)
3. Complementar com TSE Dados Abertos via API CKAN para validação de registros

**Estrutura conhecida da tabela do Eleição em Dados (fallback HTML):**
```
| Data | Nº pesquisa | Pesquisa (instituto · escopo) | Amostra | Margem | Link detalhe |
```
Cada pesquisa tem uma página de detalhe em `eleicaoemdados.com.br/pesquisas/{id}` que contém os percentuais por candidato.

**O script deve:**
- Descobrir a estrutura da API testando endpoints (GET /api/v1/polls com e sem query params)
- Fazer log detalhado do que encontrou pra debug
- Fazer upsert no Supabase na tabela `polls` (schema já existe)
- Mapear candidatos por nome_urna (fuzzy match contra tabela `candidates`)
- Tratar paginação (43+ pesquisas, provavelmente paginada)
- Gravar fonte_url apontando pro registro original

### TAREFA 2: Criar `scripts/fetch-polls-detail.ts` (COMPLEMENTAR)
Para cada pesquisa que o fetch-polls encontrou SEM percentuais por candidato, buscar a página de detalhe.

### TAREFA 3: Atualizar `scripts/fetch-trends.ts`
O pacote `google-trends-api` pode ter breaking changes. Testar e ajustar se necessário.
A alternativa é usar `serpapi` (free tier: 100 searches/month) ou scraping direto do Google Trends.

### TAREFA 4: Atualizar seed de candidatos
O arquivo `scripts/seed-candidates.ts` precisa refletir os pré-candidatos reais de março/2026:
- **Presidente (cenários que aparecem nas pesquisas):**
  - Lula (PT), Flávio Bolsonaro (PL), Tarcísio de Freitas (Republicanos), Ciro Gomes (PDT), Simone Tebet (MDB), Ratinho Junior (PSD), Ronaldo Caiado (UNIÃO/PSD), Romeu Zema (NOVO), Fernando Haddad (PT), Pablo Marçal (PRTB), Michelle Bolsonaro (PL)
  - Jair Bolsonaro aparece em pesquisas mas é INELEGÍVEL até 2030
- **Governadores:** Adicionar conforme pesquisas estaduais aparecerem (já tem RS, BA, MT, AP, PE, RJ, SP)

### TAREFA 5: Melhorar o mapa SVG
Os paths em `src/data/brazil-states.ts` são simplificados demais. Substituir por:
- TopoJSON real do Brasil: `https://github.com/codeforamerica/click_that_hood/blob/master/public/data/brazil-states.geojson`
- Ou usar D3-geo com projeção adequada (geoMercator ou geoAlbers com configuração BR)
- Renderizar via `<path d={...}>` gerado pelo d3.geoPath()

### TAREFA 6: Revisar GitHub Actions
O workflow `.github/workflows/collect-data.yml` está ok estruturalmente, mas:
- Garantir que `npm run fetch:polls` usa o novo script (Tarefa 1)
- Adicionar retry com backoff em caso de falha de API
- Adicionar notificação (GitHub Issues ou webhook) quando coleta falha 3x seguidas

## Arquitetura de dados

### Schema Supabase (já criado em `supabase/schema.sql`)
- `candidates` — id, nome, nome_urna, cargo, uf, partido, cor_partido, ativo
- `polls` — candidate_id, instituto, data_pesquisa, percentual, amostra, tipo, turno, registro_tse, fonte_url
- `poll_averages` — candidate_id, data, media_simples, media_ponderada
- `social_buzz` — candidate_id, data, source, volume_raw, volume_normalized, sentiment_score
- `buzz_index` — candidate_id, data, volume_composto, sentimento_composto (breakdown por fonte)
- `collection_log` — auditoria de cada coleta

### Views prontas
- `v_presidente_latest` — ranking atual de presidente
- `v_governador_latest` — ranking por estado
- `v_buzz_latest` — buzz ranking
- `get_state_summary()` — função RPC pro mapa

## Regras de negócio
- Pesquisas dos últimos 30 dias entram na média
- Média ponderada: peso = qualidade_instituto × recência(meia-vida 15d) × √(amostra/1000)
- Buzz Index: Google Trends 30% + Google News 30% + Bluesky 20% + YouTube 20%
- Sentimento: análise lexical PT-BR via OpLexicon (src/lib/sentiment.ts)
- Site público, sem auth, sem monetização
- Deploy: Astro SSG no Vercel, rebuild via webhook após coleta

## Convenções
- TypeScript strict em tudo
- Imports com path aliases: `@/lib/...`, `@/components/...`
- Scripts de coleta usam `dotenv/config` + `process.env`
- Supabase: anon key pro frontend (read), service key pros scripts (write)
- Console.log com prefixo `[timestamp]` e emoji de status (✓, ⚠, ✗)

## Ordem de execução sugerida
1. Tarefa 1 (fetch-polls) — é o core do projeto
2. Tarefa 4 (seed candidates) — necessário pra Tarefa 1 funcionar
3. Testar coleta completa: `npm run seed:candidates && npm run collect:all`
4. Tarefa 5 (mapa SVG) — polish visual
5. Tarefa 3 e 6 — refinamentos
