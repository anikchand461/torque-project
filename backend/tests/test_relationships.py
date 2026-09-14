from app.graph_engine.router import GraphRouter
from app.models import Relationship, RelationshipDirection


def test_bidirectional_relationship_routes_both_ways():
    router = GraphRouter()
    rel = Relationship(id="r", source_node_id="a", target_node_id="b", relationship_type="peer", direction=RelationshipDirection.BIDIRECTIONAL)
    assert router.get_candidates("a", [rel])[0][1] == "b"
    assert router.get_candidates("b", [rel])[0][1] == "a"
