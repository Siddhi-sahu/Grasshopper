// Everything stays on this device: quests, photos and progress live in IndexedDB.
import { get, set, del } from "idb-keyval";

export type Difficulty = "easy" | "medium" | "hard";

export interface Quest {
  id: string;
  title: string;
  hint: string;
  visual: string;
  difficulty: Difficulty;
}

export interface QuestProgress extends Quest {
  found: boolean;
  photo?: Blob;
  /** true when the walker counted it themselves after CLIP wasn't convinced */
  trusted?: boolean;
}

export interface Hunt {
  id: string;
  place?: string;
  startedAt: number;
  quests: QuestProgress[];
}

const KEY = "current-hunt";

export const loadHunt = () => get<Hunt>(KEY);
export const saveHunt = (hunt: Hunt) => set(KEY, hunt);
export const clearHunt = () => del(KEY);
