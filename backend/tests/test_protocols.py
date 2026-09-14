from app.graph_engine.router import GraphRouter
from app.models import Relationship, RelationshipDirection, Protocol


def test_protocol_can_block_target():
    router = GraphRouter()
    rel = Relationship(id="r", source_node_id="a", target_node_id="b", relationship_type="peer", direction=RelationshipDirection.FORWARD)
    protocol = Protocol(id="p", graph_id="g", name="restricted", allowed_targets=["c"])
    decision = router.evaluate("a", "b", rel, protocol)
    assert not decision.allowed
