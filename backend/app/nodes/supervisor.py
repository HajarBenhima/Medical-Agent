from app.state import MedicalState

def supervisor(state: MedicalState) -> dict:

    if state.get("final_report"):
        return {"next": "FINISH"}
    
    if state.get("physician_treatment"):
        return {"next": "report_agent"}
    
    if state.get("diagnostic_summary"):
        return {"next": "physician_review"}
    
    return {"next": "diagnostic_agent"}
