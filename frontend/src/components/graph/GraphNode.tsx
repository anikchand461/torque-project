"use client";

import { Fragment } from "react";

import {
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";

import type {
  Node as TorqueNode,
} from "@/lib/types";

type GraphNodeData = {
  node: TorqueNode;
};

/* =========================================================
   HANDLES

   Every side has BOTH a source-typed and a target-typed
   handle, stacked at the exact same position. This is what
   lets an edge connect to whichever side actually faces the
   other node (see pickHandlePair in GraphCanvas.tsx) instead
   of being forced onto a fixed, sometimes-wrong side —
   without ever asking React Flow to resolve a handle id from
   the wrong type list (which is what silently drops an
   edge's visual connection). Two perfectly overlapping,
   identically-styled dots at the same spot are visually
   indistinguishable from one, so this doesn't create a
   "duplicate circle" look.
========================================================= */

const HANDLE_SIDES = [
  {
    side: "top",
    position: Position.Top,
  },
  {
    side: "right",
    position: Position.Right,
  },
  {
    side: "bottom",
    position: Position.Bottom,
  },
  {
    side: "left",
    position: Position.Left,
  },
] as const;

const HANDLE_CLASS =
  "!h-3 !w-3 !border-0 !bg-[#777] transition-colors hover:!bg-[#eee]";

export default function GraphNode({
  data,
  selected,
}: NodeProps) {
  const { node } =
    data as unknown as GraphNodeData;

  const initials =
    node.name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="relative">
      {HANDLE_SIDES.map(
        ({ side, position }) => (
          <Fragment key={side}>
            <Handle
              id={`${side}-source`}
              type="source"
              position={position}
              className={HANDLE_CLASS}
            />

            <Handle
              id={`${side}-target`}
              type="target"
              position={position}
              className={HANDLE_CLASS}
            />
          </Fragment>
        ),
      )}

      {/* ==========================================
          NODE BODY
      ========================================== */}

      <div
        className={[
          "torque-flow-node",
          "relative",
          selected
            ? "torque-flow-node-selected"
            : "",
        ].join(" ")}
      >
        <div className="torque-node-avatar">
          {initials}
        </div>

        <div className="torque-node-content">
          <div className="torque-node-name">
            {node.name}
          </div>

          {node.title && (
            <div className="torque-node-title">
              {node.title}
            </div>
          )}

          {node.role && (
            <div className="torque-node-role">
              {node.role}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
