"use client";

import { createPortal } from "react-dom";

import type { Relationship } from "@/lib/types";

import {
  getBidirectionalDetail,
  getDirectionSummary,
} from "@/lib/relationships";

interface RelationshipHoverCardProps {
  relationship: Relationship;
  fromName: string;
  toName: string;
  position: { top: number; left: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const CARD_WIDTH = 260;

export default function RelationshipHoverCard({
  relationship,
  fromName,
  toName,
  position,
  onMouseEnter,
  onMouseLeave,
  onEdit,
  onDelete,
}: RelationshipHoverCardProps) {
  if (typeof document === "undefined") {
    return null;
  }

  const isBidirectional =
    relationship.direction === "BIDIRECTIONAL";

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
        <div className="truncate text-[11px] font-semibold text-[#eee]">
          {isBidirectional
            ? getBidirectionalDetail(fromName, toName)
            : getDirectionSummary(
                fromName,
                toName,
                "FORWARD",
              )}
        </div>

        <div className="mt-0.5 truncate text-[10px] text-[#999]">
          {relationship.relationship_type}
        </div>
      </div>

      {(relationship.context?.text ||
        relationship.reliance?.text) && (
        <div className="flex flex-col gap-1.5 px-3 py-2.5">
          {relationship.context?.text && (
            <div className="text-[10px]">
              <span className="text-[#666]">
                Context:{" "}
              </span>

              <span className="text-[#bbb]">
                {relationship.context.text}
              </span>
            </div>
          )}

          {relationship.reliance?.text && (
            <div className="text-[10px]">
              <span className="text-[#666]">
                Reliance:{" "}
              </span>

              <span className="text-[#bbb]">
                {relationship.reliance.text}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 border-t border-[#242424] px-3 py-2.5">
        <button
          type="button"
          className="h-7 flex-1 rounded-md border border-[#333] text-[10px] text-[#ccc] hover:bg-[#1f1f1f]"
          onClick={onEdit}
        >
          Edit Relationship
        </button>

        <button
          type="button"
          className="h-7 flex-1 rounded-md border border-red-900/60 bg-red-950/20 text-[10px] font-medium text-red-400 hover:bg-red-950/40"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>,
    document.body,
  );
}
