import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { GemmaClient } from "./gemma.js";

// Hosted Gemma 4 runs long, so trim instead of rejecting.
const clip = (max: number) => z.string().min(1).transform((s) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s));

const QuestSchema = z.object({
  title: clip(80),
  hint: clip(160),
  visual: clip(60),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

const ResponseSchema = z.object({ quests: z.array(QuestSchema).length(5) });

export type Quest = z.infer<typeof QuestSchema> & { id: string };

// Gemma orders quests well but often miscounts the split, so the ladder is fixed by position.
const LADDER = ["easy", "easy", "medium", "medium", "hard"] as const;

const SYSTEM = `You design tiny real-world scavenger hunts for someone about to go on a short walk.
Rules for every quest:
- It is something you can spot and photograph outdoors from a public street, path or park.
- It is safe: no strangers' faces, no trespassing, no touching or chasing animals, no traffic.
- It is common enough to find within a 20-30 minute walk.
- It is ONE thing, not a combination: no reflections, no "X next to Y", no specific angles or weather.
- Difficulty comes from rarity: easy = seen on almost any street, hard = needs a bit of luck or exploring.
- "title" is playful, 3 to 8 words.
- "hint" is one short, friendly sentence on where to look.
- "visual" is a plain noun phrase describing what the photo will show, for an image classifier. 2 to 5 words. Example: "a red door", "a cat on a wall", "a bicycle".`;

function userPrompt(place: string | undefined): string {
  const where = place
    ? `The walk is in ${place}. Make at least two quests specific to everyday street life there.`
    : "The walk is in an ordinary neighbourhood; keep quests universal.";
  return `${where}
Write exactly 5 quests ordered from easiest to hardest: 2 easy, 2 medium, 1 hard.
Return JSON: {"quests": [{"title", "hint", "visual", "difficulty"}]}.`;
}

export async function generateQuests(gemma: GemmaClient, place?: string): Promise<Quest[]> {
  const { $schema: _, ...schema } = z.toJSONSchema(ResponseSchema, { io: "input" });
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await gemma.generateJson(SYSTEM, userPrompt(place), schema);
      const parsed = ResponseSchema.parse(JSON.parse(raw));
      return toQuests(parsed.quests);
    } catch (err) {
      lastError = err;
      console.error(`quest attempt ${attempt + 1} failed:`, err);
    }
  }
  throw lastError;
}

function toQuests(quests: z.infer<typeof ResponseSchema>["quests"]): Quest[] {
  return quests.map((q, i) => ({ ...q, difficulty: LADDER[i], id: randomUUID() }));
}
