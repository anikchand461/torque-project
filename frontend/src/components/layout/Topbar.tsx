"use client";

import { useState } from "react";

import {
  Play,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  Loader2,
  Plus,
  MoreVertical,
} from "lucide-react";

import type { Graph, ValidationResult } from "@/lib/types";

interface TopbarProps {
  graphName: string;
  graphs: Graph[];
  selectedGraphId?: string | null;
  onSelectGraph: (graphId: string) => void;

  hasSelectedGraph: boolean;
  showGraphMenu: boolean;
  onToggleGraphMenu: () => void;
  onCloseGraphMenu: () => void;
  onDeleteGraph: () => void;
  deletingGraph?: boolean;
  onOpenGraphSettings: () => void;

  onValidate: () => void;
  validation?: ValidationResult | null;
  validateDisabled?: boolean;

  onAddNode: () => void;
  addNodeDisabled?: boolean;

  onExecute: () => void | Promise<void>;
  executing?: boolean;
}

export default function Topbar({
  graphName,
  graphs,
  selectedGraphId = null,
  onSelectGraph,
  hasSelectedGraph,
  showGraphMenu,
  onToggleGraphMenu,
  onCloseGraphMenu,
  onDeleteGraph,
  deletingGraph = false,
  onOpenGraphSettings,
  onValidate,
  validation = null,
  validateDisabled = false,
  onAddNode,
  addNodeDisabled = false,
  onExecute,
  executing = false,
}: TopbarProps) {
  const [showSwitcher, setShowSwitcher] =
    useState(false);

  async function handleExecuteClick() {
    if (executing) {
      return;
    }

    try {
      await onExecute();
    } catch (error) {
      console.error(
        "EXECUTE HANDLER ERROR:",
        error,
      );
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="relative">
          <button
            type="button"
            className="breadcrumb cursor-pointer"
            onClick={() =>
              setShowSwitcher(
                (current) => !current,
              )
            }
          >
            <span className="breadcrumb-muted">
              Graphs
            </span>

            <span className="breadcrumb-separator">
              /
            </span>

            <span>{graphName}</span>

            <ChevronDown size={14} />
          </button>

          {showSwitcher &&
            graphs.length > 0 && (
              <>
                {/* Click-away backdrop */}
                <div
                  className="fixed inset-0 z-[9998]"
                  onClick={() =>
                    setShowSwitcher(false)
                  }
                />

                <div className="absolute left-0 top-10 z-[9999] max-h-[320px] w-[240px] overflow-y-auto rounded-lg border border-[#303030] bg-[#151515] shadow-xl">
                  {graphs.map((graph) => (
                    <button
                      key={graph.id}
                      type="button"
                      className={`block w-full cursor-pointer truncate px-3 py-2.5 text-left text-[10px] hover:bg-[#202020] hover:text-[#eee] ${
                        graph.id ===
                        selectedGraphId
                          ? "text-[#eee]"
                          : "text-[#aaa]"
                      }`}
                      onClick={() => {
                        onSelectGraph(
                          graph.id,
                        );

                        setShowSwitcher(
                          false,
                        );
                      }}
                    >
                      {graph.name}
                    </button>
                  ))}
                </div>
              </>
            )}
        </div>

        {hasSelectedGraph && (
          <div className="relative">
            <button
              type="button"
              title="Graph options"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#777] hover:bg-[#1d1d1d] hover:text-[#eee]"
              onClick={(event) => {
                event.stopPropagation();
                onToggleGraphMenu();
              }}
            >
              <MoreVertical size={15} />
            </button>

            {showGraphMenu && (
              <>
                <div
                  className="fixed inset-0 z-[9998]"
                  onClick={
                    onCloseGraphMenu
                  }
                />

                <div
                  className="absolute left-0 top-9 z-[9999] w-[180px] overflow-hidden rounded-lg border border-[#303030] bg-[#151515] shadow-xl"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >
                  <button
                    type="button"
                    className="block w-full cursor-pointer px-3 py-2.5 text-left text-[10px] text-[#aaa] hover:bg-[#202020] hover:text-[#eee]"
                    onClick={
                      onOpenGraphSettings
                    }
                  >
                    Graph Settings
                  </button>

                  <div className="border-t border-[#292929]" />

                  <button
                    type="button"
                    disabled={
                      deletingGraph
                    }
                    className="block w-full cursor-pointer px-3 py-2.5 text-left text-[10px] text-red-400 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={
                      onDeleteGraph
                    }
                  >
                    {deletingGraph
                      ? "Deleting..."
                      : "Delete Graph"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="secondary-button"
          onClick={onValidate}
          disabled={validateDisabled}
        >
          {validation?.valid ? (
            <CheckCircle2 size={15} />
          ) : (
            <RefreshCw size={15} />
          )}

          {validation?.valid
            ? "Valid graph"
            : "Validate"}
        </button>

        <button
          type="button"
          className="primary-button"
          onClick={onAddNode}
          disabled={addNodeDisabled}
        >
          <Plus size={15} />
          Add Node
        </button>

        <button
          type="button"
          className="execute-button"
          onClick={handleExecuteClick}
          disabled={executing}
        >
          {executing ? (
            <Loader2
              size={15}
              className="animate-spin"
            />
          ) : (
            <Play
              size={15}
              fill="currentColor"
            />
          )}

          <span>
            {executing
              ? "Executing..."
              : "Execute"}
          </span>
        </button>
      </div>
    </header>
  );
}
