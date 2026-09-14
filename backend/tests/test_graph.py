from app.graph_engine.validator import GraphValidator
from app.models import Node


def test_hierarchy_cycle_is_rejected():
    a = Node(id="a", graph_id="g", name="A", parent_id="b")
    b = Node(id="b", graph_id="g", name="B", parent_id="a")
    result = GraphValidator().validate([a, b], [], [])
    assert not result.valid
    assert any("cycle" in e.lower() for e in result.errors)
