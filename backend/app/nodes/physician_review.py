from langgraph.types import interrupt
from app.state import MedicalState

def physician_review(state: MedicalState) -> dict:
    # 1. Préparer les données à exposer au médecin
    review_payload = {
        "diagnostic_summary": state.get("diagnostic_summary", ""),
        "interim_care": state.get("interim_care", ""),
    }
    
    # 2. PAUSE : le graphe s'arrête ici jusqu'à ce que l'API appelle resume()
    physician_treatment = interrupt(review_payload)
    
    # 3. Quand le graphe reprend, physician_treatment contient ce que le médecin a saisi
    return {
        "physician_treatment": physician_treatment,
    }
