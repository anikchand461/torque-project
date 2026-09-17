"use client";

import { createPortal } from "react-dom";

import type { Node as TorqueNode } from "@/lib/types";

interface NodeHoverCardProps {
  node: TorqueNode;
  parentName: string | null;
  position: { top: number; left: number };
  deleting: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const CARD_WIDTH = 240;

export default function NodeHoverCard({
  node,
  parentName,
  position,
  deleting,
  onMouseEnter,
  onMouseLeave,
  onEdit,
  onDelete,
}: NodeHoverCardProps) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed z-[10000] overflow-hidden rounded-lg border border-[#2c2c2c] bg-[#151515] shadow-[0_15px_45px_rgba(0,0,0,0.55)]"
      style={{
        top: position.top,
        left: position.left,
        width: CARD_WIDTH,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="border-b border-[#242424] px-3 py-2.5">
        <div className="truncate text-[12px] font-semibold text-[#eee]">
          {node.name}
        </div>

        {node.title && (
          <div className="mt-0.5 truncate text-[10px] text-[#999]">
            {node.title}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        {node.role && (
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <span className="text-[#666]">
              Role
            </span>

            <span className="truncate text-[#bbb]">
              {node.role}
            </span>
          </div>
        )}

        {parentName && (
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <span className="text-[#666]">
              Parent
            </span>

            <span className="truncate text-[#bbb]">
              {parentName}
            </span>
          </div>
        )}

        {!node.role && !parentName && (
          <div className="text-[10px] text-[#555]">
            No additional details.
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-[#242424] px-3 py-2.5">
        <button
          type="button"
          className="h-7 flex-1 rounded-md border border-[#333] text-[10px] text-[#ccc] hover:bg-[#1f1f1f]"
          onClick={onEdit}
        >
          Edit Node
        </button>

        <button
          type="button"
          className="h-7 flex-1 rounded-md border border-red-900/60 bg-red-950/20 text-[10px] font-medium text-red-400 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete Node"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
