import { API_BASE } from "./constants";
import type { Node, Edge, NamespaceMeta, AgentStat } from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText} at ${url}`);
  }
  return res.json();
}

export async function fetchNamespace(ns: string): Promise<Node[]> {
  return fetchJson(`${API_BASE}/api/namespace/${encodeURIComponent(ns)}`);
}

export async function fetchNamespaceMeta(ns: string): Promise<NamespaceMeta> {
  return fetchJson(`${API_BASE}/api/namespace/${encodeURIComponent(ns)}/meta`);
}

export async function fetchNamespaceEdges(ns: string): Promise<Edge[]> {
  return fetchJson(`${API_BASE}/api/namespace/${encodeURIComponent(ns)}/edges`);
}

export async function fetchNode(ns: string, nodeId: string): Promise<Node> {
  return fetchJson(
    `${API_BASE}/api/node/${encodeURIComponent(ns)}/${encodeURIComponent(nodeId)}`
  );
}

export async function fetchNeighbors(
  ns: string,
  nodeId: string
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  return fetchJson(
    `${API_BASE}/api/graph/${encodeURIComponent(ns)}/neighbors/${encodeURIComponent(nodeId)}`
  );
}

export async function fetchActiveNamespaces(): Promise<string[]> {
  return fetchJson(`${API_BASE}/api/namespaces/active`);
}

export async function fetchAgentStats(): Promise<AgentStat[]> {
  return fetchJson(`${API_BASE}/api/stats/agents`);
}

export async function fetchRecentTraces(sinceMs?: number): Promise<unknown[]> {
  const params = sinceMs ? `?since_ms=${sinceMs}` : "";
  return fetchJson(`${API_BASE}/api/trace/recent${params}`);
}

export async function resolveAgent(agentId: number): Promise<string | null> {
  const res = await fetch(`${API_BASE}/api/agent/${agentId}`);
  if (!res.ok) return null;
  return res.text();
}
