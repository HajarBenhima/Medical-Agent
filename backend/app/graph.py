from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from app.state import MedicalState
from app.nodes.supervisor import supervisor
from app.nodes.diagnostic_agent import diagnostic_agent
from app.nodes.physician_review import physician_review
from app.nodes.report_agent import report_agent

# Create the graph
builder = StateGraph(MedicalState)

#Add nodes to the graph
builder.add_node("supervisor", supervisor)
builder.add_node("diagnostic_agent", diagnostic_agent)
builder.add_node("physician_review", physician_review)
builder.add_node("report_agent", report_agent)

# Define transitions
builder.add_edge(START, "supervisor")
builder.add_conditional_edges(
    "supervisor",
    lambda state: state["next"],
    {
        "diagnostic_agent": "diagnostic_agent",
        "physician_review": "physician_review",
        "report_agent": "report_agent",
        "FINISH": END,
    }
)

# The 3 nodes that return always to supervisor
builder.add_edge("diagnostic_agent", "supervisor")
builder.add_edge("physician_review", "supervisor")
builder.add_edge("report_agent", "supervisor")

# Compile the graph
graph = builder.compile()
