# Diagnostic Médical — Système multi-agents avec LangGraph

Système d'orientation clinique préliminaire basé sur un workflow multi-agents LangGraph, exposé via une API FastAPI, enrichi d'une intégration MCP, et accessible via une interface React.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/) [![LangGraph](https://img.shields.io/badge/LangGraph-1.2-1C3C3C)](https://langchain-ai.github.io/langgraph/) [![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/) [![MCP](https://img.shields.io/badge/MCP-1.27-6E40C9)](https://modelcontextprotocol.io/) [![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/) [![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?logo=openai&logoColor=white)](https://platform.openai.com/)

**Avertissement:** 
Projet académique (EMSI S8, *IA Distribuée*, Pr. M. Youssfi). 
Ce système n'est pas un dispositif médical et ne fournit pas de diagnostic définitif. 
*« Ce système ne remplace pas une consultation médicale. »*

---

## Sommaire

- [Présentation](#présentation)
- [Stack](#stack)
- [Architecture](#architecture)
- [Workflow LangGraph](#workflow-langgraph)
- [Structure du dépôt](#structure-du-dépôt)
- [Installation](#installation)
- [Lancement](#lancement)
- [API REST](#api-rest)
- [Serveur MCP](#serveur-mcp)
- [LangGraph Studio](#langgraph-studio)
- [Cas de test](#cas-de-test)
- [Contraintes éthiques](#contraintes-éthiques)
- [Pistes d'amélioration](#pistes-damélioration)

---

## Présentation

Le système simule une consultation préliminaire en plusieurs étapes coordonnées par un graphe LangGraph :

1. Le patient décrit son cas.
2. Un agent (`DiagnosticAgent`) pose cinq questions au patient. Les trois premières sont fixes et couvrent les éléments cliniques essentiels (symptômes principaux, fièvre, antécédents). Les deux dernières sont générées dynamiquement par le LLM en fonction des réponses précédentes.
3. Avant de produire la synthèse, l'agent interroge le serveur MCP local pour détecter d'éventuels signes d'alerte cliniques (*red flags*) dans l'ensemble des symptômes recueillis.
4. L'agent produit une synthèse clinique préliminaire et une recommandation intermédiaire prudente.
5. Un médecin (étape *Human-in-the-Loop*) relit la synthèse et propose un traitement ou une conduite à tenir.
6. Un second agent (`ReportAgent`) génère un rapport final structuré (Pydantic) contenant le contexte patient, la synthèse, la recommandation intermédiaire, le traitement du médecin, et le disclaimer obligatoire.

L'ensemble est exposé via une API FastAPI consommée par un frontend React (quatre écrans) et reste inspectable dans LangGraph Studio.

---

## Stack

| Couche | Technologies |
|---|---|
| Backend | Python 3.11+, LangGraph 1.2, LangChain 1.3, Pydantic 2, python-dotenv |
| LLM | OpenAI `gpt-4o-mini` via `langchain-openai` |
| API | FastAPI 0.136 + Uvicorn (CORS, Swagger UI, ReDoc) |
| Outils agents | MCP 1.27 (FastMCP), `langchain-mcp-adapters` |
| Frontend | React 19, TypeScript 5, Vite 7, Tailwind CSS 4, shadcn/ui |
| UI helpers | React Router, TanStack Query, react-hook-form + Zod, Framer Motion, Lucide, Sonner |
| Studio / debug | LangGraph CLI (`langgraph dev`) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            Frontend (React)                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Intake     │→ │ Q&A (chat)   │→ │  Physician   │→ │ Final Report │  │
│  │  (Écran 1)   │  │  (Écran 2)   │  │  (Écran 3)   │  │  (Écran 4)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ HTTP (axios + TanStack Query)
┌────────────────────────────────▼─────────────────────────────────────────┐
│                              API (FastAPI)                               │
│   POST /sessions/start   ·   POST /consultation/start   ·   /resume      │
│   GET  /consultation/{id}   ·   GET /consultation/{id}/report            │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ invokes / resumes
┌────────────────────────────────▼─────────────────────────────────────────┐
│                       LangGraph workflow (state + checkpointer)          │
│                                                                          │
│   START ─→ Supervisor ─→ DiagnosticAgent  (loop 5×)                      │
│                                │                                         │
│                                ├─→ ask_patient (interrupt)               │
│                                ├─→ lookup_red_flags  ←──┐                │
│                                └─→ generer_synthese     │                │
│                                            ↓            │                │
│             Supervisor ←─────────────────  +            │                │
│                                            ↓            │                │
│             PhysicianReview (interrupt — HITL)          │                │
│                                            ↓            │                │
│             Supervisor → ReportAgent (with_structured_output)            │
│                                            ↓            │                │
│             Supervisor → END                            │                │
│                                                         │                │
└─────────────────────────────────────────────────────────┼────────────────┘
                                                         │ MCP stdio
                                       ┌─────────────────▼────────────────┐
                                       │     MCP Server (FastMCP)         │
                                       │  lookup_red_flags(symptoms)      │
                                       │  list_red_flag_categories()      │
                                       └──────────────────────────────────┘
```

---

## Workflow LangGraph

```
                                       ┌─────────────┐
                                       │    START    │
                                       └──────┬──────┘
                                              │
                                       ┌──────▼──────┐
                  ┌────────────────────│  Supervisor │◀───────────┐
                  │                    └──────┬──────┘            │
                  │                           │                   │
                  ▼                           ▼                   ▼
        ┌──────────────────┐       ┌──────────────────┐    ┌────────────┐
        │  DiagnosticAgent │       │  PhysicianReview │    │ ReportAgent│
        │                  │       │   (HITL pause)   │    │ (Pydantic) │
        │ ┌──────────────┐ │       └────────┬─────────┘    └─────┬──────┘
        │ │ ask_patient  │ │                │                    │
        │ │  ×5 loop     │ │                │                    │
        │ │              │ │                │                    │
        │ │ MCP red-flags│ │                │                    │
        │ │ + synthèse   │ │                │                    │
        │ └──────────────┘ │                │                    │
        └────────┬─────────┘                │                    │
                 └──────────────────────────┴────────────────────┘
                                                                 │
                                                          ┌──────▼──────┐
                                                          │     END     │
                                                          └─────────────┘
```

Routage du Supervisor (déterministe, sans LLM) :

- `final_report` présent → `FINISH`
- `physician_treatment` présent → `report_agent`
- `diagnostic_summary` présent → `physician_review`
- sinon → `diagnostic_agent`

---

## Structure du dépôt

```
Diagnostic_Medical/
├── backend/
│   ├── app/
│   │   ├── api.py                      # FastAPI app (5 endpoints + CORS)
│   │   ├── graph.py                    # StateGraph + nœuds + edges
│   │   ├── state.py                    # MedicalState (TypedDict, 11 champs)
│   │   ├── nodes/
│   │   │   ├── supervisor.py           # Routage déterministe
│   │   │   ├── diagnostic_agent.py     # Boucle 5 questions + synthèse LLM
│   │   │   ├── physician_review.py     # HITL via interrupt()
│   │   │   └── report_agent.py         # Pydantic + with_structured_output
│   │   └── tools/
│   │       ├── patient_tools.py        # @tool ask_patient
│   │       └── mcp_client.py           # Bridge LangChain ↔ MCP
│   ├── langgraph.json                  # Config Studio
│   ├── requirements.txt
│   └── .env.example
│
├── mcp_server/
│   ├── server.py                       # FastMCP : lookup_red_flags + categories
│   └── data/
│       └── red_flags.json              # 17 red flags, 7 catégories cliniques
│
└── frontend/
    ├── src/
    │   ├── App.tsx                     # Router + QueryClient
    │   ├── index.css                   # Palette + Inter + JetBrains Mono
    │   ├── lib/api.ts                  # Client HTTP typé
    │   ├── components/
    │   │   ├── layout/AppShell.tsx     # Header + footer
    │   │   ├── chat/TypingIndicator.tsx
    │   │   └── ui/                     # shadcn/ui
    │   └── pages/
    │       ├── PatientIntake.tsx       # Écran 1
    │       ├── DiagnosticChat.tsx      # Écran 2
    │       ├── PhysicianReview.tsx     # Écran 3
    │       └── FinalReport.tsx         # Écran 4
    ├── package.json
    └── vite.config.ts
```

---

## Installation

### Prérequis

- Python 3.11 ou plus récent
- Node.js 20 ou plus récent
- Une clé OpenAI ([platform.openai.com](https://platform.openai.com/api-keys))

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # macOS / Linux
# .venv\Scripts\activate              # Windows

pip install -r requirements.txt

cp .env.example .env                  # puis renseigner OPENAI_API_KEY
```

### Frontend

```bash
cd frontend
npm install
```

---

## Lancement

Ouvrir deux terminaux depuis la racine du dépôt.

```bash
# Terminal 1 — API FastAPI
cd backend && source .venv/bin/activate
uvicorn app.api:app --reload --port 8000
# Swagger UI    : http://localhost:8000/docs
# ReDoc         : http://localhost:8000/redoc

# Terminal 2 — Frontend React
cd frontend
npm run dev
# UI            : http://localhost:5173
```

Pour visualiser le graphe dans LangGraph Studio (optionnel) :

```bash
cd backend && source .venv/bin/activate
langgraph dev
# Studio : https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

Le serveur MCP est lancé automatiquement comme sous-processus stdio par `backend/app/tools/mcp_client.py`, il n'y a pas besoin de l'exécuter manuellement en usage normal. Pour le tester en isolation :

```bash
python mcp_server/server.py
```

---

## API REST

Documentation interactive : `http://localhost:8000/docs`

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/sessions/start` | Crée un `thread_id` (UUID) pour une nouvelle consultation |
| `POST` | `/consultation/start` | Démarre le graphe avec `patient_initial_case` |
| `POST` | `/consultation/resume` | Reprend après un `interrupt()` patient ou médecin |
| `GET`  | `/consultation/{thread_id}` | État courant + champ `next_action` (`await_patient` / `await_physician` / `done`) |
| `GET`  | `/consultation/{thread_id}/report` | Rapport final structuré (409 si pas encore prêt) |
| `GET`  | `/health` | Liveness probe |

### Exemple de session complète

```bash
# 1. Créer un thread
THREAD=$(curl -s -X POST http://localhost:8000/sessions/start | jq -r .thread_id)

# 2. Démarrer la consultation
curl -X POST http://localhost:8000/consultation/start \
  -H "Content-Type: application/json" \
  -d "{\"thread_id\":\"$THREAD\",\"patient_initial_case\":\"Mal de tête depuis 3 jours, fièvre légère\"}"

# 3. Répondre à la question retournée
curl -X POST http://localhost:8000/consultation/resume \
  -H "Content-Type: application/json" \
  -d "{\"thread_id\":\"$THREAD\",\"value\":\"Céphalée frontale, 38°C, pas de raideur de nuque\"}"

# (... quatre autres réponses ...)

# 4. Le médecin valide
curl -X POST http://localhost:8000/consultation/resume \
  -H "Content-Type: application/json" \
  -d "{\"thread_id\":\"$THREAD\",\"value\":\"Paracétamol 1g x3/j, hydratation, contrôle à 48h\"}"

# 5. Récupérer le rapport final
curl http://localhost:8000/consultation/$THREAD/report
```

---

## Serveur MCP

Le serveur expose deux outils via le transport stdio.

| Tool | Signature | Rôle |
|---|---|---|
| `lookup_red_flags` | `(symptoms: str) → list[str]` | Détecte les signes d'alerte cliniques dans un texte de symptômes |
| `list_red_flag_categories` | `() → list[str]` | Liste les domaines cliniques couverts |

La base contient 17 signes d'alerte curatés répartis en 7 catégories : cardiovasculaire, respiratoire, neurologique, infectieux, hémorragique, abdominal, métabolique, allergique, psychiatrique.

Le `DiagnosticAgent` interroge `lookup_red_flags` avant la génération de la synthèse et injecte les résultats dans le prompt LLM pour garantir leur mention explicite.

---

## LangGraph Studio

Studio permet de :

- Visualiser le graphe et ses transitions
- Lancer une consultation avec un état initial JSON
- Observer chaque transition de nœud en temps réel
- Tester les interrupts (`await_patient` et `await_physician`)
- Reprendre l'exécution avec un `Command(resume=...)`
- Inspecter chaque snapshot d'état

---

## Cas de test

Trois scénarios issus du cahier des charges.

| Cas | Description | Comportement attendu |
|---|---|---|
| Syndrome respiratoire | « Toux et fièvre 38.5°C depuis 3 jours » | Orientation virale, recommandation prudente, suivi à 48h |
| Red flags | « Douleur thoracique + essoufflement extrême + 40°C » | MCP détecte plusieurs alertes, synthèse mentionne « urgences » |
| Cas bénin | « Légère fatigue depuis quelques jours, pas de fièvre » | Recommandation conservatrice, simple surveillance |

Pour chaque scénario, vérifier que :

- les cinq questions sont posées (trois fixes, deux générées par le LLM) ;
- une synthèse et un `interim_care` sont produits ;
- l'interrupt `physician_review` se déclenche ;
- le rapport final est généré avec le disclaimer obligatoire.

---

## Contraintes éthiques

Strictement appliquées à tous les niveaux du code (prompts LLM, frontend, rapport final).

| À ne pas écrire | À utiliser à la place |
|---|---|
| « diagnostic » | « orientation clinique préliminaire » |
| « diagnostic définitif » | « synthèse clinique » |
| « prescription » | « recommandation intermédiaire » |

Phrase obligatoire — apparaît verbatim dans le rapport final :

> « Ce système ne remplace pas une consultation médicale. »

Ce vocabulaire est imposé par :

- des instructions explicites dans tous les prompts LLM ;
- une constante hardcodée (`DISCLAIMER`) injectée par `format_final_report()`, qui garantit la présence verbatim de la phrase obligatoire ;
- un bandeau persistant sur le frontend (header de l'écran 4).

---

## Pistes d'amélioration

- Export PDF natif du rapport (au lieu de `window.print()`)
- Persistance Postgres (`PostgresSaver`) à la place de `MemorySaver`
- Historique des consultations (liste, recherche, filtres)
- `docker-compose.yml` pour orchestrer backend, frontend et serveur MCP
- Tests unitaires (pytest sur les nœuds et tools)
- Tests d'intégration (httpx sur l'API)
- Authentification médecin (JWT)

---

EMSI S8 — IA Distribuée — Pr. Mohamed Youssfi.
