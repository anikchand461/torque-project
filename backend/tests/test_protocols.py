from app.graph_engine.router import GraphRouter
from app.models import Relationship, RelationshipDirection, Protocol


def test_protocol_can_block_target():
    router = GraphRouter()
    rel = Relationship(id="r", source_node_id="a", target_node_id="b", relationship_type="peer", direction=RelationshipDirection.FORWARD)
    protocol = Protocol(id="p", graph_id="g", name="restricted", allowed_targets=["c"])
    decision = router.evaluate("a", "b", rel, [protocol])
    assert not decision.allowed


def test_no_protocols_allows_communication():
    router = GraphRouter()
    rel = Relationship(id="r", source_node_id="a", target_node_id="b", relationship_type="peer", direction=RelationshipDirection.FORWARD)
    decision = router.evaluate("a", "b", rel, [])
    assert decision.allowed


def test_all_protocols_must_allow():
    router = GraphRouter()
    rel = Relationship(id="r", source_node_id="a", target_node_id="b", relationship_type="peer", direction=RelationshipDirection.FORWARD)
    permissive = Protocol(id="p1", graph_id="g", name="permissive")
    blocking = Protocol(id="p2", graph_id="g", name="blocking", can_send=False)
    decision = router.evaluate("a", "b", rel, [permissive, blocking])
    assert not decision.allowed
    assert decision.protocol_id == "p2"
