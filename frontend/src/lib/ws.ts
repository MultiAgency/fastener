import { WS_URL } from "./constants";
import type { TraceEventWS, NamespacesActivatedEvent, WSEvent } from "./types";

type TraceHandler = (event: TraceEventWS) => void;
type NamespacesActivatedHandler = (event: NamespacesActivatedEvent) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private traceHandlers: TraceHandler[] = [];
  private namespacesActivatedHandlers: NamespacesActivatedHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTimestamp = 0;

  connect() {
    if (this.ws) return;

    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      if (this.lastTimestamp > 0) {
        this.ws!.send(
          JSON.stringify({
            type: "catch_up",
            since_timestamp_ms: this.lastTimestamp,
          })
        );
      }
    };

    this.ws.onmessage = (e) => {
      try {
        const event: WSEvent = JSON.parse(e.data);
        if (event.type === "trace") {
          this.lastTimestamp = Math.max(this.lastTimestamp, event.block_timestamp_ms);
          for (const handler of this.traceHandlers) {
            handler(event);
          }
        } else if (event.type === "namespaces_activated") {
          for (const handler of this.namespacesActivatedHandlers) {
            handler(event);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected, reconnecting...");
      this.ws = null;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  onTrace(handler: TraceHandler) {
    this.traceHandlers.push(handler);
    return () => {
      this.traceHandlers = this.traceHandlers.filter((h) => h !== handler);
    };
  }

  onNamespacesActivated(handler: NamespacesActivatedHandler) {
    this.namespacesActivatedHandlers.push(handler);
    return () => {
      this.namespacesActivatedHandlers = this.namespacesActivatedHandlers.filter(
        (h) => h !== handler
      );
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
