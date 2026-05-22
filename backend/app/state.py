from typing import Annotated, Literal
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages

class MedicalState(TypedDict, total=False):
    messages: Annotated[list, add_messages]
    next: Literal["diagnostic_agent", "physician_review", "report_agent", "FINISH"]
    question_count: int
    diagnostic_summary: str
    interim_care: str
    physician_treatment: str
    final_report: str
    thread_id: str
    patient_initial_case: str
    patient_responses: list[dict]
    patient_answer: str