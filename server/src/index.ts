import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { z } from "zod";
import { gemmaFromEnv } from "./gemma.js";
import { reversePlace } from "./place.js";
import { generateQuests } from "./quests.js";

const PORT = Number(process.env.PORT ?? 3001);
const gemma = gemmaFromEnv();
const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, provider: process.env.GEMMA_PROVIDER ?? "ollama" });
});

const QuestRequest = z.object({ place: z.string().trim().max(80).optional() });

app.post("/api/quests", async (req, res) => {
  const body = QuestRequest.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: "place must be a short string" });
    return;
  }
  try {
    const quests = await generateQuests(gemma, body.data.place || undefined);
    res.json({ quests });
  } catch (err) {
    console.error("quest generation failed:", err);
    res.status(502).json({ error: "Gemma couldn't write quests right now. Try again in a moment." });
  }
});

const PlaceRequest = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

app.get("/api/place", async (req, res) => {
  const query = PlaceRequest.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "lat and lon are required" });
    return;
  }
  try {
    const place = await reversePlace(query.data.lat, query.data.lon);
    if (!place) {
      res.status(404).json({ error: "Couldn't name this place. Type it in instead." });
      return;
    }
    res.json({ place });
  } catch (err) {
    console.error("reverse geocoding failed:", err);
    res.status(502).json({ error: "Couldn't look up your location. Type it in instead." });
  }
});

// In production the built web app is served from the same origin as the API.
const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));
if (existsSync(webDist)) app.use(express.static(webDist));

app.listen(PORT, () => {
  console.log(`grasshopper on http://localhost:${PORT} (gemma via ${process.env.GEMMA_PROVIDER ?? "ollama"})`);
});
