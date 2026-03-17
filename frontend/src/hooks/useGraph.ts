import { useState, useEffect, useCallback, useRef } from "react";
import { WebSocketClient } from "../lib/ws";
import { fetchNamespace, fetchNamespaceEdges, fetchActiveNamespaces } from "../lib/api";
import type { Node, Edge, TraceEventWS } from "../lib/types";

export function useGraph(activeNamespace: string) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [traces, setTraces] = useState<TraceEventWS[]>([]);
  const activeNsRef = useRef(activeNamespace);

  // Keep ref in sync so WS handler always sees current namespace
  useEffect(() => {
    activeNsRef.current = activeNamespace;
  }, [activeNamespace]);

  // Fetch active namespaces
  useEffect(() => {
    fetchActiveNamespaces().then(setNamespaces).catch(console.error);
  }, []);

  // Fetch nodes and edges for the active namespace
  useEffect(() => {
    if (!activeNamespace) return;

    Promise.all([
      fetchNamespace(activeNamespace),
      fetchNamespaceEdges(activeNamespace),
    ])
      .then(([n, e]) => {
        setNodes(n);
        setEdges(e);
      })
      .catch(console.error);
  }, [activeNamespace]);

  // WebSocket — single connection, stable across namespace changes
  useEffect(() => {
    const ws = new WebSocketClient();
    ws.connect();

    ws.onTrace((event: TraceEventWS) => {
      setTraces((prev) => [...prev.slice(-99), event]);

      for (const mutation of event.mutations) {
        if (mutation.namespace !== activeNsRef.current) continue;

        switch (mutation.op) {
          case "create_node":
            if (mutation.node_id) {
              const nodeData = mutation.data ?? {};
              setNodes((prev) => [
                ...prev,
                {
                  id: mutation.node_id!,
                  namespace: mutation.namespace,
                  node_type: (nodeData.node_type as string) || "context",
                  data: nodeData,
                  agent_id: mutation.agent_id,
                  created_at_ms: event.block_timestamp_ms,
                  updated_at_ms: event.block_timestamp_ms,
                },
              ]);
            }
            break;
          case "update_node":
            if (mutation.node_id) {
              const updateData = mutation.data ?? {};
              setNodes((prev) =>
                prev.map((n) =>
                  n.id === mutation.node_id
                    ? { ...n, data: updateData, updated_at_ms: event.block_timestamp_ms }
                    : n
                )
              );
            }
            break;
          case "delete_node":
            if (mutation.node_id) {
              setNodes((prev) => prev.filter((n) => n.id !== mutation.node_id));
            }
            break;
          case "create_edge":
            if (mutation.edge) {
              setEdges((prev) => [
                ...prev,
                {
                  source: mutation.edge!.source,
                  target: mutation.edge!.target,
                  label: mutation.edge!.label,
                  namespace: mutation.namespace,
                  agent_id: mutation.agent_id,
                  created_at_ms: event.block_timestamp_ms,
                },
              ]);
            }
            break;
          case "delete_edge":
            if (mutation.edge) {
              const e = mutation.edge;
              setEdges((prev) =>
                prev.filter(
                  (edge) =>
                    !(edge.source === e.source && edge.target === e.target && edge.label === e.label)
                )
              );
            }
            break;
        }
      }
    });

    ws.onNamespacesActivated((event) => {
      setNamespaces((prev) => [...new Set([...prev, ...event.namespaces])]);
    });

    return () => ws.disconnect();
  }, []); // stable — no dependency on activeNamespace

  const refresh = useCallback(() => {
    if (!activeNamespace) return;
    Promise.all([
      fetchNamespace(activeNamespace),
      fetchNamespaceEdges(activeNamespace),
    ])
      .then(([n, e]) => {
        setNodes(n);
        setEdges(e);
      })
      .catch(console.error);
  }, [activeNamespace]);

  return { nodes, edges, namespaces, traces, refresh };
}
