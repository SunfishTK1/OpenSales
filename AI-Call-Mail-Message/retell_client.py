"""
Retell AI API client for managing voice agents, LLMs, and phone calls.

Requires RETELL_API_KEY in .env or as an environment variable.
"""

import os
import re
import requests

_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_URL = "https://api.retellai.com"


def _load_env(name):
    """Load a variable from .env (checks script dir, then parent dir, then env vars)."""
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


class RetellClient:
    """Thin wrapper around the Retell AI REST API."""

    def __init__(self, api_key: str = None):
        self.api_key = api_key or _load_env("RETELL_API_KEY")
        if not self.api_key:
            raise ValueError(
                "RETELL_API_KEY not set. Add it to .env or pass it directly."
            )
        self._headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

    # ── Conversation Flow ───────────────────────────────────────

    def create_conversation_flow(self, config: dict) -> dict:
        """POST /create-conversation-flow — create a conversation flow with nodes."""
        r = requests.post(
            f"{BASE_URL}/create-conversation-flow",
            json=config,
            headers=self._headers,
        )
        r.raise_for_status()
        return r.json()

    # ── Agent ────────────────────────────────────────────────────

    def create_agent(
        self,
        voice_id: str,
        conversation_flow_id: str,
        agent_name: str = None,
        **kwargs,
    ) -> dict:
        """POST /create-agent — create a voice agent tied to a conversation flow."""
        payload = {
            "voice_id": voice_id,
            "response_engine": {
                "type": "conversation-flow",
                "conversation_flow_id": conversation_flow_id,
            },
        }
        if agent_name:
            payload["agent_name"] = agent_name
        payload.update(kwargs)
        r = requests.post(
            f"{BASE_URL}/create-agent", json=payload, headers=self._headers
        )
        r.raise_for_status()
        return r.json()

    def list_agents(self, limit: int = 100) -> list:
        """GET /list-agents — list all voice agents."""
        r = requests.get(
            f"{BASE_URL}/list-agents",
            params={"limit": limit},
            headers=self._headers,
        )
        r.raise_for_status()
        return r.json()

    # ── Phone calls ──────────────────────────────────────────────

    def make_call(
        self,
        from_number: str,
        to_number: str,
        override_agent_id: str = None,
        dynamic_variables: dict = None,
        metadata: dict = None,
    ) -> dict:
        """POST /v2/create-phone-call — initiate an outbound call."""
        payload = {"from_number": from_number, "to_number": to_number}
        if override_agent_id:
            payload["override_agent_id"] = override_agent_id
        if dynamic_variables:
            payload["retell_llm_dynamic_variables"] = dynamic_variables
        if metadata:
            payload["metadata"] = metadata
        r = requests.post(
            f"{BASE_URL}/v2/create-phone-call", json=payload, headers=self._headers
        )
        r.raise_for_status()
        return r.json()
