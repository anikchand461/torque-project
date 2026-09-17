"use client";

import { useEffect, useState } from "react";

import {
  Pencil,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";

import type {
  Node as TorqueNode,
  Protocol,
  ProtocolCreate,
  ProtocolUpdate,
} from "@/lib/types";

import {
  createRelationshipProtocol,
  detachProtocolFromRelationship,
  getRelationshipProtocols,
  updateProtocol,
} from "@/lib/api";

import InfoTooltip from "@/components/common/InfoTooltip";

import ProtocolFormModal from "./ProtocolFormModal";

interface RelationshipProtocolsSectionProps {
  relationshipId: string;
  nodes: TorqueNode[];

  // Fires after any successful create/edit/detach so
  // the parent can refresh anything else that reads
  // relationship/protocol data (e.g. the Protocols
  // overview tab).
  onProtocolsChanged?: () => void;
}

export default function RelationshipProtocolsSection({
  relationshipId,
  nodes,
  onProtocolsChanged,
}: RelationshipProtocolsSectionProps) {
  const [protocols, setProtocols] =
    useState<Protocol[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState<
    string | null
  >(null);

  const [formMode, setFormMode] =
    useState<
      | { kind: "create" }
      | { kind: "edit"; protocol: Protocol }
      | null
    >(null);

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const result =
          await getRelationshipProtocols(
            relationshipId,
          );

        if (!cancelled) {
          setProtocols(result);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(
            "LOAD RELATIONSHIP PROTOCOLS ERROR:",
            err,
          );

          setError(
            "Unable to load protocols for this relationship.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [relationshipId]);

  async function handleCreate(
    data: ProtocolCreate | ProtocolUpdate,
  ) {
    try {
      setSaving(true);
      setError(null);

      const created =
        await createRelationshipProtocol(
          relationshipId,
          data as ProtocolCreate,
        );

      setProtocols((current) => [
        ...current,
        created,
      ]);

      setFormMode(null);
      onProtocolsChanged?.();
    } catch (err) {
      console.error(
        "CREATE RELATIONSHIP PROTOCOL ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create protocol.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(
    protocolId: string,
    data: ProtocolCreate | ProtocolUpdate,
  ) {
    try {
      setSaving(true);
      setError(null);

      const updated =
        await updateProtocol(
          protocolId,
          data as ProtocolUpdate,
        );

      setProtocols((current) =>
        current.map((protocol) =>
          protocol.id === updated.id
            ? updated
            : protocol,
        ),
      );

      setFormMode(null);
      onProtocolsChanged?.();
    } catch (err) {
      console.error(
        "UPDATE PROTOCOL ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update protocol.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDetach(
    protocol: Protocol,
  ) {
    const confirmed =
      window.confirm(
        `Remove "${protocol.name}" from this relationship?\n\nThe protocol itself won't be deleted if it's attached elsewhere.`,
      );

    if (!confirmed) {
      return;
    }

    const previous = protocols;

    // Remove immediately from the UI.
    setProtocols((current) =>
      current.filter(
        (item) =>
          item.id !== protocol.id,
      ),
    );

    try {
      await detachProtocolFromRelationship(
        relationshipId,
        protocol.id,
      );

      onProtocolsChanged?.();
    } catch (err) {
      console.error(
        "DETACH PROTOCOL ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove protocol from this relationship.",
      );

      // Restore on failure.
      setProtocols(previous);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center text-[10px] text-[#888]">
          Protocols

          <InfoTooltip
            text="The rules that govern this channel — who's allowed to send/receive, escalate, bypass the hierarchy, or forward information, and how confidential it is. A relationship can have any number of protocols."
          />
        </div>

        <button
          type="button"
          className="flex items-center gap-1 rounded-md border border-[#2c2c2c] px-2 py-1 text-[9px] text-[#ccc] hover:bg-[#1f1f1f]"
          onClick={() =>
            setFormMode({
              kind: "create",
            })
          }
        >
          <Plus size={11} />
          Add Protocol
        </button>
      </div>

      {loading ? (
        <div className="rounded-md border border-[#2c2c2c] bg-[#161616] px-3 py-2.5 text-[9px] text-[#666]">
          Loading protocols...
        </div>
      ) : protocols.length === 0 ? (
        <div className="rounded-md border border-[#2c2c2c] bg-[#161616] px-3 py-2.5 text-[9px] text-[#666]">
          No protocols attached to this
          relationship yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {protocols.map((protocol) => (
            <div
              key={protocol.id}
              className="rounded-md border border-[#2c2c2c] bg-[#161616] px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <ShieldCheck
                    size={13}
                    className="mt-0.5 shrink-0 text-[#666]"
                  />

                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-semibold text-[#ddd]">
                      {protocol.name}
                    </div>

                    {protocol.confidentiality && (
                      <div className="mt-0.5 text-[9px] text-[#777]">
                        Confidentiality:{" "}
                        {protocol.confidentiality}
                      </div>
                    )}

                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px]">
                      <PermissionBadge
                        label="Send"
                        enabled={
                          protocol.can_send
                        }
                      />

                      <PermissionBadge
                        label="Receive"
                        enabled={
                          protocol.can_receive
                        }
                      />

                      <PermissionBadge
                        label="Escalate"
                        enabled={
                          protocol.can_escalate
                        }
                      />
                    </div>

                    {protocol.description && (
                      <div className="mt-1 line-clamp-2 text-[9px] text-[#666]">
                        {
                          protocol.description
                        }
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    title="Edit protocol"
                    onClick={() =>
                      setFormMode({
                        kind: "edit",
                        protocol,
                      })
                    }
                    className="flex h-6 w-6 items-center justify-center rounded text-[#777] hover:bg-[#222] hover:text-[#eee]"
                  >
                    <Pencil size={11} />
                  </button>

                  <button
                    type="button"
                    title="Remove from relationship"
                    onClick={() =>
                      handleDetach(
                        protocol,
                      )
                    }
                    className="flex h-6 w-6 items-center justify-center rounded text-[#777] hover:bg-red-950/30 hover:text-red-400"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-[10px] text-red-400">
          {error}
        </div>
      )}

      {formMode && (
        <ProtocolFormModal
          protocol={
            formMode.kind === "edit"
              ? formMode.protocol
              : null
          }
          nodes={nodes}
          saving={saving}
          onCancel={() =>
            setFormMode(null)
          }
          onSubmit={(data) => {
            if (
              formMode.kind === "create"
            ) {
              void handleCreate(data);
            } else {
              void handleEdit(
                formMode.protocol.id,
                data,
              );
            }
          }}
        />
      )}
    </div>
  );
}

function PermissionBadge({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <span
      className={
        enabled
          ? "text-[#8fbf8f]"
          : "text-[#555]"
      }
    >
      {label} {enabled ? "\u2713" : "\u2717"}
    </span>
  );
}
