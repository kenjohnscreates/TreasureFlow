export const LOCAL_AGENT_URL = "http://127.0.0.1:8788";
export const CHAT_KEY_HEADER = "x-treasureflow-key";

export function resolveAgentUrl(prod: boolean, viteAgentUrl?: string): string {
  if (prod) return "";
  return viteAgentUrl || LOCAL_AGENT_URL;
}
