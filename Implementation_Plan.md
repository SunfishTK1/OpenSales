# VentureHacks — 4-Hour Hackathon Implementation Plan

**Team:** Thomas Kanz · Dhiren Narne · William Montague · Hana Benko
**Product:** Commission-based AI Sales Team w/ Shopify Integration
**Backend:** Supabase · **Time:** 4 hours

---

## Repo Structure (Zero Merge Conflicts)

```
venturehacks/
├── ui/          ← Person 1: Frontend dashboard (Next.js or React + Vite)
├── ai-core/     ← Person 2: AI onboarding + agent logic
├── comms/       ← Person 3: Email/SMS outreach engine
├── tools/       ← Person 4: Mini CRM + calendar + tool calls
└── supabase/    ← Shared: schema migration (set up together in first 15 min)
```

---

## Minute 0–15: Everyone Together

- [ ] Create Supabase project
- [ ] Run this schema together:

```sql
-- prospects (Person 4 owns, everyone reads)
create table prospects (
  id uuid primary key default gen_random_uuid(),
  name text, email text, company text, industry text,
  stage text default 'prospect', -- prospect | outreach | meeting | negotiation | closed
  score int default 0,
  status text default 'active',
  notes text,
  created_at timestamptz default now()
);

-- communications (Person 3 owns)
create table communications (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id),
  channel text, -- email | sms | call
  direction text, -- inbound | outbound
  content text,
  subject text,
  status text default 'sent',
  created_at timestamptz default now()
);

-- agent_runs (Person 2 owns)
create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id),
  action text, -- email_draft | research | score | stage_change
  reasoning text,
  result jsonb,
  created_at timestamptz default now()
);

-- tasks (Person 4 owns)
create table tasks (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id),
  type text, -- email | call | follow_up | demo
  payload jsonb,
  status text default 'pending', -- pending | approved | done
  scheduled_for timestamptz,
  created_at timestamptz default now()
);

-- shop config (Person 2 owns)
create table shop_config (
  id uuid primary key default gen_random_uuid(),
  shop_name text,
  niche text,
  target_market text,
  goal text,
  commission_rate numeric,
  tone text,
  products jsonb,
  created_at timestamptz default now()
);
```

- [ ] Share Supabase URL + anon key in group chat
- [ ] Everyone scaffolds their folder and confirms they can read/write to Supabase
- [ ] Split up and go

---

## Person 1 — UI Dashboard (`ui/`)

**Stack:** React + Vite + Tailwind + Supabase JS client
**Goal:** A slick dashboard that shows the AI sales team in action. This is what the judges SEE.

### Hour 1 (0:15–1:15)
- [ ] Scaffold React + Vite + Tailwind, connect Supabase client
- [ ] Build layout shell: sidebar + main content
- [ ] **Dashboard home** — 4 stat cards pulling from Supabase:
  - Total prospects
  - Emails sent (count from `communications`)
  - Meetings scheduled (count from `tasks` where type=call/demo)
  - Pipeline value / active deals

### Hour 2 (1:15–2:15)
- [ ] **Prospect table** — list from `prospects` table
  - Columns: name, company, stage (color-coded badge), score, last contact
  - Click row → expandable detail or side panel
- [ ] **Agent activity feed** — live feed from `agent_runs`
  - Use Supabase Realtime subscription so it updates live during demo
  - Show: "🤖 Researched Acme Corp — Score: 85", "📧 Drafted cold email to John"

### Hour 3 (2:15–3:15)
- [ ] **Prospect detail panel** — when you click a prospect:
  - Communication timeline (from `communications`)
  - Stage progress bar
  - Agent reasoning log
  - **Approve/Reject buttons** for pending tasks (the human-in-the-loop moment)
- [ ] **Pipeline Kanban** (if time) — columns for each stage, cards are prospects

### Hour 4 (3:15–4:00)
- [ ] Make it demo-ready: loading states, empty states, nice typography
- [ ] Add the onboarding wizard UI shell (renders Person 2's chat flow in a modal)
- [ ] Seed 5–10 fake prospects with realistic data so dashboard looks alive
- [ ] Screen-record backup in case live demo breaks

---

## Person 2 — AI Integration & Onboarding (`ai-core/`)

**Stack:** Node.js (or Python) + OpenAI/Anthropic API + Supabase
**Goal:** The AI brain — onboarding interrogation and the autonomous agent loop.

### Hour 1 (0:15–1:15)
- [ ] **AI Onboarding Chat** — build a simple endpoint/script:
  - Takes conversational input from merchant
  - Uses LLM to extract: niche, target market, goal, tone, products
  - Stores structured result in `shop_config`
  - Can be a CLI flow or a simple API endpoint the UI calls
- [ ] Test with: "I sell sustainable activewear to women 25-40 who are into fitness. I want 100 sales/month."

### Hour 2 (1:15–2:15)
- [ ] **Agent decision engine** — core function:
  ```
  Input: prospect record + comms history + shop_config
  Output: { action: "send_email" | "schedule_call" | "follow_up" | "mark_cold", reasoning: "..." }
  ```
  - LLM call with system prompt incorporating shop niche/tone
  - Log every decision to `agent_runs`
- [ ] **Email draft generation**
  - Given prospect + shop context → generate personalized cold email
  - Store draft in `tasks` with `type: email`, `payload: { subject, body }`

### Hour 3 (2:15–3:15)
- [ ] **Prospect research agent**
  - Given company name → use LLM (with web search if available) to summarize:
    company info, relevance to merchant's niche, decision maker guess
  - Update `prospects.notes` with research summary
  - Update `prospects.score` (0–100)
- [ ] **Batch runner** — script that loops through all prospects and runs the agent:
  - Research → Score → Decide action → Create task
  - This is the "wow" moment in the demo: kick it off and watch the feed update live

### Hour 4 (3:15–4:00)
- [ ] Wire onboarding flow to UI (coordinate with Person 1)
- [ ] Run the full loop on seed data: research → score → email draft → log
- [ ] Make sure `agent_runs` are populating with clear, readable reasoning
- [ ] Prepare 2-min demo script: "Watch the AI analyze these prospects in real time"

---

## Person 3 — Multi-Channel Comms (`comms/`)

**Stack:** Node.js + Resend/SendGrid (email) + Twilio (SMS) + Supabase
**Goal:** Actually send emails and texts. Log everything to `communications`.

### Hour 1 (0:15–1:15)
- [ ] Set up Resend or SendGrid account (Resend is faster to set up, free tier works)
- [ ] **Send email function:**
  ```
  sendEmail(prospect_id, subject, body) →
    send via API → log to communications table → return status
  ```
- [ ] Test: send a real email to your own inbox
- [ ] **Email template system** — simple string interpolation:
  - `{{name}}`, `{{company}}`, `{{product}}`, `{{sender_name}}`

### Hour 2 (1:15–2:15)
- [ ] **Task listener** — poll or subscribe to `tasks` table:
  - When new task appears with `status: 'approved'` (or `'pending'` in auto mode):
    - If `type: email` → extract payload → sendEmail()
    - If `type: sms` → sendSMS()
  - Update task status to `done` after sending
- [ ] **SMS channel** (if Twilio is set up):
  - `sendSMS(prospect_id, message)` → send via Twilio → log to `communications`
  - If Twilio is too slow to set up, mock it and focus on email

### Hour 3 (2:15–3:15)
- [ ] **Inbound email webhook** (stretch goal):
  - Resend/SendGrid inbound parse webhook
  - When prospect replies → log to `communications` with `direction: 'inbound'`
  - If too complex, manually insert a fake reply to show the flow
- [ ] **Sequence engine** (simplified):
  - Function: given a prospect, create a 3-touch sequence:
    - Day 0: cold email → Day 2: follow-up → Day 4: SMS nudge
  - Insert all 3 as `tasks` with staggered `scheduled_for` timestamps
  - For demo purposes, set times minutes apart instead of days

### Hour 4 (3:15–4:00)
- [ ] Make sure email sending is reliable for live demo
- [ ] Add send confirmation logging that shows up in Person 1's UI
- [ ] Coordinate with Person 2: agent creates task → your system sends it
- [ ] Prepare: have a test inbox open during demo to show real emails arriving

---

## Person 4 — Tool Calls / Mini CRM (`tools/`)

**Stack:** Node.js + Supabase + Google Calendar API (or Cal.com)
**Goal:** The CRM backbone and tool-call interface the AI agent uses.

### Hour 1 (0:15–1:15)
- [ ] **Prospect CRUD functions** (Supabase Edge Functions or simple Express API):
  - `createProspect(name, email, company, industry)`
  - `updateProspectStage(prospect_id, new_stage)` — also logs to `agent_runs`
  - `getProspectSummary(prospect_id)` — returns prospect + recent comms + current stage
  - `listProspects(filters)` — by stage, score, status
- [ ] **Seed data script** — insert 10–15 realistic prospects:
  - Mix of stages, some with comms history, varied scores
  - Use real-ish company names relevant to the demo niche

### Hour 2 (1:15–2:15)
- [ ] **Calendar scheduling**
  - If time: Google Calendar OAuth + create event function
  - **Faster alternative:** Cal.com booking link integration or just write to `tasks` table with meeting details and show it in UI
  - `scheduleMeeting(prospect_id, datetime, type, notes)`
  - Creates row in `tasks` with `type: 'demo'` or `'call'`
- [ ] **Task management functions**
  - `createTask(prospect_id, type, channel, payload, scheduled_for)`
  - `approveTask(task_id)` → sets status to approved, triggers Person 3's sender
  - `getTaskQueue(status)` → list pending/approved/done

### Hour 3 (2:15–3:15)
- [ ] **Tool call interface** — format functions as OpenAI-compatible tool definitions:
  ```json
  [
    {"name": "schedule_meeting", "description": "Book a meeting with a prospect",
     "parameters": {"prospect_id": "string", "datetime": "string", "type": "demo|call"}},
    {"name": "update_stage", "description": "Move prospect to new funnel stage",
     "parameters": {"prospect_id": "string", "stage": "string"}},
    {"name": "create_outreach_task", "description": "Queue an email or SMS",
     "parameters": {"prospect_id": "string", "channel": "email|sms", "content": "string"}},
    {"name": "get_prospect_summary", "description": "Get full context on a prospect",
     "parameters": {"prospect_id": "string"}}
  ]
  ```
  - Wire these so Person 2's agent can actually call them
- [ ] **Pipeline analytics RPC**
  - `getPipelineSummary()` → count per stage, avg score, conversion rate
  - Person 1's UI calls this for the dashboard cards

### Hour 4 (3:15–4:00)
- [ ] Run seed data script, verify everything shows up in Person 1's UI
- [ ] Test full flow: Person 2's agent calls your tools → data updates → UI reflects it
- [ ] Make sure the demo funnel works: prospect → outreach → meeting → negotiation → close
- [ ] Have a "fast-forward" script that simulates a full prospect journey in 30 seconds for the demo

---

## Demo Script (Last 15 min — practice this)

1. **"Meet our AI sales team"** — Show the dashboard, explain the concept
2. **Onboard a shop** — Run Person 2's interrogation: "I sell handmade candles to millennials"
3. **AI goes to work** — Kick off the batch agent. Judges watch the live feed update:
   - "Researching Acme Corp..."
   - "Score: 82 — great fit for artisan products"
   - "Drafting personalized email..."
4. **Show the email** — Click a prospect, show the AI-drafted email. Hit approve.
5. **Email actually sends** — Show it arriving in a real inbox on your phone
6. **Pipeline view** — Show prospects at different stages, explain the full funnel
7. **Commission model** — "We take X% of sales closed by our AI agents"

---

## Critical Path (If Something Breaks)

| Priority | What | Why |
|---|---|---|
| 🔴 P0 | Supabase schema + seed data | Everything depends on this |
| 🔴 P0 | UI dashboard with live feed | Judges need to see something |
| 🔴 P0 | AI agent generating emails + reasoning | This is the core product |
| 🟡 P1 | Actually sending emails | Wow factor, but can fake it |
| 🟡 P1 | Calendar scheduling | Can show as task in UI instead |
| 🟢 P2 | SMS channel | Nice to have, skip if behind |
| 🟢 P2 | Inbound reply handling | Mock it for demo |
| 🟢 P2 | Kanban board | Dashboard table is enough |

**If you're behind at hour 2:** Cut SMS, cut inbound, cut kanban. Focus on: dashboard + AI agent loop + one real email send. That's enough to win.
