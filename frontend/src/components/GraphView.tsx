import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeTypes,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Node, Edge } from "../lib/types";

const NODE_TYPE_COLORS: Record<string, string> = {
  context: "#3b82f6",
  observation: "#10b981",
  action: "#f59e0b",
  decision: "#8b5cf6",
  reflection: "#ec4899",
  policy: "#ef4444",
};

function ContextNode({ data }: { data: { label: string; nodeType: string; agentId: number } }) {
  const color = NODE_TYPE_COLORS[data.nodeType] || "#6b7280";
  return (
    <div
      style={{
        background: "#1a1a2e",
        border: `2px solid ${color}`,
        borderRadius: 8,
        padding: "8px 12px",
        minWidth: 120,
        fontSize: 12,
        color: "#e0e0e0",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <div
        style={{
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color,
          marginBottom: 4,
          fontWeight: 600,
        }}
      >
        {data.nodeType}
      </div>
      <div style={{ fontWeight: 500, wordBreak: "break-word" }}>{data.label}</div>
      {data.agentId > 0 && (
        <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
          agent #{data.agentId}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  context: ContextNode,
};

interface GraphViewProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

export default function GraphView({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
}: GraphViewProps) {
  const rfNodes: RFNode[] = useMemo(() => {
    const cols = Math.max(Math.ceil(Math.sqrt(nodes.length)), 1);
    return nodes.map((node, i) => ({
      id: node.id,
      type: "context",
      position: {
        x: (i % cols) * 200,
        y: Math.floor(i / cols) * 120,
      },
      data: {
        label: node.id,
        nodeType: node.node_type,
        agentId: node.agent_id,
      },
      selected: node.id === selectedNodeId,
    }));
  }, [nodes, selectedNodeId]);

  const rfEdges: RFEdge[] = useMemo(
    () =>
      edges.map((edge, i) => ({
        id: `e-${edge.source}-${edge.target}-${edge.label}-${i}`,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        style: { stroke: "#4a4a6a" },
        labelStyle: { fill: "#888", fontSize: 10 },
        animated: true,
      })),
    [edges]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: RFNode) => {
      onSelectNode(node.id);
    },
    [onSelectNode]
  );

  const onPaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: "#0a0a0f" }}
      >
        <Background color="#1a1a2e" gap={20} />
        <Controls
          style={{ background: "#1a1a2e", borderColor: "#2a2a4a" }}
        />
        <MiniMap
          nodeColor={(n) => NODE_TYPE_COLORS[n.data?.nodeType as string] || "#6b7280"}
          style={{ background: "#0f0f1a" }}
        />
      </ReactFlow>
    </div>
  );
}
