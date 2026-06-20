"""
Bridge between the MCP server (mcp_server/server.py) and the LangChain agent.

Loads the MCP-exposed tools as LangChain `BaseTool` instances that can be
called from inside any of our graph nodes (currently used by the
DiagnosticAgent to look up clinical red flags).

The server is spawned as a subprocess over the stdio transport. Tools are
loaded once at first call and cached for the lifetime of the process.
"""

from __future__ import annotations

import asyncio
import sys
from functools import lru_cache
from pathlib import Path
from typing import List

from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient

# ---------------------------------------------------------------------------
# Locate the MCP server script (mcp_server/server.py at the repo root)
# ---------------------------------------------------------------------------
# This file lives at:  backend/app/tools/mcp_client.py
# Repo root is 3 levels up.  MCP server is at <root>/mcp_server/server.py
_REPO_ROOT = Path(__file__).resolve().parents[3]
_MCP_SERVER_SCRIPT = str(_REPO_ROOT / "mcp_server" / "server.py")

# We use the current venv's Python so the MCP server runs with the same
# dependencies (importantly: the `mcp` package).
_PYTHON_BIN = sys.executable

_CLIENT_CONFIG = {
    "red-flags": {
        "command": _PYTHON_BIN,
        "args": [_MCP_SERVER_SCRIPT],
        "transport": "stdio",
    }
}


# ---------------------------------------------------------------------------
# Tool loading (cached)
# ---------------------------------------------------------------------------
async def _load_tools_async() -> List[BaseTool]:
    """Spawn the MCP server, connect via stdio, fetch the tool list."""
    client = MultiServerMCPClient(_CLIENT_CONFIG)
    return await client.get_tools()


@lru_cache(maxsize=1)
def get_mcp_tools() -> List[BaseTool]:
    """
    Return the list of MCP-exposed tools as LangChain `BaseTool` instances.

    Cached: the underlying subprocess is launched on first call only.
    """
    return asyncio.run(_load_tools_async())


def get_tool_by_name(name: str) -> BaseTool:
    """Get a single MCP-exposed tool by its name."""
    for tool in get_mcp_tools():
        if tool.name == name:
            return tool
    available = ", ".join(t.name for t in get_mcp_tools())
    raise ValueError(f"MCP tool '{name}' not found. Available: {available}")


def _unwrap_mcp_text_item(item) -> str:
    """
    MCP servers return content as TextContent objects of the form
    {'type': 'text', 'text': '...', 'id': ...}. The langchain-mcp-adapters
    bridge sometimes serializes these as Python repr strings. Normalize.
    """
    import ast

    # Already a plain dict
    if isinstance(item, dict) and "text" in item:
        return str(item["text"])
    if isinstance(item, str):
        # Try to parse as a Python literal dict
        try:
            parsed = ast.literal_eval(item)
            if isinstance(parsed, dict) and "text" in parsed:
                return str(parsed["text"])
        except (ValueError, SyntaxError):
            pass
        return item
    return str(item)


def call_red_flag_lookup(symptoms: str) -> list[str]:
    """
    Convenience sync helper: query the MCP `lookup_red_flags` tool with the
    given symptoms text and return the list of warnings.

    Returns an empty list on any internal error so callers don't have to
    sprinkle try/except blocks throughout the graph.
    """
    try:
        tool = get_tool_by_name("lookup_red_flags")
        result = asyncio.run(tool.ainvoke({"symptoms": symptoms}))
        if isinstance(result, list):
            return [_unwrap_mcp_text_item(x) for x in result]
        if result:
            return [_unwrap_mcp_text_item(result)]
        return []
    except Exception as exc:  # pragma: no cover  (best-effort fallback)
        print(f"[mcp_client] lookup_red_flags failed: {exc}", file=sys.stderr)
        return []
