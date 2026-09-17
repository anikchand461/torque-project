"use client";

import {
  ShieldCheck,
  ArrowUpRight,
  Trash2,
} from "lucide-react";

import type {
  Node as TorqueNode,
  Protocol,
  Relationship,
} from "@/lib/types";

import { getEffectiveEndpoints } from "@/lib/relationships";

interface ProtocolPanelProps {
  // Flat list from GET /graphs/{id}/protocols —
  // each protocol carries the relationship(s) it's
  // attached to via `relationship_ids`.
  protocols: Protocol[];

  relationships: Relationship[];

  nodes: TorqueNode[];

  onDeleteProtocol?: (
    protocolId: string,
  ) => void;

  // Switches to the Graph view and opens that
  // relationship's editor — protocols are created
  // and attached from there, not from this
  // read-only overview.
  onJumpToRelationship?: (
    relationshipId: string,
  ) => void;
}

/* =========================================================
   PROTOCOLS ARE NO LONGER ORGANIZATION-WIDE POLICIES.

   Every protocol belongs to (at least) one
   communication Relationship. This tab is now a
   read-only library: it groups protocols under the
   relationship they govern, rather than letting you
   create/edit a protocol independent of any
   relationship. Creating and attaching protocols
   happens from the relationship's own editor.
========================================================= */

export default function ProtocolPanel({
  protocols,
  relationships,
  nodes,
  onDeleteProtocol,
  onJumpToRelationship,
}: ProtocolPanelProps) {
  function nodeName(id: string) {
    return (
      nodes.find(
        (node) => node.id === id,
      )?.name ?? "Unknown"
    );
  }

  function relationshipLabel(
    relationship: Relationship,
  ) {
    const {
      fromId,
      toId,
    } = getEffectiveEndpoints(
      relationship.source_node_id,
      relationship.target_node_id,
      relationship.direction,
    );

    const arrow =
      relationship.direction ===
      "BIDIRECTIONAL"
        ? "\u21c4"
        : "\u2192";

    return `${nodeName(fromId)} ${arrow} ${nodeName(toId)}`;
  }

  function handleDelete(
    protocol: Protocol,
  ) {
    const confirmed =
      window.confirm(
        `Delete "${protocol.name}"?\n\nThis protocol will be permanently removed from every relationship it's attached to.`,
      );

    if (!confirmed) {
      return;
    }

    onDeleteProtocol?.(protocol.id);
  }

  // Group protocols by the relationship(s) that use
  // them. A protocol with no relationship_ids (should
  // not normally happen, given attachment is required)
  // falls into an "Unattached" bucket so it's never
  // silently hidden.
  const groups = new Map<
    string,
    Protocol[]
  >();

  const unattached: Protocol[] = [];

  for (const protocol of protocols) {
    if (
      protocol.relationship_ids
        .length === 0
    ) {
      unattached.push(protocol);
      continue;
    }

    for (const relationshipId of protocol.relationship_ids) {
      const existing =
        groups.get(relationshipId) ??
        [];

      existing.push(protocol);
      groups.set(
        relationshipId,
        existing,
      );
    }
  }

  const groupedRelationships =
    relationships.filter((r) =>
      groups.has(r.id),
    );

  const isEmpty =
    protocols.length === 0;

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
            Protocols are rules attached to a
            specific communication relationship.
            Add or edit them from that
            relationship&apos;s editor in the
            Graph view.
          </p>
        </div>
      </div>

      {/* =========================================
          CONTENT
      ========================================= */}

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {isEmpty ? (
          <div className="flex h-full min-h-[240px] items-center justify-center">
            <div className="max-w-sm text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[#292929] bg-[#151515] text-[#555]">
                <ShieldCheck size={20} />
              </div>

              <h3 className="mt-4 text-[12px] font-semibold text-[#ccc]">
                No protocols yet
              </h3>

              <p className="mt-1 text-[9px] leading-5 text-[#555]">
                Open a communication
                relationship in the Graph view
                and use &quot;+ Add
                Protocol&quot; to create one.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groupedRelationships.map(
              (relationship) => (
                <div
                  key={relationship.id}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onJumpToRelationship?.(
                        relationship.id,
                      )
                    }
                    className="group mb-2 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[#ccc] hover:text-[#eee]"
                  >
                    {relationshipLabel(
                      relationship,
                    )}

                    <ArrowUpRight
                      size={12}
                      className="text-[#555] group-hover:text-[#aaa]"
                    />

                    <span className="ml-1 text-[9px] font-normal text-[#555]">
                      {
                        relationship.relationship_type
                      }
                    </span>
                  </button>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {(
                      groups.get(
                        relationship.id,
                      ) ?? []
                    ).map((protocol) => (
                      <ProtocolCard
                        key={
                          protocol.id
                        }
                        protocol={
                          protocol
                        }
                        onDelete={() =>
                          handleDelete(
                            protocol,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              ),
            )}

            {unattached.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-semibold text-[#ccc]">
                  Unattached
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {unattached.map(
                    (protocol) => (
                      <ProtocolCard
                        key={
                          protocol.id
                        }
                        protocol={
                          protocol
                        }
                        onDelete={() =>
                          handleDelete(
                            protocol,
                          )
                        }
                      />
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   PROTOCOL CARD
========================================================= */

function ProtocolCard({
  protocol,
  onDelete,
}: {
  protocol: Protocol;
  onDelete: () => void;
}) {
  return (
    <div className="group rounded-lg border border-[#292929] bg-[#151515] p-4 transition-colors hover:border-[#3a3a3a]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#292929] bg-[#1b1b1b] text-[#777]">
            <ShieldCheck size={16} />
          </div>

          <div className="min-w-0">
            <div className="truncate text-[11px] font-semibold text-[#eee]">
              {protocol.name}
            </div>

            {protocol.description && (
              <div className="mt-1 line-clamp-3 text-[9px] leading-4 text-[#666]">
                {protocol.description}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          title="Delete protocol"
          onClick={onDelete}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#555] opacity-60 transition hover:bg-red-950/30 hover:text-red-400 group-hover:opacity-100"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Permission
          label="Send"
          enabled={protocol.can_send}
        />

        <Permission
          label="Receive"
          enabled={protocol.can_receive}
        />

        <Permission
          label="Escalate"
          enabled={protocol.can_escalate}
        />

        <Permission
          label="Forward"
          enabled={protocol.can_forward}
        />
      </div>

      <div className="mt-2">
        <Permission
          label="Bypass"
          enabled={protocol.can_bypass}
        />
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
        {enabled ? "ON" : "OFF"}
      </span>
    </div>
  );
}
