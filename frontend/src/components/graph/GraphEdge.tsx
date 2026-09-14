"use client";

import {
  BaseEdge,
  getStraightPath,
  type EdgeProps,
} from "@xyflow/react";

export type TorqueEdgeData = {
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
}: EdgeProps) {
  const [edgePath] =
    getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      interactionWidth={28}
      style={{
        stroke: selected
          ? "#eee"
          : "#555",
        strokeWidth: selected
          ? 2.5
          : 1.8,
      }}
    />
  );
}