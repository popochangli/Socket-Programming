import type { ChatMessage } from "../types";

const API_BASE =
  import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_SOCKET_URL ?? "http://localhost:8080";

export async function fetchPrivateMessages(me: string, peer: string): Promise<ChatMessage[]> {
  const url = new URL(`${API_BASE}/dm/${encodeURIComponent(peer)}/messages`);
  url.searchParams.set("me", me);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to load private messages");
  }

  return res.json();
}
