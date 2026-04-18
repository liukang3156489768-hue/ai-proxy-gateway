export type Provider = "openai" | "gemini" | "anthropic";

export interface ProviderPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const openaiPricing: Record<string, ProviderPricing> = {
  "gpt-5.2": { inputPer1M: 5, outputPer1M: 20 },
  "gpt-5.2-codex": { inputPer1M: 5, outputPer1M: 20 },
  "gpt-5.3-codex": { inputPer1M: 5, outputPer1M: 20 },
  "gpt-5.1": { inputPer1M: 3, outputPer1M: 12 },
  "gpt-5": { inputPer1M: 3, outputPer1M: 12 },
  "gpt-5-mini": { inputPer1M: 1, outputPer1M: 4 },
  "gpt-5-nano": { inputPer1M: 0.3, outputPer1M: 1.2 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4.1": { inputPer1M: 2, outputPer1M: 8 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "gpt-4.1-nano": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "o4-mini": { inputPer1M: 1.1, outputPer1M: 4.4 },
  "o3": { inputPer1M: 10, outputPer1M: 40 },
  "o3-mini": { inputPer1M: 1.1, outputPer1M: 4.4 },
};

const geminiPricing: Record<string, ProviderPricing> = {
  "gemini-3.1-pro-preview": { inputPer1M: 3.5, outputPer1M: 10.5 },
  "gemini-3-flash-preview": { inputPer1M: 0.3, outputPer1M: 1.2 },
  "gemini-3-pro-image-preview": { inputPer1M: 3.5, outputPer1M: 10.5 },
  "gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 10 },
  "gemini-2.5-flash": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "gemini-2.5-flash-image": { inputPer1M: 0.075, outputPer1M: 0.3 },
};

const anthropicPricing: Record<string, ProviderPricing> = {
  "claude-opus-4-7": { inputPer1M: 15, outputPer1M: 75 },
  "claude-opus-4-6": { inputPer1M: 15, outputPer1M: 75 },
  "claude-opus-4-5": { inputPer1M: 15, outputPer1M: 75 },
  "claude-opus-4-1": { inputPer1M: 15, outputPer1M: 75 },
  "claude-sonnet-4-6": { inputPer1M: 3, outputPer1M: 15 },
  "claude-sonnet-4-5": { inputPer1M: 3, outputPer1M: 15 },
  "claude-haiku-4-5": { inputPer1M: 0.8, outputPer1M: 4 },
};

// Models that support extended thinking mode
const thinkingCapableGemini = ["gemini-2.5-pro", "gemini-2.5-flash"];
const thinkingCapableAnthropic = Object.keys(anthropicPricing);

export function detectProvider(model: string): Provider {
  // Strip thinking suffix before provider detection
  const base = model.replace(/-thinking-visible$/, "").replace(/-thinking$/, "");
  if (base.startsWith("gemini-")) return "gemini";
  if (base.startsWith("claude-")) return "anthropic";
  return "openai";
}

export function estimateCost(
  provider: Provider,
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  // Strip thinking suffix for pricing lookup; thinking = visible adds ~50% more output tokens
  const isThinkingVisible = model.endsWith("-thinking-visible");
  const isThinking = model.endsWith("-thinking") || isThinkingVisible;
  const baseModel = model.replace(/-thinking-visible$/, "").replace(/-thinking$/, "");

  let pricing: ProviderPricing | undefined;
  if (provider === "openai") {
    pricing = openaiPricing[baseModel] ?? openaiPricing[model] ?? { inputPer1M: 2, outputPer1M: 8 };
  } else if (provider === "gemini") {
    pricing = geminiPricing[baseModel] ?? geminiPricing[model] ?? { inputPer1M: 1, outputPer1M: 4 };
  } else {
    pricing = anthropicPricing[baseModel] ?? anthropicPricing[model] ?? { inputPer1M: 5, outputPer1M: 25 };
  }

  // Thinking tokens are billed at output-token rate; apply multiplier to estimate
  const outputMultiplier = isThinking ? (isThinkingVisible ? 2.0 : 1.5) : 1.0;

  return (
    (promptTokens * pricing.inputPer1M + completionTokens * outputMultiplier * pricing.outputPer1M) / 1_000_000
  );
}

// ── Thinking model variants ───────────────────────────────────────────────────

function makeThinkingVariants(
  baseId: string,
  provider: string,
  baseInput: number,
  baseOutput: number,
  baseDesc: string
) {
  return [
    {
      id: `${baseId}-thinking`,
      name: `${baseId}-thinking`,
      provider,
      description: `${baseDesc}（扩展思考模式·推理过程隐藏）`,
      inputCostPer1M: baseInput,
      outputCostPer1M: baseOutput * 1.5,
      tags: ["thinking"],
    },
    {
      id: `${baseId}-thinking-visible`,
      name: `${baseId}-thinking-visible`,
      provider,
      description: `${baseDesc}（扩展思考模式·推理过程可见）`,
      inputCostPer1M: baseInput,
      outputCostPer1M: baseOutput * 2.0,
      tags: ["thinking", "thinking-visible"],
    },
  ];
}

// ── Full model list ───────────────────────────────────────────────────────────

export const SUPPORTED_MODELS = [
  // OpenAI models
  ...Object.keys(openaiPricing).map((id) => ({
    id,
    name: id,
    provider: "openai",
    description: "OpenAI model via Replit AI Integrations",
    inputCostPer1M: openaiPricing[id]!.inputPer1M,
    outputCostPer1M: openaiPricing[id]!.outputPer1M,
  })),

  // Gemini models (base)
  ...Object.keys(geminiPricing).map((id) => ({
    id,
    name: id,
    provider: "gemini",
    description: "Google Gemini model via Replit AI Integrations",
    inputCostPer1M: geminiPricing[id]!.inputPer1M,
    outputCostPer1M: geminiPricing[id]!.outputPer1M,
  })),

  // Gemini thinking variants
  ...thinkingCapableGemini.flatMap((id) =>
    makeThinkingVariants(
      id,
      "gemini",
      geminiPricing[id]!.inputPer1M,
      geminiPricing[id]!.outputPer1M,
      "Google Gemini model via Replit AI Integrations"
    )
  ),

  // Anthropic models (base)
  ...Object.keys(anthropicPricing).map((id) => ({
    id,
    name: id,
    provider: "anthropic",
    description: "Anthropic Claude model via Replit AI Integrations",
    inputCostPer1M: anthropicPricing[id]!.inputPer1M,
    outputCostPer1M: anthropicPricing[id]!.outputPer1M,
  })),

  // Anthropic thinking variants (all Claude models support extended thinking)
  ...thinkingCapableAnthropic.flatMap((id) =>
    makeThinkingVariants(
      id,
      "anthropic",
      anthropicPricing[id]!.inputPer1M,
      anthropicPricing[id]!.outputPer1M,
      "Anthropic Claude model via Replit AI Integrations"
    )
  ),
];
