from dataclasses import dataclass, field
from typing import Iterable
from app.models import Node, Relationship, Protocol


@dataclass
class ValidationResult:
    valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


class GraphValidator:
    def validate(self, nodes: Iterable[Node], relationships: Iterable[Relationship], protocols: Iterable[Protocol]) -> ValidationResult:
        nodes = list(nodes)
        relationships = list(relationships)
        protocols = list(protocols)
        errors: list[str] = []
        warnings: list[str] = []

        node_ids = [n.id for n in nodes]
        if len(node_ids) != len(set(node_ids)):
            errors.append("Duplicate node IDs detected.")
        node_set = set(node_ids)
        protocol_set = {p.id for p in protocols}

        for node in nodes:
            if node.parent_id and node.parent_id not in node_set:
                errors.append(f"Node {node.id} has invalid parent reference {node.parent_id}.")
            if node.parent_id == node.id:
                errors.append(f"Node {node.id} cannot be its own parent.")

        for rel in relationships:
            if rel.source_node_id not in node_set:
                errors.append(f"Relationship {rel.id} has invalid source node {rel.source_node_id}.")
            if rel.target_node_id not in node_set:
                errors.append(f"Relationship {rel.id} has invalid target node {rel.target_node_id}.")
            if rel.source_node_id == rel.target_node_id:
                errors.append(f"Relationship {rel.id} cannot connect a node to itself.")
            if rel.protocol_id and rel.protocol_id not in protocol_set:
                errors.append(f"Relationship {rel.id} references invalid protocol {rel.protocol_id}.")

        # Hierarchy cycles only; communication relationship cycles are valid.
        parent_map = {n.id: n.parent_id for n in nodes if n.parent_id}
        for node_id in parent_map:
            seen: set[str] = set()
            current = node_id
            while current in parent_map:
                if current in seen:
                    errors.append(f"Hierarchy cycle detected involving node {node_id}.")
                    break
                seen.add(current)
                current = parent_map[current]  # type: ignore[index]

        if nodes:
            roots = [n for n in nodes if n.parent_id is None]
            if len(roots) > 1:
                warnings.append(f"Hierarchy has {len(roots)} root-level nodes.")

        return ValidationResult(valid=not errors, errors=errors, warnings=warnings)
