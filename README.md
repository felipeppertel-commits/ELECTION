# 🗳️ Eleições 2026

Painel de eleições brasileiras com pesquisas eleitorais agregadas + termômetro social em tempo real.

**100% gratuito** — sem APIs pagas, sem auth, hospedado no Vercel.

## Stack

- **Frontend:** Astro 5 (SSG) + Preact islands
- **Data:** Supabase (PostgreSQL free tier)
- **Coleta:** GitHub Actions (cron a cada 6h)
- **Deploy:** Vercel (static, rebuild via webhook)

## Fontes de dados

| Fonte | O que coleta | Custo | Frequência |
|-------|-------------|-------|------------|
| Google Trends | Volume de busca por candidato/estado | Grátis | 6h |
| Bluesky | Posts públicos + sentiment | Grátis (AT Protocol) | 6h |
| Google News RSS | Headlines + sentiment | Grátis | 6h |
| YouTube Data API | Vídeos + engagement | Grátis (10k/dia) | 6h |
| Wikipedia | Tabelas de pesquisas eleitorais | Grátis (scraping) | 6h |

## Setup

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em SQL Editor e execute o conteúdo de `supabase/schema.sql`
3. Copie as keys (Settings > API): URL, anon key, service role key

### 2. Variáveis de ambiente

```bash
cp .env.example .env
# Preencha com suas keys do Supabase
```

### 3. Instalar e rodar local

```bash
npm install
npm run seed:candidates   # Popula candidatos iniciais
npm run collect:all       # Roda todos os coletores
npm run dev               # Astro dev server em localhost:4321
```

### 4. Deploy no Vercel

1. Push pro GitHub (repo **público** — necessário para GitHub Actions gratuito)
2. Conecte o repo no [vercel.com](https://vercel.com)
3. Adicione as variáveis de ambiente no Vercel dashboard
4. Crie um Deploy Hook (Settings > Git > Deploy Hooks) e adicione como `VERCEL_DEPLOY_HOOK`

### 5. GitHub Actions

Adicione os secrets no repo (Settings > Secrets > Actions):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `YOUTUBE_API_KEY`
- `VERCEL_DEPLOY_HOOK`

O workflow `.github/workflows/collect-data.yml` roda automaticamente a cada 6h.

## Estrutura

```
eleicoes-2026/
├── .github/workflows/     # GitHub Actions (coleta automatizada)
├── scripts/               # Scrapers e agregadores
│   ├── seed-candidates.ts
│   ├── fetch-trends.ts
│   ├── fetch-bluesky.ts
│   ├── fetch-news.ts
│   ├── fetch-polls.ts
│   └── compute-averages.ts
├── src/
│   ├── components/        # Preact islands
│   │   ├── BrazilMap.tsx
│   │   ├── CandidateRanking.tsx
│   │   └── BuzzThermometer.tsx
│   ├── data/
│   │   └── brazil-states.ts
│   ├── layouts/
│   │   └── Layout.astro
│   ├── lib/
│   │   ├── data.ts        # Supabase queries
│   │   ├── poll-average.ts
│   │   ├── sentiment.ts
│   │   ├── supabase.ts
│   │   └── types.ts
│   └── pages/
│       ├── index.astro
│       └── estado/[uf].astro
├── supabase/
│   └── schema.sql
└── public/
    └── favicon.svg
```

## Metodologia

### Média de pesquisas

- **Simples:** Média aritmética de todas as pesquisas dos últimos 30 dias
- **Ponderada:** Peso = qualidade_instituto × recência × √(amostra/1000)
  - Recência: decay exponencial com meia-vida de 15 dias
  - Instituto: rating 0-1 baseado em histórico de acerto

### Termômetro social (Buzz Index)

- **Volume composto:** Google Trends (30%) + Google News (30%) + Bluesky (20%) + YouTube (20%)
- **Sentimento:** Análise lexical PT-BR baseada em OpLexicon (~30k palavras)
- Cada fonte normalizada 0-100 relativa ao candidato com maior volume

## Licença

MIT — Projeto sem vínculo partidário. Use como quiser.
