from app.state import MedicalState

def report_agent(state: MedicalState) -> dict:
    return {
        "final_report": f"""
    RAPPORT MÉDICAL
    Synthèse : {state.get("diagnostic_summary", "N/A")}
    Traitement médecin : {state.get("physician_treatment", "N/A")}

    Ce système ne remplace pas une consultation médicale.
    """
    }

