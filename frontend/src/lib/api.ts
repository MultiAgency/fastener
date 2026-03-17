import { API_BASE } from "./constants";
import type { Node, Edge, NamespaceMeta, AgentStat } from "./types";

export async function fetchNamespace(ns: string): Promise<Node[]> {
  const res = await fetch(`${API_BASE}/api/namespace/${encodeURIComponent(ns)}`);
  return res.json();
}

export async function fetchNamespaceMeta(ns: string): Promise<NamespaceMeta> {
  const res = await fetch(`${API_BASE}/api/namespace/${encodeURIComponent(ns)}/meta`);
  return res.json();
}

export async function fetchNamespaceEdges(ns: string): Promise<Edge[]> {
  const res = await fetch(`${API_BASE}/api/namespace/${encodeURIComponent(ns)}/edges`);
  return res.json();
}

export async function fetchNode(ns: string, nodeId: string): Promise<Node> {
  const res = await fetch(
    `${API_BASE}/api/node/${encodeURIComponent(ns)}/${encodeURIComponent(nodeId)}`
  );
  return res.json();
}

export async function fetchNeighbors(
  ns: string,
  nodeId: string
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const res = await fetch(
    `${API_BASE}/api/graph/${encodeURIComponent(ns)}/neighbors/${encodeURIComponent(nodeId)}`
  );
  return res.json();
}

export async function fetchActiveNamespaces(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/namespaces/active`);
  return res.json();
}

export async function fetchAgentStats(): Promise<AgentStat[]> {
  const res = await fetch(`${API_BASE}/api/stats/agents`);
  return res.json();
}

export async function fetchRecentTraces(sinceMs?: number): Promise<unknown[]> {
  const params = sinceMs ? `?since_ms=${sinceMs}` : "";
  const res = await fetch(`${API_BASE}/api/trace/recent${params}`);
  return res.json();
}

export async function resolveAgent(agentId: number): Promise<string | null> {
  const res = await fetch(`${API_BASE}/api/agent/${agentId}`);
  if (!res.ok) return null;
  return res.text();
}
