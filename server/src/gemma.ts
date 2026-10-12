// Gemma behind a tiny interface so the host is a config change, not a rewrite.
// GEMMA_PROVIDER=ollama runs it locally; GEMMA_PROVIDER=gemini calls Google's hosted Gemma.

export interface GemmaClient {
  /** Returns the model's raw text reply, constrained to `schema` when the host supports it. */
  generateJson(system: string, user: string, schema: object): Promise<string>;
}

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const GEMMA_MODEL = process.env.GEMMA_MODEL || "gemma3:4b";

export const ollamaGemma: GemmaClient = {
  async generateJson(system, user, schema) {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: GEMMA_MODEL,
        stream: false,
        format: schema,
        options: { temperature: 0.9 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as { message?: { content?: string } };
    return body.message?.content ?? "";
  },
};

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_GEMMA_MODEL = process.env.GEMINI_GEMMA_MODEL || "gemma-4-26b-a4b-it";

export const geminiGemma: GemmaClient = {
  async generateJson(system, user, schema) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    const res = await fetch(`${GEMINI_URL}/${GEMINI_GEMMA_MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        // Hosted Gemma 4 times out with responseJsonSchema, so the schema rides in the prompt
        // and the caller validates.
        contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}\n\nJSON schema:\n${JSON.stringify(schema)}` }] }],
        generationConfig: { temperature: 0.9, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    };
    const parts = body.candidates?.[0]?.content?.parts ?? [];
    return parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  },
};

export function gemmaFromEnv(): GemmaClient {
  return process.env.GEMMA_PROVIDER === "gemini" ? geminiGemma : ollamaGemma;
}
