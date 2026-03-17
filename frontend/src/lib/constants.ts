export const CONTRACT_ID = "fastener.near";
export const DEFAULT_NAMESPACE = "default";
export const MAX_VISIBLE_NODES = 500;

const isDev = import.meta.env.DEV;
export const API_BASE = isDev ? "" : "https://api.fastener.fastnear.com";
export const WS_URL = isDev ? `ws://${location.host}/ws` : "wss://api.fastener.fastnear.com/ws";
