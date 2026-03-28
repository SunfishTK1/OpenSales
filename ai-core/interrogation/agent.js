import 'dotenv/config';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

// ─── Clients ─────────────────────────────────────────────────────────────────

const BEDROCK_API_KEY = process.env.BEDROCK_API_KEY;
const BEDROCK_REGION = process.env.AWS_REGION || 'us-east-1';
const MODEL = 'us.anthropic.claude-3-5-haiku-20241022-v1:0';
const BEDROCK_URL = `https://bedrock-runtime.${BEDROCK_REGION}.amazonaws.com/model/${MODEL}/invoke`;

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

Start by warmly greeting the user, explaining you'll be gathering their company configuration in 7 sections, and ask for section 1 (company identity).`;

// ─── Conversation loop ────────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages = [];

function ask(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function chat(userMessage) {
  messages.push({ role: 'user', content: userMessage });

  const res = await fetch(BEDROCK_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BEDROCK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));

  const assistantText = data.content[0].text;
  messages.push({ role: 'assistant', content: assistantText });
  return assistantText;
}

function extractConfig(text) {
  const match = text.match(/<CONFIG_COMPLETE>([\s\S]*?)<\/CONFIG_COMPLETE>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
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

  const { data, error } = await supabase
    .from('company_config')
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║        OpenSales — Company Onboarding Agent         ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Kick off with an empty first message to get the agent's greeting
  const greeting = await chat('Hello, I am ready to configure my company.');
  console.log(`\nAgent: ${greeting}\n`);

  while (true) {
    const userInput = await ask('You: ');

    if (!userInput.trim()) continue;
    if (['exit', 'quit', 'q'].includes(userInput.toLowerCase())) {
      console.log('\nExiting. Configuration not saved.');
      break;
    }

    const response = await chat(userInput);
    console.log(`\nAgent: ${response}\n`);

    const config = extractConfig(response);
    if (config) {
      console.log('\n--- Configuration extracted. Saving to database... ---\n');
      try {
        const saved = await saveConfig(config);
        console.log(`\n✓ Configuration saved! Record ID: ${saved.id}`);
        console.log('  Company:', saved.company_name);
        console.log('  Product:', saved.product_name);
        console.log('\nOnboarding complete. Your AI sales agent is configured.\n');
      } catch (err) {
        console.error('\n✗ Failed to save config:', err.message);
        console.log('\nExtracted config (copy this manually):\n');
        console.log(JSON.stringify(config, null, 2));
      }
      break;
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
