"""
FastAPI app exposing the medical diagnosis graph via HTTP.

Endpoints (spec §10):
    POST /sessions/start                       → create a thread_id (UUID)
    POST /consultation/start                   → start the graph with patient_initial_case
    POST /consultation/resume                  → resume after a patient/physician interrupt
    GET  /consultation/{thread_id}             → current state + next_action hint
    GET  /consultation/{thread_id}/report      → final structured report (Markdown)

Notes:
    - The graph is recompiled here with `MemorySaver` checkpointer so that interrupts
      can be paused across HTTP requests (the version exposed to LangGraph Studio is
      compiled without a checkpointer, since Studio injects its own).
    - CORS is open to the Vite dev server origin (localhost:5173) and a few common
      alternatives. Tighten for production.
"""

from __future__ import annotations

import uuid
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from pydantic import BaseModel, Field

from app.graph import builder

load_dotenv()


# ---------------------------------------------------------------------------
# Compile the graph with an in-memory checkpointer.
# The checkpointer is what makes Human-in-the-Loop work across HTTP requests:
# when interrupt() pauses the graph, the state is saved in the checkpointer
# and can be resumed by a later /consultation/resume call.
# ---------------------------------------------------------------------------
checkpointer = MemorySaver()
graph = builder.compile(checkpointer=checkpointer)


# ---------------------------------------------------------------------------
# FastAPI app + CORS
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Diagnostic Médical — Multi-Agent API",
    description=(
        "API HTTP du workflow LangGraph d'orientation clinique préliminaire. "
        "Exercice académique — ce système ne remplace pas une consultation médicale."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # backup
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class SessionStartResponse(BaseModel):
    thread_id: str
    status: str = "created"


class ConsultationStartRequest(BaseModel):
    thread_id: str = Field(..., description="UUID obtenu via /sessions/start")
    patient_initial_case: str = Field(
        ..., description="Description initiale du cas patient (texte libre)."
    )


class ConsultationResumeRequest(BaseModel):
    thread_id: str
    value: str = Field(
        ...,
        description=(
            "Réponse du patient (si pause sur diagnostic_agent) "
            "OU traitement proposé par le médecin (si pause sur physician_review)."
        ),
    )


class ConsultationStateResponse(BaseModel):
    thread_id: str
    next_action: str = Field(
        ...,
        description=(
            "L'une de : 'await_patient' | 'await_physician' | 'done' | 'await_start'."
        ),
    )
    question_count: int = 0
    pending_question: Optional[str] = Field(
        None, description="Question en attente si next_action == 'await_patient'."
    )
    diagnostic_summary: Optional[str] = None
    interim_care: Optional[str] = None
    physician_treatment: Optional[str] = None
    final_report: Optional[str] = None


class ReportResponse(BaseModel):
    thread_id: str
    final_report: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _config(thread_id: str) -> dict:
    """LangGraph config object identifying the thread."""
    return {"configurable": {"thread_id": thread_id}}


def _next_action(snapshot) -> tuple[str, Optional[str]]:
    """
    Determine the next action expected from the client, plus an optional payload
    (here, the pending question if we're waiting on a patient answer).
    """
    values = snapshot.values or {}

    # Already finished
    if values.get("final_report"):
        return "done", None

    # No interrupts AND no pending next → graph hasn't started yet
    if not snapshot.next and not snapshot.interrupts:
        return "await_start", None

    # Look at interrupts (LangGraph 1.x exposes them as a tuple of Interrupt objects)
    if snapshot.interrupts:
        for itrp in snapshot.interrupts:
            payload = getattr(itrp, "value", None)
            # ask_patient tool → {"question": "..."}
            if isinstance(payload, dict) and "question" in payload:
                return "await_patient", str(payload["question"])
            # physician_review → {"diagnostic_summary": "...", "interim_care": "..."}
            if isinstance(payload, dict) and "diagnostic_summary" in payload:
                return "await_physician", None

    # Fallback: rely on the `next` node name
    next_nodes = snapshot.next or ()
    if "physician_review" in next_nodes:
        return "await_physician", None
    if "diagnostic_agent" in next_nodes:
        return "await_patient", None

    return "running", None


def _build_state_response(thread_id: str) -> ConsultationStateResponse:
    snapshot = graph.get_state(_config(thread_id))
    values = snapshot.values or {}
    action, question = _next_action(snapshot)
    return ConsultationStateResponse(
        thread_id=thread_id,
        next_action=action,
        question_count=values.get("question_count", 0),
        pending_question=question,
        diagnostic_summary=values.get("diagnostic_summary"),
        interim_care=values.get("interim_care"),
        physician_treatment=values.get("physician_treatment"),
        final_report=values.get("final_report"),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    """Simple liveness probe."""
    return {"status": "ok"}


@app.post("/sessions/start", response_model=SessionStartResponse)
def session_start():
    """Generate a new thread_id (UUID) for a fresh consultation."""
    return SessionStartResponse(thread_id=str(uuid.uuid4()))


@app.post("/consultation/start", response_model=ConsultationStateResponse)
def consultation_start(req: ConsultationStartRequest):
    """
    Start the LangGraph workflow for the given thread_id with the patient's
    initial case. Runs until the first interrupt (the first patient question).
    """
    try:
        graph.invoke(
            {"patient_initial_case": req.patient_initial_case},
            config=_config(req.thread_id),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Graph invocation failed: {exc}",
        ) from exc
    return _build_state_response(req.thread_id)


@app.post("/consultation/resume", response_model=ConsultationStateResponse)
def consultation_resume(req: ConsultationResumeRequest):
    """
    Resume a paused consultation with a value:
      - patient answer  (string)  → if currently await_patient
      - physician treatment (string) → if currently await_physician
    """
    try:
        graph.invoke(
            Command(resume=req.value),
            config=_config(req.thread_id),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Graph resume failed: {exc}",
        ) from exc
    return _build_state_response(req.thread_id)


@app.get("/consultation/{thread_id}", response_model=ConsultationStateResponse)
def consultation_get(thread_id: str):
    """Return the current state of the consultation plus a next_action hint."""
    snapshot = graph.get_state(_config(thread_id))
    if not snapshot.values and not snapshot.next and not snapshot.interrupts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No consultation found for thread_id={thread_id}",
        )
    return _build_state_response(thread_id)


@app.get("/consultation/{thread_id}/report", response_model=ReportResponse)
def consultation_report(thread_id: str):
    """Return the final report (or 409 if not yet generated)."""
    snapshot = graph.get_state(_config(thread_id))
    final_report = (snapshot.values or {}).get("final_report")
    if not final_report:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Final report not yet available for this consultation",
        )
    return ReportResponse(thread_id=thread_id, final_report=final_report)
