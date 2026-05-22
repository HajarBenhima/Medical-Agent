from app.state import MedicalState

def diagnostic_agent(state: MedicalState) -> dict:
    return {
        "diagnostic_summary": "[STUB] Orientation préliminaire en cours d'élaboration. À compléter par appel LLM.",
        "interim_care": "[STUB] Recommandation intermédiaire : hydratation, prise de température 2x/jour, repos.",
    }
