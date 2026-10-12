import { randomUUID } from "node:crypto";
import type { Quest } from "./quests.js";

// Hand-written quests served when Gemma is unreachable, so a walk never gets blocked.
// The client labels these clearly as not AI-written.
const STARTER: Omit<Quest, "id">[] = [
  { title: "Two wheels, no rider", hint: "Parked bikes hang out by shops and gates.", visual: "a parked bicycle", difficulty: "easy" },
  { title: "Something green and growing", hint: "Cracks in pavements count. So do pots.", visual: "a green plant", difficulty: "easy" },
  { title: "A door with personality", hint: "Look for a bold colour or odd shape.", visual: "a colorful door", difficulty: "medium" },
  { title: "Somebody's lazy cat", hint: "Walls, cars and sunny steps are prime cat spots.", visual: "a cat", difficulty: "medium" },
  { title: "A bird mid-perch", hint: "Wires, rooftops and tree tops. Look up!", visual: "a bird on a wire", difficulty: "hard" },
];

export const starterQuests = (): Quest[] => STARTER.map((q) => ({ ...q, id: randomUUID() }));
