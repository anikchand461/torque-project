from typing import Any
from app.models import Node, Relationship, Protocol


class ContextBuilder:
    def build(self, node: Node, question: str, previous_responses: list[dict[str, Any]], relationships: list[Relationship], protocols: dict[str, Protocol]) -> dict[str, Any]:
        applicable_protocols = []
        for rel in relationships:
            if rel.protocol_id and rel.protocol_id in protocols:
                p = protocols[rel.protocol_id]
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
