"use client";

import {
  Plus,
  ShieldCheck,
  Pencil,
  Trash2,
} from "lucide-react";

import type {
  Protocol,
} from "@/lib/types";

interface ProtocolPanelProps {
  protocols: Protocol[];

  onAddProtocol?: () => void;

  onSelectProtocol?: (
    protocol: Protocol,
  ) => void;

  onDeleteProtocol?: (
    protocolId: string,
  ) => void;
}

export default function ProtocolPanel({
  protocols,
  onAddProtocol,
  onSelectProtocol,
  onDeleteProtocol,
}: ProtocolPanelProps) {
  function handleDelete(
    protocol: Protocol,
  ) {
    const confirmed =
      window.confirm(
        `Delete "${protocol.name}"?\n\nThis communication protocol will be permanently deleted.`,
      );

    if (!confirmed) {
      return;
    }

    onDeleteProtocol?.(
      protocol.id,
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* =========================================
          HEADER
      ========================================= */}

      <div className="flex shrink-0 items-center justify-between border-b border-[#242424] px-6 py-4">
        <div>
          <div className="text-[9px] font-bold tracking-[0.12em] text-[#555]">
            PROTOCOLS
          </div>

          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-[16px] font-semibold text-[#eee]">
              Communication Protocols
            </h2>

            <span className="rounded-md border border-[#292929] bg-[#151515] px-2 py-1 text-[8px] text-[#666]">
              {protocols.length}
            </span>
          </div>

          <p className="mt-1 text-[9px] text-[#555]">
            Define communication permissions
            between organizational positions.
          </p>
        </div>

        <button
          type="button"
          onClick={onAddProtocol}
          className="flex cursor-pointer items-center gap-2 rounded-md bg-[#eee] px-3 py-2 text-[10px] font-semibold text-[#111] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!onAddProtocol}
        >
          <Plus size={13} />
          New Protocol
        </button>
      </div>

      {/* =========================================
          CONTENT
      ========================================= */}

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {protocols.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center">
            <div className="max-w-sm text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[#292929] bg-[#151515] text-[#555]">
                <ShieldCheck size={20} />
              </div>

              <h3 className="mt-4 text-[12px] font-semibold text-[#ccc]">
                No protocols configured
              </h3>

              <p className="mt-1 text-[9px] leading-5 text-[#555]">
                Create a protocol to control
                how positions communicate.
              </p>

              <button
                type="button"
                onClick={
                  onAddProtocol
                }
                className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#eee] px-3 py-2 text-[10px] font-semibold text-[#111] hover:bg-white"
              >
                <Plus size={13} />
                New Protocol
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {protocols.map(
              (protocol) => (
                <div
                  key={protocol.id}
                  className="group rounded-lg border border-[#292929] bg-[#151515] p-4 transition-colors hover:border-[#3a3a3a]"
                >
                  {/* CARD HEADER */}

                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        onSelectProtocol?.(
                          protocol,
                        )
                      }
                      className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#292929] bg-[#1b1b1b] text-[#777]">
                        <ShieldCheck
                          size={16}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-semibold text-[#eee]">
                          {protocol.name}
                        </div>

                        {protocol.description && (
                          <div className="mt-1 line-clamp-3 text-[9px] leading-4 text-[#666]">
                            {
                              protocol.description
                            }
                          </div>
                        )}
                      </div>
                    </button>

                    {/* CARD ACTIONS */}

                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        title="Edit protocol"
                        onClick={() =>
                          onSelectProtocol?.(
                            protocol,
                          )
                        }
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#555] opacity-60 transition hover:bg-[#222] hover:text-[#eee] group-hover:opacity-100"
                      >
                        <Pencil size={12} />
                      </button>

                      <button
                        type="button"
                        title="Delete protocol"
                        onClick={() =>
                          handleDelete(
                            protocol,
                          )
                        }
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#555] opacity-60 transition hover:bg-red-950/30 hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* PERMISSIONS */}

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Permission
                      label="Send"
                      enabled={
                        protocol.can_send
                      }
                    />

                    <Permission
                      label="Receive"
                      enabled={
                        protocol.can_receive
                      }
                    />

                    <Permission
                      label="Escalate"
                      enabled={
                        protocol.can_escalate
                      }
                    />

                    <Permission
                      label="Forward"
                      enabled={
                        protocol.can_forward
                      }
                    />
                  </div>

                  {/* BYPASS */}

                  <div className="mt-2">
                    <Permission
                      label="Bypass"
                      enabled={
                        protocol.can_bypass
                      }
                    />
                  </div>

                  {/* ID */}

                  <div className="mt-4 border-t border-[#222] pt-3">
                    <div className="text-[8px] font-bold tracking-[0.1em] text-[#444]">
                      PROTOCOL ID
                    </div>

                    <code className="mt-1 block truncate text-[8px] text-[#555]">
                      {protocol.id}
                    </code>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   PERMISSION
========================================================= */

function Permission({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded border border-[#252525] bg-[#121212] px-2.5 py-2">
      <span className="text-[9px] text-[#666]">
        {label}
      </span>

      <span
        className={
          enabled
            ? "text-[9px] font-semibold text-[#aaa]"
            : "text-[9px] text-[#3f3f3f]"
        }
      >
        {enabled
          ? "ON"
          : "OFF"}
      </span>
    </div>
  );
}