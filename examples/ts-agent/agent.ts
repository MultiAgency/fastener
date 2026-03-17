/**
 * Fastener TypeScript Agent Example
 *
 * Demonstrates the agent loop:
 * 1. Read context from the graph
 * 2. Make a decision based on current state
 * 3. Write a trace (commit) to the NEAR chain
 * 4. Watch the result appear via WebSocket
 *
 * Prerequisites:
 *   - Fastener server running at localhost:3000
 *   - near-cli-rs installed and logged in (`near account import-account`)
 *   - Contract deployed to fastgraph.near
 *
 * Usage:
 *   npm install
 *   NEAR_ACCOUNT_ID=your-account.near npx tsx agent.ts
 */

import { execSync } from "child_process";
import WebSocket from "ws";

const API_BASE = process.env.API_BASE || "http://localhost:3000";
const WS_URL = process.env.WS_URL || "ws://localhost:3000/ws";
const CONTRACT_ID = process.env.CONTRACT_ID || "fastgraph.near";
const ACCOUNT_ID = process.env.NEAR_ACCOUNT_ID;

if (!ACCOUNT_ID) {
  console.error("Set NEAR_ACCOUNT_ID env var to your NEAR account");
  process.exit(1);
}

// --- Step 1: Read current context ---

async function readContext(): Promise<{ nodes: any[]; edges: any[] }> {
  const [nodesRes, edgesRes] = await Promise.all([
    fetch(`${API_BASE}/api/namespace/default`),
    fetch(`${API_BASE}/api/namespace/default/edges`),
  ]);
  return {
    nodes: await nodesRes.json(),
    edges: await edgesRes.json(),
  };
}

// --- Step 2: Decide what to write ---

function decide(context: { nodes: any[]; edges: any[] }) {
  const nodeCount = context.nodes.length;
  const nodeId = `observation-${Date.now()}`;

  const mutations: any[] = [
    {
      op: "create_node",
      namespace: "default",
      node_id: nodeId,
      data: {
        node_type: "observation",
        observed_at: new Date().toISOString(),
        existing_nodes: nodeCount,
        message: `Agent observed ${nodeCount} nodes in the graph`,
      },
    },
  ];

  if (context.nodes.length > 0) {
    const latest = context.nodes.sort(
      (a: any, b: any) => b.created_at_ms - a.created_at_ms
    )[0];
    mutations.push({
      op: "create_edge",
      namespace: "default",
      edge: { source: nodeId, target: latest.id, label: "follows" },
      data: {},
    });
  }

  const traceContext = {
    reasoning: `Observed ${nodeCount} existing nodes. Creating observation node to record current state.`,
    confidence: 1.0,
    phase: "generation",
  };

  return { mutations, traceContext };
}

// --- Step 3: Submit to NEAR chain via near-cli-rs ---

function submitCommit(mutations: any[], traceContext: any): void {
  const args = JSON.stringify({ mutations, trace_context: traceContext });

  console.log(`Submitting commit with ${mutations.length} mutations...`);

  const result = execSync(
    `near contract call-function as-transaction ${CONTRACT_ID} commit ` +
      `json-args '${args.replace(/'/g, "\\'")}' ` +
      `prepaid-gas '30 Tgas' attached-deposit '0 NEAR' ` +
      `sign-as ${ACCOUNT_ID} network-config mainnet sign-with-keychain send`,
    { encoding: "utf-8", timeout: 30000 }
  );

  const txMatch = result.match(/Transaction ID: (\S+)/);
  if (txMatch) {
    console.log(`Transaction: ${txMatch[1]}`);
  }
}

// --- Step 4: Watch for result via WebSocket ---

function watchForResult(): Promise<any> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Timeout waiting for trace event"));
    }, 60000);

    ws.on("open", () => {
      console.log("WebSocket connected, waiting for trace event...");
    });

    ws.on("message", (data: Buffer) => {
      const event = JSON.parse(data.toString());
      if (event.type === "trace") {
        console.log("Trace event received!");
        clearTimeout(timeout);
        ws.close();
        resolve(event);
      }
    });

    ws.on("error", (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// --- Main ---

async function main() {
  console.log("=== Fastener TypeScript Agent ===\n");

  console.log("1. Reading context...");
  const context = await readContext();
  console.log(
    `   Found ${context.nodes.length} nodes, ${context.edges.length} edges\n`
  );

  console.log("2. Making decision...");
  const { mutations, traceContext } = decide(context);
  console.log(`   Will create ${mutations.length} mutations`);
  console.log(`   Reasoning: ${traceContext.reasoning}\n`);

  console.log("3. Submitting to NEAR chain...");
  const watchPromise = watchForResult();
  submitCommit(mutations, traceContext);

  console.log("\n4. Waiting for trace event...");
  const traceEvent = await watchPromise;
  console.log(`   Agent: ${traceEvent.agent}`);
  console.log(`   Mutations applied: ${traceEvent.mutations.length}`);
  console.log(`\nDone! Check the dashboard at ${API_BASE}`);
}

main().catch(console.error);
