import "server-only";

/**
 * Minimal tool-calling loop over an OpenAI-compatible chat API. Defaults to
 * Gemini's free tier (docs/decisions.md, 2026-11-04); any compatible provider
 * works by changing AGENT_LLM_BASE_URL and AGENT_LLM_MODEL. Without an API key
 * the agent uses its rules instead.
 */

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_ROUNDS = 6;

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export function llmConfig() {
  const apiKey = process.env.AGENT_LLM_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.AGENT_LLM_BASE_URL ?? DEFAULT_BASE_URL,
    model: process.env.AGENT_LLM_MODEL ?? DEFAULT_MODEL,
  };
}

/**
 * Lets the model call `tools` until it stops or calls a tool named "terminar".
 * Throws on any API error so the caller can fall back to rules.
 */
export async function runToolLoop(system: string, user: string, tools: Tool[]) {
  const config = llmConfig();
  if (!config) throw new Error("llm_not_configured");

  const messages: Message[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages,
        tools: tools.map((tool) => ({
          type: "function",
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        })),
        tool_choice: "auto",
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(`llm_http_${response.status} (${config.model}): ${detail}`);
    }

    const body = (await response.json()) as { choices?: { message: Message }[] };
    const message = body.choices?.[0]?.message;
    if (!message) throw new Error("llm_empty_response");
    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });

    const calls = message.tool_calls ?? [];
    if (calls.length === 0) return config.model;

    for (const call of calls) {
      const tool = byName.get(call.function.name);
      let result: unknown;
      try {
        const args = call.function.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {};
        result = tool ? await tool.run(args) : { error: "unknown_tool" };
      } catch (error) {
        result = { error: error instanceof Error ? error.message : "tool_failed" };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      if (call.function.name === "terminar") return config.model;
    }
  }
  return config.model;
}
