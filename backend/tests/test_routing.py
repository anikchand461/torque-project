from app.graph_engine.router import GraphRouter
from app.models import Relationship, RelationshipDirection


def test_forward_only_does_not_route_reverse():
    router = GraphRouter()
    rel = Relationship(id="r", source_node_id="a", target_node_id="b", relationship_type="x", direction=RelationshipDirection.FORWARD)
    assert router.get_candidates("a", [rel])[0][1] == "b"
    assert router.get_candidates("b", [rel]) == []
