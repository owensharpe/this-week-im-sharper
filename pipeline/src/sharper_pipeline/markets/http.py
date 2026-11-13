"""One GET helper with the pipeline's usual retry policy.

5xx and network errors back off and retry. Anything 4xx, 429 included, is
raised straight away: a bad series id or an exhausted quota won't fix itself
in two seconds.
"""

from __future__ import annotations

import logging
import time

import requests

from ..config import REQUEST_TIMEOUT, USER_AGENT

log = logging.getLogger(__name__)


class FetchError(RuntimeError):
    """A request that failed for good. The message never contains the URL,
    because FRED's carries the API key."""


def get(url: str, params: dict, label: str, attempts: int = 3) -> requests.Response:
    for attempt in range(1, attempts + 1):
        try:
            resp = requests.get(
                url,
                params=params,
                headers={"User-Agent": USER_AGENT},
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            reason = type(exc).__name__
        else:
            if resp.status_code < 400:
                return resp
            if resp.status_code < 500:
                raise FetchError(f"{label}: HTTP {resp.status_code} {_detail(resp)}")
            reason = f"HTTP {resp.status_code}"

        if attempt == attempts:
            raise FetchError(f"{label}: {reason} after {attempts} attempts")
        log.warning("%s: %s (attempt %d/%d), retrying", label, reason, attempt, attempts)
        time.sleep(2 ** (attempt - 1))

    raise AssertionError("unreachable")


def _detail(resp: requests.Response) -> str:
    try:
        return str(resp.json().get("error_message", ""))[:200]
    except ValueError:
        return ""
