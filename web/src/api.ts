import type { Quest } from "./store";

export async function fetchQuests(place?: string): Promise<Quest[]> {
  const res = await fetch("/api/quests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ place }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.quests;
}
