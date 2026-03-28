"""
Sales Flow Builder — Conversation Flow API
===========================================
Converts a sales manager's configuration into a Retell Conversation Flow
with distinct node types (conversation, transfer_call, end) in rigid mode.

Flow:
  Begin → Welcome → Correct User → User Interested (pitch)
    ↓                    ↓              ↓       ↓        ↓
  Wrong User        (not needed)     Buy    Tech Qs   Not interested
    ↓                    ↓              ↓       ↓        ↓
  End Call           End Call      Transfer Transfer   End Call
                                   to AE    to SE
                                     ↓       ↓
                                 Transfer Failed → End Call
"""


def build_conversation_flow(config: dict) -> dict:
    """
    Build a Retell Conversation Flow config from sales manager input.

    Args:
        config: dict with keys: company_name, product_name, caller_name,
                caller_title, value_proposition, key_features,
                qualification_questions, sales_transfer_phone, etc.

    Returns:
        dict ready to POST to /create-conversation-flow
    """
    return {
        "start_speaker": "agent",
        "model_choice": {
            "type": "cascading",
            "model": "gpt-4.1-mini",
        },
        "global_prompt": _build_global_prompt(config),
        "start_node_id": "welcome",
        "default_dynamic_variables": _build_dynamic_variables(config),
        "nodes": _build_nodes(config),
    }


# ─── Global Prompt ───────────────────────────────────────────────


def _build_global_prompt(c: dict) -> str:
    do_not_mention = "\n".join(
        f"- {item}" for item in c.get("do_not_mention_unless_asked", [])
    )
    objections = "\n".join(
        f'- If they say: "{o["objection"]}" → Respond: "{o["response"]}"'
        for o in c.get("objections", [])
    )

    return f"""## Style
You are {c['caller_name']} from {c['company_name']}, calling a user over the phone.

## Communication style
Natural, fluent, conversational language that is clear and easy to follow (short sentences, simple words); extremely friendly and chummy; polite; casual, informal and professional.

## Guardrails
The user transcript can contain transcription errors. Do your best to guess and respond when there's errors.

## Company Context
- Company: {c['company_name']}
- Product: {c['product_name']}
- Value Proposition: {c['value_proposition']}

## Topics to Avoid (unless the prospect asks directly)
{do_not_mention or '(none specified)'}

## Objection Handling
{objections or '(handle objections naturally)'}
"""


# ─── Nodes ───────────────────────────────────────────────────────


def _build_nodes(c: dict) -> list:
    ae_name = c.get("sales_transfer_name", "Account Executive")
    ae_role = c.get("sales_transfer_role", "Account Executive")
    ae_phone = c.get("sales_transfer_phone", "")
    se_name = c.get("technical_transfer_name", "Solutions Engineer")
    se_role = c.get("technical_transfer_role", "Solutions Engineer")
    se_phone = c.get("technical_transfer_phone", "")
    collateral = ", ".join(c.get("collateral_items", ["some resources"]))
    followup_tl = c.get("followup_timeline", "within 24 hours")
    followup_email = c.get("followup_email", "")

    features = ", ".join(c.get("key_features", []))

    tiers = c.get("packaging_tiers", [])
    tiers_str = ""
    if tiers:
        tiers_str = "\n\nTiers available: " + "; ".join(
            t["name"] + ": " + t["description"] if isinstance(t, dict) else str(t)
            for t in tiers
        )

    qual_qs = c.get("qualification_questions", [])
    qual_block = "\n".join(
        f'{i+1}. {q["question"]} (Looking for: {q["threshold"]})'
        for i, q in enumerate(qual_qs)
    )
    fallback = c.get(
        "qualification_fallback",
        "Offer to send them some helpful resources.",
    )

    return [
        # ── 1. Welcome ────────────────────────────────────────
        {
            "id": "welcome",
            "type": "conversation",
            "instruction": {
                "type": "prompt",
                "text": (
                    f"Hi, this is {c['caller_name']} from {c['company_name']}. "
                    f"I'm reaching out regarding {{{{lead_source_context}}}}. "
                    f"Am I speaking with {{{{customer_name}}}}?"
                ),
            },
            "edges": [
                {
                    "id": "edge_welcome_correct",
                    "destination_node_id": "correct_user",
                    "transition_condition": {
                        "type": "prompt",
                        "prompt": "Yes the user is the intended recipient",
                    },
                },
                {
                    "id": "edge_welcome_wrong",
                    "destination_node_id": "wrong_user",
                    "transition_condition": {
                        "type": "prompt",
                        "prompt": "No the user is not the intended recipient",
                    },
                },
            ],
        },
        # ── 2. Correct User ───────────────────────────────────
        {
            "id": "correct_user",
            "type": "conversation",
            "instruction": {
                "type": "prompt",
                "text": (
                    f"I'm following up to see if you're still evaluating "
                    f"{c['product_name']} for your team?\n\n"
                    f"If they confirm interest, qualify them by naturally asking:\n"
                    f"{qual_block}"
                ),
            },
            "edges": [
                {
                    "id": "edge_correct_interested",
                    "destination_node_id": "user_interested",
                    "transition_condition": {
                        "type": "prompt",
                        "prompt": "Yes, the user is still interested",
                    },
                },
                {
                    "id": "edge_correct_not",
                    "destination_node_id": "user_not_interested",
                    "transition_condition": {
                        "type": "prompt",
                        "prompt": "No, the user doesn't need anymore",
                    },
                },
            ],
        },
        # ── 3. Wrong User ─────────────────────────────────────
        {
            "id": "wrong_user",
            "type": "conversation",
            "instruction": {
                "type": "prompt",
                "text": "No worries at all — I apologize for the mix-up, have a great day!",
            },
            "skip_response_edge": {
                "id": "edge_wrong_end",
                "destination_node_id": "end_call",
                "transition_condition": {"type": "prompt", "prompt": "Skip response"},
            },
        },
        # ── 4. User Interested / Pitch ────────────────────────
        {
            "id": "user_interested",
            "type": "conversation",
            "instruction": {
                "type": "prompt",
                "text": (
                    f"{c['product_name']} is built for teams that need "
                    f"{c['value_proposition']}\n\n"
                    f"You get {features}.{tiers_str}\n\n"
                    f"Based on what you shared about your team, I think the "
                    f"most relevant features would be especially valuable for you."
                ),
            },
            "edges": [
                {
                    "id": "edge_interested_buy",
                    "destination_node_id": "pre_transfer_ae",
                    "transition_condition": {
                        "type": "prompt",
                        "prompt": "The user wants to buy",
                    },
                },
                {
                    "id": "edge_interested_questions",
                    "destination_node_id": "user_need_help",
                    "transition_condition": {
                        "type": "prompt",
                        "prompt": "The user has questions that are not in the context",
                    },
                },
                {
                    "id": "edge_interested_not",
                    "destination_node_id": "user_not_interested",
                    "transition_condition": {
                        "type": "prompt",
                        "prompt": "The user is not interested",
                    },
                },
            ],
        },
        # ── 5. Pre-Transfer AE ────────────────────────────────
        {
            "id": "pre_transfer_ae",
            "type": "conversation",
            "instruction": {
                "type": "prompt",
                "text": (
                    f"Excellent — let me connect you with one of our "
                    f"{ae_role}s who can walk you through a custom proposal "
                    f"and get a demo scheduled.\n\nOne moment please."
                ),
            },
            "skip_response_edge": {
                "id": "edge_pre_ae_transfer",
                "destination_node_id": "transfer_ae",
                "transition_condition": {"type": "prompt", "prompt": "Skip response"},
            },
        },
        # ── 6. Transfer to AE (transfer_call) ─────────────────
        {
            "id": "transfer_ae",
            "type": "transfer_call",
            "transfer_destination": {
                "type": "predefined",
                "number": ae_phone,
            },
            "transfer_option": {
                "type": "cold_transfer",
            },
            "edge": {
                "id": "edge_ae_failed",
                "destination_node_id": "transfer_failed",
                "transition_condition": {
                    "type": "prompt",
                    "prompt": "Transfer failed",
                },
            },
        },
        # ── 7. User Needs Help (conversation) ─────────────────
        {
            "id": "user_need_help",
            "type": "conversation",
            "instruction": {
                "type": "prompt",
                "text": (
                    f"Great questions — let me connect you with a {se_role} "
                    f"who can go deeper on the architecture and integration "
                    f"specifics.\n\nOne moment please."
                ),
            },
            "skip_response_edge": {
                "id": "edge_help_transfer",
                "destination_node_id": "transfer_se",
                "transition_condition": {"type": "prompt", "prompt": "Skip response"},
            },
        },
        # ── 8. Transfer to SE (transfer_call) ─────────────────
        {
            "id": "transfer_se",
            "type": "transfer_call",
            "transfer_destination": {
                "type": "predefined",
                "number": se_phone,
            },
            "transfer_option": {
                "type": "cold_transfer",
            },
            "edge": {
                "id": "edge_se_failed",
                "destination_node_id": "transfer_failed",
                "transition_condition": {
                    "type": "prompt",
                    "prompt": "Transfer failed",
                },
            },
        },
        # ── 9. User Not Interested (conversation) ─────────────
        {
            "id": "user_not_interested",
            "type": "conversation",
            "instruction": {
                "type": "prompt",
                "text": (
                    f"No problem at all. I'll send over {collateral} so you "
                    f"have it on file. If anything changes, you can reach us "
                    f"anytime at {followup_email or '{{{{customer_email}}}}'}.\n\n"
                    f"Thanks for your time — have a great day!"
                ),
            },
            "skip_response_edge": {
                "id": "edge_not_interested_end",
                "destination_node_id": "end_call",
                "transition_condition": {"type": "prompt", "prompt": "Skip response"},
            },
        },
        # ── 10. Transfer Failed (conversation) ────────────────
        {
            "id": "transfer_failed",
            "type": "conversation",
            "instruction": {
                "type": "prompt",
                "text": (
                    f"It looks like our team is currently unavailable. "
                    f"I'll have them reach out to you via email {followup_tl} "
                    f"with everything we discussed.\n\n"
                    f"Can I confirm your best email is {{{{customer_email}}}}?"
                ),
            },
            "skip_response_edge": {
                "id": "edge_failed_end",
                "destination_node_id": "end_call",
                "transition_condition": {"type": "prompt", "prompt": "Skip response"},
            },
        },
        # ── 11. End Call (end) ─────────────────────────────────
        {
            "id": "end_call",
            "type": "end",
        },
    ]


# ─── Dynamic Variables ───────────────────────────────────────────


def _build_dynamic_variables(c: dict) -> dict:
    dv = c.get("dynamic_variables", {})
    return {
        "customer_name": dv.get("customer_name", "there"),
        "customer_email": dv.get("customer_email", ""),
        "lead_source": dv.get("lead_source", ""),
        "prospect_company": dv.get("company_name", ""),
        "lead_source_context": dv.get(
            "lead_source_context",
            f"your interest in {c['product_name']}",
        ),
    }
