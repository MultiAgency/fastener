import type { Node, Edge } from "../lib/types";

interface NodeDetailProps {
  node: Node | null;
  edges: Edge[];
  onClose: () => void;
}

export default function NodeDetail({ node, edges, onClose }: NodeDetailProps) {
  if (!node) return null;

  const connectedEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id
  );

  return (
    <div
      style={{
        width: 300,
        background: "#0f0f1a",
        borderLeft: "1px solid #1a1a2e",
        padding: 16,
        overflowY: "auto",
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{node.id}</div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#666",
            cursor: "pointer",
            fontSize: 18,
          }}
        >
          x
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            background: "#1a1a3e",
            padding: "2px 8px",
            borderRadius: 4,
            color: "#3b82f6",
          }}
        >
          {node.node_type}
        </span>
        <span style={{ color: "#666", marginLeft: 8, fontSize: 11 }}>
          agent #{node.agent_id}
        </span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>
          Data
        </div>
        <pre
          style={{
            background: "#1a1a2e",
            padding: 8,
            borderRadius: 6,
            fontSize: 11,
            color: "#ccc",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {JSON.stringify(node.data, null, 2)}
        </pre>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>
          Timestamps
        </div>
        <div style={{ color: "#aaa", fontSize: 11 }}>
          Created: {new Date(node.created_at_ms).toLocaleString()}
        </div>
        <div style={{ color: "#aaa", fontSize: 11 }}>
          Updated: {new Date(node.updated_at_ms).toLocaleString()}
        </div>
      </div>

      {connectedEdges.length > 0 && (
        <div>
          <div style={{ color: "#666", fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>
            Edges ({connectedEdges.length})
          </div>
          {connectedEdges.map((e, i) => (
            <div
              key={i}
              style={{
                background: "#1a1a2e",
                padding: "4px 8px",
                borderRadius: 4,
                marginBottom: 4,
                fontSize: 11,
                color: "#aaa",
              }}
            >
              {e.source === node.id ? (
                <>
                  <span style={{ color: "#f59e0b" }}>{e.label}</span> → {e.target}
                </>
              ) : (
                <>
                  {e.source} → <span style={{ color: "#f59e0b" }}>{e.label}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
