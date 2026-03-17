import type { TraceEventWS } from "../lib/types";

interface TraceTimelineProps {
  traces: TraceEventWS[];
}

export default function TraceTimeline({ traces }: TraceTimelineProps) {
  if (traces.length === 0) {
    return (
      <div
        style={{
          padding: "8px 12px",
          color: "#444",
          fontSize: 11,
          textAlign: "center",
        }}
      >
        No trace events yet
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        padding: "8px 12px",
        overflowX: "auto",
      }}
    >
      {traces.map((trace, i) => (
        <div
          key={i}
          style={{
            background: "#1a1a2e",
            borderRadius: 6,
            padding: "6px 10px",
            minWidth: 120,
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          <div style={{ color: "#3b82f6", fontWeight: 500 }}>
            {trace.agent.length > 16 ? trace.agent.slice(0, 14) + "..." : trace.agent}
          </div>
          <div style={{ color: "#888" }}>
            {trace.mutations.length} mutation{trace.mutations.length !== 1 ? "s" : ""}
          </div>
          <div style={{ color: "#555", fontSize: 10 }}>
            {new Date(trace.block_timestamp_ms).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );
}
