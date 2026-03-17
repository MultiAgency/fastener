"""
Fastener Python Agent Example

Demonstrates the agent loop:
1. Read context from the graph
2. Make a decision based on current state
3. Write a trace (commit) to the NEAR chain via near-cli-rs
4. Watch the result appear via WebSocket

Prerequisites:
    - Fastener server running at localhost:3000
    - near-cli-rs installed and logged in
    - Contract deployed to fastgraph.near

Usage:
    pip install -r requirements.txt
    NEAR_ACCOUNT_ID=your-account.near python agent.py
"""

import asyncio
import json
import os
import subprocess
import time

import requests
import websockets

API_BASE = os.environ.get("API_BASE", "http://localhost:3000")
WS_URL = os.environ.get("WS_URL", "ws://localhost:3000/ws")
CONTRACT_ID = os.environ.get("CONTRACT_ID", "fastgraph.near")
ACCOUNT_ID = os.environ.get("NEAR_ACCOUNT_ID")

if not ACCOUNT_ID:
    print("Set NEAR_ACCOUNT_ID env var to your NEAR account")
    exit(1)


# --- Step 1: Read current context ---

def read_context():
    nodes = requests.get(f"{API_BASE}/api/namespace/default").json()
    edges = requests.get(f"{API_BASE}/api/namespace/default/edges").json()
    return {"nodes": nodes, "edges": edges}


# --- Step 2: Decide what to write ---

def decide(context):
    node_count = len(context["nodes"])
    node_id = f"observation-{int(time.time() * 1000)}"

    mutations = [
        {
            "op": "create_node",
            "namespace": "default",
            "node_id": node_id,
            "data": {
                "node_type": "observation",
                "observed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "existing_nodes": node_count,
                "message": f"Python agent observed {node_count} nodes in the graph",
            },
        }
    ]

    if context["nodes"]:
        latest = max(context["nodes"], key=lambda n: n.get("created_at_ms", 0))
        mutations.append(
            {
                "op": "create_edge",
                "namespace": "default",
                "edge": {
                    "source": node_id,
                    "target": latest["id"],
                    "label": "follows",
                },
                "data": {},
            }
        )

    trace_context = {
        "reasoning": f"Observed {node_count} existing nodes. Creating observation node.",
        "confidence": 1.0,
        "phase": "generation",
    }

    return mutations, trace_context


# --- Step 3: Submit to NEAR chain via near-cli-rs ---

def submit_commit(mutations, trace_context):
    args = json.dumps({"mutations": mutations, "trace_context": trace_context})

    print(f"Submitting commit with {len(mutations)} mutations...")

    result = subprocess.run(
        [
            "near", "contract", "call-function", "as-transaction",
            CONTRACT_ID, "commit",
            "json-args", args,
            "prepaid-gas", "30 Tgas",
            "attached-deposit", "0 NEAR",
            "sign-as", ACCOUNT_ID,
            "network-config", "mainnet",
            "sign-with-keychain", "send",
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )

    if result.returncode != 0:
        print(f"Transaction failed: {result.stderr}")
        raise RuntimeError("NEAR transaction failed")

    print(result.stdout.split("Transaction ID:")[-1].strip().split("\n")[0] if "Transaction ID:" in result.stdout else "Transaction submitted")


# --- Step 4: Watch for result via WebSocket ---

async def watch_for_result():
    async with websockets.connect(WS_URL) as ws:
        print("WebSocket connected, waiting for trace event...")
        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=60)
            event = json.loads(msg)
            if event.get("type") == "trace":
                print("Trace event received!")
                return event


# --- Main ---

async def main():
    print("=== Fastener Python Agent ===\n")

    print("1. Reading context...")
    context = read_context()
    print(f"   Found {len(context['nodes'])} nodes, {len(context['edges'])} edges\n")

    print("2. Making decision...")
    mutations, trace_context = decide(context)
    print(f"   Will create {len(mutations)} mutations")
    print(f"   Reasoning: {trace_context['reasoning']}\n")

    print("3. Submitting to NEAR chain...")
    watch_task = asyncio.create_task(watch_for_result())
    submit_commit(mutations, trace_context)

    print("\n4. Waiting for trace event...")
    trace_event = await watch_task
    print(f"   Agent: {trace_event['agent']}")
    print(f"   Mutations applied: {len(trace_event['mutations'])}")
    print(f"\nDone! Check the dashboard at {API_BASE}")


if __name__ == "__main__":
    asyncio.run(main())
