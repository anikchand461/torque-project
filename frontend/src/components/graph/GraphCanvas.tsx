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
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  useNodesInitialized,
  type Connection,
  type Edge,
  type Node as FlowNode,
  type OnConnectStartParams,
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

import {
  findDuplicateRelationship,
  getBidirectionalDetail,
  getDirectionSummary,
  getEffectiveEndpoints,
} from "@/lib/relationships";

import InfoTooltip from "@/components/common/InfoTooltip";

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
   HANDLE ROUTING

   GraphNode renders a source-typed AND a target-typed
   handle stacked on all four sides (top/right/bottom/left),
   so — unlike an earlier version of this file that only had
   two source-typed and two target-typed handles on fixed,
   different sides — there is no longer any relative
   position between two nodes that can't be served by a
   correctly-typed handle on the correct side.

   The choice is a simple dominant-axis rule: whichever axis
   (horizontal/vertical) has the larger distance between the
   two node centers decides whether the edge exits/enters
   through the left/right sides or the top/bottom sides, and
   the sign of that distance decides which of the two. This
   always produces a short, direct, naturally-facing
   connection for horizontal, vertical, and diagonal
   arrangements alike, without any per-node-type lookup that
   could ever resolve to a handle of the wrong type — the
   source side always maps to `${side}-source` and the
   target side always maps to `${side}-target`, both of
   which always exist on every node.

   This never touches which node is logically the source vs
   target (that's `relationship.source_node_id`/
   `target_node_id`, untouched here) — only which side of
   each node the line is drawn from/to.
========================================================= */

const APPROX_NODE_WIDTH = 280;
const APPROX_NODE_HEIGHT = 92;

type CompassSide =
  | "top"
  | "right"
  | "bottom"
  | "left";

function pickCompassSides(
  sourceCenter: {
    x: number;
    y: number;
  },
  targetCenter: {
    x: number;
    y: number;
  },
): {
  sourceSide: CompassSide;
  targetSide: CompassSide;
} {
  const dx =
    targetCenter.x - sourceCenter.x;

  const dy =
    targetCenter.y - sourceCenter.y;

  /*
   * Node cards are much wider than they are
   * tall (~280 x ~92), so comparing raw pixel
   * dx/dy is misleading: two nodes that are
   * mostly stacked vertically can still end up
   * with a larger raw horizontal gap than
   * vertical gap simply because the cards are
   * wide, which used to route the edge out the
   * side instead of the bottom/top. Normalizing
   * each axis by the node's own extent on that
   * axis first answers the actual question —
   * "is the target more node-widths away
   * horizontally, or more node-heights away
   * vertically?" — which matches how the
   * relationship actually looks on screen.
   */

  const horizontalRatio =
    Math.abs(dx) / APPROX_NODE_WIDTH;

  const verticalRatio =
    Math.abs(dy) / APPROX_NODE_HEIGHT;

  // Horizontal distance dominates: exit/enter
  // through the left/right sides.
  if (
    horizontalRatio >= verticalRatio
  ) {
    return dx >= 0
      ? {
          sourceSide: "right",
          targetSide: "left",
        }
      : {
          sourceSide: "left",
          targetSide: "right",
        };
  }

  // Vertical distance dominates: exit/enter
  // through the top/bottom sides.
  return dy >= 0
    ? {
        sourceSide: "bottom",
        targetSide: "top",
      }
    : {
        sourceSide: "top",
        targetSide: "bottom",
      };
}

function pickHandlePair(
  sourceTopLeft: {
    x: number;
    y: number;
  },
  targetTopLeft: {
    x: number;
    y: number;
  },
): {
  sourceHandle: string;
  targetHandle: string;
} {
  const sourceCenter = {
    x:
      sourceTopLeft.x +
      APPROX_NODE_WIDTH / 2,
    y:
      sourceTopLeft.y +
      APPROX_NODE_HEIGHT / 2,
  };

  const targetCenter = {
    x:
      targetTopLeft.x +
      APPROX_NODE_WIDTH / 2,
    y:
      targetTopLeft.y +
      APPROX_NODE_HEIGHT / 2,
  };

  const {
    sourceSide,
    targetSide,
  } = pickCompassSides(
    sourceCenter,
    targetCenter,
  );

  return {
    sourceHandle: `${sourceSide}-source`,
    targetHandle: `${targetSide}-target`,
  };
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

  /* =======================================================
     NEW CONNECTION

     `fromNodeId`/`toNodeId` (not `connection.source`/
     `.target`) are the single source of truth for which
     node is which once a drag lands — see handleConnect,
     which resolves these against the true drag-start node
     rather than trusting React Flow's post-normalization
     Connection object.
  ======================================================= */

  const [connection, setConnection] =
    useState<Connection | null>(null);

  const [fromNodeId, setFromNodeId] =
    useState<string | null>(null);

  const [toNodeId, setToNodeId] =
    useState<string | null>(null);

  const [bidirectional, setBidirectional] =
    useState(true);

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

  /* =======================================================
     TRUE DRAG-START NODE

     In loose connectionMode, React Flow's onConnect gives
     back a Connection whose source/target are normalized by
     HANDLE TYPE, not by which node the user actually started
     dragging from — starting a drag on a target-typed handle
     and dropping on a source-typed one can silently swap
     which node ends up called "source". onConnectStart fires
     with the real starting node before any of that
     normalization happens, so capturing it here is what lets
     handleConnect below recover the user's true intent.
  ======================================================= */

  const connectStartRef =
    useRef<string | null>(null);

  const handleConnectStart =
    useCallback(
      (
        _event: unknown,
        params: OnConnectStartParams,
      ) => {
        connectStartRef.current =
          params.nodeId ?? null;
      },
      [],
    );

  const handleConnectEnd =
    useCallback(() => {
      connectStartRef.current = null;
    }, []);

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
     DERIVE EDGES FROM CURRENT NODE POSITIONS

     Both edge families are pure functions of data we
     already have — there is nothing here that needs to be
     remembered between renders, so both are plain
     useMemo values, not state-synced-via-effect. This is
     what makes a newly created relationship render
     immediately (no effect-timing gap to fall through) and
     what makes every edge survive a reload with its handles
     still correctly anchored (nothing was ever persisted
     that could go stale).
  ======================================================= */

  const nodePositions = useMemo(() => {
    const map = new Map<
      string,
      { x: number; y: number }
    >();

    for (const node of flowNodes) {
      map.set(node.id, node.position);
    }

    return map;
  }, [flowNodes]);

  /*
   * Hierarchy edges are derived directly from
   * Node.parent_id — never backed by a Relationship
   * record. They are a separate, purely visual overlay
   * showing reporting structure.
   */
  const hierarchyEdges = useMemo<
    Edge[]
  >(() => {
    const edges: Edge[] = [];

    for (const node of torqueNodes) {
      if (!node.parent_id) {
        continue;
      }

      const parentPos =
        nodePositions.get(
          node.parent_id,
        );

      const childPos =
        nodePositions.get(node.id);

      if (!parentPos || !childPos) {
        continue;
      }

      const {
        sourceHandle,
        targetHandle,
      } = pickHandlePair(
        parentPos,
        childPos,
      );

      edges.push({
        id: `hierarchy:${node.id}`,

        source: node.parent_id,
        target: node.id,

        sourceHandle,
        targetHandle,

        type: "hierarchyEdge",

        data: {
          kind: "hierarchy",
        },

        selectable: true,
        zIndex: 0,
      });
    }

    return edges;
  }, [torqueNodes, nodePositions]);

  const communicationEdges = useMemo<
    Edge[]
  >(() => {
    return relationships.map(
      (relationship) => {
        const sourcePos =
          nodePositions.get(
            relationship.source_node_id,
          );

        const targetPos =
          nodePositions.get(
            relationship.target_node_id,
          );

        const {
          sourceHandle,
          targetHandle,
        } =
          sourcePos && targetPos
            ? pickHandlePair(
                sourcePos,
                targetPos,
              )
            : {
                sourceHandle:
                  "bottom-source",
                targetHandle:
                  "top-target",
              };

        const isReverse =
          relationship.direction ===
          "REVERSE";

        const isBidirectional =
          relationship.direction ===
          "BIDIRECTIONAL";

        const arrow = {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 12,
          color: "#999",
        };

        return {
          id: relationship.id,

          source:
            relationship.source_node_id,

          target:
            relationship.target_node_id,

          sourceHandle,
          targetHandle,

          type: "torqueEdge",

          data: {
            kind: "communication",

            relationshipType:
              relationship.relationship_type,

            direction:
              relationship.direction,
          },

          // FORWARD: arrow at target only.
          // REVERSE: arrow at source only
          //   (communication actually flows
          //   target -> source).
          // BIDIRECTIONAL: arrow at both ends.
          markerEnd: !isReverse
            ? arrow
            : undefined,

          markerStart:
            isReverse || isBidirectional
              ? arrow
              : undefined,

          animated: false,
          selectable: true,
          zIndex: 1,
        };
      },
    );
  }, [relationships, nodePositions]);

  const edges = useMemo(
    () => [
      ...hierarchyEdges,
      ...communicationEdges,
    ],
    [hierarchyEdges, communicationEdges],
  );

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
      hierarchyEdge: GraphEdge,
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

        /*
         * Resolve the TRUE "from" node using
         * the node the drag actually started
         * on (see connectStartRef above), not
         * React Flow's post-normalization
         * source/target — this is what makes
         * P1 -> P2 never silently become
         * P2 -> P1.
         */

        const startNodeId =
          connectStartRef.current;

        let fromId = params.source;
        let toId = params.target;

        if (
          startNodeId &&
          startNodeId === params.target
        ) {
          fromId = params.target;
          toId = params.source;
        }

        /*
         * Only one communication relationship
         * is allowed between any two nodes —
         * A -> B and B -> A count as the same
         * pair.
         */

        const duplicate =
          findDuplicateRelationship(
            relationships,
            fromId,
            toId,
          );

        if (duplicate) {
          const fromName =
            torqueNodes.find(
              (node) =>
                node.id === fromId,
            )?.name ?? "This node";

          const toName =
            torqueNodes.find(
              (node) =>
                node.id === toId,
            )?.name ?? "the other node";

          setError(
            `${fromName} and ${toName} already have a communication relationship. Edit the existing one instead of creating a second.`,
          );

          return;
        }

        setError(null);

        setConnection(
          params,
        );

        setFromNodeId(fromId);
        setToNodeId(toId);

        setRelationshipType(
          "Communication",
        );

        setBidirectional(true);

        setContext("");

        setReliance("");
      },
      [relationships, torqueNodes],
    );

  /* =======================================================
     CREATE RELATIONSHIP
  ======================================================= */

  const closeConnectionModal =
    useCallback(() => {
      if (creating) {
        return;
      }

      setConnection(null);
      setFromNodeId(null);
      setToNodeId(null);
    }, [creating]);

  const swapConnectionEndpoints =
    useCallback(() => {
      setFromNodeId(toNodeId);
      setToNodeId(fromNodeId);
    }, [fromNodeId, toNodeId]);

  const handleCreateRelationship =
    useCallback(
      async () => {
        if (!fromNodeId || !toNodeId) {
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

          const created =
            await createRelationship(
              graphId,
              {
                source_node_id:
                  fromNodeId,

                target_node_id:
                  toNodeId,

                relationship_type:
                  relationshipType.trim(),

                direction:
                  bidirectional
                    ? "BIDIRECTIONAL"
                    : "FORWARD",

                context:
                  toRelationshipNote(context),

                reliance:
                  toRelationshipNote(reliance),

                protocol_id:
                  null,
              },
            );

          /*
           * Close connection modal.
           */

          setConnection(null);
          setFromNodeId(null);
          setToNodeId(null);

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
        fromNodeId,
        toNodeId,
        graphId,
        relationshipType,
        bidirectional,
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
        /*
         * Hierarchy edges are a derived visual
         * overlay of Node.parent_id — there is
         * no Relationship behind them, so they
         * must never open the communication
         * relationship editor. Selecting the
         * child node instead lets the user jump
         * straight to changing its parent.
         */

        if (
          (
            edge.data as
              | { kind?: string }
              | undefined
          )?.kind === "hierarchy"
        ) {
          const child =
            torqueNodes.find(
              (node) =>
                node.id ===
                edge.target,
            );

          onNodeSelect?.(
            child ?? null,
          );

          return;
        }

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
      [
        relationships,
        torqueNodes,
        onNodeSelect,
      ],
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

      setError(null);

      /*
       * The parent owns the authoritative
       * relationships state — it performs
       * the actual delete (optimistic
       * removal + API call + rollback on
       * failure). Edges are derived purely
       * from that `relationships` prop (see
       * communicationEdges above), so the
       * edge disappears the instant the
       * parent removes it from that prop —
       * nothing local to clean up here.
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
     CONNECTION FROM/TO NODES
  ======================================================= */

  const fromNode =
    fromNodeId
      ? torqueNodes.find(
          (node) =>
            node.id === fromNodeId,
        )
      : null;

  const toNode =
    toNodeId
      ? torqueNodes.find(
          (node) =>
            node.id === toNodeId,
        )
      : null;

  /* =======================================================
     SELECTED RELATIONSHIP FROM/TO NODES

     Uses the effective endpoints (accounting for a stored
     REVERSE direction) so a person always sees "who talks
     to whom" the same way regardless of how it happens to
     be stored.
  ======================================================= */

  const selectedEffectiveEndpoints =
    selectedRelationship
      ? getEffectiveEndpoints(
          selectedRelationship.source_node_id,
          selectedRelationship.target_node_id,
          direction,
        )
      : null;

  const selectedFromNode =
    selectedEffectiveEndpoints
      ? torqueNodes.find(
          (node) =>
            node.id ===
            selectedEffectiveEndpoints.fromId,
        )
      : null;

  const selectedToNode =
    selectedEffectiveEndpoints
      ? torqueNodes.find(
          (node) =>
            node.id ===
            selectedEffectiveEndpoints.toId,
        )
      : null;

  const swapSelectedDirection =
    useCallback(() => {
      setDirection((current) =>
        current === "REVERSE"
          ? "FORWARD"
          : current === "FORWARD"
            ? "REVERSE"
            : current,
      );
    }, []);

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
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={
            onNodesChange
          }
          onConnectStart={
            handleConnectStart
          }
          onConnect={
            handleConnect
          }
          onConnectEnd={
            handleConnectEnd
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
            position="bottom-right"
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
              closeConnectionModal();
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
                onClick={
                  closeConnectionModal
                }
                disabled={creating}
              >
                ×
              </button>
            </div>

            {/* BODY */}

            <div className="flex flex-col gap-5 p-5">
              {/* FROM → TO */}

              <div>
                <div className="mb-2 flex items-center text-[10px] text-[#888]">
                  Communication

                  <InfoTooltip
                    text="Who is sending information to whom. This is separate from reporting-line hierarchy — two people can communicate without one being the other's manager."
                  />
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-[#292929] bg-[#171717] p-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-[8px] font-bold tracking-[0.12em] text-[#666]">
                      FROM
                    </div>

                    <div className="truncate text-[12px] font-semibold text-[#eee]">
                      {fromNode?.name ??
                        "Unknown"}
                    </div>
                  </div>

                  <button
                    type="button"
                    title="Swap direction"
                    onClick={
                      swapConnectionEndpoints
                    }
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#2c2c2c] text-[14px] text-[#999] hover:bg-[#1f1f1f] hover:text-[#eee]"
                  >
                    ⇄
                  </button>

                  <div className="min-w-0 flex-1 text-right">
                    <div className="mb-1 text-[8px] font-bold tracking-[0.12em] text-[#666]">
                      TO
                    </div>

                    <div className="truncate text-[12px] font-semibold text-[#eee]">
                      {toNode?.name ??
                        "Unknown"}
                    </div>
                  </div>
                </div>

                <label className="mt-3 flex items-center gap-2 text-[10px] text-[#aaa]">
                  <input
                    type="checkbox"
                    checked={
                      bidirectional
                    }
                    onChange={(event) =>
                      setBidirectional(
                        event.target
                          .checked,
                      )
                    }
                  />

                  Two-way communication

                  <InfoTooltip
                    text="On: both sides regularly initiate communication. Off: only the 'From' side initiates — the 'To' side responds but doesn't start new communication on this channel."
                  />
                </label>

                <div className="mt-2 text-[10px] text-[#777]">
                  {bidirectional
                    ? getBidirectionalDetail(
                        fromNode?.name ??
                          "This node",
                        toNode?.name ??
                          "the other node",
                      )
                    : getDirectionSummary(
                        fromNode?.name ??
                          "This node",
                        toNode?.name ??
                          "the other node",
                        "FORWARD",
                      )}
                </div>
              </div>

              {/* TYPE */}

              <label className="flex flex-col gap-2">
                <span className="flex items-center text-[10px] text-[#888]">
                  Relationship Type

                  <InfoTooltip
                    text="A short label for what this channel is for, e.g. Escalation, Status Update, or Approval Request. Free text — use whatever vocabulary your organization already uses."
                  />
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

              {/* CONTEXT */}


              <label className="flex flex-col gap-2">
                <span className="flex items-center text-[10px] text-[#888]">
                  Context

                  <InfoTooltip
                    text="What information actually gets exchanged here, e.g. 'weekly status', 'budget approvals'. Helps an agent know what this channel is for."
                  />
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
                <span className="flex items-center text-[10px] text-[#888]">
                  Reliance

                  <InfoTooltip
                    text="How much one side depends on the other through this channel, e.g. 'CFO relies on Sales Lead for revenue numbers before board meetings'. Useful context for how critical the channel is."
                  />
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

              {/* PROTOCOL */}

              <div className="rounded-md border border-[#2c2c2c] bg-[#161616] px-3 py-2.5">
                <div className="flex items-center text-[10px] text-[#888]">
                  Protocol

                  <InfoTooltip
                    text="The rules that govern this channel — who's allowed to send/receive, escalate, bypass the hierarchy, or forward information, and how confidential it is. Manage and attach protocols from the Protocols tab."
                  />
                </div>

                <div className="mt-1 text-[9px] text-[#666]">
                  No protocol attached yet. Multi-protocol attachment is coming in a later update — for now, protocols are managed from the Protocols tab.
                </div>
              </div>

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
                onClick={
                  closeConnectionModal
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
                  !relationshipType.trim() ||
                  !fromNodeId ||
                  !toNodeId
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
              {/* FROM / TO */}

              <div>
                <div className="mb-2 flex items-center text-[10px] text-[#888]">
                  Communication

                  <InfoTooltip
                    text="Who is sending information to whom. This is separate from reporting-line hierarchy — two people can communicate without one being the other's manager."
                  />
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-[#292929] bg-[#171717] p-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-[8px] font-bold tracking-[0.12em] text-[#666]">
                      FROM
                    </div>

                    <div className="truncate text-[12px] font-semibold text-[#eee]">
                      {selectedFromNode?.name ??
                        "Unknown"}
                    </div>
                  </div>

                  {editingRelationship ? (
                    <button
                      type="button"
                      title="Swap direction"
                      onClick={
                        swapSelectedDirection
                      }
                      disabled={
                        direction ===
                        "BIDIRECTIONAL"
                      }
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#2c2c2c] text-[14px] text-[#999] hover:bg-[#1f1f1f] hover:text-[#eee] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ⇄
                    </button>
                  ) : (
                    <div className="text-[18px] text-[#777]">
                      {direction ===
                      "BIDIRECTIONAL"
                        ? "⇄"
                        : "→"}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 text-right">
                    <div className="mb-1 text-[8px] font-bold tracking-[0.12em] text-[#666]">
                      TO
                    </div>

                    <div className="truncate text-[12px] font-semibold text-[#eee]">
                      {selectedToNode?.name ??
                        "Unknown"}
                    </div>
                  </div>
                </div>

                {editingRelationship && (
                  <label className="mt-3 flex items-center gap-2 text-[10px] text-[#aaa]">
                    <input
                      type="checkbox"
                      checked={
                        direction ===
                        "BIDIRECTIONAL"
                      }
                      onChange={(event) =>
                        setDirection(
                          event.target
                            .checked
                            ? "BIDIRECTIONAL"
                            : "FORWARD",
                        )
                      }
                    />

                    Two-way communication

                    <InfoTooltip
                      text="On: both sides regularly initiate communication. Off: only the 'From' side initiates — the 'To' side responds but doesn't start new communication on this channel."
                    />
                  </label>
                )}

                <div className="mt-2 text-[10px] text-[#777]">
                  {direction ===
                  "BIDIRECTIONAL"
                    ? getBidirectionalDetail(
                        selectedFromNode?.name ??
                          "This node",
                        selectedToNode?.name ??
                          "the other node",
                      )
                    : getDirectionSummary(
                        selectedFromNode?.name ??
                          "This node",
                        selectedToNode?.name ??
                          "the other node",
                        "FORWARD",
                      )}
                </div>
              </div>

              {/* RELATIONSHIP TYPE */}

              {editingRelationship ? (
                <label className="flex flex-col gap-2">
                  <span className="flex items-center text-[10px] text-[#888]">
                    Relationship Type

                    <InfoTooltip
                      text="A short label for what this channel is for, e.g. Escalation, Status Update, or Approval Request. Free text — use whatever vocabulary your organization already uses."
                    />
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

              {/* CONTEXT */}


              {editingRelationship ? (
                <label className="flex flex-col gap-2">
                  <span className="flex items-center text-[10px] text-[#888]">
                    Context

                    <InfoTooltip
                      text="What information actually gets exchanged here, e.g. 'weekly status', 'budget approvals'. Helps an agent know what this channel is for."
                    />
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
                  <span className="flex items-center text-[10px] text-[#888]">
                    Reliance

                    <InfoTooltip
                      text="How much one side depends on the other through this channel, e.g. 'CFO relies on Sales Lead for revenue numbers before board meetings'. Useful context for how critical the channel is."
                    />
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

              {/* PROTOCOL */}

              {editingRelationship && (
                <div className="rounded-md border border-[#2c2c2c] bg-[#161616] px-3 py-2.5">
                  <div className="flex items-center text-[10px] text-[#888]">
                    Protocol

                    <InfoTooltip
                      text="The rules that govern this channel — who's allowed to send/receive, escalate, bypass the hierarchy, or forward information, and how confidential it is. Manage and attach protocols from the Protocols tab."
                    />
                  </div>

                  <div className="mt-1 text-[9px] text-[#666]">
                    Multi-protocol attachment is coming in a later update — for now, protocols are managed from the Protocols tab.
                  </div>
                </div>
              )}

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