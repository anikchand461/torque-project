import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, init_db
from app.models import Graph, Node, Protocol, Relationship, RelationshipDirection


async def main():
    await init_db()
    async with AsyncSessionLocal() as db:
        graph = Graph(name="Apple Decision Graph", description="Sample organization graph", target_organization="Apple")
        db.add(graph)
        await db.flush()

        ceo = Node(graph_id=graph.id, name="Apple CEO", title="CEO", role="Executive", responsibilities=["Company strategy"], decision_rights=["Strategic decisions"], persona_details={"seniority": "executive"})
        cto = Node(graph_id=graph.id, name="CTO", title="CTO", role="Technology", parent=ceo, responsibilities=["Technology strategy"], decision_rights=["Technology decisions"], persona_details={"seniority": "executive"})
        it = Node(graph_id=graph.id, name="IT Manager", title="IT Manager", role="IT Operations", parent=cto, responsibilities=["IT operations"], decision_rights=["Operational IT decisions"], persona_details={"seniority": "manager"})
        cfo = Node(graph_id=graph.id, name="CFO", title="CFO", role="Finance", parent=ceo, responsibilities=["Financial strategy"], decision_rights=["Financial decisions"], persona_details={"seniority": "executive"})
        db.add_all([ceo, cto, it, cfo])
        await db.flush()

        protocol = Protocol(graph_id=graph.id, name="Executive Communication", can_send=True, can_receive=True, can_escalate=True, can_forward=True, allowed_targets=[cto.id, cfo.id, it.id])
        db.add(protocol)
        await db.flush()

        ceo_cto = Relationship(graph_id=graph.id, source_node_id=ceo.id, target_node_id=cto.id, relationship_type="communication", direction=RelationshipDirection.BIDIRECTIONAL)
        ceo_cfo = Relationship(graph_id=graph.id, source_node_id=ceo.id, target_node_id=cfo.id, relationship_type="communication", direction=RelationshipDirection.BIDIRECTIONAL)
        cto_it = Relationship(graph_id=graph.id, source_node_id=cto.id, target_node_id=it.id, relationship_type="communication", direction=RelationshipDirection.BIDIRECTIONAL)

        # protocol_id no longer exists on Relationship — a
        # protocol is attached via the many-to-many
        # relationship_protocols association instead. The
        # same protocol can be (and here, is) attached to
        # more than one relationship.
        ceo_cto.protocols.append(protocol)
        ceo_cfo.protocols.append(protocol)
        cto_it.protocols.append(protocol)

        db.add_all([ceo_cto, ceo_cfo, cto_it])
        await db.commit()
        print(f"Seeded graph: {graph.id}")
        print(f"Start node (CEO): {ceo.id}")


if __name__ == "__main__":
    asyncio.run(main())
