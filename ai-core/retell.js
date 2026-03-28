/**
 * Retell AI Voice Agent Creator — Conversation Flow API
 * ======================================================
 * Creates a Retell Conversation Flow (rigid mode) matching this call flow:
 *
 *   Begin → Welcome Node → Correct User → User is Interested (pitch)
 *     ↓                        ↓              ↓        ↓         ↓
 *   Wrong User           (not interested)   Buy    Tech Qs    Not interested
 *     ↓                        ↓              ↓        ↓         ↓
 *   End Call              End Call        Transfer  Transfer   End Call
 *                                          to AE    to SE
 *                                            ↓        ↓
 *                                       Transfer Failed → End Call
 *
 * Node types used: conversation, transfer_call, end
 * Requires RETELL_API_KEY in .env
 */

const RETELL_BASE = 'https://api.retellai.com';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a Retell Conversation Flow + Voice Agent from onboarding config.
 *
 * @param {object} config - The <CONFIG_COMPLETE> JSON from the interrogation agent
 * @returns {{ agentId, agentName, conversationFlowId, voiceId, nodes }}
 */
export async function createRetellVoiceAgent(config) {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) throw new Error('RETELL_API_KEY not set in .env');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  // Step 1 — Build and create the Conversation Flow
  const flowConfig = buildConversationFlow(config);
  const flowRes = await fetch(`${RETELL_BASE}/create-conversation-flow`, {
    method: 'POST',
    headers,
    body: JSON.stringify(flowConfig),
  });
  if (!flowRes.ok) {
    const err = await flowRes.text();
    throw new Error(`Retell create-conversation-flow failed (${flowRes.status}): ${err}`);
  }
  const flow = await flowRes.json();

  // Step 2 — Create the voice agent using the conversation flow
  const agentName = `${config.company_identity.company_name} — ${config.company_identity.product_name} Outbound`;
  const voiceId = config.voice_id || '11labs-Adrian';

  const webhookUrl = process.env.WEBHOOK_URL;

  const agentPayload = {
    voice_id: voiceId,
    response_engine: {
      type: 'conversation-flow',
      conversation_flow_id: flow.conversation_flow_id,
    },
    agent_name: agentName,
    language: 'en-US',
    enable_backchannel: true,
    backchannel_frequency: 0.5,
    responsiveness: 0.7,
    interruption_sensitivity: 0.6,
    ...(webhookUrl && { webhook_url: webhookUrl }),
  };

  const agentRes = await fetch(`${RETELL_BASE}/create-agent`, {
    method: 'POST',
    headers,
    body: JSON.stringify(agentPayload),
  });
  if (!agentRes.ok) {
    const err = await agentRes.text();
    throw new Error(`Retell create-agent failed (${agentRes.status}): ${err}`);
  }
  const agent = await agentRes.json();

  return {
    agentId: agent.agent_id,
    agentName,
    conversationFlowId: flow.conversation_flow_id,
    voiceId,
    nodes: flowConfig.nodes.map((n) => `${n.id} (${n.type})`),
  };
}

// ─── Conversation Flow Builder ──────────────────────────────────────────────

function buildConversationFlow(cfg) {
  const ci = cfg.company_identity;
  const pd = cfg.product_details;
  const qual = cfg.qualification;
  const tr = cfg.transfer_routing;
  const oh = cfg.objection_handling || [];
  const fu = cfg.follow_up;

  return {
    start_speaker: 'agent',
    model_choice: {
      type: 'cascading',
      model: 'gpt-5.4-mini',
    },
    global_prompt: buildGlobalPrompt(ci, pd, oh),
    start_node_id: 'welcome',
    default_dynamic_variables: {
      customer_name: 'there',
      customer_email: '',
      lead_source: '',
      prospect_company: '',
      lead_source_context: `your interest in ${ci.product_name}`,
    },
    nodes: buildNodes(ci, pd, qual, tr, oh, fu),
  };
}

// ─── Global Prompt ──────────────────────────────────────────────────────────

function buildGlobalPrompt(ci, pd, oh) {
  const doNotMention = (pd.do_not_mention || [])
    .map((d) => `- ${d}`)
    .join('\n');

  const objections = oh
    .map((o) => `- If they say: "${o.objection}" → Respond: "${o.response}"`)
    .join('\n');

  return `## Style
You are ${ci.rep_name} from ${ci.company_name}, calling a user over the phone.

## Communication style
Natural, fluent, conversational language that is clear and easy to follow (short sentences, simple words); extremely friendly and chummy; polite; casual, informal and professional.

## Guardrails
The user transcript can contain transcription errors. Do your best to guess and respond when there's errors.

## Company Context
- Company: ${ci.company_name}
- Product: ${ci.product_name}
- Value Proposition: ${pd.value_proposition}

## Topics to Avoid (unless the prospect asks directly)
${doNotMention || '(none specified)'}

## Objection Handling
${objections || '(handle objections naturally)'}
`;
}

// ─── Nodes ──────────────────────────────────────────────────────────────────

function buildNodes(ci, pd, qual, tr, oh, fu) {
  const aeName = tr.closer?.role || 'Account Executive';
  const aePhone = tr.closer?.phone || '+18455448228';
  const seName = tr.technical?.role || 'Solutions Engineer';
  const sePhone = tr.technical?.phone || '+18455448228';
  const collateral = (fu.collateral || ['some resources']).join(', ');
  const followupTl = fu.follow_up_timeline || 'within 24 hours';
  const followupEmail = fu.reengagement_email || '';

  // Build the pitch text from features
  const features = (pd.key_features || [])
    .map((f) => (typeof f === 'string' ? f : f.name || String(f)))
    .join(', ');

  const tiers = (pd.tiers || [])
    .map((t) => (typeof t === 'string' ? t : `${t.name}: ${t.description}`))
    .join('; ');

  // Qualification questions for the correct_user/qualify node
  const qualQuestions = normalizeQualQuestions(qual);
  const qualBlock = qualQuestions
    .map((q, i) => `${i + 1}. ${q.question} (Looking for: ${q.threshold})`)
    .join('\n');

  const fallback = qual.fallback_path || 'Offer to send them some helpful resources.';

  return [
    // ── 1. Welcome Node (conversation) ────────────────────────
    {
      id: 'welcome',
      type: 'conversation',
      instruction: {
        type: 'prompt',
        text: `Hi, this is ${ci.rep_name} from ${ci.company_name}. I'm reaching out regarding {{lead_source_context}}. Am I speaking with {{customer_name}}?`,
      },
      edges: [
        {
          id: 'edge_welcome_correct',
          destination_node_id: 'correct_user',
          transition_condition: {
            type: 'prompt',
            prompt: 'Yes the user is the intended recipient',
          },
        },
        {
          id: 'edge_welcome_wrong',
          destination_node_id: 'wrong_user',
          transition_condition: {
            type: 'prompt',
            prompt: 'No the user is not the intended recipient',
          },
        },
      ],
    },

    // ── 2. Correct User (conversation) ────────────────────────
    {
      id: 'correct_user',
      type: 'conversation',
      instruction: {
        type: 'prompt',
        text: `I'm following up to see if you're still evaluating ${ci.product_name} for your team?\n\nIf they confirm interest, qualify them by naturally asking:\n${qualBlock}`,
      },
      edges: [
        {
          id: 'edge_correct_interested',
          destination_node_id: 'user_interested',
          transition_condition: {
            type: 'prompt',
            prompt: 'Yes, the user is still interested',
          },
        },
        {
          id: 'edge_correct_not_interested',
          destination_node_id: 'user_not_interested',
          transition_condition: {
            type: 'prompt',
            prompt: "No, the user doesn't need anymore",
          },
        },
      ],
    },

    // ── 3. Wrong User (conversation) ──────────────────────────
    {
      id: 'wrong_user',
      type: 'conversation',
      instruction: {
        type: 'prompt',
        text: "No worries at all — I apologize for the mix-up, have a great day!",
      },
      skip_response_edge: {
        id: 'edge_wrong_end',
        destination_node_id: 'end_call',
        transition_condition: { type: 'prompt', prompt: 'Skip response' },
      },
    },

    // ── 4. User is Interested / Pitch (conversation) ──────────
    {
      id: 'user_interested',
      type: 'conversation',
      instruction: {
        type: 'prompt',
        text: `${ci.product_name} is built for teams that need ${pd.value_proposition}

You get ${features}.${tiers ? `\n\nTiers available: ${tiers}` : ''}

Based on what you shared about your team, I think the most relevant features would be especially valuable for you.`,
      },
      edges: [
        {
          id: 'edge_interested_buy',
          destination_node_id: 'pre_transfer_ae',
          transition_condition: {
            type: 'prompt',
            prompt: 'The user wants to buy',
          },
        },
        {
          id: 'edge_interested_questions',
          destination_node_id: 'user_need_help',
          transition_condition: {
            type: 'prompt',
            prompt: 'The user has questions that are not in the context',
          },
        },
        {
          id: 'edge_interested_not',
          destination_node_id: 'user_not_interested',
          transition_condition: {
            type: 'prompt',
            prompt: 'The user is not interested',
          },
        },
      ],
    },

    // ── 5. Pre-Transfer AE announcement (conversation) ────────
    {
      id: 'pre_transfer_ae',
      type: 'conversation',
      instruction: {
        type: 'prompt',
        text: `Excellent — let me connect you with one of our ${aeName}s who can walk you through a custom proposal and get a demo scheduled.\n\nOne moment please.`,
      },
      skip_response_edge: {
        id: 'edge_pre_ae_transfer',
        destination_node_id: 'transfer_ae',
        transition_condition: { type: 'prompt', prompt: 'Skip response' },
      },
    },

    // ── 6. Transfer to AE (transfer_call) ─────────────────────
    {
      id: 'transfer_ae',
      type: 'transfer_call',
      transfer_destination: {
        type: 'predefined',
        number: aePhone,
      },
      transfer_option: {
        type: 'warm_transfer',
      },
      edge: {
        id: 'edge_ae_failed',
        destination_node_id: 'transfer_failed',
        transition_condition: {
          type: 'prompt',
          prompt: 'Transfer failed',
        },
      },
    },

    // ── 7. User Needs More Help (conversation) ────────────────
    {
      id: 'user_need_help',
      type: 'conversation',
      instruction: {
        type: 'prompt',
        text: `Great questions — let me connect you with a ${seName} who can go deeper on the architecture and integration specifics.\n\nOne moment please.`,
      },
      skip_response_edge: {
        id: 'edge_help_transfer',
        destination_node_id: 'transfer_se',
        transition_condition: { type: 'prompt', prompt: 'Skip response' },
      },
    },

    // ── 8. Transfer to SE (transfer_call) ─────────────────────
    {
      id: 'transfer_se',
      type: 'transfer_call',
      transfer_destination: {
        type: 'predefined',
        number: sePhone,
      },
      transfer_option: {
        type: 'warm_transfer',
      },
      edge: {
        id: 'edge_se_failed',
        destination_node_id: 'transfer_failed',
        transition_condition: {
          type: 'prompt',
          prompt: 'Transfer failed',
        },
      },
    },

    // ── 9. User Not Interested (conversation) ─────────────────
    {
      id: 'user_not_interested',
      type: 'conversation',
      instruction: {
        type: 'prompt',
        text: `No problem at all. I'll send over ${collateral} so you have it on file. If anything changes, you can reach us anytime at ${followupEmail || '{{customer_email}}'}.\n\nThanks for your time — have a great day!`,
      },
      skip_response_edge: {
        id: 'edge_not_interested_end',
        destination_node_id: 'end_call',
        transition_condition: { type: 'prompt', prompt: 'Skip response' },
      },
    },

    // ── 10. Transfer Failed (conversation) ────────────────────
    {
      id: 'transfer_failed',
      type: 'conversation',
      instruction: {
        type: 'prompt',
        text: `It looks like our team is currently unavailable. I'll have them reach out to you via email ${followupTl} with everything we discussed.\n\nCan I confirm your best email is {{customer_email}}?`,
      },
      skip_response_edge: {
        id: 'edge_failed_end',
        destination_node_id: 'end_call',
        transition_condition: { type: 'prompt', prompt: 'Skip response' },
      },
    },

    // ── 11. End Call (end) ─────────────────────────────────────
    {
      id: 'end_call',
      type: 'end',
    },
  ];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeQualQuestions(qual) {
  const questions = qual.questions || [];
  const thresholds = qual.thresholds || {};

  if (questions.length > 0 && typeof questions[0] === 'object' && questions[0].question) {
    return questions;
  }

  const thresholdValues = Object.values(thresholds);
  return questions.map((q, i) => ({
    question: typeof q === 'string' ? q : String(q),
    threshold: thresholdValues[i] || 'Use your judgment',
  }));
}
