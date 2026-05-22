import json
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

from app.state import MedicalState
from app.tools.patient_tools import ask_patient

load_dotenv()

QUESTIONS_FIXES = [
    "Quels sont vos symptômes principaux et depuis combien de temps les ressentez-vous ?",
    "Avez-vous de la fièvre ? Si oui, à quelle température ?",
    "Avez-vous des antécédents médicaux ou prenez-vous des traitements en cours ?",
]


def format_responses(responses):
    """Formate la liste des Q&A pour le prompt LLM."""
    if not responses:
        return "(aucune réponse encore)"
    return "\n".join(
        f"Q: {r['question']}\nR: {r['answer']}" 
        for r in responses
    )


def generer_question_dynamique(patient_initial_case, patient_responses):
    """Appelle le LLM pour générer une question adaptée."""
    prompt = f"""Tu es un médecin qui mène une consultation préliminaire.
            Cas patient initial : {patient_initial_case}

            Réponses déjà obtenues :
            {format_responses(patient_responses)}

            Génère UNE seule question pertinente pour creuser le cas. 
            Ne réponds QUE par la question, sans préambule.
            """
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    response = llm.invoke(prompt)
    return str(response.content).strip()


def generer_synthese(state):
    prompt = f"""Tu es un médecin qui rédige une SYNTHÈSE CLINIQUE PRÉLIMINAIRE
            (jamais un diagnostic définitif) à partir des informations suivantes.

            Cas initial : {state.get('patient_initial_case', '')}

            Réponses du patient :
            {format_responses(state.get('patient_responses', []))}

            Produis ta réponse au format JSON STRICT avec EXACTEMENT 2 clés :
            {{
            "diagnostic_summary": "synthèse clinique préliminaire en 3-5 phrases",
            "interim_care": "recommandation intermédiaire prudente (repos, hydratation, surveillance, consultation rapide si aggravation)"
            }}

            Vocabulaire interdit : "diagnostic", "diagnostiquer", "prescription".
            Vocabulaire à utiliser : "orientation clinique préliminaire", "synthèse clinique", "recommandation intermédiaire".
            """

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.2,
        model_kwargs={"response_format": {"type": "json_object"}},
    )
    response = llm.invoke(prompt)
    
    parsed = json.loads(str(response.content))
    return {
        "diagnostic_summary": parsed["diagnostic_summary"],
        "interim_care": parsed["interim_care"],
    }


def poser_prochaine_question(state, count):
    # Si count < 3 : question fixe ; sinon question LLM
    if count < 3:
        question = QUESTIONS_FIXES[count]
    else:
        question = generer_question_dynamique(
            state.get("patient_initial_case", ""),
            state.get("patient_responses", [])
        )
    
    # Pose la question (interrupt + récupère la réponse)
    answer = ask_patient.invoke({"question": question})
    
    # Mettre à jour patient_responses + incrémenter count
    responses = state.get("patient_responses", []) + [
        {"question": question, "answer": answer}
    ]
    return {
        "patient_responses": responses,
        "question_count": count + 1,
    }

def diagnostic_agent(state: MedicalState) -> dict:
    count = state.get("question_count", 0)
    
    # Cas 1 : on a déjà posé 5 questions → génère la synthèse
    if count >= 5:
        return generer_synthese(state)
    
    # Cas 2 : il reste des questions à poser → pose la suivante
    return poser_prochaine_question(state, count)


