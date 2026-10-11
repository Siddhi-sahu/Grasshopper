import type { WorkerRequest, WorkerResponse } from "./clip.worker";

export type VerifyResult = { pass: boolean; score: number; top: string };

const worker = new Worker(new URL("./clip.worker.ts", import.meta.url), { type: "module" });
const pending = new Map<string, { resolve: (r: VerifyResult) => void; reject: (e: Error) => void }>();
let onStatus: (status: ModelStatus) => void = () => {};

export type ModelStatus = { state: "loading"; progress: number } | { state: "ready" } | { state: "error"; message: string };

worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
  const msg = e.data;
  switch (msg.type) {
    case "progress":
      onStatus({ state: "loading", progress: msg.progress });
      break;
    case "ready":
      onStatus({ state: "ready" });
      break;
    case "result":
      pending.get(msg.id)?.resolve(msg);
      pending.delete(msg.id);
      break;
    case "error":
      if (msg.id) {
        pending.get(msg.id)?.reject(new Error(msg.message));
        pending.delete(msg.id);
      } else {
        onStatus({ state: "error", message: msg.message });
      }
  }
};

const send = (msg: WorkerRequest) => worker.postMessage(msg);

export function warmUp(listener: (status: ModelStatus) => void) {
  onStatus = listener;
  send({ type: "load" });
}

export function verify(image: Blob, target: string, others: string[]): Promise<VerifyResult> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send({ type: "verify", id, image, target, others });
  });
}
