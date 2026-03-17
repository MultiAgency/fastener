import { useState, useCallback } from "react";
import { useWallet } from "./hooks/useWallet";
import { useGraph } from "./hooks/useGraph";
import { useContextEditor } from "./hooks/useContextEditor";
import { ReactFlowProvider } from "@xyflow/react";
import GraphView from "./components/GraphView";
import WalletButton from "./components/WalletButton";
import NamespaceList from "./components/NamespaceList";
import NodeDetail from "./components/NodeDetail";
import ContextToolbar from "./components/ContextToolbar";
import TraceTimeline from "./components/TraceTimeline";
import { DEFAULT_NAMESPACE } from "./lib/constants";

export default function App() {
  const [activeNamespace, setActiveNamespace] = useState(DEFAULT_NAMESPACE);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { accountId, loading, signIn, signOut, callCommit } = useWallet();
  const { nodes, edges, namespaces, traces } = useGraph(activeNamespace);
  const {
    pendingMutations,
    isSending,
    addNode,
    addEdge,
    submit,
    clear,
    undo,
    canUndo,
  } = useContextEditor(callCommit, activeNamespace);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const handleSelectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  return (
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      {/* Sidebar */}
      <div
        style={{
          width: 200,
          background: "#0a0a14",
          borderRight: "1px solid #1a1a2e",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "12px",
            borderBottom: "1px solid #1a1a2e",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e0e0e0" }}>
            Fastener
          </div>
          <div style={{ fontSize: 10, color: "#3b82f6" }}>NEAR</div>
        </div>

        <NamespaceList
          namespaces={namespaces}
          activeNamespace={activeNamespace}
          onSelectNamespace={setActiveNamespace}
        />

        <div style={{ padding: "12px", borderTop: "1px solid #1a1a2e" }}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#666",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Stats
          </div>
          <div style={{ color: "#aaa", fontSize: 12 }}>
            {nodes.length} node{nodes.length !== 1 ? "s" : ""}
          </div>
          <div style={{ color: "#aaa", fontSize: 12 }}>
            {edges.length} edge{edges.length !== 1 ? "s" : ""}
          </div>
          <div style={{ color: "#aaa", fontSize: 12 }}>
            {traces.length} trace{traces.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div style={{ flex: 1 }} />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        <WalletButton
          accountId={accountId}
          loading={loading}
          onSignIn={signIn}
          onSignOut={signOut}
        />

        {/* Graph area */}
        <div style={{ flex: 1, position: "relative" }}>
          <ReactFlowProvider>
            <GraphView
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
            />
          </ReactFlowProvider>

          <ContextToolbar
            onAddNode={addNode}
            onAddEdge={addEdge}
            onSubmit={submit}
            onClear={clear}
            onUndo={undo}
            pendingCount={pendingMutations.length}
            isSending={isSending}
            canUndo={canUndo}
            accountId={accountId}
          />
        </div>

        {/* Trace timeline */}
        <div
          style={{
            height: 60,
            background: "#0a0a14",
            borderTop: "1px solid #1a1a2e",
            flexShrink: 0,
          }}
        >
          <TraceTimeline traces={traces} />
        </div>
      </div>

      {/* Node detail panel */}
      {selectedNode && (
        <NodeDetail
          node={selectedNode}
          edges={edges}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}
