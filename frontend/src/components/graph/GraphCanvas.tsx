"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import {
  Background,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  useNodesInitialized,
  type Connection,
  type Edge,
  type Node as FlowNode,
  type OnNodesChange,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import type {
  Node as TorqueNode,
  Relationship,
  RelationshipDirection,
  RelationshipNote,
} from "@/lib/types";

import {
  createRelationship,
  updateRelationship,
} from "@/lib/api";

import GraphNode from "./GraphNode";
import GraphEdge from "./GraphEdge";

/* =========================================================
   CONTEXT / RELIANCE <-> BACKEND JSON CONVERSION

   The backend stores context/reliance as a JSON
   object column (`dict | None`), not a plain
   string. These forms only collect free text, so
   we wrap/unwrap it under a single `text` key at
   the API boundary — sending a raw string here
   fails Pydantic validation with a 422.
========================================================= */

function toRelationshipNote(
  value: string,
): RelationshipNote | null {
  const trimmed = value.trim();

  return trimmed ? { text: trimmed } : null;
}

function fromRelationshipNote(
  note: RelationshipNote | null | undefined,
): string {
  return note?.text ?? "";
}

interface GraphCanvasProps {
  graphId: string;

  nodes: TorqueNode[];

  relationships: Relationship[];

  onNodeSelect?: (
    node: TorqueNode | null,
  ) => void;

  onRelationshipCreated?: () => void;

  onRelationshipUpdated?: () => void;

  /*
   * The parent page owns the authoritative
   * relationships state (it's the source of the
   * `relationships` prop below). Deletion is
   * requested here but performed by the parent so
   * there is exactly one place that mutates that
   * state — avoids racing a local optimistic edit
   * against the prop this component derives its
   * edges from.
   */
  onDeleteRelationship?: (
    relationshipId: string,
  ) => void;

  /*
   * When set, the canvas opens the relationship
   * editor for this relationship id (used by the
   * Relationships panel's Edit action so it shares
   * the exact same editing workflow as the graph
   * editor).
   */
  editRelationshipId?: string | null;

  onEditRelationshipConsumed?: () => void;
}

/* =========================================================
   AUTOMATIC NODE POSITIONS
========================================================= */

function createPositions(
  nodes: TorqueNode[],
) {
  const positions: Record<
    string,
    { x: number; y: number }
  > = {};

  const roots = nodes.filter(
    (node) =>
      node.parent_id === null,
  );

  const children = new Map<
    string,
    TorqueNode[]
  >();

  for (const node of nodes) {
    if (!node.parent_id) {
      continue;
    }

    if (!children.has(node.parent_id)) {
      children.set(
        node.parent_id,
        [],
      );
    }

    children
      .get(node.parent_id)!
      .push(node);
  }

  const levelGap = 220;

  const nodeGap = 300;

  /*
   * Root-level nodes are wrapped into a grid of rows
   * instead of one ever-widening horizontal line. A
   * graph with no hierarchy at all (every node is a
   * root, e.g. parent_id is null for all of them) is
   * common and otherwise degenerates into a single row
   * of N nodes — unreadable, and the cause of edges
   * appearing to overlap once there are more than a
   * handful of nodes. Each root row gets a full
   * levelGap * 3 of vertical room so a root's own
   * children/grandchildren never collide with the next
   * row of roots, regardless of how many roots exist.
   */

  const rootColumns = 4;

  roots.forEach(
    (root, rootIndex) => {
      const rootColumn =
        rootIndex % rootColumns;

      const rootRow = Math.floor(
        rootIndex / rootColumns,
      );

      const rootX =
        rootColumn * nodeGap + 300;

      const rootY =
        100 +
        rootRow * levelGap * 3;

      positions[root.id] = {
        x: rootX,
        y: rootY,
      };

      const directChildren =
        children.get(root.id) ?? [];

      directChildren.forEach(
        (child, childIndex) => {
          positions[child.id] = {
            x:
              rootX +
              (childIndex -
                (directChildren.length -
                  1) /
                  2) *
                nodeGap,
            y:
              rootY +
              levelGap,
          };

          const grandchildren =
            children.get(child.id) ?? [];

          grandchildren.forEach(
            (
              grandchild,
              grandchildIndex,
            ) => {
              positions[
                grandchild.id
              ] = {
                x:
                  positions[
                    child.id
                  ].x +
                  (grandchildIndex -
                    (grandchildren.length -
                      1) /
                      2) *
                    nodeGap,

                y:
                  rootY +
                  levelGap * 2,
              };
            },
          );
        },
      );
    },
  );

  /*
   * Nodes which do not have a calculated
   * hierarchy position are placed in a grid.
   */

  nodes.forEach(
    (node, index) => {
      if (positions[node.id]) {
        return;
      }

      positions[node.id] = {
        x:
          200 +
          (index % 4) *
            nodeGap,

        y:
          100 +
          Math.floor(
            index / 4,
          ) *
            levelGap,
      };
    },
  );

  return positions;
}

/* =========================================================
   POSITION PERSISTENCE

   React state alone only survives for as long as the
   browser tab/session does — it cannot survive a real
   page reload, and this app has no backend field to
   store React Flow coordinates in (and isn't allowed to
   invent one). localStorage is the only thing frontend-
   only positions can actually durably live in, so once a
   node has been placed (whether by the user dragging it,
   or by the one-time automatic layout below), that exact
   position is persisted here and is treated as gospel on
   every future load of this graph — never silently
   recomputed again.
========================================================= */

const POSITION_STORAGE_PREFIX =
  "torque:node-positions:";

type StoredPositions = Record<
  string,
  { x: number; y: number }
>;

function loadStoredPositions(
  graphId: string,
): StoredPositions {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(
      POSITION_STORAGE_PREFIX + graphId,
    );

    if (!raw) {
      return {};
    }

    const parsed: unknown = JSON.parse(raw);

    return parsed && typeof parsed === "object"
      ? (parsed as StoredPositions)
      : {};
  } catch {
    // Corrupt/unavailable storage just means we
    // fall back to auto-computed positions.
    return {};
  }
}

function saveStoredPositions(
  graphId: string,
  positions: StoredPositions,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      POSITION_STORAGE_PREFIX + graphId,
      JSON.stringify(positions),
    );
  } catch {
    // Quota exceeded / private browsing — the
    // layout simply won't survive a reload this
    // time, which is an acceptable degradation.
  }
}

/* =========================================================
   MAIN CANVAS
========================================================= */

function GraphCanvasInner({
  graphId,
  nodes: torqueNodes,
  relationships,
  onNodeSelect,
  onRelationshipCreated,
  onRelationshipUpdated,
  onDeleteRelationship,
  editRelationshipId,
  onEditRelationshipConsumed,
}: GraphCanvasProps) {
  /* =======================================================
     REACT FLOW STATE
  ======================================================= */

  const [flowNodes, setFlowNodes] =
    useState<FlowNode[]>([]);

  const [flowEdges, setFlowEdges] =
    useState<Edge[]>([]);

  /* =======================================================
     NEW CONNECTION
  ======================================================= */

  const [connection, setConnection] =
    useState<Connection | null>(null);

  /* =======================================================
     SELECTED RELATIONSHIP
  ======================================================= */

  const [
    selectedRelationship,
    setSelectedRelationship,
  ] = useState<Relationship | null>(
    null,
  );

  const [
    editingRelationship,
    setEditingRelationship,
  ] = useState(false);

  /* =======================================================
     RELATIONSHIP FORM
  ======================================================= */

  const [
    relationshipType,
    setRelationshipType,
  ] = useState("Communication");

  const [direction, setDirection] =
    useState<RelationshipDirection>(
      "BIDIRECTIONAL",
    );

  const [context, setContext] =
    useState("");

  const [reliance, setReliance] =
    useState("");

  /* =======================================================
     REQUEST STATES
  ======================================================= */

  const [creating, setCreating] =
    useState(false);

  const [savingRelationship, setSavingRelationship] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  /* =======================================================
     HANDLE MEMORY
     
     Backend currently stores node IDs but not
     React Flow sourceHandle / targetHandle.

     Therefore we keep the exact visual handle
     in frontend state while this canvas is mounted.
  ======================================================= */

  const [
    relationshipHandles,
    setRelationshipHandles,
  ] = useState<
    Record<
      string,
      {
        sourceHandle?: string | null;
        targetHandle?: string | null;
      }
    >
  >({});

  /* =======================================================
     CONVERT BACKEND NODES → REACT FLOW NODES
  ======================================================= */

  useEffect(() => {
    const computedPositions =
      createPositions(
        torqueNodes,
      );

    const storedPositions =
      loadStoredPositions(graphId);

    const nextStored: StoredPositions = {
      ...storedPositions,
    };

    let storedChanged = false;

    // Preserve any positions the user has
    // manually dragged so that adding/editing
    // an unrelated node doesn't reset the
    // whole layout (see spec: node positions
    // must remain stable across renders).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs the external node list into locally-draggable canvas state while preserving manual positions; not derivable during render.
    setFlowNodes((current) => {
      const existingPositions = new Map(
        current.map((node) => [
          node.id,
          node.position,
        ]),
      );

      return torqueNodes.map(
        (node) => {
          // Priority: whatever is already
          // rendered this session > whatever
          // was persisted from a previous
          // session/reload > a freshly
          // computed position, used only for
          // nodes that have genuinely never
          // been positioned before.
          const position =
            existingPositions.get(
              node.id,
            ) ??
            storedPositions[node.id] ??
            computedPositions[node.id];

          if (!nextStored[node.id]) {
            nextStored[node.id] = position;
            storedChanged = true;
          }

          return {
            id: node.id,

            type: "torqueNode",

            position,

            data: {
              node,
            },

            draggable: true,

            selectable: true,

            connectable: true,
          };
        },
      );
    });

    if (storedChanged) {
      saveStoredPositions(
        graphId,
        nextStored,
      );
    }
  }, [torqueNodes, graphId]);

  /* =======================================================
     FIT VIEW ONCE NODES ARE POSITIONED *AND* MEASURED

     The static `fitView` prop on <ReactFlow> fits as soon
     as `nodes` goes from empty to non-empty, which can
     happen before the browser has actually laid out and
     measured each node's DOM element (especially right
     after this component mounts — e.g. when switching back
     to the Graph tab, or opening a different graph). Fitting
     against unmeasured (zero-size) nodes collapses the
     computed tree layout into what looks like a squashed
     horizontal line, even though the underlying x/y
     positions are correct.

     `useNodesInitialized()` is the React Flow-provided
     signal for "every current node has now been measured",
     so gating our own explicit fitView() call on it (instead
     of a fixed rAF/timeout guess) is what actually makes
     this reliable regardless of node count or graph shape.
     The static `fitView` prop is intentionally left off
     <ReactFlow> below so there's exactly one source of truth
     for framing the viewport.
  ======================================================= */

  const { fitView } = useReactFlow();

  const nodesInitialized = useNodesInitialized();

  const hasFitViewRef = useRef(false);

  useEffect(() => {
    // Re-arm once per graph, so switching to a different
    // graph (which doesn't remount this component) still
    // gets its own fresh fit, not the previous graph's.
    hasFitViewRef.current = false;
  }, [graphId]);

  useEffect(() => {
    if (hasFitViewRef.current) {
      return;
    }

    if (flowNodes.length === 0) {
      return;
    }

    if (!nodesInitialized) {
      return;
    }

    hasFitViewRef.current = true;

    fitView({
      padding: 0.2,
      duration: 0,
    });
  }, [
    flowNodes,
    nodesInitialized,
    fitView,
    graphId,
  ]);

  /* =======================================================
     CONVERT BACKEND RELATIONSHIPS → REACT FLOW EDGES
  ======================================================= */

  useEffect(() => {
    const convertedEdges: Edge[] =
      relationships.map(
        (relationship) => {
          const handles =
            relationshipHandles[
              relationship.id
            ];

          return {
            id: relationship.id,

            source:
              relationship.source_node_id,

            target:
              relationship.target_node_id,

            /*
             * Preserve the exact handles used
             * when the relationship was created.
             */

            sourceHandle:
              handles?.sourceHandle ??
              "bottom-source",

            targetHandle:
              handles?.targetHandle ??
              "top-target",

            type: "torqueEdge",

            data: {
              relationshipType:
                relationship.relationship_type,

              direction:
                relationship.direction,
            },

            animated: false,

            selectable: true,
          };
        },
      );

    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs external relationships into locally-mutable edge state (handleDeleteRelationship removes an edge optimistically before the backend confirms).
    setFlowEdges(
      convertedEdges,
    );
  }, [
    relationships,
    relationshipHandles,
  ]);

  /* =======================================================
     NODE / EDGE TYPES
  ======================================================= */

  const nodeTypes = useMemo(
    () => ({
      torqueNode: GraphNode,
    }),
    [],
  );

  const edgeTypes = useMemo(
    () => ({
      torqueEdge: GraphEdge,
    }),
    [],
  );

  /* =======================================================
     NODE CHANGES
     
     We allow moving nodes locally.

     We deliberately do not persist deletion
     from React Flow's keyboard/delete handling,
     because relationship deletion must go
     through the backend.
  ======================================================= */

  const onNodesChange: OnNodesChange =
    useCallback(
      (changes) => {
        setFlowNodes(
          (current) =>
            applyNodeChanges(
              changes,
              current,
            ),
        );

        // Persist positions as soon as a drag
        // finishes (not on every intermediate
        // mouse-move) so the layout survives a
        // page reload, not just this session.
        const finishedDrags =
          changes.filter(
            (
              change,
            ): change is Extract<
              typeof change,
              { type: "position" }
            > =>
              change.type ===
                "position" &&
              change.dragging === false &&
              !!change.position,
          );

        if (finishedDrags.length > 0) {
          const stored =
            loadStoredPositions(graphId);

          for (const change of finishedDrags) {
            stored[change.id] =
              change.position!;
          }

          saveStoredPositions(
            graphId,
            stored,
          );
        }
      },
      [graphId],
    );

  /* =======================================================
     USER STARTS CONNECTION
  ======================================================= */

  const handleConnect =
    useCallback(
      (params: Connection) => {
        console.log(
          "REACT FLOW CONNECTION:",
          params,
        );

        if (!params.source) {
          return;
        }

        if (!params.target) {
          return;
        }

        /*
         * Prevent self relationships.
         */

        if (
          params.source ===
          params.target
        ) {
          setError(
            "A node cannot connect to itself.",
          );

          return;
        }

        /*
         * Make sure a handle was actually
         * selected.
         */

        if (
          !params.sourceHandle ||
          !params.targetHandle
        ) {
          setError(
            "Please connect using the node handles.",
          );

          return;
        }

        setError(null);

        setConnection(
          params,
        );

        setRelationshipType(
          "Communication",
        );

        setDirection(
          "BIDIRECTIONAL",
        );

        setContext("");

        setReliance("");
      },
      [],
    );

  /* =======================================================
     CREATE RELATIONSHIP
  ======================================================= */

  const handleCreateRelationship =
    useCallback(
      async () => {
        if (!connection) {
          return;
        }

        if (!connection.source) {
          return;
        }

        if (!connection.target) {
          return;
        }

        if (
          !relationshipType.trim()
        ) {
          setError(
            "Relationship type is required.",
          );

          return;
        }

        try {
          setCreating(true);
          setError(null);

          console.log(
            "CREATING RELATIONSHIP:",
            {
              source:
                connection.source,

              target:
                connection.target,

              sourceHandle:
                connection.sourceHandle,

              targetHandle:
                connection.targetHandle,
            },
          );

          const created =
            await createRelationship(
              graphId,
              {
                source_node_id:
                  connection.source,

                target_node_id:
                  connection.target,

                relationship_type:
                  relationshipType.trim(),

                direction,

                context:
                  toRelationshipNote(context),

                reliance:
                  toRelationshipNote(reliance),

                protocol_id:
                  null,
              },
            );

          /*
           * Remember the exact handles.
           */

          setRelationshipHandles(
            (current) => ({
              ...current,

              [created.id]: {
                sourceHandle:
                  connection.sourceHandle,

                targetHandle:
                  connection.targetHandle,
              },
            }),
          );

          /*
           * Close connection modal.
           */

          setConnection(null);

          /*
           * Tell parent to refresh relationships.
           */

          onRelationshipCreated?.();

          console.log(
            "RELATIONSHIP CREATED:",
            created,
          );
        } catch (err) {
          console.error(
            "CREATE RELATIONSHIP ERROR:",
            err,
          );

          setError(
            err instanceof Error
              ? err.message
              : "Failed to create relationship.",
          );
        } finally {
          setCreating(false);
        }
      },
      [
        connection,
        graphId,
        relationshipType,
        direction,
        context,
        reliance,
        onRelationshipCreated,
      ],
    );

  /* =======================================================
     EDGE CLICK
  ======================================================= */

  const handleEdgeClick =
    useCallback(
      (
        _event: MouseEvent,
        edge: Edge,
      ) => {
        console.log(
          "EDGE CLICKED:",
          edge.id,
        );

        const relationship =
          relationships.find(
            (item) =>
              item.id ===
              edge.id,
          );

        if (!relationship) {
          setError(
            "Relationship not found.",
          );

          return;
        }

        /*
         * IMPORTANT:
         *
         * Clicking an edge must NEVER
         * call the delete callback.
         */

        setError(null);

        setSelectedRelationship(
          relationship,
        );

        setEditingRelationship(
          false,
        );

        setRelationshipType(
          relationship.relationship_type,
        );

        setDirection(
          relationship.direction,
        );

        setContext(
          fromRelationshipNote(
            relationship.context,
          ),
        );

        setReliance(
          fromRelationshipNote(
            relationship.reliance,
          ),
        );
      },
      [relationships],
    );

  /* =======================================================
     EXTERNALLY-REQUESTED EDIT
     (Relationships panel "Edit" action)
  ======================================================= */

  useEffect(() => {
    if (!editRelationshipId) {
      return;
    }

    const relationship = relationships.find(
      (item) => item.id === editRelationshipId,
    );

    if (relationship) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- responds to an external command (editRelationshipId prop) from the parent, not a value derivable during render.
      setError(null);
      setSelectedRelationship(relationship);
      setEditingRelationship(true);
      setRelationshipType(relationship.relationship_type);
      setDirection(relationship.direction);
      setContext(fromRelationshipNote(relationship.context));
      setReliance(fromRelationshipNote(relationship.reliance));
    }

    onEditRelationshipConsumed?.();
  }, [editRelationshipId, relationships, onEditRelationshipConsumed]);

  /* =======================================================
     DELETE RELATIONSHIP
  ======================================================= */

  const handleDeleteRelationship =
    useCallback(() => {
      if (
        !selectedRelationship
      ) {
        return;
      }

      const relationshipId =
        selectedRelationship.id;

      /*
       * Close the modal immediately.
       */

      setSelectedRelationship(
        null,
      );

      setEditingRelationship(
        false,
      );

      /*
       * Drop the cached handle info for
       * this relationship. This does NOT
       * touch flowEdges — the edges-sync
       * effect below derives flowEdges
       * purely from the `relationships`
       * prop, so the edge disappears as
       * soon as the parent removes this
       * relationship from that prop. A
       * local optimistic edit here would
       * race that prop update and could
       * reintroduce the "deleted" edge
       * once this state change re-fires
       * the sync effect against the still
       * -stale prop.
       */

      setRelationshipHandles(
        (current) => {
          if (
            !(relationshipId in current)
          ) {
            return current;
          }

          const next = {
            ...current,
          };

          delete next[
            relationshipId
          ];

          return next;
        },
      );

      setError(null);

      /*
       * The parent owns the authoritative
       * relationships state — it performs
       * the actual delete (optimistic
       * removal + API call + rollback on
       * failure).
       */

      onDeleteRelationship?.(
        relationshipId,
      );
    }, [
      selectedRelationship,
      onDeleteRelationship,
    ]);

  /* =======================================================
     UPDATE RELATIONSHIP
  ======================================================= */

  const handleUpdateRelationship =
    useCallback(async () => {
      if (
        !selectedRelationship
      ) {
        return;
      }

      if (
        !relationshipType.trim()
      ) {
        setError(
          "Relationship type is required.",
        );

        return;
      }

      try {
        setSavingRelationship(
          true,
        );

        setError(null);

        console.log(
          "UPDATE RELATIONSHIP:",
          selectedRelationship.id,
        );

        const updated =
          await updateRelationship(
            graphId,
            selectedRelationship.id,
            {
              relationship_type:
                relationshipType.trim(),

              direction,

              context:
                toRelationshipNote(context),

              reliance:
                toRelationshipNote(reliance),

              protocol_id:
                selectedRelationship.protocol_id,
            },
          );

        /*
         * Keep the currently selected
         * handle information.
         */

        const existingHandles =
          relationshipHandles[
            selectedRelationship.id
          ];

        if (
          existingHandles
        ) {
          setRelationshipHandles(
            (current) => ({
              ...current,

              [selectedRelationship.id]:
                existingHandles,
            }),
          );
        }

        /*
         * Close editor.
         */

        setEditingRelationship(
          false,
        );

        setSelectedRelationship(
          null,
        );

        /*
         * IMPORTANT:
         * Use onRelationshipUpdated,
         * NOT onRelationshipCreated.
         */

        onRelationshipUpdated?.();

        console.log(
          "RELATIONSHIP UPDATED:",
          updated,
        );
      } catch (err) {
        console.error(
          "UPDATE RELATIONSHIP ERROR:",
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to update relationship.",
        );
      } finally {
        setSavingRelationship(
          false,
        );
      }
    }, [
      graphId,
      selectedRelationship,
      relationshipType,
      direction,
      context,
      reliance,
      relationshipHandles,
      onRelationshipUpdated,
    ]);

  /* =======================================================
     NODE CLICK
  ======================================================= */

  const handleNodeClick =
    useCallback(
      (
        _event: MouseEvent,
        node: FlowNode,
      ) => {
        const selected =
          torqueNodes.find(
            (item) =>
              item.id ===
              node.id,
          );

        onNodeSelect?.(
          selected ?? null,
        );
      },
      [
        torqueNodes,
        onNodeSelect,
      ],
    );

  /* =======================================================
     PANE CLICK
  ======================================================= */

  const handlePaneClick =
    useCallback(() => {
      onNodeSelect?.(null);

      setSelectedRelationship(
        null,
      );

      setEditingRelationship(
        false,
      );

      setError(null);
    }, [onNodeSelect]);

  /* =======================================================
     CONNECTION SOURCE/TARGET NODES
  ======================================================= */

  const sourceNode =
    connection
      ? torqueNodes.find(
          (node) =>
            node.id ===
            connection.source,
        )
      : null;

  const targetNode =
    connection
      ? torqueNodes.find(
          (node) =>
            node.id ===
            connection.target,
        )
      : null;

  /* =======================================================
     SELECTED RELATIONSHIP NODES
  ======================================================= */

  const selectedSourceNode =
    selectedRelationship
      ? torqueNodes.find(
          (node) =>
            node.id ===
            selectedRelationship.source_node_id,
        )
      : null;

  const selectedTargetNode =
    selectedRelationship
      ? torqueNodes.find(
          (node) =>
            node.id ===
            selectedRelationship.target_node_id,
        )
      : null;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      {/* ===================================================
          GRAPH CANVAS
      =================================================== */}

      <div className="torque-flow-container">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={
            onNodesChange
          }
          onConnect={
            handleConnect
          }
          onNodeClick={
            handleNodeClick
          }
          onEdgeClick={
            handleEdgeClick
          }
          onPaneClick={
            handlePaneClick
          }
          minZoom={0.25}
          maxZoom={1.8}
          nodesDraggable
          nodesConnectable
          elementsSelectable
          deleteKeyCode={null}
          connectionMode={ConnectionMode.Loose}
          connectionLineStyle={{
            stroke: "#888",
            strokeWidth: 1.5,
          }}
        >
          <Background
            gap={32}
            size={1}
            color="#202020"
          />

          <Controls
            showInteractive={false}
          />
        </ReactFlow>
      </div>

      {/* ===================================================
          CREATE RELATIONSHIP MODAL
      =================================================== */}

      {connection && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-6"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              if (!creating) {
                setConnection(
                  null,
                );
              }
            }
          }}
        >
          <div
            className="w-full max-w-[520px] overflow-hidden rounded-xl border border-[#303030] bg-[#111] shadow-[0_25px_100px_rgba(0,0,0,0.8)]"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            {/* HEADER */}

            <div className="flex items-start justify-between border-b border-[#242424] px-5 py-4">
              <div>
                <div className="text-[9px] font-bold tracking-[0.14em] text-[#666]">
                  NEW RELATIONSHIP
                </div>

                <h2 className="mt-1 text-[16px] font-semibold text-[#eee]">
                  Connect Nodes
                </h2>
              </div>

              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[20px] text-[#777] hover:bg-[#1d1d1d] hover:text-[#eee]"
                onClick={() =>
                  setConnection(
                    null,
                  )
                }
                disabled={creating}
              >
                ×
              </button>
            </div>

            {/* BODY */}

            <div className="flex flex-col gap-5 p-5">
              {/* SOURCE → TARGET */}

              <div className="flex items-center gap-3 rounded-lg border border-[#292929] bg-[#171717] p-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-[8px] font-bold tracking-[0.12em] text-[#666]">
                    SOURCE
                  </div>

                  <div className="truncate text-[12px] font-semibold text-[#eee]">
                    {sourceNode?.name ??
                      "Unknown"}
                  </div>
                </div>

                <div className="text-[18px] text-[#777]">
                  →
                </div>

                <div className="min-w-0 flex-1 text-right">
                  <div className="mb-1 text-[8px] font-bold tracking-[0.12em] text-[#666]">
                    TARGET
                  </div>

                  <div className="truncate text-[12px] font-semibold text-[#eee]">
                    {targetNode?.name ??
                      "Unknown"}
                  </div>
                </div>
              </div>

              {/* TYPE */}

              <label className="flex flex-col gap-2">
                <span className="text-[10px] text-[#888]">
                  Relationship Type
                </span>

                <input
                  value={
                    relationshipType
                  }
                  onChange={(event) =>
                    setRelationshipType(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Communication"
                  className="h-10 w-full rounded-md border border-[#2c2c2c] bg-[#181818] px-3 text-[11px] text-[#eee] outline-none placeholder:text-[#4d4d4d] focus:border-[#555]"
                />
              </label>

              {/* DIRECTION */}

              <label className="flex flex-col gap-2">
                <span className="text-[10px] text-[#888]">
                  Direction
                </span>

                <select
                  value={direction}
                  onChange={(event) =>
                    setDirection(
                      event.target
                        .value as RelationshipDirection,
                    )
                  }
                  className="h-10 w-full rounded-md border border-[#2c2c2c] bg-[#181818] px-3 text-[11px] text-[#eee] outline-none focus:border-[#555]"
                >
                  <option value="FORWARD">
                    Forward
                  </option>

                  <option value="REVERSE">
                    Reverse
                  </option>

                  <option value="BIDIRECTIONAL">
                    Bidirectional
                  </option>
                </select>
              </label>

              {/* CONTEXT */}

              <label className="flex flex-col gap-2">
                <span className="text-[10px] text-[#888]">
                  Context
                </span>

                <textarea
                  value={context}
                  onChange={(event) =>
                    setContext(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Optional communication context..."
                  className="min-h-[75px] w-full resize-y rounded-md border border-[#2c2c2c] bg-[#181818] px-3 py-2.5 text-[11px] text-[#eee] outline-none placeholder:text-[#4d4d4d] focus:border-[#555]"
                />
              </label>

              {/* RELIANCE */}

              <label className="flex flex-col gap-2">
                <span className="text-[10px] text-[#888]">
                  Reliance
                </span>

                <textarea
                  value={reliance}
                  onChange={(event) =>
                    setReliance(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Optional reliance information..."
                  className="min-h-[75px] w-full resize-y rounded-md border border-[#2c2c2c] bg-[#181818] px-3 py-2.5 text-[11px] text-[#eee] outline-none placeholder:text-[#4d4d4d] focus:border-[#555]"
                />
              </label>

              {error && (
                <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-[10px] text-red-400">
                  {error}
                </div>
              )}
            </div>

            {/* FOOTER */}

            <div className="flex justify-end gap-2 border-t border-[#242424] px-5 py-4">
              <button
                type="button"
                className="h-9 rounded-md border border-[#303030] px-4 text-[10px] text-[#999] hover:bg-[#1b1b1b] hover:text-[#eee]"
                onClick={() =>
                  setConnection(
                    null,
                  )
                }
                disabled={creating}
              >
                Cancel
              </button>

              <button
                type="button"
                className="h-9 rounded-md bg-[#eee] px-4 text-[10px] font-semibold text-[#111] hover:bg-white disabled:opacity-40"
                onClick={
                  handleCreateRelationship
                }
                disabled={
                  creating ||
                  !relationshipType.trim()
                }
              >
                {creating
                  ? "Creating..."
                  : "Create Relationship"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          RELATIONSHIP DETAILS / EDIT / DELETE
      =================================================== */}

      {selectedRelationship && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-6"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedRelationship(
                null,
              );

              setEditingRelationship(
                false,
              );
            }
          }}
        >
          <div
            className="w-full max-w-[520px] overflow-hidden rounded-xl border border-[#303030] bg-[#111] shadow-[0_25px_100px_rgba(0,0,0,0.8)]"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            {/* HEADER */}

            <div className="flex items-start justify-between border-b border-[#242424] px-5 py-4">
              <div>
                <div className="text-[9px] font-bold tracking-[0.14em] text-[#666]">
                  {editingRelationship
                    ? "EDIT RELATIONSHIP"
                    : "RELATIONSHIP"}
                </div>

                <h2 className="mt-1 text-[16px] font-semibold text-[#eee]">
                  {editingRelationship
                    ? "Edit Relationship"
                    : "Relationship Details"}
                </h2>
              </div>

              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[20px] text-[#777] hover:bg-[#1d1d1d] hover:text-[#eee]"
                onClick={() => {
                  setSelectedRelationship(
                    null,
                  );

                  setEditingRelationship(
                    false,
                  );
                }}
                disabled={
                  savingRelationship
                }
              >
                ×
              </button>
            </div>

            {/* BODY */}

            <div className="flex flex-col gap-5 p-5">
              {/* SOURCE / TARGET */}

              <div className="flex items-center gap-3 rounded-lg border border-[#292929] bg-[#171717] p-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-[8px] font-bold tracking-[0.12em] text-[#666]">
                    SOURCE
                  </div>

                  <div className="truncate text-[12px] font-semibold text-[#eee]">
                    {selectedSourceNode?.name ??
                      "Unknown"}
                  </div>
                </div>

                <div className="text-[18px] text-[#777]">
                  →
                </div>

                <div className="min-w-0 flex-1 text-right">
                  <div className="mb-1 text-[8px] font-bold tracking-[0.12em] text-[#666]">
                    TARGET
                  </div>

                  <div className="truncate text-[12px] font-semibold text-[#eee]">
                    {selectedTargetNode?.name ??
                      "Unknown"}
                  </div>
                </div>
              </div>

              {/* RELATIONSHIP TYPE */}

              {editingRelationship ? (
                <label className="flex flex-col gap-2">
                  <span className="text-[10px] text-[#888]">
                    Relationship Type
                  </span>

                  <input
                    value={
                      relationshipType
                    }
                    onChange={(event) =>
                      setRelationshipType(
                        event.target
                          .value,
                      )
                    }
                    className="h-10 w-full rounded-md border border-[#2c2c2c] bg-[#181818] px-3 text-[11px] text-[#eee] outline-none focus:border-[#555]"
                  />
                </label>
              ) : (
                <div className="inspector-field">
                  <span>
                    Relationship Type
                  </span>

                  <strong>
                    {
                      selectedRelationship.relationship_type
                    }
                  </strong>
                </div>
              )}

              {/* DIRECTION */}

              {editingRelationship ? (
                <label className="flex flex-col gap-2">
                  <span className="text-[10px] text-[#888]">
                    Direction
                  </span>

                  <select
                    value={direction}
                    onChange={(event) =>
                      setDirection(
                        event.target
                          .value as RelationshipDirection,
                      )
                    }
                    className="h-10 w-full rounded-md border border-[#2c2c2c] bg-[#181818] px-3 text-[11px] text-[#eee] outline-none focus:border-[#555]"
                  >
                    <option value="FORWARD">
                      Forward
                    </option>

                    <option value="REVERSE">
                      Reverse
                    </option>

                    <option value="BIDIRECTIONAL">
                      Bidirectional
                    </option>
                  </select>
                </label>
              ) : (
                <div className="inspector-field">
                  <span>
                    Direction
                  </span>

                  <strong>
                    {
                      selectedRelationship.direction
                    }
                  </strong>
                </div>
              )}

              {/* CONTEXT */}

              {editingRelationship ? (
                <label className="flex flex-col gap-2">
                  <span className="text-[10px] text-[#888]">
                    Context
                  </span>

                  <textarea
                    value={context}
                    onChange={(event) =>
                      setContext(
                        event.target
                          .value,
                      )
                    }
                    className="min-h-[75px] w-full resize-y rounded-md border border-[#2c2c2c] bg-[#181818] px-3 py-2.5 text-[11px] text-[#eee] outline-none focus:border-[#555]"
                  />
                </label>
              ) : selectedRelationship.context?.text ? (
                <div className="inspector-field">
                  <span>
                    Context
                  </span>

                  <strong>
                    {
                      selectedRelationship.context.text
                    }
                  </strong>
                </div>
              ) : null}

              {/* RELIANCE */}

              {editingRelationship ? (
                <label className="flex flex-col gap-2">
                  <span className="text-[10px] text-[#888]">
                    Reliance
                  </span>

                  <textarea
                    value={reliance}
                    onChange={(event) =>
                      setReliance(
                        event.target
                          .value,
                      )
                    }
                    className="min-h-[75px] w-full resize-y rounded-md border border-[#2c2c2c] bg-[#181818] px-3 py-2.5 text-[11px] text-[#eee] outline-none focus:border-[#555]"
                  />
                </label>
              ) : selectedRelationship.reliance?.text ? (
                <div className="inspector-field">
                  <span>
                    Reliance
                  </span>

                  <strong>
                    {
                      selectedRelationship.reliance.text
                    }
                  </strong>
                </div>
              ) : null}

              {/* ERROR */}

              {error && (
                <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-[10px] text-red-400">
                  {error}
                </div>
              )}
            </div>

            {/* FOOTER */}

            <div className="flex items-center justify-between border-t border-[#242424] px-5 py-4">
              {!editingRelationship ? (
                <>
                  {/* DELETE */}

                  <button
                    type="button"
                    className="h-9 rounded-md border border-red-900/60 bg-red-950/20 px-4 text-[10px] font-medium text-red-400 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={
                      handleDeleteRelationship
                    }
                  >
                    Delete Relationship
                  </button>

                  <div className="flex gap-2">
                    {/* CLOSE */}

                    <button
                      type="button"
                      className="h-9 rounded-md border border-[#303030] px-4 text-[10px] text-[#999] hover:bg-[#1b1b1b] hover:text-[#eee]"
                      onClick={() =>
                        setSelectedRelationship(
                          null,
                        )
                      }
                    >
                      Close
                    </button>

                    {/* EDIT */}

                    <button
                      type="button"
                      className="h-9 rounded-md bg-[#eee] px-4 text-[10px] font-semibold text-[#111] hover:bg-white"
                      onClick={() =>
                        setEditingRelationship(
                          true,
                        )
                      }
                    >
                      Edit Relationship
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* CANCEL */}

                  <button
                    type="button"
                    className="h-9 rounded-md border border-[#303030] px-4 text-[10px] text-[#999] hover:bg-[#1b1b1b] hover:text-[#eee]"
                    onClick={() =>
                      setEditingRelationship(
                        false,
                      )
                    }
                    disabled={
                      savingRelationship
                    }
                  >
                    Cancel
                  </button>

                  {/* SAVE */}

                  <button
                    type="button"
                    className="h-9 rounded-md bg-[#eee] px-4 text-[10px] font-semibold text-[#111] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={
                      handleUpdateRelationship
                    }
                    disabled={
                      savingRelationship ||
                      !relationshipType.trim()
                    }
                  >
                    {savingRelationship
                      ? "Saving..."
                      : "Save Changes"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* =========================================================
   PROVIDER WRAPPER
========================================================= */

export default function GraphCanvas(
  props: GraphCanvasProps,
) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner
        {...props}
      />
    </ReactFlowProvider>
  );
}