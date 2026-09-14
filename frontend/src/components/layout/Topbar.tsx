"use client";

import {
  Play,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Loader2,
} from "lucide-react";

import type { ValidationResult } from "@/lib/types";

interface TopbarProps {
  graphName: string;
  onExecute: () => void | Promise<void>;
  executing?: boolean;
  validation?: ValidationResult | null;
}

export default function Topbar({
  graphName,
  onExecute,
  executing = false,
  validation = null,
}: TopbarProps) {
  async function handleExecuteClick() {
    console.log("================================");
    console.log("EXECUTE BUTTON CLICKED");
    console.log("Graph:", graphName);
    console.log("Executing:", executing);
    console.log("================================");

    if (executing) {
      console.log(
        "EXECUTE BLOCKED: already executing",
      );

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
        <div className="breadcrumb">
          <span className="breadcrumb-muted">
            Graphs
          </span>

          <span className="breadcrumb-separator">
            /
          </span>

          <span>
            {graphName}
          </span>

          <ChevronDown size={14} />
        </div>
      </div>

      <div className="topbar-right">
        {validation && (
          <div
            className="validation-status"
            style={
              validation.valid
                ? undefined
                : { color: "#f87171" }
            }
          >
            {validation.valid ? (
              <CheckCircle2 size={15} />
            ) : (
              <AlertTriangle size={15} />
            )}

            <span>
              {validation.valid
                ? "Valid graph"
                : `Invalid graph (${validation.errors.length})`}
            </span>
          </div>
        )}

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