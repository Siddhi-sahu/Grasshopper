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

export async function fetchPlace(lat: number, lon: number): Promise<string> {
  const res = await fetch(`/api/place?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.place;
}

export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator) || !window.isSecureContext) {
      reject(new Error("Location needs HTTPS. Type your place in instead."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Couldn't get your location. Type it in instead.")), {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 10 * 60_000,
    });
  });
}
