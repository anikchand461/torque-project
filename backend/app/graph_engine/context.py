from typing import Any
from app.models import Node, Relationship


class ContextBuilder:
    def build(self, node: Node, question: str, previous_responses: list[dict[str, Any]], relationships: list[Relationship]) -> dict[str, Any]:
        # `relationships` must have `.protocols` already
        # eager-loaded (selectinload) by the caller — async
        # SQLAlchemy cannot lazily load it here.
        applicable_protocols = []
        for rel in relationships:
            for p in rel.protocols:
                applicable_protocols.append({
                    "protocol_id": p.id,
                    "name": p.name,
                    "confidentiality": p.confidentiality,
                    "allowed_information_types": p.allowed_information_types or [],
                })

        return {
            "node_name": node.name,
            "question": question,
            "role": node.role,
            "title": node.title,
            "responsibilities": node.responsibilities or [],
            "decision_rights": node.decision_rights or [],
            "relevant_relationship_ids": [r.id for r in relationships],
            "applicable_protocols": applicable_protocols,
        }
