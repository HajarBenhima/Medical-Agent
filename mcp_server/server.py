"""
MCP server exposing clinical red-flag lookup tools to LangChain agents.

Run standalone (stdio transport) for local development:
    python mcp_server/server.py

This server is consumed by `backend/app/tools/mcp_client.py`, which spawns it
as a subprocess and bridges its tools into the LangChain agent ecosystem.

Academic project — not a clinical decision-support system.
"""

from __future__ import annotations

import json
from pathlib import Path

from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Server + data loading
# ---------------------------------------------------------------------------
mcp = FastMCP("medical-red-flags")

_DATA_FILE = Path(__file__).resolve().parent / "data" / "red_flags.json"
_DATA = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
_RED_FLAGS = _DATA["red_flags"]


# ---------------------------------------------------------------------------
# Tools exposed via MCP
# ---------------------------------------------------------------------------
@mcp.tool()
def lookup_red_flags(symptoms: str) -> list[str]:
    """
    Look up clinical red flags (warning signs requiring urgent or rapid care)
    matching the patient's symptoms.

    Args:
        symptoms: Free text describing the patient's symptoms (French preferred).

    Returns:
        A list of human-readable warnings. Empty list if no red flag matches.
        Each warning is prefixed by its clinical category, e.g.
        "[cardiovasculaire] Douleur thoracique — évoquer un syndrome ...".
    """
    symptoms_lower = symptoms.lower()
    matches: list[str] = []
    for entry in _RED_FLAGS:
        category = entry["category"]
        warning = entry["warning"]
        for keyword in entry["keywords"]:
            if keyword.lower() in symptoms_lower:
                matches.append(f"[{category}] {warning}")
                break
    return matches


@mcp.tool()
def list_red_flag_categories() -> list[str]:
    """
    Return the distinct categories of red flags available in the database.

    Useful for an agent that wants to know what clinical domains the
    red-flag lookup covers (e.g. cardiovasculaire, neurologique, ...).
    """
    return sorted({entry["category"] for entry in _RED_FLAGS})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # stdio transport: parent process reads/writes via the subprocess's
    # stdin/stdout. This is the transport used by the LangChain MCP client.
    mcp.run(transport="stdio")
