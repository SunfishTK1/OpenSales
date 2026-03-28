import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Readable } from 'stream';
import { createRetellVoiceAgent } from './retell.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// CORS — allow UI dev server
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Clients ──────────────────────────────────────────────────────────────────

const BEDROCK_API_KEY = process.env.BEDROCK_API_KEY;
const BEDROCK_REGION = process.env.AWS_REGION || 'us-east-2';
const MODEL = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';
const BEDROCK_URL = `https://bedrock-runtime.${BEDROCK_REGION}.amazonaws.com/model/${encodeURIComponent(MODEL)}/converse`;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert B2B sales configuration specialist conducting a structured onboarding interview.
Your job is to interrogate a company representative and extract ALL of the following information to configure an AI sales agent.

You must extract:
1. COMPANY IDENTITY: company name, product/service name, representative name & title, inbound channel that triggered leads
2. PRODUCT DETAILS: value proposition (1-2 sentences), 4-6 key features to highlight, tiered packaging (if any), "do NOT mention unless asked" list (pricing specifics, competitor comparisons, discount policies)
3. QUALIFICATION CRITERIA: 3-5 qualifying questions, qualification thresholds (what defines "qualified"), fallback path for unqualified leads
4. TRANSFER ROUTING: role name for "wants to buy" transfer + phone/extension, role name for "technical questions" transfer + phone/extension
5. OBJECTION HANDLING: top 3-5 objections prospects raise + scripted responses for each
6. CLOSE & FOLLOW-UP: re-engagement email/URL, collateral sent after call, follow-up timeline if transfer fails, CRM tagging conventions
7. DYNAMIC VARIABLES: merge fields their system uses (e.g. {{customer_name}}, {{customer_email}}, {{lead_source}}, {{company_name}})

Rules:
- Ask one section at a time. Don't overwhelm the user.
- After gathering each section, briefly confirm what you've captured before moving on.
- Be conversational but efficient. This is a business interview.
- When you have gathered ALL 7 sections, output a JSON block wrapped in <CONFIG_COMPLETE> tags with this exact structure:
<CONFIG_COMPLETE>
{
  "company_identity": {
    "company_name": "",
    "product_name": "",
    "rep_name": "",
    "rep_title": "",
    "inbound_channel": ""
  },
  "product_details": {
    "value_proposition": "",
    "key_features": [],
    "tiers": [],
    "do_not_mention": []
  },
  "qualification": {
    "questions": [],
    "thresholds": {},
    "fallback_path": ""
  },
  "transfer_routing": {
    "closer": { "role": "", "phone": "" },
    "technical": { "role": "", "phone": "" }
  },
  "objection_handling": [
    { "objection": "", "response": "" }
  ],
  "follow_up": {
    "reengagement_email": "",
    "collateral": [],
    "follow_up_timeline": "",
    "crm_tags": {}
  },
  "dynamic_variables": []
}
</CONFIG_COMPLETE>

Start by warmly greeting the user, explaining you'll be gathering their company configuration in 7 sections, and ask for section 1 (company identity).

IMPORTANT — your responses will be spoken aloud via text-to-speech. Keep each reply to 2-3 short sentences maximum. No bullet points or numbered lists in your spoken replies — ask one question at a time, conversationally.`;

// ─── In-memory sessions ───────────────────────────────────────────────────────

const sessions = {};

function extractConfig(text) {
  const match = text.match(/<CONFIG_COMPLETE>([\s\S]*?)<\/CONFIG_COMPLETE>/);
  if (!match) return null;
  try { return JSON.parse(match[1].trim()); } catch { return null; }
}

async function saveConfig(config) {
  const row = {
    company_name: config.company_identity.company_name,
    product_name: config.company_identity.product_name,
    rep_name: config.company_identity.rep_name,
    rep_title: config.company_identity.rep_title,
    inbound_channel: config.company_identity.inbound_channel,
    value_proposition: config.product_details.value_proposition,
    key_features: config.product_details.key_features,
    tiers: config.product_details.tiers,
    do_not_mention: config.product_details.do_not_mention,
    qualification_questions: config.qualification.questions,
    qualification_thresholds: config.qualification.thresholds,
    fallback_path: config.qualification.fallback_path,
    transfer_closer_role: config.transfer_routing.closer.role,
    transfer_closer_phone: config.transfer_routing.closer.phone,
    transfer_technical_role: config.transfer_routing.technical.role,
    transfer_technical_phone: config.transfer_routing.technical.phone,
    objection_handling: config.objection_handling,
    reengagement_email: config.follow_up.reengagement_email,
    collateral: config.follow_up.collateral,
    follow_up_timeline: config.follow_up.follow_up_timeline,
    crm_tags: config.follow_up.crm_tags,
    dynamic_variables: config.dynamic_variables,
    raw_config: config,
  };
  const { data, error } = await supabase.from('company_config').insert(row).select().single();
  if (error) throw error;
  return data;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Whisper transcription
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set in .env' });
  if (!req.file) return res.status(400).json({ error: 'No audio file received' });

  try {
    const readable = Readable.from(req.file.buffer);
    readable.path = 'audio.webm';

    const transcription = await openai.audio.transcriptions.create({
      file: readable,
      model: 'whisper-1',
    });

    res.json({ text: transcription.text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TTS — speak agent text aloud via OpenAI (nova voice)
app.post('/api/speak', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set in .env' });
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',       // natural, clear female voice
      input: text,
      speed: 1.0,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length });
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start a new session (get the agent's opening greeting)
app.post('/api/session/start', async (req, res) => {
  const sessionId = Date.now().toString();
  sessions[sessionId] = [];

  try {
    const messages = sessions[sessionId];
    messages.push({ role: 'user', content: [{ text: 'Hello, I am ready to configure my company.' }] });

    const bedrockRes = await fetch(BEDROCK_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${BEDROCK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: [{ text: SYSTEM_PROMPT }], messages }),
    });

    const data = await bedrockRes.json();
    if (!bedrockRes.ok) throw new Error(data.message || JSON.stringify(data));

    const assistantText = data.output.message.content[0].text;
    messages.push({ role: 'assistant', content: [{ text: assistantText }] });

    res.json({ sessionId, message: assistantText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a message in an existing session
app.post('/api/session/:sessionId/message', async (req, res) => {
  const { sessionId } = req.params;
  const { message } = req.body;

  if (!sessions[sessionId]) return res.status(404).json({ error: 'Session not found' });
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  const messages = sessions[sessionId];
  messages.push({ role: 'user', content: [{ text: message }] });

  try {
    const bedrockRes = await fetch(BEDROCK_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${BEDROCK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: [{ text: SYSTEM_PROMPT }], messages }),
    });

    const data = await bedrockRes.json();
    if (!bedrockRes.ok) throw new Error(data.message || JSON.stringify(data));

    const assistantText = data.output.message.content[0].text;
    messages.push({ role: 'assistant', content: [{ text: assistantText }] });

    const config = extractConfig(assistantText);
    let saved = null;
    let saveError = null;
    let retellResult = null;
    let retellError = null;

    if (config) {
      try { saved = await saveConfig(config); }
      catch (err) { saveError = err.message; }

      // Auto-create the Retell outbound voice agent
      try { retellResult = await createRetellVoiceAgent(config); }
      catch (err) { retellError = err.message; }
    }

    // Strip the raw <CONFIG_COMPLETE> block from the displayed message
    const displayText = assistantText.replace(/<CONFIG_COMPLETE>[\s\S]*?<\/CONFIG_COMPLETE>/, '').trim();

    res.json({
      message: displayText,
      config: config || undefined,
      saved: saved || undefined,
      saveError: saveError || undefined,
      retell: retellResult || undefined,
      retellError: retellError || undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Retell Webhook — save completed calls + transcripts ─────────────────────

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${RETELL_API_KEY}`,
};

function callToRow(call) {
  const dynVars = call.retell_llm_dynamic_variables || {};
  return {
    call_id: call.call_id,
    agent_id: call.agent_id,
    agent_name: call.agent_name || null,
    call_status: call.call_status,
    call_type: call.call_type,
    direction: call.direction || null,
    from_number: call.from_number || null,
    to_number: call.to_number || null,
    duration_ms: call.duration_ms || null,
    transcript: call.transcript || null,
    transcript_object: call.transcript_object || null,
    recording_url: call.recording_url || null,
    call_analysis: call.call_analysis || null,
    disconnection_reason: call.disconnection_reason || null,
    customer_name: dynVars.customer_name || call.metadata?.customer_name || null,
    customer_email: dynVars.customer_email || call.metadata?.customer_email || null,
    prospect_company: dynVars.prospect_company || call.metadata?.prospect_company || null,
    lead_source: dynVars.lead_source || call.metadata?.lead_source || null,
    metadata: call.metadata || {},
    collected_variables: call.collected_dynamic_variables || {},
    call_cost: call.call_cost || null,
    start_timestamp: call.start_timestamp || null,
    end_timestamp: call.end_timestamp || null,
  };
}

// Retell sends POST here when calls end / are analyzed
app.post('/api/webhook/retell', async (req, res) => {
  const { event, call } = req.body;

  if (!call?.call_id) return res.status(400).json({ error: 'Missing call data' });

  if (['call_ended', 'call_analyzed'].includes(event)) {
    try {
      const row = callToRow(call);
      const { error } = await supabase
        .from('calls')
        .upsert(row, { onConflict: 'call_id' });

      if (error) console.error('Webhook save error:', error.message);
      else console.log(`[webhook] ${event}: ${call.call_id} saved`);
    } catch (err) {
      console.error('Webhook error:', err.message);
    }
  }

  res.status(200).send();
});

// ─── Call management endpoints ───────────────────────────────────────────────

// List recent calls from the database
app.get('/api/calls', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get a single call with full transcript
app.get('/api/calls/:callId', async (req, res) => {
  const { callId } = req.params;

  // Check DB first
  const { data } = await supabase
    .from('calls')
    .select('*')
    .eq('call_id', callId)
    .single();

  if (data) return res.json(data);

  // Fallback: fetch from Retell API directly
  if (!RETELL_API_KEY) return res.status(404).json({ error: 'Call not found' });

  try {
    const retellRes = await fetch(
      `https://api.retellai.com/v2/get-call/${callId}`,
      { headers: RETELL_HEADERS }
    );
    if (!retellRes.ok) return res.status(retellRes.status).json({ error: 'Call not found in Retell' });

    const call = await retellRes.json();
    res.json(callToRow(call));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manually sync recent calls from Retell API into the database
app.post('/api/calls/sync', async (req, res) => {
  if (!RETELL_API_KEY) return res.status(500).json({ error: 'RETELL_API_KEY not set' });

  try {
    const retellRes = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: RETELL_HEADERS,
      body: JSON.stringify({
        sort_order: 'descending',
        limit: parseInt(req.query.limit) || 50,
      }),
    });

    if (!retellRes.ok) {
      const err = await retellRes.text();
      return res.status(retellRes.status).json({ error: err });
    }

    const calls = await retellRes.json();
    let saved = 0;

    for (const call of calls) {
      if (call.call_status !== 'ended') continue;

      const row = callToRow(call);
      const { error } = await supabase
        .from('calls')
        .upsert(row, { onConflict: 'call_id' });

      if (!error) saved++;
    }

    res.json({ synced: saved, total: calls.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Agent & Phone Number management ────────────────────────────────────────

// List all Retell voice agents
app.get('/api/agents', async (req, res) => {
  if (!RETELL_API_KEY) return res.status(500).json({ error: 'RETELL_API_KEY not set' });
  try {
    const retellRes = await fetch('https://api.retellai.com/list-agents', {
      headers: RETELL_HEADERS,
    });
    if (!retellRes.ok) {
      const err = await retellRes.text();
      return res.status(retellRes.status).json({ error: err });
    }
    res.json(await retellRes.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List Retell phone numbers
app.get('/api/phone-numbers', async (req, res) => {
  if (!RETELL_API_KEY) return res.status(500).json({ error: 'RETELL_API_KEY not set' });
  try {
    const retellRes = await fetch('https://api.retellai.com/v2/list-phone-numbers', {
      headers: RETELL_HEADERS,
    });
    if (!retellRes.ok) {
      const err = await retellRes.text();
      return res.status(retellRes.status).json({ error: err });
    }
    const data = await retellRes.json();
    // Retell wraps results in { items: [...] }
    res.json(data.items || data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Launch an outbound phone call via Retell
app.post('/api/calls/launch', async (req, res) => {
  if (!RETELL_API_KEY) return res.status(500).json({ error: 'RETELL_API_KEY not set' });

  const { from_number, to_number, agent_id, dynamic_variables, metadata } = req.body;
  if (!from_number || !to_number) {
    return res.status(400).json({ error: 'from_number and to_number are required' });
  }

  try {
    const body = {
      from_number,
      to_number,
      ...(agent_id && { override_agent_id: agent_id }),
      ...(dynamic_variables && { retell_llm_dynamic_variables: dynamic_variables }),
      ...(metadata && { metadata }),
    };

    const retellRes = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: RETELL_HEADERS,
      body: JSON.stringify(body),
    });

    if (!retellRes.ok) {
      const err = await retellRes.text();
      return res.status(retellRes.status).json({ error: err });
    }

    res.status(201).json(await retellRes.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get live call data from Retell (for real-time polling during active calls)
app.get('/api/calls/:callId/live', async (req, res) => {
  if (!RETELL_API_KEY) return res.status(500).json({ error: 'RETELL_API_KEY not set' });

  try {
    const retellRes = await fetch(
      `https://api.retellai.com/v2/get-call/${req.params.callId}`,
      { headers: RETELL_HEADERS }
    );
    if (!retellRes.ok) {
      const err = await retellRes.text();
      return res.status(retellRes.status).json({ error: err });
    }
    res.json(await retellRes.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Summarize a call transcript via Bedrock Claude ─────────────────────────

app.post('/api/calls/:callId/summarize', async (req, res) => {
  if (!BEDROCK_API_KEY) return res.status(500).json({ error: 'BEDROCK_API_KEY not set' });

  const { transcript } = req.body;
  if (!transcript) return res.status(400).json({ error: 'transcript is required' });

  const prompt = `You are a sales call analyst. Summarize this sales call transcript concisely.

Include:
1. **Outcome** — what happened (qualified, transferred, not interested, etc.)
2. **Key points** — what the prospect said about their needs, objections, and interest level
3. **Action items** — any follow-ups, emails to send, or next steps
4. **Prospect sentiment** — overall tone (positive, neutral, negative)

Keep it to 4-6 short bullet points. Be direct and actionable.

Transcript:
${transcript}`;

  try {
    const bedrockRes = await fetch(BEDROCK_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${BEDROCK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: [{ text: prompt }] }],
      }),
    });

    const data = await bedrockRes.json();
    if (!bedrockRes.ok) throw new Error(data.message || JSON.stringify(data));

    const summary = data.output.message.content[0].text;
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Auto-sync calls from Retell every 60s ──────────────────────────────────

const SYNC_INTERVAL_MS = 60_000;

async function autoSyncCalls() {
  if (!RETELL_API_KEY) return;

  try {
    const retellRes = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: RETELL_HEADERS,
      body: JSON.stringify({ sort_order: 'descending', limit: 50 }),
    });

    if (!retellRes.ok) return;

    const calls = await retellRes.json();
    let saved = 0;

    for (const call of calls) {
      if (call.call_status !== 'ended') continue;

      const row = callToRow(call);
      const { error } = await supabase
        .from('calls')
        .upsert(row, { onConflict: 'call_id' });

      if (!error) saved++;
    }

    if (saved > 0) console.log(`[auto-sync] ${saved} new call(s) saved`);
  } catch { /* silent — will retry next interval */ }
}

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║   OpenSales Onboarding — http://localhost:${PORT}      ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);

  // Start auto-syncing calls
  if (RETELL_API_KEY) {
    setInterval(autoSyncCalls, SYNC_INTERVAL_MS);
    console.log('  Call auto-sync enabled (every 60s)\n');
  }
});
