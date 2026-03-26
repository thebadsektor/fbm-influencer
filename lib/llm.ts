export type LLMProvider = "anthropic" | "openai" | "gemini";

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
};

export const PROVIDER_MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
};

const PROVIDER_ENV_KEYS: Record<LLMProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
};

/**
 * Unified LLM text generation across providers.
 * Returns the raw text response.
 *
 * Pass a pre-resolved apiKey to use credential-based keys (server routes
 * should call resolveApiKey() first). Falls back to env vars when omitted.
 */
export async function llmGenerate(
  provider: LLMProvider,
  prompt: string,
  maxTokens: number = 1024,
  apiKeyOverride?: string
): Promise<string> {
  const apiKey =
    apiKeyOverride || process.env[PROVIDER_ENV_KEYS[provider]] || "";

  if (!apiKey) {
    throw new Error(
      `No API key for ${provider}. Add it in Credentials or set ${PROVIDER_ENV_KEYS[provider]} in .env.`
    );
  }

  switch (provider) {
    case "anthropic":
      return generateAnthropic(apiKey, prompt, maxTokens);
    case "openai":
      return generateOpenAI(apiKey, prompt, maxTokens);
    case "gemini":
      return generateGemini(apiKey, prompt, maxTokens);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function generateAnthropic(
  apiKey: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: PROVIDER_MODELS.anthropic,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic returned an empty response");
  }
  return textBlock.text;
}

async function generateOpenAI(
  apiKey: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: PROVIDER_MODELS.openai,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new Error("OpenAI returned an empty response");
  }
  return text;
}

async function generateGemini(
  apiKey: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: PROVIDER_MODELS.gemini,
    contents: prompt,
    config: { maxOutputTokens: maxTokens },
  });
  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }
  return text;
}

/**
 * Parse JSON from LLM response text.
 * Handles raw JSON, JSON wrapped in markdown code blocks, or JSON embedded in prose.
 */
export function parseJsonFromLLM<T = unknown>(text: string): T {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting JSON object from surrounding text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in LLM response");
    }
    return JSON.parse(jsonMatch[0]);
  }
}
