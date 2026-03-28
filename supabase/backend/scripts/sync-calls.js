import { supabase } from '../db.js'

const RETELL_API_KEY = process.env.RETELL_API_KEY
const POLL_INTERVAL_MS = 30_000 // poll every 30 seconds

if (!RETELL_API_KEY) {
  console.error('Missing RETELL_API_KEY in .env')
  process.exit(1)
}

async function fetchRetellCalls() {
  const res = await fetch('https://api.retellai.com/v2/list-calls', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RETELL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`Retell API error: ${res.status}`)
  return res.json()
}

async function getExistingCallIds() {
  const { data } = await supabase
    .from('communications')
    .select('subject')
    .eq('channel', 'call')
    .like('subject', 'retell:%')
  return new Set((data || []).map(r => r.subject.replace('retell:', '')))
}

async function findOrCreateProspect(customerName, customerEmail) {
  if (customerEmail) {
    const { data: existing } = await supabase
      .from('prospects')
      .select('*')
      .eq('email', customerEmail.trim())
      .single()
    if (existing) return existing
  }

  // Try match by name
  if (customerName) {
    const { data: existing } = await supabase
      .from('prospects')
      .select('*')
      .ilike('name', customerName.trim())
      .single()
    if (existing) return existing
  }

  // Create new prospect
  const { data, error } = await supabase
    .from('prospects')
    .insert({
      name: customerName || 'Unknown',
      email: customerEmail?.trim() || null,
      stage: 'outreach',
      score: 0,
      source: 'imported',
      notes: 'Auto-created from Retell call sync.',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create prospect: ${error.message}`)
  console.log(`  Created new prospect: ${data.name}`)
  return data
}

function mapSentimentToStage(sentiment, callSuccessful, currentStage) {
  if (!callSuccessful) return currentStage
  if (sentiment === 'Positive') return 'responded'
  return currentStage
}

function mapSentimentToIntentScore(sentiment, callSuccessful) {
  if (!callSuccessful) return 0
  if (sentiment === 'Positive') return 78
  if (sentiment === 'Neutral') return 45
  return 20
}

async function syncCall(call, existingCallIds) {
  const callId = call.call_id

  // Only process Supabase sales calls
  if (!call.agent_name?.toLowerCase().includes('supabase')) return

  if (existingCallIds.has(callId)) return // already synced

  const vars = call.retell_llm_dynamic_variables || {}
  const analysis = call.call_analysis || {}
  const customerName = vars.customer_name
  const customerEmail = vars.customer_email

  if (!customerName && !customerEmail) {
    console.log(`  Skipping call ${callId} — no customer info`)
    return
  }

  console.log(`  Syncing call ${callId} for ${customerName || customerEmail}...`)

  const prospect = await findOrCreateProspect(customerName, customerEmail)

  const intentScore = mapSentimentToIntentScore(analysis.user_sentiment, analysis.call_successful)
  const newStage = mapSentimentToStage(analysis.user_sentiment, analysis.call_successful, prospect.stage)

  // Log the call as a communication (subject used as unique key: retell:<call_id>)
  await supabase.from('communications').insert({
    prospect_id: prospect.id,
    channel: 'call',
    direction: 'outbound',
    subject: `retell:${callId}`,
    content: call.transcript || '(no transcript)',
    status: analysis.call_successful ? 'replied' : 'sent',
  })

  // Log agent run
  await supabase.from('agent_runs').insert({
    prospect_id: prospect.id,
    action: 'schedule_call',
    reasoning: analysis.call_summary || `Retell call ${callId} completed. Sentiment: ${analysis.user_sentiment}.`,
    result: {
      call_id: callId,
      duration_ms: call.duration_ms,
      call_successful: analysis.call_successful,
      user_sentiment: analysis.user_sentiment,
      in_voicemail: analysis.in_voicemail,
      intent_score: intentScore,
    },
  })

  // Update prospect stage + intent score if the call was meaningful
  if (analysis.call_successful && intentScore > prospect.intent_score) {
    await supabase.from('prospects').update({
      stage: newStage,
      intent_score: intentScore,
    }).eq('id', prospect.id)
    console.log(`  Updated ${prospect.name} → stage: ${newStage}, intent: ${intentScore}`)
  }
}

async function sync() {
  console.log(`[${new Date().toISOString()}] Syncing Retell calls...`)
  try {
    const [calls, existingCallIds] = await Promise.all([
      fetchRetellCalls(),
      getExistingCallIds(),
    ])

    const supabaseCalls = calls.filter(c => c.agent_name?.toLowerCase().includes('supabase'))
    console.log(`  Found ${supabaseCalls.length} Supabase calls (${calls.length} total)`)

    let newCount = 0
    for (const call of supabaseCalls) {
      if (!existingCallIds.has(call.call_id)) {
        await syncCall(call, existingCallIds)
        newCount++
      }
    }

    console.log(`  ${newCount} new calls synced\n`)
  } catch (err) {
    console.error('Sync error:', err.message)
  }
}

// Run immediately, then poll
sync()
setInterval(sync, POLL_INTERVAL_MS)
console.log(`Retell call sync running — polling every ${POLL_INTERVAL_MS / 1000}s`)
