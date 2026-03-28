-- ─── prospects ────────────────────────────────────────────────────────────────
create table if not exists prospects (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text,
  phone           text,
  company         text,
  industry        text,
  title           text,
  stage           text not null default 'research'
                    check (stage in ('research','outreach','responded','discovery_call','high_intent','demo','negotiation','pilot','closed')),
  score           int check (score between 0 and 100),
  intent_score    int check (intent_score between 0 and 100),
  status          text not null default 'active'
                    check (status in ('active','rejected','cold')),
  rejection_reason text,
  source          text,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ─── communications ───────────────────────────────────────────────────────────
create table if not exists communications (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  channel     text not null check (channel in ('email','call')),
  direction   text not null check (direction in ('inbound','outbound')),
  content     text,
  subject     text,
  status      text not null default 'sent'
                check (status in ('sent','delivered','opened','replied','bounced','rejected')),
  created_at  timestamptz not null default now()
);

-- ─── agent_runs ───────────────────────────────────────────────────────────────
create table if not exists agent_runs (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  action      text not null,
  reasoning   text,
  result      jsonb,
  created_at  timestamptz not null default now()
);

-- ─── tasks ────────────────────────────────────────────────────────────────────
create table if not exists tasks (
  id             uuid primary key default gen_random_uuid(),
  prospect_id    uuid references prospects(id) on delete cascade,
  type           text not null
                   check (type in ('email','call','follow_up','discovery_call','demo','negotiation_meeting','pilot_review')),
  payload        jsonb,
  status         text not null default 'pending'
                   check (status in ('pending','approved','rejected','done')),
  scheduled_for  timestamptz,
  created_at     timestamptz not null default now()
);

-- ─── company_config ───────────────────────────────────────────────────────────
create table if not exists company_config (
  id                       uuid primary key default gen_random_uuid(),

  -- Identity
  company_name             text not null,
  product_name             text,
  rep_name                 text,
  rep_title                text,
  inbound_channel          text,

  -- Product
  value_proposition        text,
  key_features             jsonb default '[]',
  tiers                    jsonb default '[]',
  do_not_mention           jsonb default '[]',

  -- Qualification
  qualification_questions  jsonb default '[]',
  qualification_thresholds jsonb default '{}',
  fallback_path            text,

  -- Transfer routing
  transfer_closer_role     text,
  transfer_closer_phone    text,
  transfer_technical_role  text,
  transfer_technical_phone text,

  -- Objection handling
  objection_handling       jsonb default '[]',

  -- Follow-up
  reengagement_email       text,
  collateral               jsonb default '[]',
  follow_up_timeline       text,
  crm_tags                 jsonb default '{}',

  -- Dynamic variables
  dynamic_variables        jsonb default '[]',

  -- Full raw config as extracted by the agent
  raw_config               jsonb,

  created_at               timestamptz not null default now()
);
