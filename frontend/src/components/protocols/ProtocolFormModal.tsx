"use client";

import { useState } from "react";

import type {
  Node as TorqueNode,
  Protocol,
  ProtocolCreate,
  ProtocolUpdate,
} from "@/lib/types";

import InfoTooltip from "@/components/common/InfoTooltip";

interface ProtocolFormModalProps {
  // Present when editing an existing protocol;
  // absent when creating a new one.
  protocol?: Protocol | null;

  nodes: TorqueNode[];

  saving: boolean;

  onCancel: () => void;

  onSubmit: (
    data: ProtocolCreate | ProtocolUpdate,
  ) => void;
}

function parseJsonObjectField(
  raw: string,
): Record<string, unknown> | null {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = JSON.parse(trimmed);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      "Must be a JSON object, e.g. {\"key\": \"value\"}.",
    );
  }

  return parsed as Record<
    string,
    unknown
  >;
}

// The backend stores conditions/stop_conditions as a
// JSON ARRAY of objects (list[dict]), not a single
// object — distinct from metadata, which is a single
// object.
function parseJsonArrayField(
  raw: string,
): Record<string, unknown>[] | null {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = JSON.parse(trimmed);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Must be a JSON array of objects, e.g. [{\"key\": \"value\"}].",
    );
  }

  for (const item of parsed) {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item)
    ) {
      throw new Error(
        "Every item must be a JSON object, e.g. [{\"key\": \"value\"}].",
      );
    }
  }

  return parsed as Record<
    string,
    unknown
  >[];
}

export default function ProtocolFormModal({
  protocol,
  nodes,
  saving,
  onCancel,
  onSubmit,
}: ProtocolFormModalProps) {
  const [name, setName] = useState(
    protocol?.name ?? "",
  );

  const [description, setDescription] =
    useState(
      protocol?.description ?? "",
    );

  const [canSend, setCanSend] = useState(
    protocol?.can_send ?? true,
  );

  const [canReceive, setCanReceive] =
    useState(
      protocol?.can_receive ?? true,
    );

  const [canEscalate, setCanEscalate] =
    useState(
      protocol?.can_escalate ?? false,
    );

  const [canBypass, setCanBypass] =
    useState(
      protocol?.can_bypass ?? false,
    );

  const [canForward, setCanForward] =
    useState(
      protocol?.can_forward ?? false,
    );

  const [confidentiality, setConfidentiality] =
    useState(
      protocol?.confidentiality ?? "",
    );

  const [
    allowedInformationTypes,
    setAllowedInformationTypes,
  ] = useState(
    (
      protocol?.allowed_information_types ??
      []
    ).join(", "),
  );

  const [allowedTargets, setAllowedTargets] =
    useState<string[]>(
      protocol?.allowed_targets ?? [],
    );

  const [showAdvanced, setShowAdvanced] =
    useState(false);

  const [conditionsRaw, setConditionsRaw] =
    useState(
      protocol?.conditions
        ? JSON.stringify(
            protocol.conditions,
            null,
            2,
          )
        : "",
    );

  const [
    stopConditionsRaw,
    setStopConditionsRaw,
  ] = useState(
    protocol?.stop_conditions
      ? JSON.stringify(
          protocol.stop_conditions,
          null,
          2,
        )
      : "",
  );

  const [metadataRaw, setMetadataRaw] =
    useState(
      protocol?.metadata
        ? JSON.stringify(
            protocol.metadata,
            null,
            2,
          )
        : "",
    );

  const [formError, setFormError] =
    useState<string | null>(null);

  function toggleTarget(nodeId: string) {
    setAllowedTargets((current) =>
      current.includes(nodeId)
        ? current.filter(
            (id) => id !== nodeId,
          )
        : [...current, nodeId],
    );
  }

  function handleSubmit() {
    if (!name.trim()) {
      setFormError(
        "Protocol name is required.",
      );

      return;
    }

    let conditions: Record<
      string,
      unknown
    >[] | null = null;

    let stopConditions: Record<
      string,
      unknown
    >[] | null = null;

    let metadata: Record<
      string,
      unknown
    > | null = null;

    try {
      conditions = parseJsonArrayField(
        conditionsRaw,
      );

      stopConditions = parseJsonArrayField(
        stopConditionsRaw,
      );

      metadata = parseJsonObjectField(
        metadataRaw,
      );
    } catch (err) {
      setFormError(
        err instanceof Error
          ? `Advanced fields: ${err.message}`
          : "Advanced fields contain invalid JSON.",
      );

      return;
    }

    setFormError(null);

    onSubmit({
      name: name.trim(),
      description:
        description.trim() || null,
      can_send: canSend,
      can_receive: canReceive,
      can_escalate: canEscalate,
      can_bypass: canBypass,
      can_forward: canForward,
      confidentiality:
        confidentiality.trim() ||
        null,
      allowed_information_types:
        allowedInformationTypes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      allowed_targets:
        allowedTargets.length > 0
          ? allowedTargets
          : null,
      conditions,
      stop_conditions: stopConditions,
      metadata,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/75 p-6"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onCancel();
        }
      }}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-[#303030] bg-[#111] shadow-[0_25px_100px_rgba(0,0,0,0.8)]"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-start justify-between border-b border-[#242424] px-5 py-4">
          <div>
            <div className="text-[9px] font-bold tracking-[0.14em] text-[#666]">
              PROTOCOL
            </div>

            <h2 className="mt-1 text-[16px] font-semibold text-[#eee]">
              {protocol
                ? "Edit Protocol"
                : "New Protocol"}
            </h2>
          </div>

          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[20px] text-[#777] hover:bg-[#1d1d1d] hover:text-[#eee]"
            onClick={onCancel}
            disabled={saving}
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 p-5">
            <label className="flex flex-col gap-2">
              <span className="text-[10px] text-[#888]">
                Name
              </span>

              <input
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
                placeholder="e.g. Financial Reporting"
                autoFocus
                className="h-10 w-full rounded-md border border-[#2c2c2c] bg-[#181818] px-3 text-[11px] text-[#eee] outline-none placeholder:text-[#4d4d4d] focus:border-[#555]"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[10px] text-[#888]">
                Description
              </span>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                placeholder="What this protocol governs..."
                rows={2}
                className="w-full resize-y rounded-md border border-[#2c2c2c] bg-[#181818] px-3 py-2.5 text-[11px] text-[#eee] outline-none placeholder:text-[#4d4d4d] focus:border-[#555]"
              />
            </label>

            <div>
              <div className="mb-2 flex items-center text-[10px] text-[#888]">
                Permissions

                <InfoTooltip
                  text="What this protocol allows on the relationship: sending, receiving, escalating past the normal chain, bypassing the hierarchy entirely, or forwarding information onward."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Checkbox
                  label="Can send"
                  checked={canSend}
                  onChange={
                    setCanSend
                  }
                />

                <Checkbox
                  label="Can receive"
                  checked={canReceive}
                  onChange={
                    setCanReceive
                  }
                />

                <Checkbox
                  label="Can escalate"
                  checked={canEscalate}
                  onChange={
                    setCanEscalate
                  }
                />

                <Checkbox
                  label="Can forward"
                  checked={canForward}
                  onChange={
                    setCanForward
                  }
                />

                <Checkbox
                  label="Can bypass hierarchy"
                  checked={canBypass}
                  onChange={
                    setCanBypass
                  }
                />
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <span className="flex items-center text-[10px] text-[#888]">
                Confidentiality

                <InfoTooltip
                  text="How sensitive information on this channel is, e.g. 'Internal', 'Confidential', 'Restricted'. Free text."
                />
              </span>

              <input
                value={confidentiality}
                onChange={(event) =>
                  setConfidentiality(
                    event.target.value,
                  )
                }
                placeholder="e.g. Confidential"
                className="h-10 w-full rounded-md border border-[#2c2c2c] bg-[#181818] px-3 text-[11px] text-[#eee] outline-none placeholder:text-[#4d4d4d] focus:border-[#555]"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="flex items-center text-[10px] text-[#888]">
                Allowed Information Types

                <InfoTooltip
                  text="Comma-separated categories of information this protocol permits, e.g. 'budget, forecasts, headcount'."
                />
              </span>

              <input
                value={
                  allowedInformationTypes
                }
                onChange={(event) =>
                  setAllowedInformationTypes(
                    event.target.value,
                  )
                }
                placeholder="e.g. budget, forecasts"
                className="h-10 w-full rounded-md border border-[#2c2c2c] bg-[#181818] px-3 text-[11px] text-[#eee] outline-none placeholder:text-[#4d4d4d] focus:border-[#555]"
              />
            </label>

            {nodes.length > 0 && (
              <div>
                <div className="mb-2 flex items-center text-[10px] text-[#888]">
                  Allowed Targets

                  <InfoTooltip
                    text="Optional: restrict this protocol to specific downstream nodes, e.g. who information may ultimately be forwarded to. Leave empty for no restriction."
                  />
                </div>

                <div className="flex max-h-[120px] flex-col gap-1 overflow-y-auto rounded-md border border-[#2c2c2c] bg-[#161616] p-2">
                  {nodes.map((node) => (
                    <label
                      key={node.id}
                      className="flex items-center gap-2 rounded px-1.5 py-1 text-[10px] text-[#aaa] hover:bg-[#1f1f1f]"
                    >
                      <input
                        type="checkbox"
                        checked={allowedTargets.includes(
                          node.id,
                        )}
                        onChange={() =>
                          toggleTarget(
                            node.id,
                          )
                        }
                      />

                      {node.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              className="self-start text-[10px] text-[#888] underline decoration-dotted underline-offset-4 hover:text-[#ccc]"
              onClick={() =>
                setShowAdvanced(
                  (current) => !current,
                )
              }
            >
              {showAdvanced
                ? "Hide advanced (JSON) fields"
                : "Show advanced (JSON) fields"}
            </button>

            {showAdvanced && (
              <div className="flex flex-col gap-4 rounded-md border border-[#2c2c2c] bg-[#141414] p-3">
                <JsonField
                  label="Conditions"
                  tooltip="A JSON array of condition objects describing when this protocol applies, interpreted by the execution engine, e.g. [{'key': 'value'}]."
                  value={conditionsRaw}
                  onChange={
                    setConditionsRaw
                  }
                  placeholder="[]"
                />

                <JsonField
                  label="Stop Conditions"
                  tooltip="A JSON array of condition objects describing when communication over this channel should halt, e.g. [{'key': 'value'}]."
                  value={
                    stopConditionsRaw
                  }
                  onChange={
                    setStopConditionsRaw
                  }
                  placeholder="[]"
                />

                <JsonField
                  label="Metadata"
                  tooltip="Any other structured data you want stored alongside this protocol, as a single JSON object."
                  value={metadataRaw}
                  onChange={
                    setMetadataRaw
                  }
                  placeholder="{}"
                />
              </div>
            )}

            {formError && (
              <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-[10px] text-red-400">
                {formError}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#242424] px-5 py-4">
          <button
            type="button"
            className="h-9 rounded-md border border-[#303030] px-4 text-[10px] text-[#999] hover:bg-[#1b1b1b] hover:text-[#eee]"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="h-9 rounded-md bg-[#eee] px-4 text-[10px] font-semibold text-[#111] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            onClick={handleSubmit}
            disabled={
              saving || !name.trim()
            }
          >
            {saving
              ? "Saving..."
              : protocol
                ? "Save Changes"
                : "Create Protocol"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-[#2c2c2c] bg-[#161616] px-2.5 py-2 text-[10px] text-[#aaa]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
      />

      {label}
    </label>
  );
}

function JsonField({
  label,
  tooltip,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  tooltip: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center text-[10px] text-[#888]">
        {label}

        <InfoTooltip text={tooltip} />
      </span>

      <textarea
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        rows={3}
        spellCheck={false}
        className="w-full resize-y rounded-md border border-[#2c2c2c] bg-[#181818] px-3 py-2.5 font-mono text-[10px] text-[#eee] outline-none placeholder:text-[#4d4d4d] focus:border-[#555]"
      />
    </label>
  );
}
