interface NamespaceListProps {
  namespaces: string[];
  activeNamespace: string;
  onSelectNamespace: (ns: string) => void;
}

export default function NamespaceList({
  namespaces,
  activeNamespace,
  onSelectNamespace,
}: NamespaceListProps) {
  return (
    <div
      style={{
        padding: "12px",
        borderBottom: "1px solid #1a1a2e",
      }}
    >
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
        Namespaces
      </div>
      {namespaces.length === 0 && (
        <div style={{ color: "#444", fontSize: 12 }}>No active namespaces</div>
      )}
      {namespaces.map((ns) => (
        <button
          key={ns}
          onClick={() => onSelectNamespace(ns)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            background: ns === activeNamespace ? "#1a1a3e" : "transparent",
            border: ns === activeNamespace ? "1px solid #3b82f6" : "1px solid transparent",
            borderRadius: 6,
            padding: "6px 10px",
            marginBottom: 4,
            color: ns === activeNamespace ? "#3b82f6" : "#aaa",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {ns}
        </button>
      ))}
    </div>
  );
}
