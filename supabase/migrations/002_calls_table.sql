-- ─── calls (Retell AI call records + transcripts) ─────────────────────────────
create table if not exists calls (
  id                    uuid primary key default gen_random_uuid(),
  call_id               text unique not null,   -- Retell call ID
  agent_id              text,
  agent_name            text,
  call_status           text,                    -- registered, ongoing, ended, error
  call_type             text,                    -- web_call, phone_call
  direction             text,                    -- inbound, outbound
  from_number           text,
  to_number             text,
  duration_ms           int,
  transcript            text,                    -- full conversation text
  transcript_object     jsonb,                   -- utterances with timestamps
  recording_url         text,
  call_analysis         jsonb,                   -- post-call summary, sentiment, success
  disconnection_reason  text,
  customer_name         text,
  customer_email        text,
  prospect_company      text,
  lead_source           text,
  metadata              jsonb default '{}',
  collected_variables   jsonb default '{}',      -- variables extracted during call
  call_cost             jsonb,
  start_timestamp       bigint,
  end_timestamp         bigint,
  created_at            timestamptz not null default now()
);

-- Index for listing calls by agent and recency
create index if not exists idx_calls_agent_id on calls(agent_id);
create index if not exists idx_calls_created_at on calls(created_at desc);
