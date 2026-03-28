# OpenSales — 4-Hour Hackathon Implementation Plan

**Team:** Thomas Kanz · Dhiren Narne · William Montague · Hana Benko
**Product:** Commission-based AI B2B Sales Team
**Backend:** Supabase · **Time:** 4 hours

---

## What We Start With

- An existing **customer list** (company names, contacts, emails)
- Prior **communication history** with these contacts that needs to be tracked

## The Funnel

```
Research companies → Get contacts → Automated email from list
→ Track hits / rejections → They respond with a time
→ Schedule discovery call (prospect talks to AI agent about their problem)
→ If intent is high: callback + spin up personalized demo for their workflow
→ Meeting with proposed negotiation → Check demo against real project → Close
```

## Pipeline Stages

```
research → outreach → responded → discovery_call → high_intent → demo → negotiation → pilot → closed
```

---

## Task Breakdown

| Area | What | Who |
|---|---|---|
| **AI Interrogation** | Onboarding chat that learns about the B2B company, extracts config | Person 2 |
| **AI Agent Tools** | Scheduler agent, middle-man agent, decision engine | Person 2 |
| **Backend System** | CRM functions the agents call: schedule calendar, update prospects, log comms in/out. Must be very organized | Person 3 + 4 |
| **UI** | Dashboard showing all data from the system, schedules, communication logs. Human verifier element (approve/reject) | Person 1 |
| **Comms Engine** | Email sending, tracking hits/rejections, logging all communication | Person 3 |

---

## Repo Structure

```
OpenSales/
├── ui/          ← Person 1: Frontend dashboard (William)
├── ai-core/     ← Person 2: AI interrogation + agent logic (Dhiren)
├── comms/       ← Person 3: Email engine + communication tracking (Thomas)
├── tools/       ← Person 4: CRM backend + calendar + tool calls (Hana)
└── supabase/    ← Shared: schema migration (set up together in first 15 min)
```

---

## Minute 0–15: Everyone Together

- [x] Create Supabase project
- [x] Run this schema together:

```sql
-- prospects / customer list (Person 4 owns, everyone reads)
create table prospects (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  company text,
  industry text,
  title text,                    -- job title / role
  stage text default 'research', -- research | outreach | responded | discovery_call | high_intent | demo | negotiation | pilot | closed
  score int default 0,           -- fit score from research
  intent_score int default 0,    -- set after discovery call, drives callback decision
  status text default 'active',  -- active | rejected | cold
  rejection_reason text,
  source text,                   -- imported | manual | referral
  notes text,
  created_at timestamptz default now()
);

-- communications log (Person 3 owns) — tracks ALL comms in and out, must be very organized
create table communications (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id),
  channel text,    -- email | call
  direction text,  -- inbound | outbound
  content text,
  subject text,
  status text default 'sent', -- sent | delivered | opened | replied | bounced | rejected
  created_at timestamptz default now()
);

-- agent activity log (Person 2 owns) — every AI decision gets logged here
create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id),
  action text,     -- email_draft | research | score | stage_change | schedule_call | intent_score | spin_demo
  reasoning text,  -- AI explains why it made this decision
  result jsonb,
  created_at timestamptz default now()
);

-- task queue (Person 4 owns) — things the AI wants to do, human can approve/reject
create table tasks (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id),
  type text,       -- email | call | follow_up | discovery_call | demo | negotiation_meeting | pilot_review
  payload jsonb,
  status text default 'pending', -- pending | approved | rejected | done
  scheduled_for timestamptz,
  created_at timestamptz default now()
);

-- company config (Person 2 owns) — extracted from AI interrogation
create table company_config (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  industry text,
  target_market text,
  value_proposition text,
  goal text,
  commission_rate numeric,
  tone text,
  services jsonb,
  created_at timestamptz default now()
);
```

- [x] Share Supabase URL + anon key in group chat
- [ ] Everyone scaffolds their folder and confirms they can read/write to Supabase
- [ ] Import initial customer list into `prospects` table
- [ ] Split up and go

---

## Person 1 — UI Dashboard (`ui/`)

**Stack:** React + Vite + Tailwind + Supabase JS client
**Goal:** Show all data from the system. Human verifier element. This is what the judges SEE.

### Hour 1 (0:15–1:15)
- [x] Scaffold React + Vite + Tailwind, connect Supabase client
- [x] Build layout shell: sidebar + main content
- [x] **Dashboard home** — stat cards pulling from Supabase:
  - Total prospects in pipeline
  - Emails sent / opened / replied (hit rate)
  - Rejections count
  - Discovery calls scheduled
  - High-intent prospects
  - Deals in negotiation / closed

### Hour 2 (1:15–2:15)
- [x] **Prospect table** — list from `prospects` table
  - Columns: name, company, stage (color-coded badge), score, intent score, last contact
  - Click row → detail panel
- [x] **Agent activity feed** — live feed from `agent_runs`
  - Supabase Realtime subscription so it updates live during demo
  - Show: "Researched Acme Corp — Score: 85", "Drafted cold email to John"

### Hour 3 (2:15–3:15)
- [x] **Prospect detail panel** — when you click a prospect:
  - Full communication timeline (inbound + outbound from `communications`)
  - Stage progress bar across all 9 stages
  - Agent reasoning log (from `agent_runs`)
  - **Approve/Reject buttons** for pending tasks (the human-in-the-loop verifier)
  - Schedule view for upcoming calls/meetings
- [ ] **Pipeline Kanban** (if time) — columns for each stage, cards are prospects

### Hour 4 (3:15–4:00)
- [x] Make it demo-ready: loading states, empty states, nice typography
- [x] Add the onboarding wizard UI (renders Person 2's AI interrogation in a modal)
- [x] Verify all data flows show up correctly
- [ ] Screen-record backup in case live demo breaks

---

## Person 2 — AI Interrogation + Agent Logic (`ai-core/`)

**Stack:** Node.js (or Python) + OpenAI/Anthropic API + Supabase
**Goal:** The AI brain — onboarding interrogation, decision engine, and the autonomous agent loop.

### Hour 1 (0:15–1:15)
- [ ] **AI Interrogation / Onboarding Chat:**
  - Conversational flow that learns about the B2B company
  - LLM extracts: industry, target market, value proposition, goal, tone, services
  - Stores structured result in `company_config`
  - Can be a CLI flow or API endpoint the UI calls
- [ ] Test with: "We're a SaaS company selling workforce analytics to mid-market HR teams. We want 20 enterprise demos/month."

### Hour 2 (1:15–2:15)
- [ ] **Agent decision engine** — the core AI brain:
  ```
  Input: prospect record + comms history + company_config
  Output: { action, reasoning }
  ```
  Actions by stage:
  - `research` → research company, score fit → draft cold email → move to `outreach`
  - `outreach` → track hits/rejections, wait for reply
  - `responded` → schedule discovery call → move to `discovery_call`
  - `discovery_call` → score intent after call → if high, move to `high_intent`
  - `high_intent` → callback + spin up personalized demo → move to `demo`
  - `demo` → propose negotiation meeting → move to `negotiation`
  - `negotiation` → move to `pilot` for real-project validation
  - `pilot` → close the deal
  - Log every decision to `agent_runs`
- [ ] **Email draft generation**
  - Prospect + company context → personalized cold email
  - Store draft in `tasks` with `type: email`, `payload: { subject, body }`

### Hour 3 (2:15–3:15)
- [ ] **Prospect research agent**
  - Given company name → LLM summarizes: company info, relevance, decision maker guess
  - Updates `prospects.notes` with research summary
  - Updates `prospects.score` (0–100)
- [ ] **Intent scoring** — after discovery call:
  - AI analyzes call notes to score buying intent (0–100)
  - High intent (70+) → auto-create callback task + generate personalized demo plan
  - Low intent → mark cold or schedule nurture follow-up
- [ ] **Batch runner** — loops through all prospects and runs the agent:
  - Research → Score → Decide action → Create task
  - This is the "wow" moment: kick it off and watch the feed update live

### Hour 4 (3:15–4:00)
- [ ] Wire interrogation flow to UI (coordinate with Person 1)
- [ ] Run the full loop on customer list: research → score → email draft → log
- [ ] Make sure `agent_runs` are populating with clear, readable reasoning
- [ ] Prepare demo: "Watch the AI analyze these prospects in real time"

---

## Person 3 — Email Engine + Communication Tracking (`comms/`)

**Stack:** Node.js + Resend/SendGrid (email) + Supabase
**Goal:** Send emails, track all communication in/out. Keep the `communications` table organized and complete.

### Hour 1 (0:15–1:15)
- [ ] Set up Resend or SendGrid (Resend is faster, free tier works)
- [ ] **Send email function:**
  ```
  sendEmail(prospect_id, subject, body) →
    send via API → log to communications table → return status
  ```
- [ ] Test: send a real email to your own inbox
- [ ] **Email template system** — simple string interpolation:
  - `{{name}}`, `{{company}}`, `{{service}}`, `{{sender_name}}`

### Hour 2 (1:15–2:15)
- [ ] **Task listener** — poll or subscribe to `tasks` table:
  - When task appears with `status: 'approved'` (or `'pending'` in auto mode):
    - `type: email` → extract payload → sendEmail()
  - Update task status to `done` after sending
- [ ] **Communication logger** — ensure ALL inbound + outbound comms are logged:
  - Every sent email → `communications` row with `direction: 'outbound'`
  - Every reply detected → `communications` row with `direction: 'inbound'`
  - Track status: sent → delivered → opened → replied OR bounced/rejected

### Hour 3 (2:15–3:15)
- [ ] **Inbound reply handling:**
  - Resend/SendGrid inbound parse webhook
  - When prospect replies → log to `communications` with `direction: 'inbound'`
  - If reply contains a time → update prospect stage to `responded`, trigger scheduling
  - If too complex to automate, manually insert reply to show the flow
- [ ] **Outreach sequence engine:**
  - Given a prospect, create a multi-touch email sequence:
    - Day 0: cold email → Day 2: follow-up → Day 4: final nudge
  - Track opens/replies to determine hit vs rejection
  - No reply after full sequence = mark prospect as rejected with reason
  - Reply with time = move to `responded`, trigger discovery call scheduling
  - For demo: set times minutes apart instead of days

### Hour 4 (3:15–4:00)
- [ ] Make sure email sending is reliable for live demo
- [ ] Verify all communications are logging correctly and showing in Person 1's UI
- [ ] Coordinate with Person 2: agent creates task → your system sends it → logs it
- [ ] Have a test inbox open during demo to show real emails arriving

---

## Person 4 — CRM Backend + Calendar + Tool Calls (`tools/`)

**Stack:** Node.js + Supabase + Google Calendar API (or Cal.com)
**Goal:** The system that AI agents interact with. Schedule calls, update prospects, manage the pipeline. Must be very organized.

### Hour 1 (0:15–1:15)
- [ ] **Prospect CRUD functions:**
  - `createProspect(name, email, company, industry)` — or bulk import from customer list
  - `updateProspectStage(prospect_id, new_stage)` — logs to `agent_runs`
  - `getProspectSummary(prospect_id)` — returns prospect + recent comms + current stage
  - `listProspects(filters)` — by stage, score, status
- [ ] **Customer list import script** — bulk insert existing customer list into `prospects`
  - Map existing data to prospect fields
  - Import any prior communication history into `communications`

### Hour 2 (1:15–2:15)
- [ ] **Calendar / scheduling system:**
  - If time: Google Calendar OAuth + create event
  - **Faster:** Cal.com booking link or write to `tasks` table with meeting details
  - `scheduleDiscoveryCall(prospect_id, datetime)` — for when prospect responds with a time
  - `scheduleMeeting(prospect_id, datetime, type, notes)` — for demos, negotiations, pilot reviews
  - Creates rows in `tasks` with appropriate type
- [ ] **Task management functions:**
  - `createTask(prospect_id, type, payload, scheduled_for)`
  - `approveTask(task_id)` → sets status to approved, triggers comms engine
  - `rejectTask(task_id)` → sets status to rejected
  - `getTaskQueue(status)` → list pending/approved/rejected/done

### Hour 3 (2:15–3:15)
- [ ] **Tool call interface** — functions the AI agent calls directly:
  ```json
  [
    {"name": "schedule_discovery_call", "description": "Book a discovery call when prospect responds with a time",
     "parameters": {"prospect_id": "string", "datetime": "string"}},
    {"name": "schedule_meeting", "description": "Book a demo/negotiation/pilot meeting",
     "parameters": {"prospect_id": "string", "datetime": "string", "type": "demo|negotiation|pilot"}},
    {"name": "update_stage", "description": "Move prospect to new pipeline stage",
     "parameters": {"prospect_id": "string", "stage": "string"}},
    {"name": "create_outreach_task", "description": "Queue an email to be sent",
     "parameters": {"prospect_id": "string", "content": "string", "subject": "string"}},
    {"name": "score_intent", "description": "Score buying intent after discovery call",
     "parameters": {"prospect_id": "string", "call_notes": "string"}},
    {"name": "spin_up_demo", "description": "Generate personalized demo for high-intent prospect",
     "parameters": {"prospect_id": "string"}},
    {"name": "get_prospect_summary", "description": "Get full context on a prospect",
     "parameters": {"prospect_id": "string"}},
    {"name": "log_communication", "description": "Log inbound or outbound communication",
     "parameters": {"prospect_id": "string", "channel": "string", "direction": "string", "content": "string"}}
  ]
  ```
  - Wire these so Person 2's agent can call them
- [ ] **Pipeline analytics RPC:**
  - `getPipelineSummary()` → count per stage, hit/rejection rates, avg scores
  - Person 1's UI calls this for the dashboard cards

### Hour 4 (3:15–4:00)
- [ ] Import customer list, verify everything shows up in Person 1's UI
- [ ] Test full flow: Person 2's agent calls your tools → data updates → UI reflects it
- [ ] Make sure the full funnel works: research → outreach → responded → discovery call → high intent → demo → negotiation → pilot → closed
- [ ] Have a "fast-forward" script that simulates a full prospect journey in 30 seconds for the demo

---

## Demo Script (Last 15 min — practice this)

1. **"Meet our AI sales team"** — Show the dashboard with the imported customer list
2. **Onboard** — Run AI interrogation: "We sell workforce analytics to mid-market HR teams"
3. **AI researches** — Batch agent runs. Judges watch the live feed:
   - "Researching Acme Corp..."
   - "Score: 82 — great fit for enterprise HR solutions"
   - "Drafting personalized cold email..."
4. **Automated outreach** — AI sends emails to the list. Show hit/rejection tracking
5. **Prospect responds** — Show a reply come in with a time. AI schedules a discovery call
6. **Discovery call** — AI agent talks to the prospect about their problem, scores intent
7. **High intent → Demo** — AI spins up a personalized demo showing workflow integration
8. **Human verifier** — Show approve/reject buttons. Human stays in the loop
9. **Full pipeline** — Show prospects at every stage, the organized communication log
10. **Commission model** — "We take X% of B2B deals closed by our AI agents"

---

## Critical Path (If Something Breaks)

| Priority | What | Why |
|---|---|---|
| P0 | Supabase schema + customer list import | Everything depends on this |
| P0 | UI dashboard with live feed + human verifier | Judges need to see something |
| P0 | AI agent decision engine + email drafting | This is the core product |
| P0 | Communication tracking system | Must show organized comms log |
| P1 | Actually sending emails | Wow factor, but can fake it |
| P1 | Calendar scheduling | Can show as task in UI instead |
| P2 | Inbound reply handling | Mock it for demo |
| P2 | Kanban board | Dashboard table is enough |

**If you're behind at hour 2:** Focus on: dashboard + AI agent loop + organized comms log + one real email send. That's enough to win.
