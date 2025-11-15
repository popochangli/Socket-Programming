import type { Group } from "../types";

const API_BASE =
  import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_SOCKET_URL ?? "http://localhost:8080";

export async function fetchGroups(): Promise<Group[]> {
  const res = await fetch(`${API_BASE}/groups`);
  if (!res.ok) {
    throw new Error("Failed to load groups");
  }
  return res.json();
}

export async function createGroup(name: string): Promise<Group> {
  const res = await fetch(`${API_BASE}/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Unable to create group");
  }

  return res.json();
}
