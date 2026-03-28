"""
Simple call to Claude Sonnet via AWS Bedrock using the Bedrock API Key.
"""

import os
import re
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


def simple_call(prompt: str) -> str:
    """Send a single message to Claude via Bedrock Converse API."""
    url = f"{BASE_URL}/model/{quote(MODEL_ID, safe='')}/converse"

    response = requests.post(
        url,
        json={
            "messages": [
                {"role": "user", "content": [{"text": prompt}]}
            ]
        },
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
    )
    response.raise_for_status()
    data = response.json()

    text = data["output"]["message"]["content"][0]["text"]
    return text


if __name__ == "__main__":
    prompt = "What is the capital of France? Answer in one sentence."
    print(f"Prompt: {prompt}\n")

    answer = simple_call(prompt)
    print(f"Response: {answer}")
