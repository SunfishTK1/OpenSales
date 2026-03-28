import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { supabase } from './db.js'

const app = express()
app.use(cors())
app.use(express.json())

// ─── PROSPECTS ────────────────────────────────────────────────────────────────

// GET /prospects?stage=&status=&min_score=
app.get('/prospects', async (req, res) => {
  let query = supabase.from('prospects').select('*').order('created_at', { ascending: false })
  if (req.query.stage) query = query.eq('stage', req.query.stage)
  if (req.query.status) query = query.eq('status', req.query.status)
  if (req.query.min_score) query = query.gte('score', Number(req.query.min_score))
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /prospects/:id — full summary with recent comms + agent runs
app.get('/prospects/:id', async (req, res) => {
  const { id } = req.params
  const [{ data: prospect, error: pe }, { data: comms }, { data: runs }] = await Promise.all([
    supabase.from('prospects').select('*').eq('id', id).single(),
    supabase.from('communications').select('*').eq('prospect_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('agent_runs').select('*').eq('prospect_id', id).order('created_at', { ascending: false }).limit(10),
  ])
  if (pe) return res.status(404).json({ error: pe.message })
  res.json({ prospect, communications: comms, agent_runs: runs })
})

// POST /prospects
app.post('/prospects', async (req, res) => {
  const { name, email, company, industry, phone, title, source, notes } = req.body
  const { data, error } = await supabase
    .from('prospects')
    .insert({ name, email, company, industry, phone, title, source: source || 'manual', notes })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// POST /prospects/bulk — import array of prospects
app.post('/prospects/bulk', async (req, res) => {
  const prospects = req.body
  if (!Array.isArray(prospects)) return res.status(400).json({ error: 'Body must be an array' })
  const rows = prospects.map(p => ({ ...p, source: p.source || 'imported' }))
  const { data, error } = await supabase.from('prospects').insert(rows).select()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ inserted: data.length, prospects: data })
})

// PATCH /prospects/:id/stage
app.patch('/prospects/:id/stage', async (req, res) => {
  const { id } = req.params
  const { stage, reasoning } = req.body
  const validStages = ['research', 'outreach', 'responded', 'discovery_call', 'high_intent', 'demo', 'negotiation', 'pilot', 'closed']
  if (!validStages.includes(stage)) return res.status(400).json({ error: `Invalid stage. Must be one of: ${validStages.join(', ')}` })

  const [{ data: prospect, error: pe }, { error: logError }] = await Promise.all([
    supabase.from('prospects').update({ stage }).eq('id', id).select().single(),
    supabase.from('agent_runs').insert({ prospect_id: id, action: 'stage_change', reasoning: reasoning || `Moved to ${stage}`, result: { stage } }),
  ])
  if (pe) return res.status(500).json({ error: pe.message })
  if (logError) console.warn('agent_run log failed:', logError.message)
  res.json(prospect)
})

// PATCH /prospects/:id — update any fields (score, intent_score, status, notes, etc.)
app.patch('/prospects/:id', async (req, res) => {
  const { id } = req.params
  const allowed = ['score', 'intent_score', 'status', 'rejection_reason', 'notes', 'name', 'email', 'phone', 'company', 'industry', 'title']
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)))
  const { data, error } = await supabase.from('prospects').update(updates).eq('id', id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ─── TASKS ────────────────────────────────────────────────────────────────────

// GET /tasks?status=pending
app.get('/tasks', async (req, res) => {
  let query = supabase.from('tasks').select('*, prospects(name, company, email)').order('created_at', { ascending: false })
  if (req.query.status) query = query.eq('status', req.query.status)
  if (req.query.prospect_id) query = query.eq('prospect_id', req.query.prospect_id)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /tasks
app.post('/tasks', async (req, res) => {
  const { prospect_id, type, payload, scheduled_for } = req.body
  const { data, error } = await supabase
    .from('tasks')
    .insert({ prospect_id, type, payload, scheduled_for, status: 'pending' })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// PATCH /tasks/:id/approve
app.patch('/tasks/:id/approve', async (req, res) => {
  const { data, error } = await supabase.from('tasks').update({ status: 'approved' }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// PATCH /tasks/:id/reject
app.patch('/tasks/:id/reject', async (req, res) => {
  const { data, error } = await supabase.from('tasks').update({ status: 'rejected' }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// PATCH /tasks/:id/done
app.patch('/tasks/:id/done', async (req, res) => {
  const { data, error } = await supabase.from('tasks').update({ status: 'done' }).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ─── COMMUNICATIONS ───────────────────────────────────────────────────────────

// POST /communications — log a comm
app.post('/communications', async (req, res) => {
  const { prospect_id, channel, direction, content, subject, status } = req.body
  const { data, error } = await supabase
    .from('communications')
    .insert({ prospect_id, channel, direction, content, subject, status: status || 'sent' })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// ─── TOOL CALL INTERFACE (for AI agent) ───────────────────────────────────────

// GET /tools — returns tool schema for the AI agent
app.get('/tools', (_, res) => {
  res.json([
    {
      name: 'schedule_discovery_call',
      description: 'Book a discovery call when prospect responds with a time',
      parameters: { prospect_id: 'string (uuid)', datetime: 'string (ISO 8601)' },
      endpoint: 'POST /tool/schedule_discovery_call',
    },
    {
      name: 'schedule_meeting',
      description: 'Book a demo, negotiation, or pilot meeting',
      parameters: { prospect_id: 'string (uuid)', datetime: 'string (ISO 8601)', type: 'demo|negotiation|pilot', notes: 'string (optional)' },
      endpoint: 'POST /tool/schedule_meeting',
    },
    {
      name: 'update_stage',
      description: 'Move prospect to a new pipeline stage',
      parameters: { prospect_id: 'string (uuid)', stage: 'research|outreach|responded|discovery_call|high_intent|demo|negotiation|pilot|closed', reasoning: 'string (optional)' },
      endpoint: 'POST /tool/update_stage',
    },
    {
      name: 'create_outreach_task',
      description: 'Queue an email to be sent to a prospect',
      parameters: { prospect_id: 'string (uuid)', subject: 'string', content: 'string' },
      endpoint: 'POST /tool/create_outreach_task',
    },
    {
      name: 'score_intent',
      description: 'Score buying intent after a discovery call (0–100)',
      parameters: { prospect_id: 'string (uuid)', intent_score: 'number (0–100)', call_notes: 'string' },
      endpoint: 'POST /tool/score_intent',
    },
    {
      name: 'spin_up_demo',
      description: 'Generate a personalized demo task for a high-intent prospect',
      parameters: { prospect_id: 'string (uuid)', demo_plan: 'string' },
      endpoint: 'POST /tool/spin_up_demo',
    },
    {
      name: 'get_prospect_summary',
      description: 'Get full context on a prospect including comms and agent runs',
      parameters: { prospect_id: 'string (uuid)' },
      endpoint: 'GET /prospects/:id',
    },
    {
      name: 'log_communication',
      description: 'Log inbound or outbound communication',
      parameters: { prospect_id: 'string (uuid)', channel: 'email|call', direction: 'inbound|outbound', content: 'string', subject: 'string (optional)' },
      endpoint: 'POST /communications',
    },
  ])
})

// POST /tool/schedule_discovery_call
app.post('/tool/schedule_discovery_call', async (req, res) => {
  const { prospect_id, datetime } = req.body
  const { data, error } = await supabase
    .from('tasks')
    .insert({ prospect_id, type: 'discovery_call', payload: { datetime }, scheduled_for: datetime, status: 'pending' })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  await supabase.from('prospects').update({ stage: 'discovery_call' }).eq('id', prospect_id)
  await supabase.from('agent_runs').insert({ prospect_id, action: 'schedule_call', reasoning: `Discovery call scheduled for ${datetime}`, result: { task_id: data.id } })
  res.status(201).json(data)
})

// POST /tool/schedule_meeting
app.post('/tool/schedule_meeting', async (req, res) => {
  const { prospect_id, datetime, type, notes } = req.body
  const { data, error } = await supabase
    .from('tasks')
    .insert({ prospect_id, type, payload: { datetime, notes }, scheduled_for: datetime, status: 'pending' })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  await supabase.from('agent_runs').insert({ prospect_id, action: 'schedule_call', reasoning: `${type} meeting scheduled for ${datetime}`, result: { task_id: data.id } })
  res.status(201).json(data)
})

// POST /tool/update_stage
app.post('/tool/update_stage', async (req, res) => {
  const { prospect_id, stage, reasoning } = req.body
  const response = await fetch(`http://localhost:${process.env.PORT || 3001}/prospects/${prospect_id}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, reasoning }),
  })
  const data = await response.json()
  res.status(response.status).json(data)
})

// POST /tool/create_outreach_task
app.post('/tool/create_outreach_task', async (req, res) => {
  const { prospect_id, subject, content } = req.body
  const { data, error } = await supabase
    .from('tasks')
    .insert({ prospect_id, type: 'email', payload: { subject, body: content }, status: 'pending' })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// POST /tool/score_intent
app.post('/tool/score_intent', async (req, res) => {
  const { prospect_id, intent_score, call_notes } = req.body
  const isHighIntent = intent_score >= 70
  await Promise.all([
    supabase.from('prospects').update({
      intent_score,
      stage: isHighIntent ? 'high_intent' : undefined,
      status: !isHighIntent && intent_score < 30 ? 'cold' : undefined,
    }).eq('id', prospect_id),
    supabase.from('agent_runs').insert({
      prospect_id,
      action: 'intent_score',
      reasoning: call_notes || `Intent scored at ${intent_score}`,
      result: { intent_score, high_intent: isHighIntent },
    }),
  ])
  res.json({ prospect_id, intent_score, high_intent: isHighIntent })
})

// POST /tool/spin_up_demo
app.post('/tool/spin_up_demo', async (req, res) => {
  const { prospect_id, demo_plan } = req.body
  const { data, error } = await supabase
    .from('tasks')
    .insert({ prospect_id, type: 'demo', payload: { demo_plan }, status: 'pending' })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  await supabase.from('agent_runs').insert({ prospect_id, action: 'spin_demo', reasoning: 'High-intent prospect — spinning up personalized demo', result: { task_id: data.id, demo_plan } })
  res.status(201).json(data)
})

// ─── PIPELINE ANALYTICS ───────────────────────────────────────────────────────

// GET /pipeline/summary
app.get('/pipeline/summary', async (req, res) => {
  const stages = ['research', 'outreach', 'responded', 'discovery_call', 'high_intent', 'demo', 'negotiation', 'pilot', 'closed']
  const [{ data: prospects }, { data: comms }] = await Promise.all([
    supabase.from('prospects').select('stage, score, intent_score, status'),
    supabase.from('communications').select('status, direction'),
  ])

  const byStage = Object.fromEntries(stages.map(s => [s, 0]))
  let totalScore = 0, scoredCount = 0
  for (const p of prospects || []) {
    if (byStage[p.stage] !== undefined) byStage[p.stage]++
    if (p.score > 0) { totalScore += p.score; scoredCount++ }
  }

  const sent = comms?.filter(c => c.direction === 'outbound').length || 0
  const replied = comms?.filter(c => c.direction === 'inbound').length || 0
  const rejected = prospects?.filter(p => p.status === 'rejected').length || 0

  res.json({
    total_prospects: prospects?.length || 0,
    by_stage: byStage,
    emails_sent: sent,
    replies: replied,
    reply_rate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
    rejections: rejected,
    avg_score: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0,
    high_intent_count: byStage.high_intent + byStage.demo + byStage.negotiation + byStage.pilot + byStage.closed,
    closed: byStage.closed,
  })
})

// ─── DEMO FAST-FORWARD ────────────────────────────────────────────────────────

// POST /demo/simulate — simulates a full prospect journey in seconds
app.post('/demo/simulate', async (req, res) => {
  const { name = 'Demo Corp', email = 'demo@example.com', company = 'Demo Corp', industry = 'SaaS' } = req.body

  // 1. Create prospect
  const { data: prospect } = await supabase.from('prospects').insert({ name, email, company, industry, source: 'manual', stage: 'research', score: 0 }).select().single()
  const pid = prospect.id
  const delay = ms => new Promise(r => setTimeout(r, ms))

  const steps = []

  // 2. Research + score
  await supabase.from('agent_runs').insert({ prospect_id: pid, action: 'research', reasoning: `Researching ${company}...`, result: { status: 'in_progress' } })
  await delay(300)
  await supabase.from('prospects').update({ score: 82, notes: `${company} is a strong fit. Mid-market, clear budget signal, decision maker identified.` }).eq('id', pid)
  await supabase.from('agent_runs').insert({ prospect_id: pid, action: 'score', reasoning: `Score: 82 — great fit. Initiating outreach.`, result: { score: 82 } })
  steps.push('researched')

  // 3. Draft + send cold email
  await delay(300)
  const { data: emailTask } = await supabase.from('tasks').insert({ prospect_id: pid, type: 'email', payload: { subject: `Quick question for ${company}`, body: `Hi ${name}, I think we can help...` }, status: 'approved' }).select().single()
  await supabase.from('communications').insert({ prospect_id: pid, channel: 'email', direction: 'outbound', subject: `Quick question for ${company}`, content: `Hi ${name}, I think we can help...`, status: 'sent' })
  await supabase.from('prospects').update({ stage: 'outreach' }).eq('id', pid)
  await supabase.from('agent_runs').insert({ prospect_id: pid, action: 'email_draft', reasoning: 'Cold email drafted and sent', result: { task_id: emailTask.id } })
  steps.push('outreach_sent')

  // 4. Prospect replies
  await delay(300)
  await supabase.from('communications').insert({ prospect_id: pid, channel: 'email', direction: 'inbound', content: 'Sounds interesting! How about Tuesday at 2pm?', status: 'replied' })
  await supabase.from('prospects').update({ stage: 'responded' }).eq('id', pid)
  await supabase.from('agent_runs').insert({ prospect_id: pid, action: 'stage_change', reasoning: 'Prospect replied with availability — scheduling discovery call', result: { stage: 'responded' } })
  steps.push('replied')

  // 5. Discovery call scheduled
  await delay(300)
  const callTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
  await supabase.from('tasks').insert({ prospect_id: pid, type: 'discovery_call', payload: { datetime: callTime }, scheduled_for: callTime, status: 'approved' })
  await supabase.from('prospects').update({ stage: 'discovery_call' }).eq('id', pid)
  steps.push('call_scheduled')

  // 6. High intent after call
  await delay(300)
  await supabase.from('prospects').update({ stage: 'high_intent', intent_score: 85 }).eq('id', pid)
  await supabase.from('agent_runs').insert({ prospect_id: pid, action: 'intent_score', reasoning: 'Discovery call complete. Clear pain point, budget confirmed, decision maker engaged. Intent: 85/100', result: { intent_score: 85, high_intent: true } })
  steps.push('high_intent')

  // 7. Demo spun up
  await delay(300)
  await supabase.from('tasks').insert({ prospect_id: pid, type: 'demo', payload: { demo_plan: `Personalized demo for ${company} showing workflow integration` }, status: 'pending' })
  await supabase.from('prospects').update({ stage: 'demo' }).eq('id', pid)
  await supabase.from('agent_runs').insert({ prospect_id: pid, action: 'spin_demo', reasoning: 'Spinning up personalized demo for high-intent prospect', result: { stage: 'demo' } })
  steps.push('demo_ready')

  res.json({ prospect_id: pid, steps, message: 'Full journey simulated — check the dashboard!' })
})

// ─── RETELL SYNC ─────────────────────────────────────────────────────────────

async function getExistingCallIds() {
  const { data } = await supabase.from('communications').select('subject').eq('channel', 'call').like('subject', 'retell:%')
  return new Set((data || []).map(r => r.subject.replace('retell:', '')))
}

async function findOrCreateProspect(customerName, customerEmail) {
  if (customerEmail) {
    const { data } = await supabase.from('prospects').select('*').eq('email', customerEmail.trim()).single()
    if (data) return data
  }
  if (customerName) {
    const { data } = await supabase.from('prospects').select('*').ilike('name', customerName.trim()).single()
    if (data) return data
  }
  const { data, error } = await supabase.from('prospects').insert({ name: customerName || 'Unknown', email: customerEmail?.trim() || null, stage: 'outreach', score: 0, source: 'imported', notes: 'Auto-created from Retell call sync.' }).select().single()
  if (error) throw new Error(`Failed to create prospect: ${error.message}`)
  return data
}

async function syncRetellCalls() {
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) throw new Error('RETELL_API_KEY not set in .env')

  const res = await fetch('https://api.retellai.com/v2/list-calls', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`Retell API error: ${res.status}`)
  const calls = await res.json()

  const supabaseCalls = calls.filter(c => c.agent_name?.toLowerCase().includes('supabase'))
  const existingCallIds = await getExistingCallIds()

  let synced = 0
  for (const call of supabaseCalls) {
    if (existingCallIds.has(call.call_id)) continue

    const vars = call.retell_llm_dynamic_variables || {}
    const analysis = call.call_analysis || {}
    if (!vars.customer_name && !vars.customer_email) continue

    const prospect = await findOrCreateProspect(vars.customer_name, vars.customer_email)

    const intentScore = analysis.call_successful ? (analysis.user_sentiment === 'Positive' ? 78 : 45) : 0
    const newStage = analysis.call_successful && analysis.user_sentiment === 'Positive' ? 'responded' : prospect.stage

    await supabase.from('communications').insert({ prospect_id: prospect.id, channel: 'call', direction: 'outbound', subject: `retell:${call.call_id}`, content: call.transcript || '(no transcript)', status: analysis.call_successful ? 'replied' : 'sent' })
    await supabase.from('agent_runs').insert({ prospect_id: prospect.id, action: 'schedule_call', reasoning: analysis.call_summary || `Retell call completed. Sentiment: ${analysis.user_sentiment}.`, result: { call_id: call.call_id, duration_ms: call.duration_ms, call_successful: analysis.call_successful, user_sentiment: analysis.user_sentiment, in_voicemail: analysis.in_voicemail, intent_score: intentScore } })

    if (analysis.call_successful && intentScore > (prospect.intent_score || 0)) {
      await supabase.from('prospects').update({ stage: newStage, intent_score: intentScore }).eq('id', prospect.id)
    }
    synced++
  }

  return { total_supabase_calls: supabaseCalls.length, new_calls_synced: synced }
}

// POST /sync/calls — trigger from UI button
app.post('/sync/calls', async (req, res) => {
  try {
    const result = await syncRetellCalls()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true }))

app.get('/', (_, res) => {
  res.json({
    service: 'OpenSales Backend',
    endpoints: [
      'GET  /prospects',
      'GET  /prospects/:id',
      'POST /prospects',
      'POST /prospects/bulk',
      'PATCH /prospects/:id/stage',
      'PATCH /prospects/:id',
      'GET  /tasks',
      'POST /tasks',
      'PATCH /tasks/:id/approve',
      'PATCH /tasks/:id/reject',
      'PATCH /tasks/:id/done',
      'POST /communications',
      'GET  /tools',
      'POST /tool/schedule_discovery_call',
      'POST /tool/schedule_meeting',
      'POST /tool/update_stage',
      'POST /tool/create_outreach_task',
      'POST /tool/score_intent',
      'POST /tool/spin_up_demo',
      'GET  /pipeline/summary',
      'POST /demo/simulate',
      'POST /sync/calls',
    ],
  })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`))
