// Turns rounded coordinates into a city name with OpenStreetMap's Nominatim.
// Only the city/state/country goes on to Gemma, never the coordinates.

const USER_AGENT = "Grasshopper/0.1 (Hacktoberfest side-quest walk app)";

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  county?: string;
  state?: string;
  country?: string;
}

export async function reversePlace(lat: number, lon: number): Promise<string | undefined> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    lat: lat.toFixed(2),
    lon: lon.toFixed(2),
    format: "jsonv2",
    zoom: "10",
    "accept-language": "en",
  }).toString();
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const body = (await res.json()) as { address?: NominatimAddress };
  const a = body.address;
  if (!a) return undefined;
  const local = a.city ?? a.town ?? a.village ?? a.suburb ?? a.county;
  return [local, a.state, a.country].filter(Boolean).join(", ") || undefined;
}
