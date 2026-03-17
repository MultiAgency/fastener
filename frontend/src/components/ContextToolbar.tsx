import { useState } from "react";

interface ContextToolbarProps {
  onAddNode: (nodeId: string, nodeType: string, data: Record<string, unknown>) => void;
  onAddEdge: (source: string, target: string, label: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onUndo: () => void;
  pendingCount: number;
  isSending: boolean;
  canUndo: boolean;
  accountId: string | null;
}

const NODE_TYPES = ["context", "observation", "action", "decision", "reflection", "policy"];

export default function ContextToolbar({
  onAddNode,
  onAddEdge,
  onSubmit,
  onClear,
  onUndo,
  pendingCount,
  isSending,
  canUndo,
  accountId,
}: ContextToolbarProps) {
  const [mode, setMode] = useState<"node" | "edge" | null>(null);
  const [nodeId, setNodeId] = useState("");
  const [nodeType, setNodeType] = useState("context");
  const [nodeData, setNodeData] = useState("");
  const [edgeSource, setEdgeSource] = useState("");
  const [edgeTarget, setEdgeTarget] = useState("");
  const [edgeLabel, setEdgeLabel] = useState("");

  const handleAddNode = () => {
    if (!nodeId.trim()) return;
    let data: Record<string, unknown> = {};
    try {
      data = nodeData ? JSON.parse(nodeData) : {};
    } catch {
      data = { value: nodeData };
    }
    onAddNode(nodeId.trim(), nodeType, data);
    setNodeId("");
    setNodeData("");
  };

  const handleAddEdge = () => {
    if (!edgeSource.trim() || !edgeTarget.trim() || !edgeLabel.trim()) return;
    onAddEdge(edgeSource.trim(), edgeTarget.trim(), edgeLabel.trim());
    setEdgeSource("");
    setEdgeTarget("");
    setEdgeLabel("");
  };

  const inputStyle: React.CSSProperties = {
    background: "#1a1a2e",
    border: "1px solid #2a2a4a",
    borderRadius: 4,
    padding: "4px 8px",
    color: "#e0e0e0",
    fontSize: 12,
    width: "100%",
    marginBottom: 4,
  };

  const btnStyle: React.CSSProperties = {
    background: "#1a1a2e",
    border: "1px solid #2a2a4a",
    borderRadius: 4,
    padding: "4px 10px",
    color: "#aaa",
    fontSize: 11,
    cursor: "pointer",
    marginRight: 4,
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        background: "#0f0f1a",
        border: "1px solid #1a1a2e",
        borderRadius: 10,
        padding: "10px 16px",
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      {!accountId ? (
        <div style={{ color: "#666", fontSize: 12 }}>Connect wallet to commit</div>
      ) : (
        <>
          <button
            onClick={() => setMode(mode === "node" ? null : "node")}
            style={{ ...btnStyle, color: mode === "node" ? "#3b82f6" : "#aaa" }}
          >
            + Node
          </button>
          <button
            onClick={() => setMode(mode === "edge" ? null : "edge")}
            style={{ ...btnStyle, color: mode === "edge" ? "#f59e0b" : "#aaa" }}
          >
            + Edge
          </button>

          {mode === "node" && (
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
              <input
                placeholder="Node ID"
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
                style={{ ...inputStyle, width: 100 }}
              />
              <select
                value={nodeType}
                onChange={(e) => setNodeType(e.target.value)}
                style={{ ...inputStyle, width: 90 }}
              >
                {NODE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                placeholder="Data (JSON or text)"
                value={nodeData}
                onChange={(e) => setNodeData(e.target.value)}
                style={{ ...inputStyle, width: 140 }}
              />
              <button onClick={handleAddNode} style={{ ...btnStyle, color: "#3b82f6" }}>
                Add
              </button>
            </div>
          )}

          {mode === "edge" && (
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
              <input
                placeholder="Source ID"
                value={edgeSource}
                onChange={(e) => setEdgeSource(e.target.value)}
                style={{ ...inputStyle, width: 90 }}
              />
              <input
                placeholder="Label"
                value={edgeLabel}
                onChange={(e) => setEdgeLabel(e.target.value)}
                style={{ ...inputStyle, width: 80 }}
              />
              <input
                placeholder="Target ID"
                value={edgeTarget}
                onChange={(e) => setEdgeTarget(e.target.value)}
                style={{ ...inputStyle, width: 90 }}
              />
              <button onClick={handleAddEdge} style={{ ...btnStyle, color: "#f59e0b" }}>
                Add
              </button>
            </div>
          )}

          {pendingCount > 0 && (
            <>
              <div style={{ color: "#888", fontSize: 11 }}>
                {pendingCount} pending
              </div>
              {canUndo && (
                <button onClick={onUndo} style={btnStyle}>Undo</button>
              )}
              <button onClick={onClear} style={btnStyle}>Clear</button>
              <button
                onClick={onSubmit}
                disabled={isSending}
                style={{
                  ...btnStyle,
                  background: "#3b82f6",
                  color: "#fff",
                  border: "none",
                  opacity: isSending ? 0.5 : 1,
                }}
              >
                {isSending ? "Sending..." : "Commit"}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
