from langchain_core.tools import tool
from langgraph.types import interrupt


@tool
def ask_patient(question: str) -> str:
    """
    Pose une question au patient et attend sa réponse.
    Utilise interrupt() pour mettre le graphe en pause jusqu'à ce
    que le patient envoie sa réponse via l'API resume().
    """

    # 1. Pause le graphe et expose la question au client
    answer = interrupt({"question": question})
    
    # 2. Retourne la réponse du patient
    return answer
