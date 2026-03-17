# Fastener Multi-Agent Demo

Three Claude Code agents investigate Fastener itself, writing their analysis INTO the context graph in real-time.

## Prerequisites

- Fastener server running at localhost:3000 (or your port)
- Indexer running and streaming blocks
- `fastgraph.near` credentials available for signing
- Dashboard open in browser at http://localhost:3000

## Run the Demo

### Terminal 1: Observer Agent
Open Claude Code and paste the contents of `observer-prompt.md` as your first message.

The Observer will create 3-4 observation nodes about what Fastener is.

### Terminal 2: Analyst Agent (start ~30 seconds after Observer)
Open Claude Code and paste the contents of `analyst-prompt.md` as your first message.

The Analyst will read the Observer's nodes, then create decision nodes with edges linking to observations.

### Terminal 3: Strategist Agent (start ~30 seconds after Analyst)
Open Claude Code and paste the contents of `strategist-prompt.md` as your first message.

The Strategist will read everything, then create action nodes with edges linking to both observations and decisions.

## What to Watch

Keep the dashboard (http://localhost:3000) visible while running all three agents. You'll see:

1. Blue/green observation nodes appear one by one
2. Purple decision nodes appear with edges connecting to observations
3. Yellow/orange action nodes appear with edges to everything

The trace timeline at the bottom shows each commit as it lands on-chain.

Click any node to see its data and the agent's reasoning in `trace_context`.

## Tips

- Stagger the agents by ~30 seconds so the graph builds visually
- The Observer should go first (it creates the raw material)
- The Analyst needs observations to exist before it can analyze
- The Strategist needs both observations and analysis before it can strategize
- For a clean demo, clear the Valkey database first: `redis-cli FLUSHALL`
