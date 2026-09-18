"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  GitBranch,
  ShieldCheck,
  History,
  Network,
  Square,
  Loader2,
  ArrowRight,
} from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import GraphCanvas from "@/components/graph/GraphCanvas";
import RelationshipPanel from "@/components/relationships/RelationshipPanel";
import ProtocolPanel from "@/components/protocols/ProtocolPanel";

import {
  getGraphs,
  getNodes,
  getRelationships,
  getProtocols,
  getExecutions,
  getExecution,
  getExecutionTrace,
  validateGraph,
  createGraph,
  createNode,
  updateNode,
  deleteNode,
  executeGraph,
  deleteGraph,
  createRelationship,
  deleteRelationship,
  deleteProtocol,
  stopExecution,
} from "@/lib/api";

import { findDuplicateRelationship } from "@/lib/relationships";

import type {
  Graph,
  Node,
  Relationship,
  Protocol,
  Execution,
  ValidationResult,
} from "@/lib/types";

export default function Home() {
  // ============================================
  // APP STATE
  // ============================================

  const [mounted, setMounted] = useState(false);

  const [activeView, setActiveView] =
    useState("Graph");

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  // ============================================
  // GRAPH STATE
  // ============================================

  const [graphs, setGraphs] =
    useState<Graph[]>([]);

  const [selectedGraph, setSelectedGraph] =
    useState<Graph | null>(null);

  const [nodes, setNodes] =
    useState<Node[]>([]);

  const [relationships, setRelationships] =
    useState<Relationship[]>([]);

  const [protocols, setProtocols] =
    useState<Protocol[]>([]);

  const [selectedNode, setSelectedNode] =
    useState<Node | null>(null);

  const [validation, setValidation] =
    useState<ValidationResult | null>(null);

  const [
    pendingEditRelationshipId,
    setPendingEditRelationshipId,
  ] = useState<string | null>(null);

  // Tracks which graph the most recently issued
  // loadGraphData() call belongs to, so a slow
  // response from a graph the user has since
  // switched away from (or deleted) can never
  // overwrite newer state.
  const graphDataRequestRef =
    useRef<string | null>(null);

  // ============================================
  // EXECUTION STATE
  // ============================================

  const [executions, setExecutions] =
    useState<Execution[]>([]);

  const [selectedExecution, setSelectedExecution] =
    useState<Execution | null>(null);

  const [executionTrace, setExecutionTrace] =
    useState<
      Execution["routing_events"]
    >([]);

  const [executing, setExecuting] =
    useState(false);

  const [stoppingExecution, setStoppingExecution] =
    useState(false);

  const [executionNotice, setExecutionNotice] =
    useState<string | null>(null);

  // ============================================
  // EXECUTE MODAL
  // ============================================

  const [showExecuteModal, setShowExecuteModal] =
    useState(false);

  const [executeQuestion, setExecuteQuestion] =
    useState("");

  const [executeStartNodeId, setExecuteStartNodeId] =
    useState("");

  // ============================================
  // NEW GRAPH MODAL
  // ============================================

  const [showNewGraphModal, setShowNewGraphModal] =
    useState(false);

  const [graphName, setGraphName] =
    useState("");

  const [graphDescription, setGraphDescription] =
    useState("");

  const [targetOrganization, setTargetOrganization] =
    useState("");

  const [creatingGraph, setCreatingGraph] =
    useState(false);

  // ============================================
  // GRAPH MENU
  // ============================================

  const [showGraphMenu, setShowGraphMenu] =
    useState(false);

  const [deletingGraph, setDeletingGraph] =
    useState(false);

  // ============================================
  // ADD NODE MODAL
  // ============================================

  const [showAddNodeModal, setShowAddNodeModal] =
    useState(false);

  const [nodeName, setNodeName] =
    useState("");

  const [nodeTitle, setNodeTitle] =
    useState("");

  const [nodeRole, setNodeRole] =
    useState("");

  const [nodeParentId, setNodeParentId] =
    useState("");

  const [creatingNode, setCreatingNode] =
    useState(false);

  // ============================================
  // EDIT NODE MODAL
  // ============================================

  const [showEditNodeModal, setShowEditNodeModal] =
    useState(false);

  const [editingNodeId, setEditingNodeId] =
    useState<string | null>(null);

  const [updatingNode, setUpdatingNode] =
    useState(false);

  const [deletingNodeId, setDeletingNodeId] =
    useState<string | null>(null);

  // ============================================
  // MOUNT
  // ============================================

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard client-mount detector; cannot be derived during render.
    setMounted(true);
  }, []);

  // ============================================
  // LOAD GRAPHS
  // ============================================

  useEffect(() => {
    void loadGraphs();
  }, []);

  async function loadGraphs() {
    try {
      setLoading(true);
      setError(null);

      const result = await getGraphs();

      setGraphs(result);

      if (result.length === 0) {
        // No graphs remain — invalidate any
        // in-flight loadGraphData request so a
        // late response can't repopulate stale
        // nodes/relationships/protocols.
        graphDataRequestRef.current = null;

        setSelectedGraph(null);
        setNodes([]);
        setRelationships([]);
        setProtocols([]);
        setSelectedNode(null);
        setExecutions([]);
        setSelectedExecution(null);
        setExecutionTrace([]);
        return;
      }

      setSelectedGraph((current) => {
        if (!current) {
          return result[0];
        }

        const stillExists = result.find(
          (graph) =>
            graph.id === current.id,
        );

        return stillExists ?? result[0];
      });
    } catch (err) {
      console.error(
        "LOAD GRAPHS ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the Torque backend.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================
  // LOAD SELECTED GRAPH DATA
  // ============================================

  useEffect(() => {
    if (!selectedGraph) {
      return;
    }

    // Clear the previous graph's nodes/relationships/
    // protocols/executions immediately. The Graph tab
    // already hides stale data behind the `loading`
    // spinner, but the Relationships/Protocols/Executions/
    // History/Settings tabs render directly off this state
    // and don't gate on `loading` — without this they'd
    // keep showing the old graph's data (and counts) until
    // the new graph's fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the selectedGraph prop changing, not a value derivable during render; must clear before the new graph's async fetch starts.
    setNodes([]);
    setRelationships([]);
    setProtocols([]);
    setSelectedNode(null);
    setExecutions([]);
    setSelectedExecution(null);
    setExecutionTrace([]);

    void loadGraphData(
      selectedGraph.id,
    );
  }, [selectedGraph]);

  async function loadGraphData(
    graphId: string,
  ) {
    // Mark this call as the latest request for
    // this graph. If the selected graph changes
    // again before this resolves, a newer call
    // will overwrite this value and the stale
    // response below will be discarded instead
    // of clobbering the newer state.
    graphDataRequestRef.current = graphId;

    try {
      setLoading(true);
      setError(null);

      const [
        graphNodes,
        graphRelationships,
        graphProtocols,
        graphExecutions,
      ] = await Promise.all([
        getNodes(graphId),
        getRelationships(graphId),
        getProtocols(graphId),
        getExecutions(graphId),
      ]);

      if (
        graphDataRequestRef.current !==
        graphId
      ) {
        // A different graph was selected while
        // this request was in flight — ignore.
        return;
      }

      setNodes(graphNodes);
      setRelationships(
        graphRelationships,
      );
      setProtocols(graphProtocols);

      // Authoritative execution history for this graph —
      // this is what makes every past execution (not just
      // the ones run this browser session) show up in the
      // Executions and History tabs, and survive a reload.
      setExecutions(graphExecutions);

      setSelectedNode((current) => {
        if (!current) {
          return null;
        }

        return (
          graphNodes.find(
            (node) =>
              node.id === current.id,
          ) ?? null
        );
      });
    } catch (err) {
      if (
        graphDataRequestRef.current !==
        graphId
      ) {
        return;
      }

      console.error(
        "LOAD GRAPH DATA ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load graph data.",
      );
    } finally {
      if (
        graphDataRequestRef.current ===
        graphId
      ) {
        setLoading(false);
      }
    }
  }

  // ============================================
  // REFRESH RELATIONSHIPS
  // ============================================

  async function refreshRelationships() {
    if (!selectedGraph) {
      return;
    }

    try {
      const result =
        await getRelationships(
          selectedGraph.id,
        );

      setRelationships(result);
    } catch (err) {
      console.error(
        "REFRESH RELATIONSHIPS ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh relationships.",
      );
    }
  }

  // ============================================
  // REFRESH PROTOCOLS
  // ============================================

  async function refreshProtocols() {
    if (!selectedGraph) {
      return;
    }

    try {
      const result =
        await getProtocols(
          selectedGraph.id,
        );

      setProtocols(result);
    } catch (err) {
      console.error(
        "REFRESH PROTOCOLS ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh protocols.",
      );
    }
  }

  // ============================================
  // NEW GRAPH
  // ============================================

  function openNewGraphModal() {
    setGraphName("");
    setGraphDescription("");
    setTargetOrganization("");

    setError(null);
    setShowGraphMenu(false);
    setShowNewGraphModal(true);
  }

  function closeNewGraphModal() {
    if (creatingGraph) {
      return;
    }

    setShowNewGraphModal(false);
  }

  async function handleCreateGraph() {
    if (!graphName.trim()) {
      setError(
        "Graph name is required.",
      );

      return;
    }

    try {
      setCreatingGraph(true);
      setError(null);

      const newGraph =
        await createGraph({
          name: graphName.trim(),
          description:
            graphDescription.trim() ||
            null,
          target_organization:
            targetOrganization.trim() ||
            null,
        });

      setGraphs((current) => [
        ...current,
        newGraph,
      ]);

      // Invalidate any in-flight loadGraphData
      // request for the previously selected graph
      // so a late response can't repopulate stale
      // data over this brand-new empty graph.
      graphDataRequestRef.current = null;

      setSelectedGraph(newGraph);

      setNodes([]);
      setRelationships([]);
      setProtocols([]);
      setSelectedNode(null);
      setValidation(null);
      setExecutions([]);
      setSelectedExecution(null);
      setExecutionTrace([]);

      setShowNewGraphModal(false);

      setGraphName("");
      setGraphDescription("");
      setTargetOrganization("");

      setActiveView("Graph");
    } catch (err) {
      console.error(
        "CREATE GRAPH ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create the graph.",
      );
    } finally {
      setCreatingGraph(false);
    }
  }

  // ============================================
  // ADD NODE
  // ============================================

  function openAddNodeModal(
    parentId?: string,
  ) {
    if (!selectedGraph) {
      setError(
        "Create or select a graph first.",
      );

      return;
    }

    setNodeName("");
    setNodeTitle("");
    setNodeRole("");
    setNodeParentId(
      parentId ?? "",
    );

    setError(null);
    setShowAddNodeModal(true);
  }

  function closeAddNodeModal() {
    if (creatingNode) {
      return;
    }

    setShowAddNodeModal(false);
  }

  async function handleCreateNode() {
    if (!selectedGraph) {
      setError(
        "Create or select a graph first.",
      );

      return;
    }

    if (!nodeName.trim()) {
      setError(
        "Node name is required.",
      );

      return;
    }

    try {
      setCreatingNode(true);
      setError(null);

      const parentId =
        nodeParentId || null;

      const newNode =
        await createNode(
          selectedGraph.id,
          {
            name: nodeName.trim(),
            title:
              nodeTitle.trim() || null,
            role:
              nodeRole.trim() || null,
            parent_id: parentId,
          },
        );

      setNodes((current) => [
        ...current,
        newNode,
      ]);

      /*
       * A parent selection sets hierarchy
       * (Node.parent_id) above — hierarchy and
       * communication remain separate sources
       * of truth. But the org chart is only
       * useful once agents can actually talk to
       * each other, so a normal, ordinary
       * communication Relationship (BIDIRECTIONAL,
       * type "Communication") is also created
       * between parent and child here — through
       * the exact same createRelationship() call
       * a manual drag-to-connect uses, so it's
       * indistinguishable from one afterwards:
       * same UUID, same edit/delete workflow,
       * same rendering. Guarded against a
       * duplicate in case one already exists for
       * this pair.
       */

      if (parentId) {
        const alreadyExists =
          findDuplicateRelationship(
            relationships,
            parentId,
            newNode.id,
          );

        if (!alreadyExists) {
          try {
            const parentCommunicationRelationship =
              await createRelationship(
                selectedGraph.id,
                {
                  source_node_id:
                    parentId,

                  target_node_id:
                    newNode.id,

                  relationship_type:
                    "Communication",

                  direction:
                    "BIDIRECTIONAL",

                  context: null,
                  reliance: null,
                },
              );

            setRelationships(
              (current) => [
                ...current,
                parentCommunicationRelationship,
              ],
            );
          } catch (relationshipErr) {
            // Node creation already
            // succeeded — don't fail the
            // whole operation over the
            // best-effort communication
            // link, just surface it.
            console.error(
              "AUTO-CREATE PARENT RELATIONSHIP ERROR:",
              relationshipErr,
            );

            setError(
              "Node created, but the automatic communication link to its parent could not be created.",
            );
          }
        }
      }

      setShowAddNodeModal(false);

      setNodeName("");
      setNodeTitle("");
      setNodeRole("");
      setNodeParentId("");

      setActiveView("Graph");
    } catch (err) {
      console.error(
        "CREATE NODE ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create the node.",
      );
    } finally {
      setCreatingNode(false);
    }
  }

  // ============================================
  // EDIT NODE
  // ============================================

  function openEditNodeModal(node: Node) {
    setEditingNodeId(node.id);

    setNodeName(node.name);
    setNodeTitle(node.title ?? "");
    setNodeRole(node.role ?? "");
    setNodeParentId(node.parent_id ?? "");

    setError(null);
    setShowEditNodeModal(true);
  }

  function closeEditNodeModal() {
    if (updatingNode) {
      return;
    }

    setShowEditNodeModal(false);
    setEditingNodeId(null);
  }

  async function handleUpdateNode() {
    if (!editingNodeId) {
      return;
    }

    if (!nodeName.trim()) {
      setError("Node name is required.");
      return;
    }

    try {
      setUpdatingNode(true);
      setError(null);

      const updated = await updateNode(
        editingNodeId,
        {
          name: nodeName.trim(),
          title: nodeTitle.trim() || null,
          role: nodeRole.trim() || null,
          parent_id: nodeParentId || null,
        },
      );

      setNodes((current) =>
        current.map((node) =>
          node.id === updated.id ? updated : node,
        ),
      );

      setSelectedNode((current) =>
        current?.id === updated.id
          ? updated
          : current,
      );

      /*
       * Assigning/changing a parent here must create the
       * same backing Communication relationship that
       * handleCreateNode creates when a parent is picked
       * at creation time — otherwise the hierarchy line
       * this draws is purely visual (derived straight from
       * parent_id, see GraphCanvas's hierarchyEdges) with
       * no Relationship record behind it. Clicking such an
       * edge selects the child node instead of opening the
       * relationship editor, and it can't be redirected or
       * have its type/direction/context edited — exactly
       * the "connection is static, I can't change its
       * details" symptom this fixes.
       */

      if (updated.parent_id && selectedGraph) {
        const alreadyExists =
          findDuplicateRelationship(
            relationships,
            updated.parent_id,
            updated.id,
          );

        if (!alreadyExists) {
          try {
            const parentCommunicationRelationship =
              await createRelationship(
                selectedGraph.id,
                {
                  source_node_id:
                    updated.parent_id,

                  target_node_id:
                    updated.id,

                  relationship_type:
                    "Communication",

                  direction:
                    "BIDIRECTIONAL",

                  context: null,
                  reliance: null,
                },
              );

            setRelationships(
              (current) => [
                ...current,
                parentCommunicationRelationship,
              ],
            );
          } catch (relationshipErr) {
            console.error(
              "AUTO-CREATE PARENT RELATIONSHIP ERROR:",
              relationshipErr,
            );

            setError(
              "Node updated, but the automatic communication link to its parent could not be created.",
            );
          }
        }
      }

      setShowEditNodeModal(false);
      setEditingNodeId(null);
    } catch (err) {
      console.error("UPDATE NODE ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the node.",
      );
    } finally {
      setUpdatingNode(false);
    }
  }

  // ============================================
  // DELETE NODE
  // ============================================

  async function handleDeleteNode(nodeId: string) {
    if (!selectedGraph) {
      return;
    }

    const node = nodes.find((item) => item.id === nodeId);

    const confirmed = window.confirm(
      `Delete "${node?.name ?? "this node"}"?\n\nThis will permanently delete this organizational position and any relationships connected to it.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingNodeId(nodeId);
      setError(null);

      await deleteNode(nodeId);

      setSelectedNode((current) =>
        current?.id === nodeId ? null : current,
      );

      // Node deletion cascades to relationships on
      // the backend, so refresh both from the graph
      // so the UI reflects the authoritative state.
      await loadGraphData(selectedGraph.id);
    } catch (err) {
      console.error("DELETE NODE ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete the node.",
      );
    } finally {
      setDeletingNodeId(null);
    }
  }

  // ============================================
  // PROTOCOLS
  // ============================================

  async function handleDeleteProtocol(
    protocolId: string,
  ) {
    try {
      setError(null);

      // Remove immediately from UI.
      setProtocols((current) =>
        current.filter(
          (protocol) => protocol.id !== protocolId,
        ),
      );

      await deleteProtocol(protocolId);
    } catch (err) {
      console.error("DELETE PROTOCOL ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete the protocol.",
      );

      // Restore authoritative backend state.
      await refreshProtocols();
    }
  }

  // ============================================
  // VALIDATE
  // ============================================

  async function handleValidate() {
    if (!selectedGraph) {
      setError(
        "Create or select a graph first.",
      );

      return;
    }

    try {
      setError(null);

      const result =
        await validateGraph(
          selectedGraph.id,
        );

      setValidation(result);
    } catch (err) {
      console.error(
        "VALIDATE ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to validate the graph.",
      );
    }
  }

  // ============================================
  // EXECUTE
  // ============================================

  function openExecuteModal() {
    if (!selectedGraph) {
      setError(
        "Create or select a graph first.",
      );

      return;
    }

    if (nodes.length === 0) {
      setError(
        "Add at least one node before executing.",
      );

      return;
    }

    if (executing) {
      return;
    }

    setExecuteQuestion(
      "How should the target organization price its next product?",
    );

    setExecuteStartNodeId(
      (selectedNode ?? nodes[0]).id,
    );

    setError(null);
    setShowExecuteModal(true);
  }

  function closeExecuteModal() {
    if (executing) {
      return;
    }

    setShowExecuteModal(false);
  }

  async function handleExecute() {
    if (!selectedGraph) {
      setError(
        "Create or select a graph first.",
      );

      return;
    }

    if (nodes.length === 0) {
      setError(
        "Add at least one node before executing.",
      );

      return;
    }

    if (executing) {
      return;
    }

    if (!executeQuestion.trim()) {
      setError(
        "Enter a question for the organization to answer.",
      );

      return;
    }

    const startNode =
      nodes.find(
        (node) =>
          node.id ===
          executeStartNodeId,
      ) ??
      selectedNode ??
      nodes[0];

    try {
      setExecuting(true);
      setError(null);

      const execution =
        await executeGraph(
          selectedGraph.id,
          {
            start_node_id:
              startNode.id,

            question:
              executeQuestion.trim(),
          },
        );

      // Store the execution so it shows up
      // immediately in the Executions and
      // History views.
      setExecutions(
        (current) => [
          execution,
          ...current.filter(
            (item) =>
              item.execution_id !==
              execution.execution_id,
          ),
        ],
      );

      setSelectedExecution(execution);

      setExecutionTrace(
        execution.routing_events ?? [],
      );

      setExecutionNotice(
        `Execution ${execution.status.toLowerCase()} — open the Executions tab to inspect the trace.`,
      );

      setShowExecuteModal(false);

      // Pull the authoritative trace/state
      // from the backend once it's available.
      void refreshExecution(
        execution.execution_id,
      );
    } catch (err) {
      console.error(
        "EXECUTE GRAPH ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to execute the graph.",
      );
    } finally {
      setExecuting(false);
    }
  }
  // ============================================
  // REFRESH EXECUTION
  // ============================================

  async function refreshExecution(
    executionId: string,
  ) {
    try {
      const execution =
        await getExecution(
          executionId,
        );

      setSelectedExecution(
        execution,
      );

      setExecutions(
        (current) =>
          current.map((item) =>
            item.execution_id ===
            execution.execution_id
              ? execution
              : item,
          ),
      );

      try {
        const trace =
          await getExecutionTrace(
            execution.execution_id,
          );

        setExecutionTrace(trace);
      } catch {
        setExecutionTrace(
          execution.routing_events ??
            [],
        );
      }
    } catch (err) {
      console.error(
        "REFRESH EXECUTION ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh execution.",
      );
    }
  }

  // ============================================
  // STOP EXECUTION
  // ============================================

  async function handleStopExecution() {
    if (!selectedExecution) {
      return;
    }

    try {
      setStoppingExecution(true);
      setError(null);

      const execution =
        await stopExecution(
          selectedExecution.execution_id,
        );

      setSelectedExecution(
        execution,
      );

      setExecutions(
        (current) =>
          current.map((item) =>
            item.execution_id ===
            execution.execution_id
              ? execution
              : item,
          ),
      );
    } catch (err) {
      console.error(
        "STOP EXECUTION ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to stop execution.",
      );
    } finally {
      setStoppingExecution(false);
    }
  }

  // ============================================
  // GRAPH SELECTION
  // ============================================

  function handleGraphChange(
    graphId: string,
  ) {
    const graph =
      graphs.find(
        (item) =>
          item.id === graphId,
      );

    if (!graph) {
      return;
    }

    setSelectedGraph(graph);

    setSelectedNode(null);
    setValidation(null);
    setSelectedExecution(null);
    setExecutionTrace([]);

    setError(null);
    setShowGraphMenu(false);
  }

  // ============================================
  // DELETE GRAPH
  // ============================================

  async function handleDeleteGraph() {
    if (!selectedGraph) {
      setError("No graph selected.");
      return;
    }

    if (deletingGraph) {
      return;
    }

    const graphId =
      selectedGraph.id;

    const graphName =
      selectedGraph.name;

    console.log(
      "DELETE GRAPH CLICKED:",
      graphId,
    );

    const confirmed =
      window.confirm(
        `Delete "${graphName}"?\n\nThis will permanently delete this graph and all of its nodes, relationships, and protocols.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingGraph(true);
      setError(null);

      await deleteGraph(
        graphId,
      );

      const remainingGraphs =
        graphs.filter(
          (graph) =>
            graph.id !==
            graphId,
        );

      setGraphs(
        remainingGraphs,
      );

      setShowGraphMenu(false);

      // Invalidate any in-flight loadGraphData
      // request for the deleted graph so a late
      // response can't repopulate stale data.
      graphDataRequestRef.current = null;

      setNodes([]);
      setRelationships([]);
      setProtocols([]);
      setSelectedNode(null);
      setValidation(null);
      setExecutions([]);
      setSelectedExecution(null);
      setExecutionTrace([]);

      if (
        remainingGraphs.length >
        0
      ) {
        setSelectedGraph(
          remainingGraphs[0],
        );
      } else {
        setSelectedGraph(null);
      }

      setActiveView("Graph");
    } catch (err) {
      console.error(
        "DELETE GRAPH ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete graph.",
      );
    } finally {
      setDeletingGraph(false);
    }
  }

  // ============================================
  // REMOVE RELATIONSHIP (core, authoritative)
  //
  // The single place that mutates `relationships`
  // state and calls the backend for a delete. Both
  // entry points below (RelationshipPanel's row
  // action and the canvas edge/relationship modal)
  // funnel through this, so there is exactly one
  // source of truth for the deletion — no separate
  // optimistic edit anywhere else that could race
  // it and cause a deleted relationship/edge to
  // reappear.
  // ============================================

  async function removeRelationship(
    relationshipId: string,
  ) {
    if (!selectedGraph) {
      return;
    }

    setError(null);

    // Remove immediately from UI.
    setRelationships(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            relationshipId,
        ),
    );

    try {
      await deleteRelationship(
        selectedGraph.id,
        relationshipId,
      );
    } catch (err) {
      console.error(
        "DELETE RELATIONSHIP ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete relationship.",
      );

      // Restore authoritative backend state.
      await refreshRelationships();
    }
  }

  // ============================================
  // DELETE RELATIONSHIP
  //
  // RelationshipPanel's entry point — confirms
  // with the user, then delegates to the shared
  // removeRelationship() above.
  // ============================================

  async function handleDeleteRelationship(
    relationshipId: string,
  ) {
    const relationship =
      relationships.find(
        (item) =>
          item.id ===
          relationshipId,
      );

    if (!relationship) {
      return;
    }

    const sourceName =
      getNodeName(
        relationship.source_node_id,
      );

    const targetName =
      getNodeName(
        relationship.target_node_id,
      );

    const confirmed =
      window.confirm(
        `Delete relationship?\n\n${sourceName} → ${targetName}`,
      );

    if (!confirmed) {
      return;
    }

    await removeRelationship(relationshipId);
  }

  // ============================================
  // NODE NAME HELPER
  // ============================================

  function getNodeName(
    nodeId: string,
  ) {
    return (
      nodes.find(
        (node) =>
          node.id === nodeId,
      )?.name ?? "Unknown"
    );
  }

  // ============================================
  // VALID RELATIONSHIPS FOR THE CURRENT GRAPH
  //
  // A relationship can briefly reference a node
  // that no longer exists in `nodes` (e.g. the
  // backend cascade for a node/graph delete
  // hasn't been reflected yet). Never render or
  // count those — only relationships whose
  // source and target both exist in the
  // currently loaded node list are "real". Also
  // collapse any duplicate ids to one entry so a
  // repeated id can never render (or count) as
  // more than one relationship/edge.
  // ============================================

  const visibleRelationships = useMemo(() => {
    const nodeIds = new Set(
      nodes.map((node) => node.id),
    );

    const seenIds = new Set<string>();
    const result: typeof relationships = [];

    for (const relationship of relationships) {
      if (seenIds.has(relationship.id)) {
        continue;
      }

      if (
        !nodeIds.has(
          relationship.source_node_id,
        ) ||
        !nodeIds.has(
          relationship.target_node_id,
        )
      ) {
        continue;
      }

      seenIds.add(relationship.id);
      result.push(relationship);
    }

    return result;
  }, [relationships, nodes]);

  // ============================================
  // EXECUTION SUMMARY
  // ============================================

  const completedExecutions =
    useMemo(
      () =>
        executions.filter(
          (execution) =>
            execution.status ===
            "COMPLETED",
        ).length,
      [executions],
    );

  // ============================================
  // VIEW TITLE
  // ============================================

  const viewTitle = useMemo(() => {
    switch (activeView) {
      case "Executions":
        return "Executions";

      case "Relationships":
        return "Communication Relationships";

      case "Protocols":
        return "Protocols";

      case "History":
        return "Execution History";

      case "Settings":
        return "Settings";

      default:
        return (
          selectedGraph?.name ??
          "Organization Graph"
        );
    }
  }, [activeView, selectedGraph]);

  // ============================================
  // DOCUMENT TITLE
  // ============================================

  useEffect(() => {
    document.title = `${viewTitle} — Torque Communications`;
  }, [viewTitle]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <main className="app-shell">
      <Sidebar
        activeView={activeView}
        onViewChange={(view) => {
          console.log(
            "VIEW CHANGED:",
            view,
          );

          setActiveView(view);
          setError(null);
          setShowGraphMenu(false);
        }}
        onNewGraph={
          openNewGraphModal
        }
        collapsed={sidebarCollapsed}
        onToggleCollapse={() =>
          setSidebarCollapsed(
            (current) => !current,
          )
        }
      />

      <section className="main-area">
        {/* ======================================
            TOPBAR
        ====================================== */}

        <Topbar
          graphName={
            selectedGraph?.name ??
            "No graph selected"
          }
          graphs={graphs}
          selectedGraphId={
            selectedGraph?.id ?? null
          }
          onSelectGraph={
            handleGraphChange
          }
          hasSelectedGraph={
            !!selectedGraph
          }
          showGraphMenu={
            showGraphMenu
          }
          onToggleGraphMenu={() =>
            setShowGraphMenu(
              (current) => !current,
            )
          }
          onCloseGraphMenu={() =>
            setShowGraphMenu(false)
          }
          onDeleteGraph={
            handleDeleteGraph
          }
          deletingGraph={
            deletingGraph
          }
          onOpenGraphSettings={() => {
            setShowGraphMenu(false);
            setActiveView("Settings");
          }}
          onValidate={
            handleValidate
          }
          validation={validation}
          validateDisabled={
            !mounted || !selectedGraph
          }
          onAddNode={() =>
            openAddNodeModal()
          }
          addNodeDisabled={
            !mounted || !selectedGraph
          }
          onExecute={openExecuteModal}
          executing={executing}
        />

        <div className="workspace">
          {executionNotice && (
            <div className="error-banner" style={{ borderColor: "#1f3d2b", background: "rgba(34,197,94,0.08)" }}>
              <CheckCircle2 size={16} />

              <span>{executionNotice}</span>

              <button
                type="button"
                className="error-close"
                onClick={() =>
                  setExecutionNotice(null)
                }
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* ======================================
              GRAPH VIEW

              Rendered unconditionally (never
              conditionally mounted on activeView)
              and hidden with `display: none` when
              another sidebar view is active instead.
              GraphCanvas owns the authoritative node
              positions in its own React state; if
              this block were unmounted on every view
              switch (as it previously was), that
              state — and every manually-placed
              position with it — would be destroyed
              and silently rebuilt from a fresh
              hierarchy layout on return. Hiding
              instead of unmounting means there is
              nothing to lose and therefore nothing
              to recompute.
          ====================================== */}

          <div
            className="graph-view-root"
            style={{
              display:
                activeView === "Graph"
                  ? "contents"
                  : "none",
            }}
          >

              {error && (
                <div className="error-banner">
                  <AlertCircle
                    size={16}
                  />

                  <span>
                    {error}
                  </span>

                  <button
                    type="button"
                    className="error-close"
                    onClick={() =>
                      setError(
                        null,
                      )
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="graph-area">
                {loading ? (
                  <div className="graph-loading">
                    <div className="loading-spinner" />

                    <span>
                      Loading organization graph...
                    </span>
                  </div>
                ) : selectedGraph ? (
                  <GraphCanvas
                    graphId={
                      selectedGraph.id
                    }
                    nodes={nodes}
                    relationships={
                      visibleRelationships
                    }
                    onNodeSelect={
                      setSelectedNode
                    }
                    onRelationshipCreated={
                      refreshRelationships
                    }
                    onRelationshipUpdated={
                      refreshRelationships
                    }
                    onDeleteRelationship={
                      removeRelationship
                    }
                    editRelationshipId={
                      pendingEditRelationshipId
                    }
                    onEditRelationshipConsumed={() =>
                      setPendingEditRelationshipId(
                        null,
                      )
                    }
                    onAddChildNode={(
                      parentNode,
                    ) =>
                      openAddNodeModal(
                        parentNode.id,
                      )
                    }
                  />
                ) : (
                  <div className="graph-empty">
                    <div className="empty-icon">
                      <Plus
                        size={22}
                      />
                    </div>

                    <h2>
                      No graphs found
                    </h2>

                    <p>
                      Create your first
                      organization graph.
                    </p>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={
                        openNewGraphModal
                      }
                    >
                      <Plus
                        size={15}
                      />

                      New Graph
                    </button>
                  </div>
                )}

                <div className="canvas-info">
                  <span>
                    {nodes.length}{" "}
                    nodes
                  </span>

                  <span>
                    •
                  </span>

                  <span>
                    {
                      visibleRelationships.length
                    }{" "}
                    relationships
                  </span>
                </div>
              </div>

              {selectedNode && (
                <div className="node-inspector">
                  <div className="inspector-header">
                    <div>
                      <div className="inspector-label">
                        SELECTED NODE
                      </div>

                      <h2>
                        {
                          selectedNode.name
                        }
                      </h2>
                    </div>

                    <button
                      type="button"
                      className="inspector-close"
                      onClick={() =>
                        setSelectedNode(
                          null,
                        )
                      }
                    >
                      ×
                    </button>
                  </div>

                  {selectedNode.title && (
                    <div className="inspector-field">
                      <span>
                        Title
                      </span>

                      <strong>
                        {
                          selectedNode.title
                        }
                      </strong>
                    </div>
                  )}

                  {selectedNode.role && (
                    <div className="inspector-field">
                      <span>
                        Role
                      </span>

                      <strong>
                        {
                          selectedNode.role
                        }
                      </strong>
                    </div>
                  )}

                  {selectedNode.parent_id && (
                    <div className="inspector-field">
                      <span>
                        Parent Position
                      </span>

                      <strong>
                        {getNodeName(
                          selectedNode.parent_id,
                        )}
                      </strong>
                    </div>
                  )}

                  {selectedNode.responsibilities
                    ?.length ? (
                    <div className="inspector-field">
                      <span>
                        Responsibilities
                      </span>

                      <div className="inspector-list">
                        {selectedNode.responsibilities.map(
                          (
                            item,
                            index,
                          ) => (
                            <div
                              key={
                                index
                              }
                            >
                              •{" "}
                              {
                                item
                              }
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ) : null}

                  {selectedNode.decision_rights
                    ?.length ? (
                    <div className="inspector-field">
                      <span>
                        Decision Rights
                      </span>

                      <div className="inspector-list">
                        {selectedNode.decision_rights.map(
                          (
                            item,
                            index,
                          ) => (
                            <div
                              key={
                                index
                              }
                            >
                              •{" "}
                              {
                                item
                              }
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="inspector-field">
                    <span>
                      Node ID
                    </span>

                    <code>
                      {
                        selectedNode.id
                      }
                    </code>
                  </div>

                  <div className="mt-4 flex gap-2 border-t border-[#242424] pt-4">
                    <button
                      type="button"
                      className="secondary-button flex-1 justify-center"
                      onClick={() =>
                        openEditNodeModal(
                          selectedNode,
                        )
                      }
                    >
                      Edit Node
                    </button>

                    <button
                      type="button"
                      className="h-9 flex-1 rounded-md border border-red-900/60 bg-red-950/20 px-4 text-[10px] font-medium text-red-400 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() =>
                        handleDeleteNode(
                          selectedNode.id,
                        )
                      }
                      disabled={
                        deletingNodeId ===
                        selectedNode.id
                      }
                    >
                      {deletingNodeId ===
                      selectedNode.id
                        ? "Deleting..."
                        : "Delete Node"}
                    </button>
                  </div>
                </div>
              )}
          </div>

          {/* ======================================
              RELATIONSHIPS VIEW
          ====================================== */}

          {activeView ===
            "Relationships" && (
            <div className="flex h-full min-h-0 flex-col">
              {error && (
                <div className="error-banner">
                  <AlertCircle
                    size={16}
                  />

                  <span>
                    {error}
                  </span>

                  <button
                    type="button"
                    className="error-close"
                    onClick={() =>
                      setError(
                        null,
                      )
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {selectedGraph ? (
                <RelationshipPanel
                  relationships={
                    visibleRelationships
                  }
                  nodes={nodes}
                  onDeleteRelationship={
                    handleDeleteRelationship
                  }
                  onEditRelationship={(
                    relationship,
                  ) => {
                    setPendingEditRelationshipId(
                      relationship.id,
                    );

                    setActiveView("Graph");
                  }}
                />
              ) : (
                <EmptyView
                  icon={
                    <GitBranch
                      size={22}
                    />
                  }
                  title="No graph selected"
                  description="Create or select a graph to manage communication relationships."
                />
              )}
            </div>
          )}

          {/* ======================================
              PROTOCOLS VIEW
          ====================================== */}

          {activeView ===
            "Protocols" && (
            <div className="flex h-full min-h-0 flex-col">
              {error && (
                <div className="error-banner">
                  <AlertCircle size={16} />

                  <span>{error}</span>

                  <button
                    type="button"
                    className="error-close"
                    onClick={() => setError(null)}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {selectedGraph ? (
                <ProtocolPanel
                  protocols={protocols}
                  relationships={
                    visibleRelationships
                  }
                  nodes={nodes}
                  onDeleteProtocol={
                    handleDeleteProtocol
                  }
                  onJumpToRelationship={(
                    relationshipId,
                  ) => {
                    setPendingEditRelationshipId(
                      relationshipId,
                    );

                    setActiveView("Graph");
                  }}
                />
              ) : (
                <EmptyView
                  icon={<ShieldCheck size={22} />}
                  title="No graph selected"
                  description="Create or select a graph to manage communication protocols."
                />
              )}
            </div>
          )}

          {/* ======================================
              EXECUTIONS VIEW
          ====================================== */}

          {activeView ===
            "Executions" && (
            <div className="flex h-full min-h-0 flex-col">
              <ViewHeader
                eyebrow="EXECUTIONS"
                title="Graph Executions"
                count={
                  executions.length
                }
                icon={
                  <Play
                    size={18}
                  />
                }
              />

              {error && (
                <div className="error-banner">
                  <AlertCircle
                    size={16}
                  />

                  <span>
                    {error}
                  </span>

                  <button
                    type="button"
                    className="error-close"
                    onClick={() =>
                      setError(
                        null,
                      )
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="flex min-h-0 flex-1">
                {/* EXECUTION LIST */}

                <div className="w-[360px] shrink-0 overflow-auto border-r border-[#242424] p-4">
                  {executions.length ===
                  0 ? (
                    <div className="flex h-full items-center justify-center text-center">
                      <div>
                        <Play
                          size={
                            24
                          }
                          className="mx-auto text-[#444]"
                        />

                        <p className="mt-3 text-[11px] text-[#555]">
                          No executions yet.
                        </p>

                        <button
                          type="button"
                          className="primary-button mt-4"
                          onClick={() => {
                            setActiveView(
                              "Graph",
                            );
                          }}
                        >
                          <Network
                            size={
                              14
                            }
                          />

                          Open Graph
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {executions.map(
                        (
                          execution,
                        ) => {
                          const active =
                            selectedExecution?.execution_id ===
                            execution.execution_id;

                          return (
                            <button
                              key={
                                execution.execution_id
                              }
                              type="button"
                              className={`w-full cursor-pointer rounded-lg border p-3 text-left transition ${
                                active
                                  ? "border-[#555] bg-[#191919]"
                                  : "border-[#292929] bg-[#111] hover:bg-[#151515]"
                              }`}
                              onClick={() => {
                                setSelectedExecution(
                                  execution,
                                );

                                setExecutionTrace(
                                  execution.routing_events ??
                                    [],
                                );

                                void refreshExecution(
                                  execution.execution_id,
                                );
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-[10px] font-medium text-[#ddd]">
                                  {
                                    execution.question
                                  }
                                </span>

                                <StatusBadge
                                  status={
                                    execution.status
                                  }
                                />
                              </div>

                              <div className="mt-2 flex items-center justify-between gap-2 text-[8px] text-[#555]">
                                <span className="truncate">
                                  {
                                    execution.execution_id
                                  }
                                </span>

                                <span className="shrink-0">
                                  {formatFinishedAt(
                                    execution,
                                  )}
                                </span>
                              </div>
                            </button>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>

                {/* EXECUTION DETAILS */}

                <div className="min-w-0 flex-1 overflow-auto p-6">
                  {!selectedExecution ? (
                    <EmptyView
                      icon={
                        <Play
                          size={22}
                        />
                      }
                      title="Select an execution"
                      description="Choose an execution from the list to inspect its state and routing trace."
                    />
                  ) : (
                    <div className="max-w-4xl">
                      <div className="flex items-start justify-between gap-6">
                        <div>
                          <div className="text-[9px] font-bold tracking-[0.12em] text-[#555]">
                            EXECUTION
                          </div>

                          <h2 className="mt-1 text-[18px] font-semibold text-[#eee]">
                            {
                              selectedExecution.question
                            }
                          </h2>

                          <div className="mt-2 text-[9px] text-[#555]">
                            {
                              selectedExecution.execution_id
                            }
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge
                            status={
                              selectedExecution.status
                            }
                          />

                          {(selectedExecution.status ===
                            "RUNNING" ||
                            selectedExecution.status ===
                              "PENDING") && (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={
                                handleStopExecution
                              }
                              disabled={
                                stoppingExecution
                              }
                            >
                              {stoppingExecution ? (
                                <Loader2
                                  size={
                                    14
                                  }
                                  className="animate-spin"
                                />
                              ) : (
                                <Square
                                  size={
                                    13
                                  }
                                />
                              )}

                              Stop
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-6 grid gap-3 sm:grid-cols-4">
                        <MetricCard
                          label="Start Node"
                          value={getNodeName(
                            selectedExecution.start_node_id,
                          )}
                        />

                        <MetricCard
                          label="Status"
                          value={
                            selectedExecution.status
                          }
                        />

                        <MetricCard
                          label="Routing Events"
                          value={String(
                            executionTrace.length,
                          )}
                        />

                        <MetricCard
                          label="Finished"
                          value={formatFinishedAt(
                            selectedExecution,
                          )}
                        />
                      </div>

                      <div className="mt-6 rounded-lg border border-[#292929]">
                        <div className="border-b border-[#292929] bg-[#151515] px-4 py-3">
                          <div className="text-[8px] font-bold tracking-[0.1em] text-[#555]">
                            ROUTING TRACE
                          </div>
                        </div>

                        <div className="divide-y divide-[#222]">
                          {executionTrace.length ===
                          0 ? (
                            <div className="p-6 text-[10px] text-[#555]">
                              No routing events recorded.
                            </div>
                          ) : (
                            executionTrace.map(
                              (
                                event,
                                index,
                              ) => (
                                <div
                                  key={`${event.relationship_id ?? "event"}-${index}`}
                                  className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-4 py-3"
                                >
                                  <div className="text-[9px] text-[#555]">
                                    {index +
                                      1}
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-2 text-[10px] text-[#ddd]">
                                      <span>
                                        {
                                          getNodeName(
                                            event.from_node,
                                          )
                                        }
                                      </span>

                                      <ArrowRight
                                        size={
                                          12
                                        }
                                        className="text-[#555]"
                                      />

                                      <span>
                                        {
                                          getNodeName(
                                            event.to_node,
                                          )
                                        }
                                      </span>
                                    </div>

                                    <div className="mt-1 text-[8px] text-[#555]">
                                      {
                                        event.reason
                                      }
                                    </div>
                                  </div>

                                  <span
                                    className={`text-[8px] font-semibold ${
                                      event.allowed
                                        ? "text-green-400"
                                        : "text-red-400"
                                    }`}
                                  >
                                    {event.allowed
                                      ? "ALLOWED"
                                      : "BLOCKED"}
                                  </span>
                                </div>
                              ),
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================
              HISTORY VIEW
          ====================================== */}

          {activeView ===
            "History" && (
            <div className="flex h-full flex-col">
              <ViewHeader
                eyebrow="HISTORY"
                title="Execution History"
                count={
                  executions.length
                }
                icon={
                  <History
                    size={18}
                  />
                }
              />

              <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard
                  label="Total Executions"
                  value={String(
                    executions.length,
                  )}
                />

                <MetricCard
                  label="Completed"
                  value={String(
                    completedExecutions,
                  )}
                />

                <MetricCard
                  label="Graph Nodes"
                  value={String(
                    nodes.length,
                  )}
                />
              </div>

              <div className="flex-1 overflow-auto px-6 pb-6">
                {executions.length ===
                0 ? (
                  <EmptyView
                    icon={
                      <History
                        size={22}
                      />
                    }
                    title="No execution history"
                    description="Run the graph to create execution history."
                  />
                ) : (
                  <div className="overflow-hidden rounded-lg border border-[#292929]">
                    <div className="grid grid-cols-[1fr_140px_120px_170px_180px] border-b border-[#292929] bg-[#151515] px-4 py-3 text-[8px] font-bold tracking-[0.1em] text-[#555]">
                      <span>
                        QUESTION
                      </span>

                      <span>
                        STATUS
                      </span>

                      <span>
                        START NODE
                      </span>

                      <span>
                        FINISHED
                      </span>

                      <span>
                        EXECUTION ID
                      </span>
                    </div>

                    {executions.map(
                      (
                        execution,
                      ) => (
                        <button
                          key={
                            execution.execution_id
                          }
                          type="button"
                          className="grid w-full cursor-pointer grid-cols-[1fr_140px_120px_170px_180px] items-center border-b border-[#222] px-4 py-3 text-left last:border-b-0 hover:bg-[#141414]"
                          onClick={() => {
                            setSelectedExecution(
                              execution,
                            );

                            setExecutionTrace(
                              execution.routing_events ??
                                [],
                            );

                            setActiveView(
                              "Executions",
                            );

                            void refreshExecution(
                              execution.execution_id,
                            );
                          }}
                        >
                          <span className="truncate pr-4 text-[10px] text-[#ddd]">
                            {
                              execution.question
                            }
                          </span>

                          <span>
                            <StatusBadge
                              status={
                                execution.status
                              }
                            />
                          </span>

                          <span className="truncate text-[9px] text-[#777]">
                            {getNodeName(
                              execution.start_node_id,
                            )}
                          </span>

                          <span className="truncate text-[9px] text-[#777]">
                            {formatFinishedAt(
                              execution,
                            )}
                          </span>

                          <span className="truncate text-[8px] text-[#555]">
                            {
                              execution.execution_id
                            }
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================
              SETTINGS
          ====================================== */}

          {activeView ===
            "Settings" && (
            <div className="flex h-full flex-col">
              <ViewHeader
                eyebrow="SETTINGS"
                title="Workspace Settings"
                icon={
                  <Network
                    size={18}
                  />
                }
              />

              <div className="max-w-2xl p-6">
                <div className="rounded-lg border border-[#292929] bg-[#111] p-5">
                  <div className="text-[9px] font-bold tracking-[0.1em] text-[#555]">
                    BACKEND
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-400" />

                    <span className="text-[11px] text-[#ddd]">
                      Backend connected
                    </span>
                  </div>

                  <div className="mt-2 text-[9px] text-[#555]">
                    http://127.0.0.1:8000
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-[#292929] bg-[#111] p-5">
                  <div className="text-[9px] font-bold tracking-[0.1em] text-[#555]">
                    CURRENT GRAPH
                  </div>

                  <div className="mt-2 text-[12px] text-[#ddd]">
                    {selectedGraph?.name ??
                      "No graph selected"}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <MetricCard
                      label="Nodes"
                      value={String(
                        nodes.length,
                      )}
                    />

                    <MetricCard
                      label="Relationships"
                      value={String(
                        visibleRelationships.length,
                      )}
                    />

                    <MetricCard
                      label="Protocols"
                      value={String(
                        protocols.length,
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================
              MODALS
          ====================================== */}

          {showNewGraphModal && (
            <div
              className="modal-backdrop"
              onMouseDown={
                closeNewGraphModal
              }
            >
              <div
                className="modal"
                onMouseDown={(
                  event,
                ) =>
                  event.stopPropagation()
                }
              >
                <div className="modal-header">
                  <div>
                    <div className="modal-label">
                      WORKSPACE
                    </div>

                    <h2>
                      Create New Graph
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="modal-close"
                    onClick={
                      closeNewGraphModal
                    }
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="modal-body">
                  <label>
                    Graph Name

                    <input
                      value={
                        graphName
                      }
                      onChange={(
                        event,
                      ) =>
                        setGraphName(
                          event.target
                            .value,
                        )
                      }
                      placeholder="e.g. Apple Organization"
                      autoFocus
                    />
                  </label>

                  <label>
                    Target Organization

                    <input
                      value={
                        targetOrganization
                      }
                      onChange={(
                        event,
                      ) =>
                        setTargetOrganization(
                          event.target
                            .value,
                        )
                      }
                      placeholder="e.g. Apple"
                    />
                  </label>

                  <label>
                    Description

                    <textarea
                      value={
                        graphDescription
                      }
                      onChange={(
                        event,
                      ) =>
                        setGraphDescription(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Describe this organization graph..."
                      rows={3}
                    />
                  </label>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      closeNewGraphModal
                    }
                    disabled={
                      creatingGraph
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={
                      handleCreateGraph
                    }
                    disabled={
                      creatingGraph ||
                      !graphName.trim()
                    }
                  >
                    {creatingGraph
                      ? "Creating..."
                      : "Create Graph"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showAddNodeModal && (
            <div
              className="modal-backdrop"
              onMouseDown={
                closeAddNodeModal
              }
            >
              <div
                className="modal"
                onMouseDown={(
                  event,
                ) =>
                  event.stopPropagation()
                }
              >
                <div className="modal-header">
                  <div>
                    <div className="modal-label">
                      ORGANIZATION
                    </div>

                    <h2>
                      Add Node
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="modal-close"
                    onClick={
                      closeAddNodeModal
                    }
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="modal-body">
                  <label>
                    Name

                    <input
                      value={
                        nodeName
                      }
                      onChange={(
                        event,
                      ) =>
                        setNodeName(
                          event.target
                            .value,
                        )
                      }
                      placeholder="e.g. Chief Technology Officer"
                      autoFocus
                    />
                  </label>

                  <label>
                    Title

                    <input
                      value={
                        nodeTitle
                      }
                      onChange={(
                        event,
                      ) =>
                        setNodeTitle(
                          event.target
                            .value,
                        )
                      }
                      placeholder="e.g. CTO"
                    />
                  </label>

                  <label>
                    Role

                    <input
                      value={
                        nodeRole
                      }
                      onChange={(
                        event,
                      ) =>
                        setNodeRole(
                          event.target
                            .value,
                        )
                      }
                      placeholder="e.g. Technology"
                    />
                  </label>

                  <label>
                    Parent Position

                    <select
                      value={
                        nodeParentId
                      }
                      onChange={(
                        event,
                      ) =>
                        setNodeParentId(
                          event.target
                            .value,
                        )
                      }
                    >
                      <option value="">
                        No parent
                      </option>

                      {nodes.map(
                        (
                          node,
                        ) => (
                          <option
                            key={
                              node.id
                            }
                            value={
                              node.id
                            }
                          >
                            {
                              node.name
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      closeAddNodeModal
                    }
                    disabled={
                      creatingNode
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={
                      handleCreateNode
                    }
                    disabled={
                      creatingNode ||
                      !nodeName.trim()
                    }
                  >
                    {creatingNode
                      ? "Creating..."
                      : "Create Node"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showEditNodeModal && (
            <div
              className="modal-backdrop"
              onMouseDown={closeEditNodeModal}
            >
              <div
                className="modal"
                onMouseDown={(event) =>
                  event.stopPropagation()
                }
              >
                <div className="modal-header">
                  <div>
                    <div className="modal-label">
                      ORGANIZATION
                    </div>

                    <h2>Edit Node</h2>
                  </div>

                  <button
                    type="button"
                    className="modal-close"
                    onClick={closeEditNodeModal}
                    disabled={updatingNode}
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="modal-body">
                  <label>
                    Name

                    <input
                      value={nodeName}
                      onChange={(event) =>
                        setNodeName(
                          event.target.value,
                        )
                      }
                      placeholder="e.g. Chief Technology Officer"
                      autoFocus
                    />
                  </label>

                  <label>
                    Title

                    <input
                      value={nodeTitle}
                      onChange={(event) =>
                        setNodeTitle(
                          event.target.value,
                        )
                      }
                      placeholder="e.g. CTO"
                    />
                  </label>

                  <label>
                    Role

                    <input
                      value={nodeRole}
                      onChange={(event) =>
                        setNodeRole(
                          event.target.value,
                        )
                      }
                      placeholder="e.g. Technology"
                    />
                  </label>

                  <label>
                    Parent Position

                    <select
                      value={nodeParentId}
                      onChange={(event) =>
                        setNodeParentId(
                          event.target.value,
                        )
                      }
                    >
                      <option value="">
                        No parent
                      </option>

                      {nodes
                        .filter(
                          (node) =>
                            node.id !==
                            editingNodeId,
                        )
                        .map((node) => (
                          <option
                            key={node.id}
                            value={node.id}
                          >
                            {node.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  {error && (
                    <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-[10px] text-red-400">
                      {error}
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeEditNodeModal}
                    disabled={updatingNode}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleUpdateNode}
                    disabled={
                      updatingNode ||
                      !nodeName.trim()
                    }
                  >
                    {updatingNode
                      ? "Saving..."
                      : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showExecuteModal && (
            <div
              className="modal-backdrop"
              onMouseDown={
                closeExecuteModal
              }
            >
              <div
                className="modal"
                onMouseDown={(event) =>
                  event.stopPropagation()
                }
              >
                <div className="modal-header">
                  <div>
                    <div className="modal-label">
                      EXECUTION
                    </div>

                    <h2>
                      Execute Graph
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="modal-close"
                    onClick={
                      closeExecuteModal
                    }
                    disabled={executing}
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="modal-body">
                  <label>
                    Start Node

                    <select
                      value={
                        executeStartNodeId
                      }
                      onChange={(event) =>
                        setExecuteStartNodeId(
                          event.target
                            .value,
                        )
                      }
                    >
                      {nodes.map(
                        (node) => (
                          <option
                            key={node.id}
                            value={
                              node.id
                            }
                          >
                            {node.name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label>
                    Question

                    <textarea
                      value={
                        executeQuestion
                      }
                      onChange={(event) =>
                        setExecuteQuestion(
                          event.target
                            .value,
                        )
                      }
                      placeholder="What question should the organization answer?"
                      rows={3}
                      autoFocus
                    />
                  </label>

                  {error && (
                    <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-[10px] text-red-400">
                      {error}
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      closeExecuteModal
                    }
                    disabled={executing}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleExecute}
                    disabled={
                      executing ||
                      !executeQuestion.trim() ||
                      !executeStartNodeId
                    }
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

                    {executing
                      ? "Executing..."
                      : "Execute"}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </section>
    </main>
  );
}

// ============================================
// SMALL UI COMPONENTS
// ============================================

function ViewHeader({
  eyebrow,
  title,
  count,
  icon,
}: {
  eyebrow: string;
  title: string;
  count?: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="border-b border-[#242424] px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#292929] bg-[#151515] text-[#777]">
              {icon}
            </div>
          )}

          <div>
            <div className="text-[9px] font-bold tracking-[0.12em] text-[#555]">
              {eyebrow}
            </div>

            <h2 className="mt-1 text-[16px] font-semibold text-[#eee]">
              {title}
            </h2>
          </div>
        </div>

        {typeof count ===
          "number" && (
          <span className="rounded-md border border-[#292929] bg-[#151515] px-2 py-1 text-[9px] text-[#666]">
            {count}
          </span>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   FINISHED-AT TIMESTAMP

   `completed_at` is null while an execution is still
   PENDING/RUNNING (and, today, also for a STOPPED
   execution — the stop endpoint doesn't set it) — those
   cases fall back to a plain status word instead of a
   timestamp rather than showing a misleading blank.
========================================================= */

function formatFinishedAt(
  execution: Execution,
): string {
  if (execution.completed_at) {
    return new Date(
      execution.completed_at,
    ).toLocaleString();
  }

  return execution.status ===
    "RUNNING" ||
    execution.status === "PENDING"
    ? "In progress…"
    : "—";
}

function EmptyView({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[#292929] bg-[#151515] text-[#555]">
          {icon}
        </div>

        <h3 className="mt-4 text-[12px] font-semibold text-[#ccc]">
          {title}
        </h3>

        <p className="mt-1 text-[9px] leading-5 text-[#555]">
          {description}
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#292929] bg-[#111] p-4">
      <div className="text-[8px] font-bold tracking-[0.1em] text-[#555]">
        {label}
      </div>

      <div className="mt-2 truncate text-[13px] font-semibold text-[#ddd]">
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    status.toUpperCase();

  const isSuccess =
    normalized === "COMPLETED";

  const isFailure =
    normalized === "FAILED";

  const isRunning =
    normalized === "RUNNING";

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-1 text-[8px] font-semibold ${
        isSuccess
          ? "border-green-900/50 bg-green-950/20 text-green-400"
          : isFailure
            ? "border-red-900/50 bg-red-950/20 text-red-400"
            : isRunning
              ? "border-blue-900/50 bg-blue-950/20 text-blue-400"
              : "border-[#333] bg-[#171717] text-[#777]"
      }`}
    >
      {status}
    </span>
  );
}

