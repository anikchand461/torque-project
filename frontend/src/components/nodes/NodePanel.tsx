"use client";

import {
  Plus,
  Trash2,
  ChevronRight,
} from "lucide-react";

import type {
  Node as TorqueNode,
} from "@/lib/types";

interface NodePanelProps {
  nodes: TorqueNode[];

  onAddNode?: () => void;

  onDeleteNode?: (
    nodeId: string,
  ) => void;

  onSelectNode?: (
    node: TorqueNode,
  ) => void;
}

export default function NodePanel({
  nodes,
  onAddNode,
  onDeleteNode,
  onSelectNode,
}: NodePanelProps) {
  function handleDelete(
    node: TorqueNode,
  ) {
    const confirmed =
      window.confirm(
        `Delete "${node.name}"?\n\nThis will permanently delete this organizational position and any relationships connected to it.`,
      );

    if (!confirmed) {
      return;
    }

    onDeleteNode?.(node.id);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* =========================================
          HEADER
      ========================================= */}

      <div className="flex shrink-0 items-center justify-between border-b border-[#242424] px-6 py-4">
        <div>
          <div className="text-[9px] font-bold tracking-[0.12em] text-[#555]">
            NODES
          </div>

          <h2 className="mt-1 text-[16px] font-semibold text-[#eee]">
            Organizational Positions
          </h2>

          <p className="mt-1 text-[9px] text-[#555]">
            {nodes.length}{" "}
            {nodes.length === 1
              ? "position"
              : "positions"}
          </p>
        </div>

        <button
          type="button"
          onClick={onAddNode}
          className="flex cursor-pointer items-center gap-2 rounded-md bg-[#eee] px-3 py-2 text-[10px] font-semibold text-[#111] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!onAddNode}
        >
          <Plus size={13} />
          Add Node
        </button>
      </div>

      {/* =========================================
          CONTENT
      ========================================= */}

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {nodes.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center">
            <div className="max-w-sm text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[#292929] bg-[#151515] text-[#555]">
                <Plus size={20} />
              </div>

              <h3 className="mt-4 text-[12px] font-semibold text-[#ccc]">
                No organizational positions
              </h3>

              <p className="mt-1 text-[9px] leading-5 text-[#555]">
                Add a node to start building
                your organization graph.
              </p>

              <button
                type="button"
                onClick={onAddNode}
                className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#eee] px-3 py-2 text-[10px] font-semibold text-[#111] hover:bg-white"
              >
                <Plus size={13} />
                Add Node
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {nodes.map((node) => (
              <div
                key={node.id}
                className="group flex items-center gap-3 rounded-lg border border-[#292929] bg-[#151515] p-4 transition-colors hover:border-[#3a3a3a] hover:bg-[#171717]"
              >
                {/* NODE AVATAR */}

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#303030] bg-[#1d1d1d] text-[10px] font-semibold text-[#aaa]">
                  {node.name
                    .split(" ")
                    .filter(Boolean)
                    .map(
                      (word) =>
                        word[0],
                    )
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                {/* NODE DETAILS */}

                <button
                  type="button"
                  onClick={() =>
                    onSelectNode?.(
                      node,
                    )
                  }
                  className="min-w-0 flex-1 cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2">
                    <div className="truncate text-[12px] font-semibold text-[#eee]">
                      {node.name}
                    </div>

                    <ChevronRight
                      size={13}
                      className="shrink-0 text-[#444] transition group-hover:text-[#777]"
                    />
                  </div>

                  {node.title && (
                    <div className="mt-1 truncate text-[10px] text-[#777]">
                      {node.title}
                    </div>
                  )}

                  {node.role && (
                    <div className="mt-0.5 truncate text-[9px] text-[#555]">
                      {node.role}
                    </div>
                  )}

                  {node.parent_id && (
                    <div className="mt-2 text-[8px] text-[#444]">
                      Has parent position
                    </div>
                  )}
                </button>

                {/* DELETE */}

                <button
                  type="button"
                  title="Delete node"
                  onClick={() =>
                    handleDelete(node)
                  }
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#555] opacity-60 transition hover:bg-red-950/30 hover:text-red-400 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}