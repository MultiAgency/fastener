import { useMemo, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeTypes,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Dagre from "@dagrejs/dagre";
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
        minWidth: 140,
        maxWidth: 220,
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

function layoutGraph(nodes: RFNode[], edges: RFEdge[]): RFNode[] {
  if (nodes.length === 0) return nodes;

  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });

  for (const node of nodes) {
    g.setNode(node.id, { width: 180, height: 70 });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  Dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 90, y: pos.y - 35 },
    };
  });
}

interface GraphViewProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

function GraphViewInner({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
}: GraphViewProps) {
  const { fitView } = useReactFlow();

  const rfEdges: RFEdge[] = useMemo(
    () =>
      edges.map((edge, i) => ({
        id: `e-${edge.source}-${edge.target}-${edge.label}-${i}`,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        style: { stroke: "#4a4a6a", strokeWidth: 1.5 },
        labelStyle: { fill: "#888", fontSize: 10 },
        animated: true,
      })),
    [edges]
  );

  const rfNodes: RFNode[] = useMemo(() => {
    const raw = nodes.map((node) => ({
      id: node.id,
      type: "context" as const,
      position: { x: 0, y: 0 },
      data: {
        label: node.id,
        nodeType: node.node_type,
        agentId: node.agent_id,
      },
      selected: node.id === selectedNodeId,
    }));
    return layoutGraph(raw, rfEdges);
  }, [nodes, selectedNodeId, rfEdges]);

  // Auto-fit when nodes change
  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 50);
    }
  }, [nodes.length, fitView]);

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
  );
}

export default function GraphView(props: GraphViewProps) {
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <GraphViewInner {...props} />
    </div>
  );
}
