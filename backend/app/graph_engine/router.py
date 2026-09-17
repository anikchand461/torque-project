from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from app.models import Relationship, RelationshipDirection, Protocol


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(slots=True)
class RoutingDecision:
    from_node: str
    to_node: str
    allowed: bool
    reason: str
    relationship_id: str | None = None
    protocol_id: str | None = None
    timestamp: datetime = field(default_factory=utcnow)


class GraphRouter:
    def get_candidates(self, node_id: str, relationships: list[Relationship]) -> list[tuple[Relationship, str]]:
        candidates: list[tuple[Relationship, str]] = []
        for rel in relationships:
            if rel.source_node_id == node_id and rel.direction in (RelationshipDirection.FORWARD, RelationshipDirection.BIDIRECTIONAL):
                candidates.append((rel, rel.target_node_id))
            elif rel.target_node_id == node_id and rel.direction in (RelationshipDirection.REVERSE, RelationshipDirection.BIDIRECTIONAL):
                candidates.append((rel, rel.source_node_id))
        return candidates

    def evaluate(self, source_node_id: str, target_node_id: str, relationship: Relationship, protocols: list[Protocol], info_type: str | None = None) -> RoutingDecision:
        if not protocols:
            return RoutingDecision(source_node_id, target_node_id, True, "No protocol restriction configured.", relationship.id, None, utcnow())

        # A relationship can now carry more than one
        # protocol; communication is allowed only if every
        # attached protocol allows it (AND semantics). This
        # is a direct generalization of the previous
        # single-protocol behavior — with 0 or 1 protocols
        # attached, the result is identical to before.
        # `protocol_id` on the decision reflects whichever
        # protocol blocked it, or the first protocol
        # evaluated if all of them allow it.
        for protocol in protocols:
            if not protocol.can_send:
                return RoutingDecision(source_node_id, target_node_id, False, "Protocol blocks sending.", relationship.id, protocol.id, utcnow())
            if not protocol.can_receive:
                return RoutingDecision(source_node_id, target_node_id, False, "Protocol blocks receiving.", relationship.id, protocol.id, utcnow())
            if protocol.allowed_targets and target_node_id not in protocol.allowed_targets:
                return RoutingDecision(source_node_id, target_node_id, False, "Target is not allowed by protocol.", relationship.id, protocol.id, utcnow())
            if info_type and protocol.allowed_information_types and info_type not in protocol.allowed_information_types:
                return RoutingDecision(source_node_id, target_node_id, False, "Information type is not allowed by protocol.", relationship.id, protocol.id, utcnow())

        return RoutingDecision(source_node_id, target_node_id, True, "Relationship direction and all attached protocols allow communication.", relationship.id, protocols[0].id, utcnow())
