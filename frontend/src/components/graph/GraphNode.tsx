"use client";

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
      {/* ==========================================
          TOP
          Incoming connection
      ========================================== */}

      <Handle
        id="top-target"
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-0 !bg-[#777] transition-colors hover:!bg-[#eee]"
      />

      {/* ==========================================
          RIGHT
          Outgoing connection
      ========================================== */}

      <Handle
        id="right-source"
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-0 !bg-[#777] transition-colors hover:!bg-[#eee]"
      />

      {/* ==========================================
          LEFT
          Incoming connection
      ========================================== */}

      <Handle
        id="left-target"
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-0 !bg-[#777] transition-colors hover:!bg-[#eee]"
      />

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

      {/* ==========================================
          BOTTOM
          Outgoing connection
      ========================================== */}

      <Handle
        id="bottom-source"
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-0 !bg-[#777] transition-colors hover:!bg-[#eee]"
      />
    </div>
  );
}