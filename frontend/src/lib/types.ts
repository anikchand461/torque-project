// ============================================
// Torque Communications - Frontend Types
// ============================================

// ---------- Common ----------

export type UUID = string;


// ---------- Graph ----------

export interface Graph {
  id: UUID;
  name: string;
  description: string | null;
  target_organization: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface GraphCreate {
  name: string;
  description?: string | null;
  target_organization?: string | null;
}

export interface GraphUpdate {
  name?: string;
  description?: string | null;
  target_organization?: string | null;
}


// ---------- Node / Position ----------

export interface Node {
  id: UUID;
  graph_id: UUID;
  name: string;
  title: string | null;
  role: string | null;

  responsibilities: string[] | null;
  decision_rights: string[] | null;

  persona_details: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;

  parent_id: UUID | null;

  created_at: string;
  updated_at: string;
}

export interface NodeCreate {
  name: string;
  title?: string | null;
  role?: string | null;

  responsibilities?: string[] | null;
  decision_rights?: string[] | null;

  persona_details?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;

  parent_id?: UUID | null;
}

export interface NodeUpdate {
  name?: string;
  title?: string | null;
  role?: string | null;

  responsibilities?: string[] | null;
  decision_rights?: string[] | null;

  persona_details?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;

  parent_id?: UUID | null;
}


// ---------- Relationship ----------

export type RelationshipDirection =
  | "FORWARD"
  | "REVERSE"
  | "BIDIRECTIONAL";

// The backend stores context/reliance as a JSON
// object column (`dict | None` in the Pydantic
// schema), not a plain string. The frontend keeps
// the free-text value under a single `text` key.
export interface RelationshipNote {
  text: string;
}

export interface Relationship {
  id: UUID;
  graph_id: UUID;

  source_node_id: UUID;
  target_node_id: UUID;

  relationship_type: string;

  direction: RelationshipDirection;

  context: RelationshipNote | null;
  reliance: RelationshipNote | null;

  // A relationship can carry zero or more protocols
  // (see relationship_protocols on the backend).
  // `protocols` carries the full attached objects so
  // the UI never needs a second round-trip just to
  // show what's already on the relationship;
  // `protocol_ids` is kept alongside for any consumer
  // that only needs the lightweight id list.
  protocol_ids: UUID[];
  protocols: Protocol[];

  created_at: string;
}

export interface RelationshipCreate {
  source_node_id: UUID;
  target_node_id: UUID;

  relationship_type: string;

  direction: RelationshipDirection;

  context?: RelationshipNote | null;
  reliance?: RelationshipNote | null;
}

export interface RelationshipUpdate {
  relationship_type?: string;

  direction?: RelationshipDirection;

  context?: RelationshipNote | null;
  reliance?: RelationshipNote | null;
}


// ---------- Protocol ----------

export interface Protocol {
  id: UUID;
  graph_id: UUID;

  name: string;
  description: string | null;

  can_send: boolean;
  can_receive: boolean;

  can_escalate: boolean;
  can_bypass: boolean;
  can_forward: boolean;

  confidentiality: string | null;

  allowed_information_types: string[] | null;

  conditions: Record<string, unknown>[] | null;

  allowed_targets: UUID[] | null;

  stop_conditions: Record<string, unknown>[] | null;

  metadata: Record<string, unknown> | null;

  // Every relationship this protocol is currently
  // attached to. A protocol created from within a
  // relationship starts with exactly one entry here,
  // but the underlying relationship_protocols
  // association allows the same protocol to be
  // attached to more than one relationship later.
  relationship_ids: UUID[];

  created_at: string;
  updated_at: string;
}

export interface ProtocolCreate {
  name: string;
  description?: string | null;

  can_send?: boolean;
  can_receive?: boolean;

  can_escalate?: boolean;
  can_bypass?: boolean;
  can_forward?: boolean;

  confidentiality?: string | null;

  allowed_information_types?: string[] | null;

  conditions?: Record<string, unknown>[] | null;

  allowed_targets?: UUID[] | null;

  stop_conditions?: Record<string, unknown>[] | null;

  metadata?: Record<string, unknown> | null;
}

export interface ProtocolUpdate {
  name?: string;
  description?: string | null;

  can_send?: boolean;
  can_receive?: boolean;

  can_escalate?: boolean;
  can_bypass?: boolean;
  can_forward?: boolean;

  confidentiality?: string | null;

  allowed_information_types?: string[] | null;

  conditions?: Record<string, unknown>[] | null;

  allowed_targets?: UUID[] | null;

  stop_conditions?: Record<string, unknown>[] | null;

  metadata?: Record<string, unknown> | null;
}


// ---------- Execution ----------

export type ExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "STOPPED";

export interface RoutingEvent {
  from_node: UUID;
  to_node: UUID;

  reason: string;

  relationship_id: UUID | null;
  protocol_id: UUID | null;

  allowed: boolean;

  timestamp: string;
}

export interface Execution {
  execution_id: UUID;
  graph_id: UUID;

  question: string;
  start_node_id: UUID;

  status: ExecutionStatus;

  active_nodes: UUID[];
  pending_nodes: UUID[];
  completed_nodes: UUID[];
  failed_nodes: UUID[];

  responses: Record<string, unknown>;

  routing_events: RoutingEvent[];

  created_at: string;
  completed_at: string | null;
}

export interface ExecuteGraphRequest {
  start_node_id: UUID;
  question: string;
}


// ---------- Validation ----------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}


// ---------- API Error ----------

export interface ApiError {
  detail: string | unknown;
}