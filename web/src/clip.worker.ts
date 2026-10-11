// Runs CLIP entirely in the browser. After the first download the model is cached,
// so checking photos keeps working with no signal.
import { pipeline, RawImage, type ProgressInfo } from "@huggingface/transformers";

const MODEL = "Xenova/clip-vit-base-patch32";

// Generic "you didn't find it" labels the target has to beat.
const DECOYS = [
  "a phone or computer screen",
  "the inside of a room",
  "a blank wall",
  "a ceiling",
  "a blurry photo",
  "the ground",
];

export type WorkerRequest =
  | { type: "load" }
  | { type: "verify"; id: string; image: Blob; target: string; others: string[] };

export type WorkerResponse =
  | { type: "progress"; progress: number }
  | { type: "ready" }
  | { type: "result"; id: string; pass: boolean; score: number; top: string }
  | { type: "error"; id?: string; message: string };

type Classifier = (image: RawImage, labels: string[], opts: { hypothesis_template: string }) =>
  Promise<{ label: string; score: number }[]>;

let classifier: Promise<Classifier> | null = null;

const post = (msg: WorkerResponse) => self.postMessage(msg);

function load(): Promise<Classifier> {
  classifier ??= pipeline("zero-shot-image-classification", MODEL, {
    progress_callback: (p: ProgressInfo) => {
      if (p.status === "progress_total") post({ type: "progress", progress: p.progress });
    },
  }).then((c) => {
    post({ type: "ready" });
    return c as unknown as Classifier;
  });
  return classifier;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === "load") {
    load().catch((err) => post({ type: "error", message: String(err) }));
    return;
  }
  try {
    const classify = await load();
    const labels = [...new Set([msg.target, ...msg.others, ...DECOYS])];
    const image = await RawImage.fromBlob(msg.image);
    const ranked = await classify(image, labels, { hypothesis_template: "a photo of {}." });
    const score = ranked.find((r) => r.label === msg.target)?.score ?? 0;
    // Top pick, or a strong second place (CLIP splits votes between close labels).
    const pass = ranked[0].label === msg.target || score >= 0.3;
    post({ type: "result", id: msg.id, pass, score, top: ranked[0].label });
  } catch (err) {
    post({ type: "error", id: msg.id, message: String(err) });
  }
};
