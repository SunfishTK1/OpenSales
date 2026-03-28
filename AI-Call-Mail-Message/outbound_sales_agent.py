"""
Outbound Sales Agent Builder
============================
A Claude agent (via AWS Bedrock) that helps sales managers create and deploy
outbound AI voice agents on Retell AI.

Tools available to the agent:
  - create_outbound_sales_agent  — build a Retell voice agent from sales config
  - make_outbound_call           — place an outbound call with a created agent
  - list_sales_agents            — list all configured voice agents

Usage:
  1. Add RETELL_API_KEY to your .env file
  2. python outbound_sales_agent.py

The agent will conversationally gather your sales configuration and create
a fully configured outbound voice agent matching the call flow:

  Welcome → Confirm Identity → Qualify Lead → Pitch Product → Next Steps
  → Transfer to AE / Transfer to SE / Polite Close → End Call
"""

import os
import re
import json
import requests
from urllib.parse import quote

from retell_client import RetellClient
from sales_flow_builder import build_conversation_flow

# ─── Environment ──────────────────────────────────────────────────

_DIR = os.path.dirname(os.path.abspath(__file__))


def _load_env(name):
    for path in [os.path.join(_DIR, ".env"), os.path.join(os.path.dirname(_DIR), ".env")]:
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    m = re.match(rf'{name}\s*=\s*"?(.*?)"?\s*$', line)
                    if m:
                        v = m.group(1).strip('"')
                        if v:
                            return v
    return os.environ.get(name, "")


BED_ROCK_KEY = _load_env("Bed_Rock_Key")
if not BED_ROCK_KEY:
    raise RuntimeError("Bed_Rock_Key not found in .env")

MODEL_ID = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
REGION = "us-east-2"
BEDROCK_URL = (
    f"https://bedrock-runtime.{REGION}.amazonaws.com"
    f"/model/{quote(MODEL_ID, safe='')}/converse"
)
BEDROCK_HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {BED_ROCK_KEY}",
}

# ─── System Prompt ────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a Sales AI Configuration Assistant. You help sales managers \
create outbound AI voice agents that make sales calls on their behalf using Retell AI.

Your job is to gather the information needed to configure a complete outbound sales agent, \
then use the create_outbound_sales_agent tool to build it.

## Information to Collect

Guide the sales manager through providing:

1. **Company & Agent Identity**
   - Company name, product/service name
   - The AI caller's name and title
   - Lead source (how leads are acquired)

2. **Product Details for the Pitch**
   - Core value proposition (1-2 sentences)
   - 4-6 key features to highlight
   - Packaging tiers (if applicable)
   - "Don't mention unless asked" list (pricing, competitor comparisons, etc.)

3. **Qualification Criteria**
   - 3-5 qualifying questions with pass/fail thresholds
   - Fallback for unqualified leads (self-serve, nurture sequence, etc.)

4. **Transfer Routing**
   - Sales transfer: name, role, phone number (for demo/pricing requests)
   - Technical transfer: name, role, phone number (for technical deep-dives)

5. **Objection Handling**
   - Top 3-5 objections and scripted responses

6. **Close & Follow-up**
   - Follow-up email address
   - Collateral to send (one-pager, case study, etc.)
   - Follow-up timeline if transfer fails
   - CRM tags for outcomes

Be conversational. If they provide partial info, ask clarifying questions. \
Suggest reasonable defaults where appropriate. Once you have everything, \
call the create_outbound_sales_agent tool.

After creating an agent, you can use make_outbound_call to test it \
or list_sales_agents to see all agents."""

# ─── Tool Definitions (Bedrock Converse format) ──────────────────

TOOLS = [
    {
        "toolSpec": {
            "name": "create_outbound_sales_agent",
            "description": (
                "Create a fully configured outbound sales AI voice agent on Retell AI. "
                "The agent follows a standard sales call flow: Welcome → Confirm Identity "
                "→ Qualify Lead → Pitch Product → Next Steps → Transfer/Close. "
                "Takes all sales configuration and returns the created agent details."
            ),
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "company_name": {
                            "type": "string",
                            "description": "Company name",
                        },
                        "product_name": {
                            "type": "string",
                            "description": "Product or service name",
                        },
                        "caller_name": {
                            "type": "string",
                            "description": "The AI caller's display name (e.g., 'Sarah')",
                        },
                        "caller_title": {
                            "type": "string",
                            "description": "The AI caller's title (e.g., 'Business Development Representative')",
                        },
                        "lead_source": {
                            "type": "string",
                            "description": "How leads are acquired (e.g., 'demo request form', 'referral', 'webinar signup')",
                        },
                        "value_proposition": {
                            "type": "string",
                            "description": "Core value proposition in 1-2 sentences",
                        },
                        "key_features": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "4-6 key features to highlight during the pitch",
                        },
                        "packaging_tiers": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "description": {"type": "string"},
                                },
                                "required": ["name", "description"],
                            },
                            "description": "Product tiers/packages (optional)",
                        },
                        "do_not_mention_unless_asked": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Topics to avoid unless the prospect asks (e.g., 'pricing details', 'competitor comparisons')",
                        },
                        "qualification_questions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "question": {
                                        "type": "string",
                                        "description": "The qualification question to ask",
                                    },
                                    "threshold": {
                                        "type": "string",
                                        "description": "What constitutes a passing answer",
                                    },
                                },
                                "required": ["question", "threshold"],
                            },
                            "description": "3-5 qualifying questions with pass/fail thresholds",
                        },
                        "qualification_fallback": {
                            "type": "string",
                            "description": "What to offer leads who don't qualify (e.g., 'send to self-serve', 'add to nurture sequence')",
                        },
                        "sales_transfer_name": {
                            "type": "string",
                            "description": "Name of the person to transfer qualified/buying leads to",
                        },
                        "sales_transfer_role": {
                            "type": "string",
                            "description": "Role (e.g., 'Account Executive', 'Closer')",
                        },
                        "sales_transfer_phone": {
                            "type": "string",
                            "description": "Phone number in E.164 format (e.g., +11234567890)",
                        },
                        "technical_transfer_name": {
                            "type": "string",
                            "description": "Name of the person for technical deep-dives",
                        },
                        "technical_transfer_role": {
                            "type": "string",
                            "description": "Role (e.g., 'Solutions Engineer', 'Product Specialist')",
                        },
                        "technical_transfer_phone": {
                            "type": "string",
                            "description": "Phone number in E.164 format",
                        },
                        "objections": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "objection": {
                                        "type": "string",
                                        "description": "The objection the prospect raises",
                                    },
                                    "response": {
                                        "type": "string",
                                        "description": "The scripted response to the objection",
                                    },
                                },
                                "required": ["objection", "response"],
                            },
                            "description": "Common objections and scripted responses (3-5 recommended)",
                        },
                        "followup_email": {
                            "type": "string",
                            "description": "Email address for follow-ups when transfer fails",
                        },
                        "collateral_items": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Materials to send after the call (e.g., 'product one-pager', 'case study')",
                        },
                        "followup_timeline": {
                            "type": "string",
                            "description": "When to follow up if transfer fails (e.g., 'within 24 hours')",
                        },
                        "crm_tags": {
                            "type": "object",
                            "properties": {
                                "qualified": {"type": "string"},
                                "nurture": {"type": "string"},
                                "lost": {"type": "string"},
                                "transferred": {"type": "string"},
                            },
                            "description": "CRM tagging conventions for call outcomes",
                        },
                        "voice_id": {
                            "type": "string",
                            "description": "Retell voice ID (default: '11labs-Adrian'). Check Retell voice library for options.",
                        },
                    },
                    "required": [
                        "company_name",
                        "product_name",
                        "caller_name",
                        "caller_title",
                        "value_proposition",
                        "key_features",
                        "qualification_questions",
                        "sales_transfer_phone",
                        "technical_transfer_phone",
                    ],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "make_outbound_call",
            "description": (
                "Make an outbound sales call using a configured Retell voice agent. "
                "Requires an agent_id from a previously created agent and a Retell "
                "phone number to call from."
            ),
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "agent_id": {
                            "type": "string",
                            "description": "The Retell agent ID to use for this call",
                        },
                        "from_number": {
                            "type": "string",
                            "description": "Your Retell phone number in E.164 format (e.g., +11234567890)",
                        },
                        "to_number": {
                            "type": "string",
                            "description": "The prospect's phone number in E.164 format",
                        },
                        "customer_name": {
                            "type": "string",
                            "description": "The prospect's name (injected as dynamic variable)",
                        },
                        "customer_email": {
                            "type": "string",
                            "description": "The prospect's email (injected as dynamic variable)",
                        },
                        "prospect_company": {
                            "type": "string",
                            "description": "The prospect's company name",
                        },
                        "lead_source": {
                            "type": "string",
                            "description": "How the lead was acquired",
                        },
                        "lead_source_context": {
                            "type": "string",
                            "description": "Context about why we're calling (e.g., 'you signed up for a demo on our website')",
                        },
                    },
                    "required": ["agent_id", "from_number", "to_number", "customer_name"],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "list_sales_agents",
            "description": "List all configured Retell voice agents with their IDs, names, and status.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                }
            },
        }
    },
]

# ─── Tool Handlers ────────────────────────────────────────────────


def handle_create_outbound_sales_agent(params: dict) -> dict:
    """Create a Retell Conversation Flow + Agent from sales configuration."""
    try:
        client = RetellClient()
    except ValueError as e:
        return {"error": str(e)}

    # Step 1: Build and create the Conversation Flow
    flow_config = build_conversation_flow(params)

    try:
        flow_result = client.create_conversation_flow(flow_config)
    except requests.HTTPError as e:
        return {
            "error": f"Failed to create Conversation Flow: {e.response.status_code} — {e.response.text}"
        }

    cf_id = flow_result["conversation_flow_id"]

    # Step 2: Create the Agent
    voice_id = params.get("voice_id", "11labs-Adrian")
    agent_name = f"{params['company_name']} - {params['product_name']} Outbound Sales"

    try:
        agent_result = client.create_agent(
            voice_id=voice_id,
            conversation_flow_id=cf_id,
            agent_name=agent_name,
            language="en-US",
            enable_backchannel=True,
            backchannel_frequency=0.5,
            responsiveness=0.7,
            interruption_sensitivity=0.6,
        )
    except requests.HTTPError as e:
        return {
            "error": f"Failed to create Retell Agent: {e.response.status_code} — {e.response.text}",
            "conversation_flow_id": cf_id,
        }

    node_ids = [n["id"] for n in flow_config["nodes"]]

    return {
        "success": True,
        "agent_id": agent_result["agent_id"],
        "agent_name": agent_name,
        "conversation_flow_id": cf_id,
        "voice_id": voice_id,
        "call_flow_nodes": node_ids,
        "message": (
            f"Outbound sales agent created successfully! "
            f"Agent ID: {agent_result['agent_id']}. "
            f"Flow: {' → '.join(node_ids)}. "
            f"Use make_outbound_call with this agent_id to place calls."
        ),
    }


def handle_make_outbound_call(params: dict) -> dict:
    """Place an outbound call with a Retell agent."""
    try:
        client = RetellClient()
    except ValueError as e:
        return {"error": str(e)}

    dynamic_variables = {
        "customer_name": params.get("customer_name", "there"),
        "customer_email": params.get("customer_email", ""),
        "prospect_company": params.get("prospect_company", ""),
        "lead_source": params.get("lead_source", ""),
        "lead_source_context": params.get(
            "lead_source_context",
            f"we'd love to tell you about what we offer",
        ),
    }

    try:
        result = client.make_call(
            from_number=params["from_number"],
            to_number=params["to_number"],
            override_agent_id=params["agent_id"],
            dynamic_variables=dynamic_variables,
            metadata={
                "customer_name": params.get("customer_name", ""),
                "customer_email": params.get("customer_email", ""),
                "lead_source": params.get("lead_source", ""),
            },
        )
    except requests.HTTPError as e:
        return {
            "error": f"Failed to make call: {e.response.status_code} — {e.response.text}"
        }

    return {
        "success": True,
        "call_id": result.get("call_id"),
        "call_status": result.get("call_status"),
        "to_number": params["to_number"],
        "customer_name": params.get("customer_name"),
        "message": (
            f"Outbound call initiated to {params['to_number']} "
            f"(call ID: {result.get('call_id')})"
        ),
    }


def handle_list_sales_agents(_params: dict) -> dict:
    """List all Retell voice agents."""
    try:
        client = RetellClient()
    except ValueError as e:
        return {"error": str(e)}

    try:
        agents = client.list_agents()
    except requests.HTTPError as e:
        return {
            "error": f"Failed to list agents: {e.response.status_code} — {e.response.text}"
        }

    summary = [
        {
            "agent_id": a.get("agent_id"),
            "agent_name": a.get("agent_name", "(unnamed)"),
            "voice_id": a.get("voice_id"),
            "is_published": a.get("is_published"),
        }
        for a in agents
    ]

    return {
        "total": len(summary),
        "agents": summary,
    }


TOOL_HANDLERS = {
    "create_outbound_sales_agent": handle_create_outbound_sales_agent,
    "make_outbound_call": handle_make_outbound_call,
    "list_sales_agents": handle_list_sales_agents,
}

# ─── Agent Loop ───────────────────────────────────────────────────


def converse(messages: list) -> dict:
    """Send a Converse request with system prompt and tools."""
    resp = requests.post(
        BEDROCK_URL,
        json={
            "system": [{"text": SYSTEM_PROMPT}],
            "messages": messages,
            "toolConfig": {"tools": TOOLS},
        },
        headers=BEDROCK_HEADERS,
    )
    resp.raise_for_status()
    return resp.json()


def run_agent(user_prompt: str) -> str:
    """
    Run the agent loop: send prompt, handle tool calls, return final text.
    Loops until the model stops requesting tools.
    """
    messages = [{"role": "user", "content": [{"text": user_prompt}]}]

    while True:
        print(">>> Calling Claude...")
        data = converse(messages)

        assistant_msg = data["output"]["message"]
        stop_reason = data["stopReason"]
        messages.append(assistant_msg)

        if stop_reason != "tool_use":
            break

        # Process each tool call
        tool_results = []
        for block in assistant_msg["content"]:
            if "toolUse" not in block:
                continue
            tool = block["toolUse"]
            name, inputs = tool["name"], tool["input"]
            print(f"    Tool call: {name}")
            print(f"    Input:     {json.dumps(inputs, indent=2)[:500]}")

            handler = TOOL_HANDLERS.get(name)
            if handler:
                result = handler(inputs)
            else:
                result = {"error": f"Unknown tool: {name}"}
            print(f"    Result:    {json.dumps(result, indent=2)[:500]}")

            tool_results.append(
                {
                    "toolResult": {
                        "toolUseId": tool["toolUseId"],
                        "content": [{"json": result}],
                    }
                }
            )

        messages.append({"role": "user", "content": tool_results})

    # Extract final text
    final_text = ""
    for block in assistant_msg["content"]:
        if "text" in block:
            final_text += block["text"]
    return final_text


# ─── Interactive Mode ─────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  Outbound Sales Agent Builder")
    print("  Powered by Claude + Retell AI")
    print("=" * 60)
    print()
    print("Describe your sales team setup and I'll create an")
    print("outbound AI voice agent for you.")
    print("Type 'quit' to exit.")
    print()

    conversation = []

    while True:
        user_input = input("You: ").strip()
        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit", "q"):
            print("Goodbye!")
            break

        conversation.append(
            {"role": "user", "content": [{"text": user_input}]}
        )

        try:
            # Run the agent loop with the full conversation
            print("\n>>> Calling Claude...")
            data = converse(conversation)

            assistant_msg = data["output"]["message"]
            stop_reason = data["stopReason"]
            conversation.append(assistant_msg)

            # Handle tool calls in a loop
            while stop_reason == "tool_use":
                tool_results = []
                for block in assistant_msg["content"]:
                    if "toolUse" not in block:
                        continue
                    tool = block["toolUse"]
                    name, inputs = tool["name"], tool["input"]
                    print(f"    Tool call: {name}")

                    handler = TOOL_HANDLERS.get(name)
                    if handler:
                        result = handler(inputs)
                    else:
                        result = {"error": f"Unknown tool: {name}"}

                    status = "OK" if result.get("success") else "ERROR"
                    print(f"    Result:    {status}")

                    tool_results.append(
                        {
                            "toolResult": {
                                "toolUseId": tool["toolUseId"],
                                "content": [{"json": result}],
                            }
                        }
                    )

                conversation.append({"role": "user", "content": tool_results})
                data = converse(conversation)
                assistant_msg = data["output"]["message"]
                stop_reason = data["stopReason"]
                conversation.append(assistant_msg)

            # Print assistant response
            for block in assistant_msg["content"]:
                if "text" in block:
                    print(f"\nAssistant: {block['text']}\n")

        except requests.HTTPError as e:
            print(f"\nError: {e}\n")
        except Exception as e:
            print(f"\nUnexpected error: {e}\n")
