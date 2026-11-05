import "server-only";

/**
 * Minimal tool-calling loop over an OpenAI-compatible chat API. Defaults to
 * Gemini's free tier (docs/decisions.md, 2026-11-04); any compatible provider
 * works by changing AGENT_LLM_BASE_URL and AGENT_LLM_MODEL. When the model is
 * busy (429 or 5xx) it retries once, then tries AGENT_LLM_FALLBACK_MODEL.
 * Without an API key the agent uses its rules instead.
 */

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-flash-lite-latest";
const MAX_ROUNDS = 6;
const RETRY_DELAY_MS = 2_000;
const REQUEST_TIMEOUT_MS = 15_000;

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
    fallbackModel: process.env.AGENT_LLM_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL,
  };
}

type Config = NonNullable<ReturnType<typeof llmConfig>>;

class LlmError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** One chat completion against one model. Busy models and timeouts are retryable. */
async function complete(config: Config, model: string, payload: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model, ...payload }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new LlmError(`llm_network (${model}): ${error instanceof Error ? error.message : error}`, true);
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    const busy = response.status === 429 || response.status >= 500;
    throw new LlmError(`llm_http_${response.status} (${model}): ${detail}`, busy);
  }
  const body = (await response.json()) as { choices?: { message: Message }[] };
  const message = body.choices?.[0]?.message;
  if (!message) throw new LlmError(`llm_empty_response (${model})`, false);
  return message;
}

/**
 * Tries `model`, retries it once after a short pause, then the fallback model.
 * Returns the reply and the model that answered, so later rounds stick to it.
 */
async function completeWithRetry(config: Config, model: string, payload: Record<string, unknown>) {
  const attempts = [model, model];
  if (config.fallbackModel !== model) attempts.push(config.fallbackModel);
  let last: unknown;
  for (const [i, candidate] of attempts.entries()) {
    if (i === 1) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    try {
      return { message: await complete(config, candidate, payload), model: candidate };
    } catch (error) {
      last = error;
      if (!(error instanceof LlmError) || !error.retryable) throw error;
      console.warn("[agente] LLM busy, retrying:", error.message);
    }
  }
  throw last;
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

  const payload = {
    tools: tools.map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    })),
    tool_choice: "auto",
    temperature: 0.2,
  };
  let model = config.model;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const reply = await completeWithRetry(config, model, { ...payload, messages });
    const message = reply.message;
    model = reply.model;
    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });

    const calls = message.tool_calls ?? [];
    if (calls.length === 0) return model;

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
      if (call.function.name === "terminar") return model;
    }
  }
  return model;
}

/**
 * One JSON answer from the model (no tools), with the same retry and
 * fallback as the tool loop. Throws on any failure so callers can use rules.
 */
export async function askJson<T>(system: string, user: string): Promise<T> {
  const config = llmConfig();
  if (!config) throw new Error("llm_not_configured");
  const { message } = await completeWithRetry(config, config.model, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });
  const text = (message.content ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "");
  return JSON.parse(text) as T;
}
