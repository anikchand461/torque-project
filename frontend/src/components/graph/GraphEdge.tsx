"use client";

import {
  BaseEdge,
  getStraightPath,
  type EdgeProps,
} from "@xyflow/react";

export type TorqueEdgeData = {
  kind?: "hierarchy" | "communication";
  relationshipType?: string;
  direction?: string;
};

export default function GraphEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  markerStart,
  markerEnd,
  data,
}: EdgeProps) {
  const edgeData =
    data as TorqueEdgeData | undefined;

  const isHierarchy =
    edgeData?.kind === "hierarchy";

  const [edgePath] =
    getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });

  if (isHierarchy) {
    return (
      <BaseEdge
        id={id}
        path={edgePath}
        interactionWidth={24}
        style={{
          stroke: selected
            ? "#eee"
            : "#888",
          strokeWidth: selected
            ? 2.5
            : 1.8,
        }}
      />
    );
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      interactionWidth={28}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={{
        stroke: selected
          ? "#eee"
          : "#888",
        strokeWidth: selected
          ? 2.5
          : 1.8,
      }}
    />
  );
}
