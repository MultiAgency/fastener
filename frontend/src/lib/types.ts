export interface Node {
  id: string;
  namespace: string;
  node_type: string;
  data: Record<string, unknown>;
  agent_id: number;
  created_at_ms: number;
  updated_at_ms: number;
}

export interface Edge {
  source: string;
  target: string;
  label: string;
  namespace: string;
  agent_id: number;
  created_at_ms: number;
  data?: Record<string, unknown>;
}

export interface MutationWS {
  op: "create_node" | "update_node" | "delete_node" | "create_edge" | "delete_edge";
  namespace: string;
  node_id?: string;
  edge?: { source: string; target: string; label: string };
  agent_id: number;
  data?: Record<string, unknown>;
}

export interface TraceEventWS {
  type: "trace";
  agent: string;
  block_timestamp_ms: number;
  mutations: MutationWS[];
  trace_context?: Record<string, unknown> | null;
}

export interface NamespacesActivatedEvent {
  type: "namespaces_activated";
  namespaces: string[];
}

export type WSEvent = TraceEventWS | NamespacesActivatedEvent;

export interface NamespaceMeta {
  namespace: string;
  node_count: number;
  last_updated: number;
}

export interface AgentStat {
  account_id: string;
  node_count: number;
}

export interface Mutation {
  op: "create_node" | "update_node" | "delete_node" | "create_edge" | "delete_edge";
  namespace: string;
  node_id?: string;
  edge?: { source: string; target: string; label: string };
  data: Record<string, unknown>;
}
