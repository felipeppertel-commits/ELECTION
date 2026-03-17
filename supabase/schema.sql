-- =============================================================
-- Eleições 2026 — Supabase Schema
-- =============================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- =============================================================
-- 1. CANDIDATES
-- =============================================================
create table candidates (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  nome_urna text not null,
  cargo text not null check (cargo in ('presidente', 'governador', 'senador')),
  uf char(2), -- null for presidente
  partido text not null,
  foto_url text,
  cor_partido text, -- hex color for charts
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_candidates_cargo on candidates(cargo);
create index idx_candidates_uf on candidates(uf);
create index idx_candidates_ativo on candidates(ativo) where ativo = true;

-- =============================================================
-- 2. POLLS (pesquisas eleitorais)
-- =============================================================
create table polls (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid references candidates(id) on delete cascade,
  instituto text not null,
  data_pesquisa date not null,
  data_publicacao date not null,
  percentual numeric(5,2) not null,
  margem_erro numeric(4,2),
  amostra integer,
  tipo text not null check (tipo in ('estimulada', 'espontanea')),
  turno integer default 1 check (turno in (1, 2)),
  registro_tse text,
  fonte_url text,
  cargo text not null,
  uf char(2),
  created_at timestamptz default now()
);

create index idx_polls_candidate on polls(candidate_id);
create index idx_polls_data on polls(data_pesquisa desc);
create index idx_polls_cargo_uf on polls(cargo, uf);

-- Prevent duplicate poll entries
create unique index idx_polls_unique on polls(candidate_id, instituto, data_pesquisa, tipo, turno);

-- =============================================================
-- 3. POLL AVERAGES (médias calculadas)
-- =============================================================
create table poll_averages (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid references candidates(id) on delete cascade,
  data date not null,
  media_simples numeric(5,2),
  media_ponderada numeric(5,2),
  num_pesquisas integer default 0,
  cargo text not null,
  uf char(2),
  created_at timestamptz default now()
);

create index idx_averages_candidate on poll_averages(candidate_id);
create index idx_averages_data on poll_averages(data desc);
create unique index idx_averages_unique on poll_averages(candidate_id, data);

-- =============================================================
-- 4. SOCIAL BUZZ (dados de cada fonte social)
-- =============================================================
create table social_buzz (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid references candidates(id) on delete cascade,
  data date not null,
  hora time not null default '00:00:00',
  source text not null check (source in ('google_trends', 'bluesky', 'google_news', 'youtube')),
  volume_raw numeric(12,2) default 0,
  volume_normalized numeric(5,2) default 0, -- 0-100
  sentiment_score numeric(4,3) default 0, -- -1.0 to +1.0
  sentiment_positive integer default 0,
  sentiment_negative integer default 0,
  sentiment_neutral integer default 0,
  sample_size integer default 0, -- total items analyzed
  metadata jsonb default '{}', -- source-specific extra data
  created_at timestamptz default now()
);

create index idx_buzz_candidate on social_buzz(candidate_id);
create index idx_buzz_data on social_buzz(data desc);
create index idx_buzz_source on social_buzz(source);
create unique index idx_buzz_unique on social_buzz(candidate_id, data, hora, source);

-- =============================================================
-- 5. BUZZ INDEX (índice composto calculado)
-- =============================================================
create table buzz_index (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid references candidates(id) on delete cascade,
  data date not null,
  volume_composto numeric(5,2) default 0, -- 0-100
  sentimento_composto numeric(4,3) default 0, -- -1.0 to +1.0
  -- Breakdown by source
  trends_volume numeric(5,2) default 0,
  trends_sentiment numeric(4,3) default 0,
  bluesky_volume numeric(5,2) default 0,
  bluesky_sentiment numeric(4,3) default 0,
  news_volume numeric(5,2) default 0,
  news_sentiment numeric(4,3) default 0,
  youtube_volume numeric(5,2) default 0,
  youtube_sentiment numeric(4,3) default 0,
  cargo text not null,
  uf char(2),
  created_at timestamptz default now()
);

create index idx_buzzindex_candidate on buzz_index(candidate_id);
create index idx_buzzindex_data on buzz_index(data desc);
create unique index idx_buzzindex_unique on buzz_index(candidate_id, data);

-- =============================================================
-- 6. DATA COLLECTION LOG (auditoria de coletas)
-- =============================================================
create table collection_log (
  id uuid primary key default uuid_generate_v4(),
  source text not null,
  status text not null check (status in ('success', 'partial', 'error')),
  records_inserted integer default 0,
  records_updated integer default 0,
  error_message text,
  duration_ms integer,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_log_source on collection_log(source);
create index idx_log_created on collection_log(created_at desc);

-- =============================================================
-- 7. VIEWS (consultas prontas pro frontend)
-- =============================================================

-- Latest poll average per candidate (presidente)
create or replace view v_presidente_latest as
select
  c.id,
  c.nome,
  c.nome_urna,
  c.partido,
  c.foto_url,
  c.cor_partido,
  pa.media_simples,
  pa.media_ponderada,
  pa.num_pesquisas,
  pa.data as ultima_atualizacao
from candidates c
join lateral (
  select * from poll_averages
  where candidate_id = c.id
  order by data desc
  limit 1
) pa on true
where c.cargo = 'presidente' and c.ativo = true
order by pa.media_ponderada desc nulls last;

-- Latest poll average per candidate per state (governadores)
create or replace view v_governador_latest as
select
  c.id,
  c.nome,
  c.nome_urna,
  c.partido,
  c.uf,
  c.foto_url,
  c.cor_partido,
  pa.media_simples,
  pa.media_ponderada,
  pa.num_pesquisas,
  pa.data as ultima_atualizacao
from candidates c
join lateral (
  select * from poll_averages
  where candidate_id = c.id
  order by data desc
  limit 1
) pa on true
where c.cargo = 'governador' and c.ativo = true
order by c.uf, pa.media_ponderada desc nulls last;

-- Latest buzz index per candidate
create or replace view v_buzz_latest as
select
  c.id,
  c.nome,
  c.nome_urna,
  c.cargo,
  c.uf,
  c.partido,
  bi.volume_composto,
  bi.sentimento_composto,
  bi.trends_volume,
  bi.bluesky_volume,
  bi.news_volume,
  bi.youtube_volume,
  bi.data as ultima_atualizacao
from candidates c
join lateral (
  select * from buzz_index
  where candidate_id = c.id
  order by data desc
  limit 1
) bi on true
where c.ativo = true
order by bi.volume_composto desc nulls last;

-- =============================================================
-- 8. RLS (Row Level Security) — public read
-- =============================================================
alter table candidates enable row level security;
alter table polls enable row level security;
alter table poll_averages enable row level security;
alter table social_buzz enable row level security;
alter table buzz_index enable row level security;
alter table collection_log enable row level security;

-- Public read access (site is open)
create policy "Public read candidates" on candidates for select using (true);
create policy "Public read polls" on polls for select using (true);
create policy "Public read averages" on poll_averages for select using (true);
create policy "Public read buzz" on social_buzz for select using (true);
create policy "Public read buzz_index" on buzz_index for select using (true);

-- Service role write (GitHub Actions uses service key)
create policy "Service write candidates" on candidates for all using (true) with check (true);
create policy "Service write polls" on polls for all using (true) with check (true);
create policy "Service write averages" on poll_averages for all using (true) with check (true);
create policy "Service write buzz" on social_buzz for all using (true) with check (true);
create policy "Service write buzz_index" on buzz_index for all using (true) with check (true);
create policy "Service write log" on collection_log for all using (true) with check (true);

-- =============================================================
-- 9. FUNCTIONS
-- =============================================================

-- Get poll history for a candidate (for charts)
create or replace function get_poll_history(
  p_candidate_id uuid,
  p_days integer default 90
)
returns table (
  data date,
  media_simples numeric,
  media_ponderada numeric
) language sql stable as $$
  select data, media_simples, media_ponderada
  from poll_averages
  where candidate_id = p_candidate_id
    and data >= current_date - p_days
  order by data asc;
$$;

-- Get buzz history for a candidate
create or replace function get_buzz_history(
  p_candidate_id uuid,
  p_days integer default 30
)
returns table (
  data date,
  volume_composto numeric,
  sentimento_composto numeric
) language sql stable as $$
  select data, volume_composto, sentimento_composto
  from buzz_index
  where candidate_id = p_candidate_id
    and data >= current_date - p_days
  order by data asc;
$$;

-- Get state summary (leader + buzz for map coloring)
create or replace function get_state_summary()
returns table (
  uf char(2),
  lider_nome text,
  lider_partido text,
  lider_cor text,
  lider_percentual numeric,
  buzz_volume numeric,
  buzz_sentimento numeric
) language sql stable as $$
  select distinct on (c.uf)
    c.uf,
    c.nome_urna as lider_nome,
    c.partido as lider_partido,
    c.cor_partido as lider_cor,
    pa.media_ponderada as lider_percentual,
    bi.volume_composto as buzz_volume,
    bi.sentimento_composto as buzz_sentimento
  from candidates c
  left join lateral (
    select * from poll_averages where candidate_id = c.id order by data desc limit 1
  ) pa on true
  left join lateral (
    select * from buzz_index where candidate_id = c.id order by data desc limit 1
  ) bi on true
  where c.cargo = 'governador' and c.ativo = true
  order by c.uf, pa.media_ponderada desc nulls last;
$$;
