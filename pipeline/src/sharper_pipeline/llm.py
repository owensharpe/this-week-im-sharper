"""Provider-agnostic LLM gateway.

One function — `generate(prompt, system=None) -> str` — that the rest of the
pipeline calls. The provider is selected by the `LLM_PROVIDER` env var:

  - "gemini"    (default)  Gemini 2.5 Flash, free tier covers daily volume
  - "anthropic"            Claude Sonnet, swap here when Northeastern comes through
  - "deepseek"             DeepSeek V3, optional A/B candidate

Required env vars per provider:
  gemini    -> GEMINI_API_KEY
  anthropic -> ANTHROPIC_API_KEY
  deepseek  -> DEEPSEEK_API_KEY

Failures are surfaced as `LLMError`. Caller decides whether to fall back to
the stub briefing (describe.py does this per-cluster so one bad call doesn't
sink the whole digest).
"""

from __future__ import annotations

import logging
import os
import time
from typing import Callable

import requests

log = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """Raised when the LLM call fails after retries."""


# public API
def generate(prompt: str, system: str | None = None) -> str:
    """Send `prompt` to the configured provider and return the text response.

    Retries 3x on transient errors (429, 5xx, timeouts) with exponential
    backoff. Raises LLMError on permanent failure.
    """
    provider = os.environ.get("LLM_PROVIDER", "gemini").lower().strip()
    try:
        call = _PROVIDERS[provider]
    except KeyError as exc:
        raise LLMError(
            f"unknown LLM_PROVIDER={provider!r}; expected one of "
            f"{sorted(_PROVIDERS)}"
        ) from exc

    return _with_retries(lambda: call(prompt, system))


# providers
def _gemini(prompt: str, system: str | None) -> str:
    api_key = _require_env("GEMINI_API_KEY")
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )

    body: dict = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1024,
            "responseMimeType": "application/json",
        },
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}

    resp = requests.post(url, json=body, timeout=60)
    _raise_for_status(resp)
    data = resp.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise LLMError(f"unexpected Gemini response shape: {data!r}") from exc


def _anthropic(prompt: str, system: str | None) -> str:
    api_key = _require_env("ANTHROPIC_API_KEY")
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    url = "https://api.anthropic.com/v1/messages"

    body: dict = {
        "model": model,
        "max_tokens": 1024,
        "temperature": 0.2,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        body["system"] = system

    resp = requests.post(
        url,
        json=body,
        timeout=60,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    _raise_for_status(resp)
    data = resp.json()
    try:
        return data["content"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise LLMError(f"unexpected Anthropic response shape: {data!r}") from exc


def _deepseek(prompt: str, system: str | None) -> str:
    api_key = _require_env("DEEPSEEK_API_KEY")
    model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
    url = "https://api.deepseek.com/chat/completions"

    messages: list[dict] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 1024,
        "response_format": {"type": "json_object"},
    }

    resp = requests.post(
        url,
        json=body,
        timeout=60,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    _raise_for_status(resp)
    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise LLMError(f"unexpected DeepSeek response shape: {data!r}") from exc


_PROVIDERS: dict[str, Callable[[str, str | None], str]] = {
    "gemini": _gemini,
    "anthropic": _anthropic,
    "deepseek": _deepseek,
}


# helpers
def _require_env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise LLMError(f"missing required env var: {name}")
    return val


def _raise_for_status(resp: requests.Response) -> None:
    """Convert HTTP failures into LLMError, distinguishing transient vs final."""
    if resp.status_code < 400:
        return
    transient = resp.status_code == 429 or resp.status_code >= 500
    msg = f"HTTP {resp.status_code} from {resp.url.split('?', 1)[0]}: {resp.text[:300]}"
    err = LLMError(msg)
    
    # tag so the retry wrapper can decide
    err.transient = transient  # type: ignore[attr-defined]
    raise err


def _with_retries(call: Callable[[], str], max_attempts: int = 3) -> str:
    """Retry transient failures with exponential backoff (1s, 2s, 4s)."""
    delay = 1.0
    last_exc: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return call()
        except LLMError as exc:
            last_exc = exc
            if not getattr(exc, "transient", False) or attempt == max_attempts:
                raise
            log.warning(
                "LLM transient error (attempt %d/%d): %s",
                attempt, max_attempts, exc,
            )
            time.sleep(delay)
            delay *= 2
        except (requests.Timeout, requests.ConnectionError) as exc:
            last_exc = exc
            if attempt == max_attempts:
                raise LLMError(f"network error after {attempt} attempts: {exc}") from exc
            log.warning(
                "LLM network error (attempt %d/%d): %s",
                attempt, max_attempts, exc,
            )
            time.sleep(delay)
            delay *= 2
    
    # unreachable, but keeps type-checkers happy
    raise LLMError(f"retries exhausted: {last_exc}")
