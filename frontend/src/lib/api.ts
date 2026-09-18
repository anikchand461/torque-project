import type {
  ApiError,
  ExecuteGraphRequest,
  Execution,
  Graph,
  GraphCreate,
  GraphUpdate,
  Node,
  NodeCreate,
  NodeUpdate,
  Protocol,
  ProtocolCreate,
  ProtocolUpdate,
  Relationship,
  RelationshipCreate,
  RelationshipUpdate,
  ValidationResult,
} from "./types";


// ============================================
// Configuration
// ============================================

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const API_PREFIX = "/api/v1";


// ============================================
// API Error
// ============================================

export class ApiRequestError extends Error {
  status: number;
  data: unknown;

  constructor(
    message: string,
    status: number,
    data?: unknown,
  ) {
    super(message);

    this.name = "ApiRequestError";
    this.status = status;
    this.data = data;
  }
}


// ============================================
// Generic Request Helper
// ============================================

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    },
  );

  const contentType =
    response.headers.get("content-type");

  // Read the response body only once.
  // DELETE endpoints may return an empty 204 response.
  const responseText =
    await response.text();

  let data: unknown = null;

  // Only attempt JSON parsing when a response body exists.
  if (responseText.trim().length > 0) {
    if (
      contentType?.includes(
        "application/json",
      )
    ) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = responseText;
      }
    } else {
      data = responseText;
    }
  }

  if (!response.ok) {
    const errorData =
      data as ApiError;

    throw new ApiRequestError(
      typeof errorData?.detail ===
        "string"
        ? errorData.detail
        : `API request failed with status ${response.status}`,
      response.status,
      data,
    );
  }

  return data as T;
}


// ============================================
// Health
// ============================================

export async function getHealth(): Promise<unknown> {
  return request("/health");
}


// ============================================
// Graphs
// ============================================

export async function getGraphs(): Promise<Graph[]> {
  return request<Graph[]>(
    `${API_PREFIX}/graphs`,
  );
}


export async function getGraph(
  graphId: string,
): Promise<Graph> {
  return request<Graph>(
    `${API_PREFIX}/graphs/${graphId}`,
  );
}


export async function createGraph(
  data: GraphCreate,
): Promise<Graph> {
  return request<Graph>(
    `${API_PREFIX}/graphs`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}


export async function updateGraph(
  graphId: string,
  data: GraphUpdate,
): Promise<Graph> {
  return request<Graph>(
    `${API_PREFIX}/graphs/${graphId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
}


export async function deleteGraph(
  graphId: string,
): Promise<void> {
  await request(
    `${API_PREFIX}/graphs/${graphId}`,
    {
      method: "DELETE",
    },
  );
}


// ============================================
// Nodes
// ============================================

export async function getNodes(
  graphId: string,
): Promise<Node[]> {
  return request<Node[]>(
    `${API_PREFIX}/graphs/${graphId}/nodes`,
  );
}


export async function getNode(
  nodeId: string,
): Promise<Node> {
  return request<Node>(
    `${API_PREFIX}/nodes/${nodeId}`,
  );
}


export async function createNode(
  graphId: string,
  data: NodeCreate,
): Promise<Node> {
  return request<Node>(
    `${API_PREFIX}/graphs/${graphId}/nodes`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}


export async function updateNode(
  nodeId: string,
  data: NodeUpdate,
): Promise<Node> {
  return request<Node>(
    `${API_PREFIX}/nodes/${nodeId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
}


export async function deleteNode(
  nodeId: string,
): Promise<void> {
  await request(
    `${API_PREFIX}/nodes/${nodeId}`,
    {
      method: "DELETE",
    },
  );
}


// ============================================
// Relationships
// ============================================

export async function getRelationships(
  graphId: string,
): Promise<Relationship[]> {
  return request<Relationship[]>(
    `${API_PREFIX}/graphs/${graphId}/relationships`,
  );
}


export async function createRelationship(
  graphId: string,
  data: RelationshipCreate,
): Promise<Relationship> {
  return request<Relationship>(
    `${API_PREFIX}/graphs/${graphId}/relationships`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}


export async function updateRelationship(
  graphId: string,
  relationshipId: string,
  data: RelationshipUpdate,
): Promise<Relationship> {
  return request<Relationship>(
    `${API_PREFIX}/relationships/${relationshipId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
}


export async function deleteRelationship(
  graphId: string,
  relationshipId: string,
): Promise<void> {
  await request<void>(
    `${API_PREFIX}/relationships/${relationshipId}`,
    {
      method: "DELETE",
    },
  );
}

// ============================================
// Protocols
//
// Protocols no longer stand alone at the graph
// level — every protocol is attached to at least
// one Relationship via the relationship_protocols
// association. `getProtocols` is kept for the
// read-only Protocols overview (grouped by the
// relationship each protocol belongs to); creation
// only happens through a relationship (see the
// Relationship Protocols section below), and
// editing/deleting a protocol by its own id is
// unchanged.
// ============================================

export async function getProtocols(
  graphId: string,
): Promise<Protocol[]> {
  return request<Protocol[]>(
    `${API_PREFIX}/graphs/${graphId}/protocols`,
  );
}


export async function updateProtocol(
  protocolId: string,
  data: ProtocolUpdate,
): Promise<Protocol> {
  return request<Protocol>(
    `${API_PREFIX}/protocols/${protocolId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
}


export async function deleteProtocol(
  protocolId: string,
): Promise<void> {
  await request(
    `${API_PREFIX}/protocols/${protocolId}`,
    {
      method: "DELETE",
    },
  );
}


// ============================================
// Relationship <-> Protocol association
// ============================================

export async function getRelationshipProtocols(
  relationshipId: string,
): Promise<Protocol[]> {
  return request<Protocol[]>(
    `${API_PREFIX}/relationships/${relationshipId}/protocols`,
  );
}


// Creates a brand-new protocol scoped to (and
// immediately attached to) this relationship.
export async function createRelationshipProtocol(
  relationshipId: string,
  data: ProtocolCreate,
): Promise<Protocol> {
  return request<Protocol>(
    `${API_PREFIX}/relationships/${relationshipId}/protocols`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}


// Attaches an already-existing protocol (e.g. one
// created for another relationship in this graph)
// to this relationship as well.
export async function attachProtocolToRelationship(
  relationshipId: string,
  protocolId: string,
): Promise<Protocol> {
  return request<Protocol>(
    `${API_PREFIX}/relationships/${relationshipId}/protocols/${protocolId}/attach`,
    {
      method: "POST",
    },
  );
}


// Detaches a protocol from this relationship without
// deleting the protocol itself (it may still be
// attached elsewhere). Use deleteProtocol() to
// remove a protocol entirely.
export async function detachProtocolFromRelationship(
  relationshipId: string,
  protocolId: string,
): Promise<void> {
  await request(
    `${API_PREFIX}/relationships/${relationshipId}/protocols/${protocolId}`,
    {
      method: "DELETE",
    },
  );
}


// ============================================
// Graph Validation
// ============================================

export async function validateGraph(
  graphId: string,
): Promise<ValidationResult> {
  return request<ValidationResult>(
    `${API_PREFIX}/graphs/${graphId}/validate`,
    {
      method: "POST",
    },
  );
}


// ============================================
// Execution
// ============================================

export async function executeGraph(
  graphId: string,
  data: ExecuteGraphRequest,
): Promise<Execution> {
  return request<Execution>(
    `${API_PREFIX}/graphs/${graphId}/execute`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}


export async function getExecutions(
  graphId: string,
): Promise<Execution[]> {
  return request<Execution[]>(
    `${API_PREFIX}/graphs/${graphId}/executions`,
  );
}


export async function getExecution(
  executionId: string,
): Promise<Execution> {
  return request<Execution>(
    `${API_PREFIX}/executions/${executionId}`,
  );
}


export async function getExecutionTrace(
  executionId: string,
): Promise<Execution["routing_events"]> {
  return request<Execution["routing_events"]>(
    `${API_PREFIX}/executions/${executionId}/trace`,
  );
}


export async function stopExecution(
  executionId: string,
): Promise<Execution> {
  return request<Execution>(
    `${API_PREFIX}/executions/${executionId}/stop`,
    {
      method: "POST",
    },
  );
}