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

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║   OpenSales Onboarding — http://localhost:${PORT}      ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);
});
