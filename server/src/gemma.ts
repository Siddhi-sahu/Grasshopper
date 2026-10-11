// Gemma behind a tiny interface so the host is a config change, not a rewrite.
// Locally we talk to Ollama; a hosted provider can implement the same shape later.

export interface GemmaClient {
  /** Returns the model's raw text reply, constrained to `schema` when the host supports it. */
  generateJson(system: string, user: string, schema: object): Promise<string>;
}

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const GEMMA_MODEL = process.env.GEMMA_MODEL ?? "gemma3:4b";

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
