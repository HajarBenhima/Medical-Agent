# TASKS.md — Diagnostic_Medical Project Tracker

> Single source of truth for where I am in the project. Update checkboxes as you finish each task. See [CLAUDE.md](CLAUDE.md) for the full spec and stack details.

**Legend**: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Phase 0 — Setup & scaffolding ✅

### 0.1 Repo bootstrap ✅
- [x] Create `backend/`, `mcp_server/`, `frontend/` folders at project root
- [x] `git init` + `.gitignore`
- [x] `README.md` skeleton
- [ ] First commit (to do when Phase 1 is ready to commit)

### 0.2 Backend Python environment ✅
- [x] venv created at `backend/.venv`
- [x] `requirements.txt` (langgraph 1.2, langchain 1.3, langchain-openai 1.2, fastapi 0.136, mcp 1.27, etc.)
- [x] `pip install -r requirements.txt`
- [x] `.env.example` + `.env` (gitignored) with OPENAI_API_KEY
- [x] Smoke test passed: `ChatOpenAI(model='gpt-4o-mini')` returns 28-token French response

### 0.3 Frontend scaffold ✅
- [x] Vite + React + TypeScript scaffolded
- [x] Tailwind v4 wired via `@tailwindcss/vite` plugin
- [x] Path alias `@` → `src/` in vite + tsconfig
- [x] shadcn/ui initialized (preset Nova: Geist font + Lucide icons + dark mode)
- [x] Base components installed: button, card, input, textarea, label, dialog, sheet, badge, skeleton, sonner, separator, progress
- [x] Extra deps installed: lucide-react, framer-motion, react-hook-form, @hookform/resolvers, zod, @tanstack/react-query, axios, sonner, clsx, tailwind-merge, class-variance-authority
- [x] `npm run build` passes (248ms, 60KB JS gzipped)
- [ ] _Customize theme tokens to medical palette (teal/blue) — defer to Phase 8.0 shared shell_

### 0.4 LangGraph Studio ✅
- [x] `langgraph-cli[inmem]` installed (separately from `langgraph` package)
- [x] `backend/langgraph.json` created pointing at `./app/graph.py:graph`
- [x] `langgraph dev` lance Studio + graphe chargé sans erreur

---

## Phase 1 — Minimal graph (Supervisor → Diagnostic → Report → END) ✅

### 1.1 State definition ✅
- [x] `backend/app/state.py` créé avec `MedicalState` TypedDict (11 champs : spec §8 + `thread_id`, `patient_initial_case`, `patient_responses`, `patient_answer`)
- [x] `backend/app/__init__.py` créé

### 1.2 Nodes (stubs sans LLM) ✅
- [x] `supervisor.py` — routage early-return + truthy check
- [x] `diagnostic_agent.py` — stub avec vocabulaire éthique
- [x] `report_agent.py` — stub avec disclaimer obligatoire verbatim
- [x] `physician_review.py` — HITL avec `interrupt()` (anticipé de Phase 4)
- [x] `__init__.py` ajouté à `nodes/`

### 1.3 Wire the graph ✅
- [x] `backend/app/graph.py` — `StateGraph(MedicalState)`, 4 nœuds, 8 edges (4 conditionnels + 4 fixes), `compile()` sans checkpointer (Studio gère)
- [x] Validé dans LangGraph Studio : graphe visible, transitions ok
- [x] Invocation end-to-end testée : interrupt physician_review + resume + END ✅

### 1.4 Commit ✅
- [x] Commit `ce59928 — feat(graph): minimal LangGraph workflow with HITL — Phase 1 done`

---

## Phase 2 — Patient interaction (5-question loop) ✅

### 2.1 `ask_patient` tool ✅
- [x] `backend/app/tools/__init__.py` créé
- [x] `backend/app/tools/patient_tools.py` — `@tool` `ask_patient(question)` qui appelle `interrupt({"question": ...})` et retourne la réponse string

### 2.2 Diagnostic Agent v2 (vrai LLM + boucle hybride) ✅
- [x] **Choix design : Option C (hybride)** — 3 questions fixes + 2 questions LLM adaptatives
- [x] `ChatOpenAI(model="gpt-4o-mini")` intégré via `langchain-openai`
- [x] `QUESTIONS_FIXES` (Q1-Q3 cliniques essentielles : symptômes, fièvre, antécédents)
- [x] `generer_question_dynamique()` — LLM génère Q4 et Q5 en fonction des réponses précédentes
- [x] `generer_synthese()` — LLM produit `diagnostic_summary` + `interim_care` en JSON mode (`response_format=json_object`)
- [x] `question_count` tracké, boucle gérée via routage Supervisor
- [x] Vocabulaire éthique enforced dans le prompt (interdit : "diagnostic" / utiliser : "orientation clinique préliminaire")

### 2.3 Test in Studio ✅
- [x] Run avec cas "fièvre + mal de gorge" — 5 questions enchaînées (3 fixes + 2 LLM)
- [x] Synthèse générée respecte le vocabulaire éthique ("pourrait orienter vers", pas "diagnostiquer")
- [x] Interim care couvre repos/hydratation/surveillance/consultation si aggravation
- [x] HITL physician_review affiche bien la synthèse au médecin

---

## Phase 3 — Interim care recommendation ✅ (intégré dans Phase 2)

> **Design choice**: au lieu d'un tool séparé `recommend_interim_care`, l'interim_care est généré par le même appel LLM que la synthèse (clé `interim_care` dans le JSON output de `generer_synthese`). Plus efficient (1 appel LLM au lieu de 2) et le contexte clinique est partagé.

- [x] `interim_care` rempli pour le cas testé en Phase 2.3
- [ ] À valider en Phase 5 : red-flag case mentionne urgent consultation
- [ ] À valider en Phase 5 : benign case reste prudent

---

## Phase 4 — Physician Review (Human-in-the-Loop) ✅ (fait en Phase 1.2)

- [x] `backend/app/nodes/physician_review.py` créé en Phase 1.2 (anticipation)
- [x] Convention `interrupt()` clarifiée : payload exposé + retour string brute (pas dict)
- [x] Resume testé avec succès en Phase 1.3 ET re-testé en Phase 2.3 avec vraie synthèse LLM

---

## Phase 5 — Real Report Agent

### 5.1 Structured final report
- [ ] Define `FinalReport` Pydantic model (sections: patient_context, synthese_clinique, recommandation_intermediaire, traitement_propose_medecin, disclaimer, date)
- [ ] ReportAgent uses `ChatOpenAI(...).with_structured_output(FinalReport)`
- [ ] Disclaimer field must be hard-coded to: « Ce système ne remplace pas une consultation médicale. »
- [ ] Final report written to `state["final_report"]` (serialized as JSON string or dict)

### 5.2 Validate against 3 spec test cases
- [ ] Simple respiratory case → report generated
- [ ] Red-flag case → report flags urgency
- [ ] Benign case → report stays cautious
- [ ] All three reports include disclaimer verbatim

---

## Phase 6 — FastAPI

### 6.1 App setup
- [ ] `backend/app/api.py` — FastAPI app, CORS for `http://localhost:5173`, mount `/health`
- [ ] Wire compiled graph (with checkpointer) as a module-level singleton

### 6.2 Five mandatory endpoints (spec §10)
- [ ] `POST /sessions/start` → returns `{ thread_id }`
- [ ] `POST /consultation/start` → body `{ thread_id, initial_case }`, kicks off graph until first interrupt
- [ ] `POST /consultation/resume` → body `{ thread_id, payload }`, resumes from interrupt
- [ ] `GET /consultation/{thread_id}` → current state + `next_action` hint (`await_patient` | `await_physician` | `done`)
- [ ] `GET /consultation/{thread_id}/report` → final report (or 409 if not ready)

### 6.3 Verify
- [ ] Run all 5 endpoints with curl or `/docs` Swagger UI
- [ ] Full happy-path consultation end-to-end via HTTP only

---

## Phase 7 — MCP integration (mandatory)

### 7.1 MCP server
- [ ] Pick a tool: **`lookup_red_flags(symptoms: list[str]) -> list[str]`** (curated JSON of warning signs)
- [ ] `mcp_server/data/red_flags.json` — seed with ~20 entries
- [ ] `mcp_server/server.py` — MCP server exposing the tool
- [ ] Run + smoke-test the MCP server standalone

### 7.2 MCP client in the graph
- [ ] `backend/app/tools/mcp_client.py` — connect to MCP server, wrap tool as LangChain `Tool`
- [ ] Bind it to the Diagnostic Agent
- [ ] Verify Agent calls `lookup_red_flags` on red-flag test case

---

## Phase 8 — Frontend (the 4 screens) — UI polish mandatory

> Reminder: every screen must look like a real health-tech product before moving on. No basic UI. See CLAUDE.md §8.

### 8.0 Shared shell
- [ ] App shell: top nav with logo + project name, footer with disclaimer banner, max-width container
- [ ] Custom Tailwind theme: medical color tokens (primary teal/blue, semantic warn/success, neutrals)
- [ ] Inter (body) + display font set up via `@fontsource/inter` or Google Fonts
- [ ] React Query provider, Sonner toaster, react-router setup
- [ ] API client (`src/api/consultation.ts`) typed against backend models

### 8.1 Screen 1 — Initial case intake
- [ ] Route `/consultation/new`
- [ ] react-hook-form + zod for age, sex, chief complaint, context
- [ ] Multi-step or single polished card layout
- [ ] Privacy + ethics disclaimer banner (visible, not buried)
- [ ] Submit → calls `/sessions/start` then `/consultation/start`, navigates to screen 2
- [ ] **UI check**: open browser, confirm it looks polished (typography, spacing, focus rings, button states, mobile responsive)

### 8.2 Screen 2 — Patient Q&A (chat-style)
- [ ] Route `/consultation/:thread_id/qa`
- [ ] Chat layout with message bubbles (agent vs patient)
- [ ] Progress indicator: "Question 1 of 5"
- [ ] Typing/skeleton indicator while waiting on graph
- [ ] Input → calls `/consultation/resume` with answer, polls or waits for next question
- [ ] Framer Motion fade-in on each new message
- [ ] **UI check**: feels conversational and reassuring, not robotic

### 8.3 Screen 3 — Physician Review
- [ ] Route `/consultation/:thread_id/physician`
- [ ] Two-pane layout: left = read-only synthesis + interim_care card, right = editable treatment form
- [ ] Submit → `/consultation/resume` with `physician_treatment`
- [ ] **UI check**: clearly distinguishes "AI output (preview)" from "physician input (authoritative)"

### 8.4 Screen 4 — Final Report
- [ ] Route `/consultation/:thread_id/report`
- [ ] Document-style layout, section headings from `FinalReport` model
- [ ] Disclaimer header banner (verbatim French)
- [ ] Print-friendly styling (`@media print`)
- [ ] **UI check**: looks like a real medical document, not a JSON dump

### 8.5 Frontend integration test
- [ ] Run all 3 spec test cases end-to-end through the UI
- [ ] Confirm screens transition correctly
- [ ] Confirm errors are surfaced via Sonner toasts, not console

---

## Phase 9 — LangGraph Studio demo

- [ ] All graph transitions visible
- [ ] Patient interrupts demonstrably pause the graph
- [ ] Physician interrupt demonstrably pauses the graph
- [ ] Intermediate states observable in Studio's state panel
- [ ] Record short video / take screenshots for deliverable

---

## Phase 10 — Deliverables (spec §14)

- [ ] Full source committed: `backend/`, `mcp_server/`, `frontend/`
- [ ] `README.md` — install instructions for all three components, env vars, run commands
- [ ] Short technical report (PDF or MD) — architecture diagram + design choices
- [ ] Demo: screenshots of all 4 screens + Studio graph view + Studio interrupt flow
- [ ] All 3 spec test cases pass end-to-end

---

## Phase 11 — Bonus (pick what's feasible)

- [ ] PDF export of the final report (frontend or backend via `reportlab`/`weasyprint`)
- [ ] Persistence: swap `MemorySaver` → `SqliteSaver` or Postgres checkpointer
- [ ] Consultation history page (list past `thread_id`s)
- [ ] `docker-compose.yml` for backend + frontend + mcp_server
- [ ] Unit tests (pytest for nodes/tools) + integration tests (httpx for API)
- [ ] Pydantic structured output everywhere (already partially in Phase 5)
- [ ] Advanced error handling: retries, friendly error UI, OpenAI rate-limit backoff

---

## Notes & blockers

_Append notes here as you go — date them so context doesn't decay._

- `2026-05-21` — Project initialized. Chose React+Vite+Tailwind+shadcn for frontend. Will use OpenAI (`gpt-4o-mini` default) via `langchain-openai`.
- `2026-05-22` — Phases 0, 1, 2, 3, 4 done. Le graphe complet tourne dans Studio avec vraie boucle LLM 5 questions (3 fixes + 2 adaptatives), synthèse OpenAI, HITL médecin, rapport final avec disclaimer. Commit Phase 1: `ce59928`. **Prochaine session : Phase 5 (Report Agent avec Pydantic structured output) puis Phase 6 (FastAPI).**
