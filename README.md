# Diagnostic Médical — Système multi-agents avec LangGraph

> **Avertissement**: Ce système est un **exercice académique** (EMSI S8, IA Distribuée, Pr. M. Youssfi).
> Il n'est **pas** un dispositif médical et ne fournit **pas** de diagnostic définitif.
> **Ce système ne remplace pas une consultation médicale.**

Application multi-agents simulant un workflow d'orientation clinique préliminaire :
collecte des informations patient → synthèse clinique → validation par un médecin (Human-in-the-Loop) → rapport final structuré.

## Stack

- **Backend** : Python 3.11+, LangGraph, LangChain, FastAPI
- **LLM** : OpenAI `gpt-4o-mini` via `langchain-openai`
- **Outils** : MCP (Model Context Protocol)
- **Frontend** : React + Vite + Tailwind CSS + shadcn/ui
- **Tests / Debug** : LangGraph Studio

## Architecture

```
Diagnostic_Medical/
├── backend/        # FastAPI + graphe LangGraph + agents
├── mcp_server/     # Serveur MCP exposant des outils
├── frontend/       # React + Vite + Tailwind + shadcn/ui
└── assets/         # Cahier des charges + ressources
```

## Installation

> _Sections à compléter au fur et à mesure du développement._

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # puis renseigner OPENAI_API_KEY
```

### MCP server

```bash
cd mcp_server
# (instructions à compléter Phase 7)
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Lancement

```bash
# Terminal 1 — MCP server
cd mcp_server && python server.py

# Terminal 2 — Backend FastAPI
cd backend && uvicorn app.api:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend && npm run dev

# Terminal 4 — LangGraph Studio (optionnel)
cd backend && langgraph dev
```
