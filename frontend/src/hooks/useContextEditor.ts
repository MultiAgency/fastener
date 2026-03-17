import { useState, useCallback } from "react";
import type { Mutation } from "../lib/types";

export function useContextEditor(
  callCommit: (mutations: Mutation[], traceContext?: Record<string, unknown>) => Promise<void>,
  activeNamespace: string,
) {
  const [pendingMutations, setPendingMutations] = useState<Mutation[]>([]);
  const [isSending, setIsSending] = useState(false);

  const addNode = useCallback(
    (nodeId: string, nodeType: string, data: Record<string, unknown>) => {
      const mutation: Mutation = {
        op: "create_node",
        namespace: activeNamespace,
        node_id: nodeId,
        data: { ...data, node_type: nodeType },
      };
      setPendingMutations((prev) => [...prev, mutation]);
    },
    [activeNamespace]
  );

  const addEdge = useCallback(
    (source: string, target: string, label: string) => {
      const mutation: Mutation = {
        op: "create_edge",
        namespace: activeNamespace,
        edge: { source, target, label },
        data: {},
      };
      setPendingMutations((prev) => [...prev, mutation]);
    },
    [activeNamespace]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      const mutation: Mutation = {
        op: "delete_node",
        namespace: activeNamespace,
        node_id: nodeId,
        data: {},
      };
      setPendingMutations((prev) => [...prev, mutation]);
    },
    [activeNamespace]
  );

  const submit = useCallback(async () => {
    if (pendingMutations.length === 0) return;
    setIsSending(true);
    try {
      await callCommit(pendingMutations);
      setPendingMutations([]);
    } finally {
      setIsSending(false);
    }
  }, [pendingMutations, callCommit]);

  const clear = useCallback(() => {
    setPendingMutations([]);
  }, []);

  const undo = useCallback(() => {
    setPendingMutations((prev) => prev.slice(0, -1));
  }, []);

  return {
    pendingMutations,
    isSending,
    addNode,
    addEdge,
    deleteNode,
    submit,
    clear,
    undo,
    canUndo: pendingMutations.length > 0,
  };
}
