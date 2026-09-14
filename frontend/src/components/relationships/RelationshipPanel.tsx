"use client";

import {
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Pencil,
  Trash2,
  GitBranch,
} from "lucide-react";

import type {
  Relationship,
  RelationshipDirection,
  Node as TorqueNode,
} from "@/lib/types";

interface RelationshipPanelProps {
  relationships: Relationship[];

  nodes: TorqueNode[];

  onEditRelationship?: (
    relationship: Relationship,
  ) => void;

  onDeleteRelationship?: (
    relationshipId: string,
  ) => void;
}

/* =========================================================
   NODE NAME
========================================================= */

function getNodeName(
  nodes: TorqueNode[],
  id: string,
) {
  return (
    nodes.find(
      (node) =>
        node.id === id,
    )?.name ?? "Unknown"
  );
}

/* =========================================================
   DIRECTION ICON
========================================================= */

function DirectionIcon({
  direction,
}: {
  direction: RelationshipDirection;
}) {
  if (
    direction ===
    "FORWARD"
  ) {
    return (
      <ArrowRight
        size={13}
        strokeWidth={1.8}
      />
    );
  }

  if (
    direction ===
    "REVERSE"
  ) {
    return (
      <ArrowLeft
        size={13}
        strokeWidth={1.8}
      />
    );
  }

  return (
    <ArrowLeftRight
      size={13}
      strokeWidth={1.8}
    />
  );
}

/* =========================================================
   DIRECTION LABEL
========================================================= */

function getDirectionLabel(
  direction: RelationshipDirection,
) {
  if (
    direction ===
    "FORWARD"
  ) {
    return "Forward";
  }

  if (
    direction ===
    "REVERSE"
  ) {
    return "Reverse";
  }

  return "Bidirectional";
}

/* =========================================================
   PANEL
========================================================= */

export default function RelationshipPanel({
  relationships,
  nodes,
  onEditRelationship,
  onDeleteRelationship,
}: RelationshipPanelProps) {
  function handleDelete(
    relationship: Relationship,
  ) {
    const sourceName =
      getNodeName(
        nodes,
        relationship.source_node_id,
      );

    const targetName =
      getNodeName(
        nodes,
        relationship.target_node_id,
      );

    const confirmed =
      window.confirm(
        `Delete this relationship?\n\n${sourceName} → ${targetName}\n\nThis action cannot be undone.`,
      );

    if (!confirmed) {
      return;
    }

    onDeleteRelationship?.(
      relationship.id,
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="shrink-0 border-b border-[#242424] px-6 py-4">
        <div className="text-[9px] font-bold tracking-[0.12em] text-[#555]">
          RELATIONSHIPS
        </div>

        <div className="mt-1 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[16px] font-semibold text-[#eee]">
              Communication Relationships
            </h2>

            <span className="rounded-md border border-[#292929] bg-[#151515] px-2 py-1 text-[9px] text-[#666]">
              {relationships.length}
            </span>
          </div>
        </div>

        <p className="mt-1 text-[9px] text-[#555]">
          Manage communication paths between
          organizational positions.
        </p>
      </div>

      {/* ===================================================
          CONTENT
      =================================================== */}

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {relationships.length ===
        0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center">
            <div className="max-w-sm text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[#292929] bg-[#151515] text-[#555]">
                <GitBranch size={20} />
              </div>

              <h3 className="mt-4 text-[12px] font-semibold text-[#ccc]">
                No communication relationships
              </h3>

              <p className="mt-1 text-[9px] leading-5 text-[#555]">
                Connect two nodes from the Graph
                view to create a relationship.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#292929]">
            {/* =================================================
                TABLE HEADER
            ================================================= */}

            <div className="grid grid-cols-[minmax(140px,1fr)_44px_minmax(140px,1fr)_150px_130px_80px] items-center border-b border-[#292929] bg-[#151515] px-4 py-3 text-[8px] font-bold tracking-[0.1em] text-[#555]">
              <span>
                SOURCE
              </span>

              <span />

              <span>
                TARGET
              </span>

              <span>
                TYPE
              </span>

              <span>
                DIRECTION
              </span>

              <span className="text-right">
                ACTIONS
              </span>
            </div>

            {/* =================================================
                ROWS
            ================================================= */}

            {relationships.map(
              (relationship) => {
                const sourceName =
                  getNodeName(
                    nodes,
                    relationship.source_node_id,
                  );

                const targetName =
                  getNodeName(
                    nodes,
                    relationship.target_node_id,
                  );

                return (
                  <div
                    key={
                      relationship.id
                    }
                    className="group grid grid-cols-[minmax(140px,1fr)_44px_minmax(140px,1fr)_150px_130px_80px] items-center border-b border-[#222] px-4 py-3 transition-colors last:border-b-0 hover:bg-[#141414]"
                  >
                    {/* SOURCE */}

                    <div
                      title={
                        sourceName
                      }
                      className="min-w-0 truncate text-[10px] font-medium text-[#ddd]"
                    >
                      {
                        sourceName
                      }
                    </div>

                    {/* ICON */}

                    <div className="flex justify-center text-[#777]">
                      <DirectionIcon
                        direction={
                          relationship.direction
                        }
                      />
                    </div>

                    {/* TARGET */}

                    <div
                      title={
                        targetName
                      }
                      className="min-w-0 truncate text-[10px] font-medium text-[#ddd]"
                    >
                      {
                        targetName
                      }
                    </div>

                    {/* TYPE */}

                    <div
                      title={
                        relationship.relationship_type
                      }
                      className="min-w-0 truncate text-[9px] text-[#777]"
                    >
                      {
                        relationship.relationship_type
                      }
                    </div>

                    {/* DIRECTION */}

                    <div className="flex items-center gap-1.5 text-[9px] text-[#777]">
                      <DirectionIcon
                        direction={
                          relationship.direction
                        }
                      />

                      <span>
                        {getDirectionLabel(
                          relationship.direction,
                        )}
                      </span>
                    </div>

                    {/* ACTIONS */}

                    <div className="flex justify-end gap-1">
                      {/* EDIT */}

                      <button
                        type="button"
                        title="Edit relationship"
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#555] opacity-60 transition hover:bg-[#222] hover:text-[#eee] group-hover:opacity-100"
                        onClick={() =>
                          onEditRelationship?.(
                            relationship,
                          )
                        }
                      >
                        <Pencil
                          size={12}
                        />
                      </button>

                      {/* DELETE */}

                      <button
                        type="button"
                        title="Delete relationship"
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#555] opacity-60 transition hover:bg-red-950/30 hover:text-red-400 group-hover:opacity-100"
                        onClick={() =>
                          handleDelete(
                            relationship,
                          )
                        }
                      >
                        <Trash2
                          size={12}
                        />
                      </button>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    </div>
  );
}