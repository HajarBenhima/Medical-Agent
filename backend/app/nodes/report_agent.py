from datetime import datetime

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.state import MedicalState

load_dotenv()


DISCLAIMER = "Ce système ne remplace pas une consultation médicale."


class FinalReport(BaseModel):
    """Rapport d'orientation clinique préliminaire structuré."""

    patient_context: str = Field(
        description="Résumé du cas initial et des informations recueillies sur le patient (2-3 phrases)."
    )
    synthese_clinique: str = Field(
        description="Synthèse clinique préliminaire (PAS un diagnostic) basée sur les Q&A et la pré-analyse."
    )
    recommandation_intermediaire: str = Field(
        description="Recommandation intermédiaire prudente (repos, hydratation, surveillance, consultation rapide si aggravation)."
    )
    traitement_medecin: str = Field(
        description="Traitement ou conduite à tenir proposé par le médecin traitant."
    )


def format_final_report(report: FinalReport) -> str:
    """Formate le FinalReport en Markdown lisible pour l'affichage."""
    date = datetime.now().strftime("%d/%m/%Y à %H:%M")
    return f"""# RAPPORT D'ORIENTATION CLINIQUE PRÉLIMINAIRE

**Date de génération** : {date}

---

## 1. Contexte patient
{report.patient_context}

## 2. Synthèse clinique préliminaire
{report.synthese_clinique}

## 3. Recommandation intermédiaire
{report.recommandation_intermediaire}

## 4. Traitement proposé par le médecin
{report.traitement_medecin}

---

 **{DISCLAIMER}**
"""


def report_agent(state: MedicalState) -> dict:
    # 1. Construire le prompt avec les vraies données de l'état
    prompt = f"""Tu es un médecin qui rédige un RAPPORT D'ORIENTATION CLINIQUE PRÉLIMINAIRE
(jamais un diagnostic définitif) à partir des informations suivantes.

Cas initial du patient :
{state.get('patient_initial_case', 'Non renseigné')}

Synthèse clinique déjà produite par le Diagnostic Agent :
{state.get('diagnostic_summary', 'Non renseignée')}

Recommandation intermédiaire déjà produite :
{state.get('interim_care', 'Non renseignée')}

Traitement proposé par le médecin traitant :
{state.get('physician_treatment', 'Non renseigné')}

Vocabulaire INTERDIT : "diagnostic", "diagnostiquer", "prescription".
Vocabulaire À UTILISER : "orientation clinique préliminaire", "synthèse clinique", "recommandation intermédiaire".

Produis le rapport en remplissant les 4 champs demandés.
Reste prudent et nuancé dans la formulation (jamais de conclusion ferme).
"""

    # 2. Appeler le LLM avec structured output (Pydantic)
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1).with_structured_output(FinalReport)
    report = llm.invoke(prompt)

    # 3. Formater en Markdown lisible
    markdown = format_final_report(report)

    # 4. Stocker la string Markdown dans l'état
    return {"final_report": markdown}
