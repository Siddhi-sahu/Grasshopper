import express from "express";
import { z } from "zod";
import { ollamaGemma } from "./gemma.js";
import { generateQuests } from "./quests.js";

const PORT = Number(process.env.PORT ?? 3001);
const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const QuestRequest = z.object({ place: z.string().trim().max(80).optional() });

app.post("/api/quests", async (req, res) => {
  const body = QuestRequest.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: "place must be a short string" });
    return;
  }
  try {
    const quests = await generateQuests(ollamaGemma, body.data.place || undefined);
    res.json({ quests });
  } catch (err) {
    console.error("quest generation failed:", err);
    res.status(502).json({ error: "Gemma couldn't write quests right now. Is Ollama running?" });
  }
});

app.listen(PORT, () => {
  console.log(`grasshopper api on http://localhost:${PORT}`);
});
