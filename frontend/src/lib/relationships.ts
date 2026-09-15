import type {
  Relationship,
  RelationshipDirection,
} from "./types";

/* =========================================================
   EFFECTIVE ENDPOINTS

   `source_node_id`/`target_node_id` are storage-level
   fields. For a REVERSE relationship the actual
   communication flows target -> source, so the "From"/"To"
   a person should see is not the same as source/target.
   This is the single place that translation happens so
   every surface (canvas modal, relationships table, edge
   arrows) agrees.
========================================================= */

export function getEffectiveEndpoints(
  sourceNodeId: string,
  targetNodeId: string,
  direction: RelationshipDirection,
): {
  fromId: string;
  toId: string;
} {
  if (direction === "REVERSE") {
    return {
      fromId: targetNodeId,
      toId: sourceNodeId,
    };
  }

  return {
    fromId: sourceNodeId,
    toId: targetNodeId,
  };
}

/* =========================================================
   HUMAN-READABLE DIRECTION LABEL

   Never surfaces FORWARD/REVERSE/BIDIRECTIONAL — always
   real node names.
========================================================= */

export function getDirectionSummary(
  fromName: string,
  toName: string,
  direction: RelationshipDirection,
): string {
  if (direction === "BIDIRECTIONAL") {
    return `${fromName} \u21c4 ${toName}`;
  }

  return `${fromName} \u2192 ${toName}`;
}

export function getBidirectionalDetail(
  fromName: string,
  toName: string,
): string {
  return `${fromName} \u2192 ${toName} and ${toName} \u2192 ${fromName}`;
}

/* =========================================================
   DUPLICATE-PAIR DETECTION

   A -> B and B -> A count as the same pair — only one
   communication relationship is allowed between any two
   nodes, regardless of direction.
========================================================= */

export function isSameNodePair(
  aSourceId: string,
  aTargetId: string,
  bSourceId: string,
  bTargetId: string,
): boolean {
  return (
    (aSourceId === bSourceId &&
      aTargetId === bTargetId) ||
    (aSourceId === bTargetId &&
      aTargetId === bSourceId)
  );
}

export function findDuplicateRelationship(
  relationships: Relationship[],
  sourceNodeId: string,
  targetNodeId: string,
  excludeRelationshipId?: string,
): Relationship | undefined {
  return relationships.find(
    (relationship) =>
      relationship.id !==
        excludeRelationshipId &&
      isSameNodePair(
        relationship.source_node_id,
        relationship.target_node_id,
        sourceNodeId,
        targetNodeId,
      ),
  );
}
