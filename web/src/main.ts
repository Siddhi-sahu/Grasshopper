import "./style.css";
import { fetchQuests } from "./api";
import { clearHunt, loadHunt, saveHunt, type Hunt, type QuestProgress } from "./store";
import { verify, warmUp, type ModelStatus } from "./verify";

const app = document.querySelector<HTMLDivElement>("#app")!;

type View = { name: "home"; error?: string } | { name: "loading" } | { name: "hunt" };

let view: View = { name: "home" };
let hunt: Hunt | undefined;
let model: ModelStatus = { state: "loading", progress: 0 };

// Per-quest UI state that doesn't need to survive a reload.
const checking = new Set<string>();
const doubts = new Map<string, { photo: Blob; top?: string }>();
const photoUrls = new Map<Blob, string>();

const DIFFICULTY = {
  easy: { icon: "🌱", label: "easy" },
  medium: { icon: "🌿", label: "medium" },
  hard: { icon: "🌳", label: "hard" },
} as const;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function photoUrl(blob: Blob): string {
  let url = photoUrls.get(blob);
  if (!url) {
    url = URL.createObjectURL(blob);
    photoUrls.set(blob, url);
  }
  return url;
}

const titlebar = (label: string) => `
  <header class="titlebar">
    <span>${label}</span>
    <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
  </header>`;

function renderHome(error?: string): string {
  return `
  <main class="shell home">
    <section class="window hero">
      ${titlebar("grasshopper.exe")}
      <div class="window-body">
        <div class="mascot" aria-hidden="true">🦗</div>
        <h1><span>Grass</span><span>hopper</span></h1>
        <p class="tagline">5 tiny side quests. go outside. come back with proof.</p>
        <form id="start" class="start">
          <label for="place">where are you walking? <span class="muted">(optional)</span></label>
          <input id="place" name="place" placeholder="e.g. Jhansi, India" maxlength="80" autocomplete="off" />
          <button class="btn primary" type="submit">hop to it ✦</button>
        </form>
        ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ""}
      </div>
    </section>
    <p class="footnote">quests written by Gemma · photos checked on your device and never uploaded</p>
  </main>`;
}

function renderLoading(): string {
  return `
  <main class="shell home">
    <section class="window hero">
      ${titlebar("thinking...")}
      <div class="window-body center">
        <div class="mascot hop" aria-hidden="true">🦗</div>
        <p class="tagline">Gemma is dreaming up your quests…</p>
      </div>
    </section>
  </main>`;
}

function renderModelPill(): string {
  switch (model.state) {
    case "loading":
      return `<span class="pill">photo checker loading ${Math.round(model.progress)}%</span>`;
    case "ready":
      return `<span class="pill ok">● photo checker ready · works offline</span>`;
    case "error":
      return `<span class="pill warn">photo checker offline · you can still count finds</span>`;
  }
}

function renderQuest(q: QuestProgress, i: number): string {
  const d = DIFFICULTY[q.difficulty];
  let action: string;
  if (q.found && q.photo) {
    action = `
      <figure class="proof">
        <img class="polaroid" src="${photoUrl(q.photo)}" alt="your photo of ${esc(q.visual)}" />
        <figcaption class="stamp">${q.trusted ? "found (on trust)" : "found!"}</figcaption>
      </figure>`;
  } else if (checking.has(q.id)) {
    action = `<p class="checking">the grasshopper is squinting at your photo…</p>`;
  } else if (doubts.has(q.id)) {
    const doubt = doubts.get(q.id)!;
    action = `
      <img class="polaroid small" src="${photoUrl(doubt.photo)}" alt="" />
      <p class="doubt">${doubt.top ? `hmm, that looks more like <b>${esc(doubt.top)}</b> to me.` : "I couldn't check this one."}</p>
      <div class="row">
        ${cameraButton(q.id, "📷 try again")}
        <button class="btn" data-action="trust" data-id="${q.id}">count it anyway</button>
      </div>`;
  } else {
    action = cameraButton(q.id, "📷 spotted it!");
  }
  return `
    <li class="window quest ${q.found ? "found" : ""}">
      <header class="titlebar">
        <span class="chip ${q.difficulty}">${d.icon} ${d.label}</span>
        <span>quest ${i + 1}/5</span>
      </header>
      <div class="window-body">
        <h2>${esc(q.title)}</h2>
        <p class="hint">${esc(q.hint)}</p>
        ${action}
      </div>
    </li>`;
}

function cameraButton(id: string, label: string): string {
  return `
    <label class="btn primary camera">
      ${label}
      <input type="file" accept="image/*" capture="environment" data-id="${id}" hidden />
    </label>`;
}

function renderHunt(h: Hunt): string {
  const found = h.quests.filter((q) => q.found).length;
  const done = found === h.quests.length;
  return `
  <main class="shell hunt">
    <header class="topbar">
      <span class="brand">🦗 grasshopper</span>
      ${renderModelPill()}
    </header>
    <section class="window">
      ${titlebar(`quest log${h.place ? ` · ${esc(h.place)}` : ""}`)}
      <div class="window-body">
        <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="${h.quests.length}" aria-valuenow="${found}">
          <div class="meter-fill" style="width:${(found / h.quests.length) * 100}%"></div>
        </div>
        <p class="meter-label">${found}/${h.quests.length} found${done ? " ✦" : " · put the phone away between finds"}</p>
      </div>
    </section>
    ${
      done
        ? `<section class="window celebrate">
            ${titlebar("quest_complete.wav")}
            <div class="window-body center">
              <div class="mascot hop" aria-hidden="true">🦗</div>
              <h2>you touched grass!</h2>
              <p>go drink some water. you earned it.</p>
            </div>
          </section>`
        : ""
    }
    <ol class="quests">${h.quests.map(renderQuest).join("")}</ol>
    <div class="center">
      <button class="btn" data-action="new">${done ? "start a new hunt ✦" : "new hunt"}</button>
    </div>
  </main>`;
}

function render() {
  if (view.name === "home") app.innerHTML = renderHome(view.error);
  else if (view.name === "loading") app.innerHTML = renderLoading();
  else if (hunt) app.innerHTML = renderHunt(hunt);
}

async function startHunt(place: string) {
  view = { name: "loading" };
  render();
  try {
    const quests = await fetchQuests(place || undefined);
    hunt = {
      id: crypto.randomUUID(),
      place: place || undefined,
      startedAt: Date.now(),
      quests: quests.map((q) => ({ ...q, found: false })),
    };
    await saveHunt(hunt);
    view = { name: "hunt" };
  } catch (err) {
    view = { name: "home", error: (err as Error).message };
  }
  render();
}

// Phone photos are huge; shrink before storing and before CLIP sees them.
async function shrink(file: File, max = 1024): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale));
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
}

async function checkPhoto(questId: string, file: File) {
  if (!hunt) return;
  const quest = hunt.quests.find((q) => q.id === questId);
  if (!quest) return;
  doubts.delete(questId);
  checking.add(questId);
  render();

  const photo = await shrink(file);
  const others = hunt.quests.filter((q) => q.id !== questId).map((q) => q.visual);
  try {
    const result = await verify(photo, quest.visual, others);
    if (result.pass) {
      Object.assign(quest, { found: true, photo, trusted: false });
      await saveHunt(hunt);
    } else {
      doubts.set(questId, { photo, top: result.top });
    }
  } catch {
    doubts.set(questId, { photo });
  }
  checking.delete(questId);
  render();
}

async function trustQuest(questId: string) {
  const quest = hunt?.quests.find((q) => q.id === questId);
  const doubt = doubts.get(questId);
  if (!hunt || !quest || !doubt) return;
  Object.assign(quest, { found: true, photo: doubt.photo, trusted: true });
  doubts.delete(questId);
  await saveHunt(hunt);
  render();
}

async function newHunt() {
  if (hunt && hunt.quests.some((q) => !q.found) && !confirm("Abandon this hunt and start a new one?")) return;
  await clearHunt();
  hunt = undefined;
  doubts.clear();
  view = { name: "home" };
  render();
}

app.addEventListener("submit", (e) => {
  e.preventDefault();
  const place = new FormData(e.target as HTMLFormElement).get("place");
  startHunt(String(place ?? "").trim());
});

app.addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (input.type === "file" && input.dataset.id && file) checkPhoto(input.dataset.id, file);
});

app.addEventListener("click", (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "trust") trustQuest(button.dataset.id!);
  if (button.dataset.action === "new") newHunt();
});

warmUp((status) => {
  model = status;
  if (view.name === "hunt") {
    const pill = app.querySelector(".pill");
    if (pill) pill.outerHTML = renderModelPill();
  }
});

hunt = await loadHunt();
view = hunt ? { name: "hunt" } : { name: "home" };
render();
