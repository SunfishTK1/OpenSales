"""
Tool use (function calling) with Claude Sonnet via AWS Bedrock Converse API.
Demonstrates defining tools, handling tool_use responses, and sending tool results back.
"""

import os
import re
import json
import requests
from urllib.parse import quote

# Read API key from .env file
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
with open(ENV_PATH) as f:
    for line in f:
        m = re.match(r'Bed_Rock_Key\s*=\s*"?(.*?)"?\s*$', line)
        if m:
            API_KEY = m.group(1).strip('"')
            break
    else:
        raise RuntimeError("Bed_Rock_Key not found in .env")

MODEL_ID = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
REGION = "us-east-2"
BASE_URL = f"https://bedrock-runtime.{REGION}.amazonaws.com"
CONVERSE_URL = f"{BASE_URL}/model/{quote(MODEL_ID, safe='')}/converse"
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}",
}

# ─── Tool definitions ──────────────────────────────────────────

TOOLS = [
    {
        "toolSpec": {
            "name": "get_weather",
            "description": "Get the current weather for a given city.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                            "description": "The city name, e.g. 'San Francisco'",
                        },
                        "unit": {
                            "type": "string",
                            "enum": ["celsius", "fahrenheit"],
                            "description": "Temperature unit (default: fahrenheit)",
                        },
                    },
                    "required": ["city"],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "get_stock_price",
            "description": "Get the current stock price for a given ticker symbol.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "ticker": {
                            "type": "string",
                            "description": "Stock ticker symbol, e.g. 'AAPL'",
                        }
                    },
                    "required": ["ticker"],
                }
            },
        }
    },
]


# ─── Fake tool implementations (replace with real APIs) ────────

def fake_get_weather(city: str, unit: str = "fahrenheit") -> dict:
    return {"city": city, "temperature": 72, "unit": unit, "condition": "sunny"}


def fake_get_stock_price(ticker: str) -> dict:
    return {"ticker": ticker, "price": 185.42, "currency": "USD"}


TOOL_HANDLERS = {
    "get_weather": fake_get_weather,
    "get_stock_price": fake_get_stock_price,
}


# ─── Agentic tool-use loop ─────────────────────────────────────

def converse(messages: list) -> dict:
    """Send a Converse request with tool config."""
    resp = requests.post(
        CONVERSE_URL,
        json={"messages": messages, "toolConfig": {"tools": TOOLS}},
        headers=HEADERS,
    )
    resp.raise_for_status()
    return resp.json()


def run_tool_loop(user_prompt: str) -> str:
    """
    Send a prompt, handle any tool calls the model makes, return final text.
    Loops until the model stops requesting tools.
    """
    messages = [
        {"role": "user", "content": [{"text": user_prompt}]}
    ]

    while True:
        print(">>> Calling model...")
        data = converse(messages)

        assistant_msg = data["output"]["message"]
        stop_reason = data["stopReason"]
        messages.append(assistant_msg)

        # If the model didn't request tools, we're done
        if stop_reason != "tool_use":
            break

        # Process each tool call
        tool_results = []
        for block in assistant_msg["content"]:
            if "toolUse" not in block:
                continue
            tool = block["toolUse"]
            name, inputs = tool["name"], tool["input"]
            print(f"    Tool call: {name}({json.dumps(inputs)})")

            handler = TOOL_HANDLERS.get(name)
            if handler:
                result = handler(**inputs)
            else:
                result = {"error": f"Unknown tool: {name}"}
            print(f"    Result:    {json.dumps(result)}")

            tool_results.append({
                "toolResult": {
                    "toolUseId": tool["toolUseId"],
                    "content": [{"json": result}],
                }
            })

        # Send tool results back as a user message
        messages.append({"role": "user", "content": tool_results})

    # Extract final text
    final_text = ""
    for block in assistant_msg["content"]:
        if "text" in block:
            final_text += block["text"]
    return final_text


if __name__ == "__main__":
    prompt = "What's the weather in San Francisco and the current price of AAPL stock?"
    print(f"Prompt: {prompt}\n")

    answer = run_tool_loop(prompt)
    print(f"\nFinal answer:\n{answer}")
