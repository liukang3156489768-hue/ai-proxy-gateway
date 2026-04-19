import { Router, type IRouter, Request, Response } from "express";
import { proxyAuth } from "../middlewares/proxyAuth.js";
import { detectProvider, estimateCost, SUPPORTED_MODELS } from "../lib/providers.js";

const SUPPORTED_MODEL_IDS = new Set((SUPPORTED_MODELS as { id: string }[]).map((m) => m.id));

function isModelSupported(model: string): boolean {
  const base = model.replace(/-thinking-visible$/, "").replace(/-thinking$/, "");
  return SUPPORTED_MODEL_IDS.has(base) || SUPPORTED_MODEL_IDS.has(model);
}

function extractUpstreamError(err: unknown): { status: number; message: string; type: string } {
  if (err && typeof err === "object") {
    const e = err as { status?: number; error?: { error?: { message?: string; type?: string } }; message?: string };
    const status = typeof e.status === "number" ? e.status : 500;
    const upstreamMsg = e.error?.error?.message ?? e.message ?? "Unknown error";
    const upstreamType = e.error?.error?.type ?? "upstream_error";
    return { status, message: upstreamMsg, type: upstreamType };
  }
  return { status: 500, message: String(err), type: "proxy_error" };
}
import { db, apiUsageLogs } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ai } from "@workspace/integrations-gemini-ai";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import OpenAI from "openai";

// OpenRouter client — OpenAI-compatible SDK pointed at the OpenRouter integration endpoint
const openrouter = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENROUTER_BASE_URL"] ?? "https://openrouter.ai/api/v1",
  apiKey: process.env["AI_INTEGRATIONS_OPENROUTER_API_KEY"] ?? "",
});
import type {
  MessageParam,
  TextBlockParam,
  ImageBlockParam,
  ContentBlockParam,
  Tool as AnthropicTool,
  ToolUseBlock,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";

const router: IRouter = Router();

// ── Types ────────────────────────────────────────────────────────────────────

interface OpenAIImageURL {
  url: string;
  detail?: "auto" | "low" | "high";
}

type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: OpenAIImageURL };

type OpenAIContent = string | OpenAIContentPart[];

interface OpenAIToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

interface OpenAITool {
  type: "function";
  function: OpenAIToolFunction;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: OpenAIContent | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ChatCompletionBody {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  tools?: OpenAITool[];
  tool_choice?: unknown;
}

interface ThinkingConfig {
  enabled: boolean;
  visible: boolean;
}

type ProxyRes = Response & { _proxyUsage?: { prompt: number; completion: number } };

// ── Thinking mode helpers ─────────────────────────────────────────────────────

function parseThinkingModel(model: string): { base: string; thinking: ThinkingConfig } {
  if (model.endsWith("-thinking-visible")) {
    return {
      base: model.slice(0, -"-thinking-visible".length),
      thinking: { enabled: true, visible: true },
    };
  }
  if (model.endsWith("-thinking")) {
    return {
      base: model.slice(0, -"-thinking".length),
      thinking: { enabled: true, visible: false },
    };
  }
  return { base: model, thinking: { enabled: false, visible: false } };
}

// ── Content converters ───────────────────────────────────────────────────────

function extractText(content: OpenAIContent | null): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

function parseDataUri(url: string): { mimeType: string; data: string } | null {
  if (!url.startsWith("data:")) return null;
  const comma = url.indexOf(",");
  if (comma === -1) return null;
  return { mimeType: url.slice(5, comma).split(";")[0]!, data: url.slice(comma + 1) };
}

function toGeminiParts(content: OpenAIContent): object[] {
  if (typeof content === "string") return [{ text: content }];
  return content.map((block) => {
    if (block.type === "text") return { text: block.text };
    const url = block.image_url.url;
    const parsed = parseDataUri(url);
    if (parsed) return { inlineData: { mimeType: parsed.mimeType, data: parsed.data } };
    return { fileData: { fileUri: url } };
  });
}

function toAnthropicContent(content: OpenAIContent | null): ContentBlockParam[] {
  if (!content) return [];
  if (typeof content === "string") return [{ type: "text", text: content }];
  return content.map((block): ContentBlockParam => {
    if (block.type === "text") return { type: "text", text: block.text };
    const url = block.image_url.url;
    const parsed = parseDataUri(url);
    if (parsed) {
      const mediaType = parsed.mimeType as ImageBlockParam["source"]["media_type"];
      return { type: "image", source: { type: "base64", media_type: mediaType, data: parsed.data } };
    }
    return { type: "image", source: { type: "url", url } as ImageBlockParam["source"] };
  });
}

// ── Tool call converters ─────────────────────────────────────────────────────

function toAnthropicTools(tools: OpenAITool[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: (t.function.parameters ?? { type: "object", properties: {} }) as AnthropicTool["input_schema"],
  }));
}

function toGeminiTools(tools: OpenAITool[]) {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.function.name,
        description: t.function.description ?? "",
        parameters: t.function.parameters,
      })),
    },
  ];
}

/** Convert OpenAI messages to Anthropic MessageParam[], handling tool_calls and tool results */
function toAnthropicMessages(messages: OpenAIMessage[]): MessageParam[] {
  const result: MessageParam[] = [];

  for (const m of messages) {
    if (m.role === "system") continue;

    if (m.role === "tool") {
      // Tool result → Anthropic user message with tool_result content
      const last = result[result.length - 1];
      const block: ToolResultBlockParam = {
        type: "tool_result",
        tool_use_id: m.tool_call_id ?? "",
        content: extractText(m.content),
      };
      if (last?.role === "user" && Array.isArray(last.content)) {
        (last.content as ContentBlockParam[]).push(block);
      } else {
        result.push({ role: "user", content: [block] });
      }
      continue;
    }

    if (m.role === "assistant" && m.tool_calls?.length) {
      // Assistant tool_calls → Anthropic assistant message with tool_use blocks
      const content: ContentBlockParam[] = [];
      if (m.content) content.push(...toAnthropicContent(m.content));
      for (const tc of m.tool_calls) {
        let input: Record<string, unknown> = {};
        try { input = JSON.parse(tc.function.arguments); } catch { /* fallback */ }
        content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
      }
      result.push({ role: "assistant", content });
      continue;
    }

    result.push({
      role: m.role as "user" | "assistant",
      content: toAnthropicContent(m.content),
    });
  }

  return result;
}

/** Convert OpenAI messages to Gemini contents, handling tool calls and results */
function toGeminiContents(messages: OpenAIMessage[]) {
  const result: { role: "user" | "model"; parts: object[] }[] = [];

  for (const m of messages) {
    if (m.role === "system") continue;

    if (m.role === "tool") {
      const last = result[result.length - 1];
      const part = {
        functionResponse: {
          name: m.name ?? "tool",
          response: { result: extractText(m.content) },
        },
      };
      if (last?.role === "user") {
        last.parts.push(part);
      } else {
        result.push({ role: "user", parts: [part] });
      }
      continue;
    }

    if (m.role === "assistant" && m.tool_calls?.length) {
      const parts = m.tool_calls.map((tc) => {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* fallback */ }
        return { functionCall: { name: tc.function.name, args } };
      });
      result.push({ role: "model", parts });
      continue;
    }

    result.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: toGeminiParts(m.content ?? ""),
    });
  }

  return result;
}

/** Convert Anthropic content blocks back to OpenAI tool_calls format */
function anthropicBlocksToOpenAI(content: ContentBlockParam[]): {
  text: string;
  tool_calls: OpenAIToolCall[];
} {
  let text = "";
  const tool_calls: OpenAIToolCall[] = [];
  for (const block of content) {
    if (block.type === "text") text += block.text;
    if (block.type === "tool_use") {
      const b = block as ToolUseBlock;
      tool_calls.push({
        id: b.id,
        type: "function",
        function: { name: b.name, arguments: JSON.stringify(b.input) },
      });
    }
  }
  return { text, tool_calls };
}

// ── Logging helper ───────────────────────────────────────────────────────────

async function logUsage(opts: {
  clientKey: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  status: number;
  isStream: boolean;
  requestPath: string;
  errorMessage?: string;
}) {
  await db.insert(apiUsageLogs).values({
    clientKey: opts.clientKey,
    provider: opts.provider,
    model: opts.model,
    promptTokens: opts.promptTokens,
    completionTokens: opts.completionTokens,
    totalTokens: opts.promptTokens + opts.completionTokens,
    latencyMs: opts.latencyMs,
    costUsd: estimateCost(opts.provider, opts.model, opts.promptTokens, opts.completionTokens),
    status: opts.status,
    isStream: opts.isStream,
    requestPath: opts.requestPath,
    errorMessage: opts.errorMessage,
  }).catch(() => {});
}

// ── Models list endpoint ──────────────────────────────────────────────────────
// Accessible at /proxy/v1/models (via /api) and /models (via /v1 mount)

router.get(["/proxy/v1/models", "/models"], proxyAuth, (_req: Request, res: Response) => {
  const now = Math.floor(Date.now() / 1000);
  res.json({
    object: "list",
    data: (SUPPORTED_MODELS as { id: string; provider: string }[]).map((m) => ({
      id: m.id,
      object: "model",
      created: now,
      owned_by: m.provider,
    })),
  });
});

// ── OpenAI Chat Completions endpoint ─────────────────────────────────────────
// Accessible at /proxy/v1/chat/completions (via /api) and /chat/completions (via /v1 mount)

router.post(["/proxy/v1/chat/completions", "/chat/completions"], proxyAuth, async (req: Request, res: Response) => {
  const clientKey = (req as Request & { proxyClientKey?: string }).proxyClientKey ?? "unknown";
  const rawBody = req.body as ChatCompletionBody;
  const { base: model, thinking } = parseThinkingModel(rawBody.model);
  const body = { ...rawBody, model };
  const { messages, stream = false } = body;

  if (!model || !messages) {
    res.status(400).json({ error: { message: "Missing model or messages", type: "invalid_request_error" } });
    return;
  }

  if (!isModelSupported(rawBody.model)) {
    req.log.warn({ clientKey, requestedModel: rawBody.model, stream }, "rejected unsupported model");
    res.status(404).json({
      error: {
        message: `Model '${rawBody.model}' is not supported. Call GET /v1/models for the list of available models.`,
        type: "model_not_found",
        code: "model_not_found",
      },
    });
    return;
  }

  const provider = detectProvider(model);
  const startTime = Date.now();
  const requestPath = "/proxy/v1/chat/completions";
  let promptTokens = 0;
  let completionTokens = 0;
  let status = 200;
  let errorMessage: string | undefined;

  req.log.info({ clientKey, model, provider, stream, thinking }, "proxy chat request");

  try {
    if (provider === "openai") {
      await handleOpenAI({ req, res: res as ProxyRes, body, model, stream });
    } else if (provider === "gemini") {
      await handleGemini({ req, res: res as ProxyRes, body, model, stream, thinking });
    } else if (provider === "openrouter") {
      await handleOpenRouter({ req, res: res as ProxyRes, body, model, stream });
    } else {
      await handleAnthropic({ req, res: res as ProxyRes, body, model, stream, thinking });
    }

    const latencyMs = Date.now() - startTime;
    const usage = (res as ProxyRes)._proxyUsage;
    if (usage) { promptTokens = usage.prompt; completionTokens = usage.completion; }

    await logUsage({ clientKey, provider, model, promptTokens, completionTokens, latencyMs, status, isStream: stream, requestPath });
    req.log.info({ clientKey, model, provider, latencyMs, promptTokens, completionTokens }, "proxy chat complete");
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const upstream = extractUpstreamError(err);
    status = upstream.status;
    errorMessage = upstream.message;
    req.log.error({ err, model, provider, upstreamStatus: upstream.status, upstreamMessage: upstream.message }, "proxy chat error");
    if (!res.headersSent) {
      res.status(upstream.status).json({
        error: { message: upstream.message, type: upstream.type, code: upstream.status },
      });
    }
    await logUsage({ clientKey, provider, model, promptTokens: 0, completionTokens: 0, latencyMs, status, isStream: stream, requestPath, errorMessage });
  }
});

// ── Anthropic-native Messages endpoint (/proxy/v1/messages or /messages) ─────
// Accepts Anthropic Messages API format, routes by model name.
// Clients targeting Claude API can point Base URL here with no changes.

router.post(["/proxy/v1/messages", "/messages"], proxyAuth, async (req: Request, res: Response) => {
  const clientKey = (req as Request & { proxyClientKey?: string }).proxyClientKey ?? "unknown";
  const body = req.body as {
    model: string;
    messages: MessageParam[];
    system?: string | TextBlockParam[];
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
    tools?: AnthropicTool[];
  };

  const { base: model, thinking } = parseThinkingModel(body.model);
  const provider = detectProvider(model);
  const stream = body.stream ?? false;
  const startTime = Date.now();
  const requestPath = "/proxy/v1/messages";
  let promptTokens = 0;
  let completionTokens = 0;
  let status = 200;
  let errorMessage: string | undefined;

  req.log.info({ clientKey, model, provider, stream }, "proxy messages request");

  // For Anthropic → pass through natively
  if (provider !== "anthropic") {
    // Convert Anthropic-format request to OpenAI-format messages then call appropriate handler
    // For simplicity, convert system to OpenAI system message and forward
    const systemText = typeof body.system === "string"
      ? body.system
      : (body.system ?? []).filter((b): b is TextBlockParam => b.type === "text").map((b) => b.text).join("\n");

    const openAIMsgs: OpenAIMessage[] = [
      ...(systemText ? [{ role: "system" as const, content: systemText }] : []),
      ...body.messages.map((m): OpenAIMessage => ({
        role: m.role,
        content: Array.isArray(m.content)
          ? m.content.filter((b) => b.type === "text").map((b) => (b as TextBlockParam).text).join("\n")
          : (m.content as string),
      })),
    ];

    const fakeBody: ChatCompletionBody = {
      model,
      messages: openAIMsgs,
      stream,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
    };

    try {
      if (provider === "openai") {
        res.setHeader("X-Proxy-Route", "openai");
        await handleOpenAI({ req, res: res as ProxyRes, body: fakeBody, model, stream });
      } else {
        res.setHeader("X-Proxy-Route", "gemini");
        await handleGemini({ req, res: res as ProxyRes, body: fakeBody, model, stream, thinking });
      }
      const usage = (res as ProxyRes)._proxyUsage;
      if (usage) { promptTokens = usage.prompt; completionTokens = usage.completion; }
    } catch (err) {
      const upstream = extractUpstreamError(err);
      status = upstream.status;
      errorMessage = upstream.message;
      req.log.error({ err, model, provider, upstreamStatus: upstream.status, upstreamMessage: upstream.message }, "proxy messages error");
      if (!res.headersSent) {
        res.status(upstream.status).json({ error: { message: upstream.message, type: upstream.type, code: upstream.status } });
      }
    }

    await logUsage({ clientKey, provider, model, promptTokens, completionTokens, latencyMs: Date.now() - startTime, status, isStream: stream, requestPath, errorMessage });
    return;
  }

  // Anthropic → native pass-through
  try {
    const systemContent: TextBlockParam[] | undefined = (() => {
      if (!body.system) return undefined;
      if (typeof body.system === "string") {
        return [{ type: "text", text: body.system, cache_control: { type: "ephemeral" } }];
      }
      return body.system.map((b) =>
        b.type === "text" ? { ...b, cache_control: { type: "ephemeral" } as const } : b
      ) as TextBlockParam[];
    })();

    const isOpus47 = model === "claude-opus-4-7";
    const requestedMaxTokens = body.max_tokens ?? 30000;
    const desiredBudget = Math.max(1024, Math.floor(requestedMaxTokens * 0.5));
    const effectiveMaxTokens = thinking.enabled && !isOpus47
      ? Math.max(requestedMaxTokens, desiredBudget + 1024)
      : requestedMaxTokens;
    const budgetTokens = Math.min(desiredBudget, effectiveMaxTokens - 1);

    const thinkingParam = thinking.enabled && !isOpus47
      ? { thinking: { type: "enabled" as const, budget_tokens: budgetTokens } }
      : {};

    const baseParams = {
      model,
      max_tokens: effectiveMaxTokens,
      messages: body.messages,
      ...(body.temperature !== undefined && !isOpus47 ? { temperature: body.temperature } : {}),
      ...(systemContent ? { system: systemContent } : {}),
      ...(body.tools ? { tools: body.tools } : {}),
      ...thinkingParam,
    };

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Accel-Buffering", "no");

      const streamResp = anthropic.messages.stream(baseParams);
      let pt = 0; let ct = 0;
      for await (const event of streamResp) {
        if (!thinking.visible && event.type === "content_block_start" && (event.content_block as { type: string }).type === "thinking") continue;
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        if (event.type === "message_start" && event.message.usage) pt = event.message.usage.input_tokens;
        if (event.type === "message_delta" && event.usage) ct = event.usage.output_tokens;
      }
      (res as ProxyRes)._proxyUsage = { prompt: pt, completion: ct };
      promptTokens = pt; completionTokens = ct;
      res.write("event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n");
      res.end();
    } else {
      const message = await anthropic.messages.create({ ...baseParams, stream: false });
      const filteredContent = thinking.visible ? message.content : message.content.filter((b) => b.type !== "thinking");
      promptTokens = message.usage.input_tokens;
      completionTokens = message.usage.output_tokens;
      (res as ProxyRes)._proxyUsage = { prompt: promptTokens, completion: completionTokens };
      res.json({ ...message, content: filteredContent });
    }
  } catch (err) {
    status = 500;
    errorMessage = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) res.status(500).json({ error: { message: errorMessage } });
  }

  await logUsage({ clientKey, provider, model, promptTokens, completionTokens, latencyMs: Date.now() - startTime, status, isStream: stream, requestPath, errorMessage });
});

// ── OpenAI handler ───────────────────────────────────────────────────────────

async function handleOpenAI({ req: _req, res, body, model, stream }: {
  req: Request; res: ProxyRes; body: ChatCompletionBody; model: string; stream: boolean;
}) {
  const messages = body.messages.map((m): ChatCompletionMessageParam => {
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.tool_call_id ?? "", content: extractText(m.content) };
    }
    if (m.role === "assistant" && m.tool_calls) {
      return { role: "assistant", content: m.content as string | null, tool_calls: m.tool_calls as ChatCompletionMessageParam["tool_calls"] };
    }
    return { role: m.role as "system" | "user" | "assistant", content: m.content as ChatCompletionMessageParam["content"] };
  });

  const baseParams: Parameters<typeof openai.chat.completions.create>[0] = {
    model,
    messages,
    ...(body.max_completion_tokens ? { max_completion_tokens: body.max_completion_tokens } : {}),
    ...(body.max_tokens ? { max_tokens: body.max_tokens } : {}),
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    ...(body.tools ? { tools: body.tools as Parameters<typeof openai.chat.completions.create>[0]["tools"] } : {}),
    ...(body.tool_choice ? { tool_choice: body.tool_choice as Parameters<typeof openai.chat.completions.create>[0]["tool_choice"] } : {}),
  };

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    const streamResp = await openai.chat.completions.create({ ...baseParams, stream: true });
    let pt = 0; let ct = 0;
    for await (const chunk of streamResp) {
      if (chunk.usage) { pt = chunk.usage.prompt_tokens ?? 0; ct = chunk.usage.completion_tokens ?? 0; }
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res._proxyUsage = { prompt: pt, completion: ct };
    res.write("data: [DONE]\n\n");
    res.end();
  } else {
    const completion = await openai.chat.completions.create({ ...baseParams, stream: false });
    res._proxyUsage = { prompt: completion.usage?.prompt_tokens ?? 0, completion: completion.usage?.completion_tokens ?? 0 };
    res.json(completion);
  }
}

// ── OpenRouter handler ────────────────────────────────────────────────────────
// Uses the OpenAI-compatible SDK pointed at the OpenRouter integration.
// The model ID received here carries the "openrouter/" prefix for client
// disambiguation; we strip it before forwarding to the OpenRouter API.

async function handleOpenRouter({ req: _req, res, body, model, stream }: {
  req: Request; res: ProxyRes; body: ChatCompletionBody; model: string; stream: boolean;
}) {
  // Strip the openrouter/ prefix → "openrouter/anthropic/claude-opus-4-5" → "anthropic/claude-opus-4-5"
  const upstreamModel = model.replace(/^openrouter\//, "");

  const messages = body.messages.map((m): ChatCompletionMessageParam => {
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.tool_call_id ?? "", content: extractText(m.content) };
    }
    if (m.role === "assistant" && m.tool_calls) {
      return { role: "assistant", content: m.content as string | null, tool_calls: m.tool_calls as ChatCompletionMessageParam["tool_calls"] };
    }
    return { role: m.role as "system" | "user" | "assistant", content: m.content as ChatCompletionMessageParam["content"] };
  });

  const baseParams: Parameters<typeof openrouter.chat.completions.create>[0] = {
    model: upstreamModel,
    messages,
    ...(body.max_completion_tokens ? { max_completion_tokens: body.max_completion_tokens } : {}),
    ...(body.max_tokens ? { max_tokens: body.max_tokens } : {}),
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    ...(body.tools ? { tools: body.tools as Parameters<typeof openrouter.chat.completions.create>[0]["tools"] } : {}),
    ...(body.tool_choice ? { tool_choice: body.tool_choice as Parameters<typeof openrouter.chat.completions.create>[0]["tool_choice"] } : {}),
  };

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    const streamResp = await openrouter.chat.completions.create({ ...baseParams, stream: true });
    let pt = 0; let ct = 0;
    for await (const chunk of streamResp) {
      if (chunk.usage) { pt = chunk.usage.prompt_tokens ?? 0; ct = chunk.usage.completion_tokens ?? 0; }
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res._proxyUsage = { prompt: pt, completion: ct };
    res.write("data: [DONE]\n\n");
    res.end();
  } else {
    const completion = await openrouter.chat.completions.create({ ...baseParams, stream: false });
    res._proxyUsage = { prompt: completion.usage?.prompt_tokens ?? 0, completion: completion.usage?.completion_tokens ?? 0 };
    res.json(completion);
  }
}

// ── Gemini handler ───────────────────────────────────────────────────────────

async function handleGemini({ req: _req, res, body, model, stream, thinking }: {
  req: Request; res: ProxyRes; body: ChatCompletionBody; model: string; stream: boolean; thinking: ThinkingConfig;
}) {
  const systemParts = body.messages
    .filter((m) => m.role === "system")
    .flatMap((m) => toGeminiParts(m.content ?? ""));

  const chatMessages = toGeminiContents(body.messages);

  const config: Record<string, unknown> = {
    maxOutputTokens: body.max_completion_tokens ?? body.max_tokens ?? 8192,
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    ...(systemParts.length > 0 ? { systemInstruction: { parts: systemParts } } : {}),
    ...(thinking.enabled ? { thinkingConfig: { thinkingBudget: -1 } } : {}),
  };

  const tools = body.tools?.length ? toGeminiTools(body.tools) : undefined;
  const completionId = `cmpl-gemini-${Date.now()}`;

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    const streamResp = await ai.models.generateContentStream({
      model, contents: chatMessages, config, ...(tools ? { tools } : {}),
    });

    let pt = 0; let ct = 0;
    let sawToolCall = false;

    // Initial role chunk (required by strict OpenAI-compatible clients)
    res.write(`data: ${JSON.stringify({
      id: completionId, object: "chat.completion.chunk", model,
      choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
    })}\n\n`);

    for await (const chunk of streamResp) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({
          id: completionId, object: "chat.completion.chunk", model,
          choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
        })}\n\n`);
      }
      // Function call chunks
      const fnCall = chunk.candidates?.[0]?.content?.parts?.find((p: { functionCall?: unknown }) => p.functionCall);
      if (fnCall) {
        sawToolCall = true;
        const fc = (fnCall as { functionCall: { name: string; args: unknown } }).functionCall;
        res.write(`data: ${JSON.stringify({
          id: completionId, object: "chat.completion.chunk", model,
          choices: [{ index: 0, delta: { tool_calls: [{ id: `tc-${Date.now()}`, type: "function", function: { name: fc.name, arguments: JSON.stringify(fc.args) } }] }, finish_reason: null }],
        })}\n\n`);
      }
      if (chunk.usageMetadata) { pt = chunk.usageMetadata.promptTokenCount ?? 0; ct = chunk.usageMetadata.candidatesTokenCount ?? 0; }
    }

    // Final chunk with finish_reason (required by strict OpenAI-compatible clients)
    res.write(`data: ${JSON.stringify({
      id: completionId, object: "chat.completion.chunk", model,
      choices: [{ index: 0, delta: {}, finish_reason: sawToolCall ? "tool_calls" : "stop" }],
    })}\n\n`);

    res._proxyUsage = { prompt: pt, completion: ct };
    res.write("data: [DONE]\n\n");
    res.end();
  } else {
    const result = await ai.models.generateContent({
      model, contents: chatMessages, config, ...(tools ? { tools } : {}),
    });

    const candidate = result.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    // Check for function calls in response
    const fnCalls = parts.filter((p: { functionCall?: unknown }) => p.functionCall);
    if (fnCalls.length > 0) {
      const tool_calls: OpenAIToolCall[] = fnCalls.map((p: { functionCall: { name: string; args: unknown } }, i: number) => ({
        id: `tc-gemini-${Date.now()}-${i}`,
        type: "function" as const,
        function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args) },
      }));
      const usage = result.usageMetadata;
      res._proxyUsage = { prompt: usage?.promptTokenCount ?? 0, completion: usage?.candidatesTokenCount ?? 0 };
      res.json({
        id: completionId, object: "chat.completion", model,
        choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls }, finish_reason: "tool_calls" }],
        usage: { prompt_tokens: usage?.promptTokenCount ?? 0, completion_tokens: usage?.candidatesTokenCount ?? 0, total_tokens: usage?.totalTokenCount ?? 0 },
      });
      return;
    }

    const text = result.text ?? "";
    const usage = result.usageMetadata;
    res._proxyUsage = { prompt: usage?.promptTokenCount ?? 0, completion: usage?.candidatesTokenCount ?? 0 };
    res.json({
      id: completionId, object: "chat.completion", model,
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
      usage: { prompt_tokens: usage?.promptTokenCount ?? 0, completion_tokens: usage?.candidatesTokenCount ?? 0, total_tokens: usage?.totalTokenCount ?? 0 },
    });
  }
}

// ── Anthropic handler ────────────────────────────────────────────────────────

async function handleAnthropic({ req: _req, res, body, model, stream, thinking }: {
  req: Request; res: ProxyRes; body: ChatCompletionBody; model: string; stream: boolean; thinking: ThinkingConfig;
}) {
  const systemParts = body.messages.filter((m) => m.role === "system");
  const systemText = systemParts.map((m) => extractText(m.content)).join("\n") || undefined;

  const anthropicSystem: TextBlockParam[] | undefined = systemText
    ? [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }]
    : undefined;

  const chatMessages = toAnthropicMessages(body.messages);
  const maxTokens = body.max_completion_tokens ?? body.max_tokens ?? 30000;
  const completionId = `cmpl-anthropic-${Date.now()}`;

  // claude-opus-4-7: doesn't support temperature/top_p, and uses adaptive thinking (no budget_tokens)
  const isOpus47 = model === "claude-opus-4-7";

  // budget_tokens must be >= 1024 and < max_tokens (Anthropic constraints)
  const desiredBudget = Math.max(1024, Math.floor(maxTokens * 0.5));
  const effectiveMaxTokens = thinking.enabled && !isOpus47
    ? Math.max(maxTokens, desiredBudget + 1024)
    : maxTokens;
  const budgetTokens = Math.min(desiredBudget, effectiveMaxTokens - 1);

  // For claude-opus-4-7, thinking can't be controlled via budget_tokens — model emits thinking blocks naturally.
  // We omit the thinking param entirely; the user still gets reasoning via thinking blocks (filtered unless visible).
  const thinkingParam = thinking.enabled && !isOpus47
    ? { thinking: { type: "enabled" as const, budget_tokens: budgetTokens } }
    : {};

  const baseParams = {
    model,
    max_tokens: effectiveMaxTokens,
    messages: chatMessages,
    ...(body.temperature !== undefined && !isOpus47 ? { temperature: body.temperature } : {}),
    ...(anthropicSystem ? { system: anthropicSystem } : {}),
    ...(body.tools ? { tools: toAnthropicTools(body.tools) } : {}),
    ...thinkingParam,
  };

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");

    const streamResp = anthropic.messages.stream(baseParams);
    let pt = 0; let ct = 0;
    let skipThinkingBlock = false;
    let finishReason: string = "stop";

    // Initial role chunk (required by strict OpenAI-compatible clients)
    res.write(`data: ${JSON.stringify({
      id: completionId, object: "chat.completion.chunk", model,
      choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
    })}\n\n`);

    for await (const event of streamResp) {
      if (event.type === "content_block_start") {
        skipThinkingBlock = !thinking.visible && (event.content_block as { type: string }).type === "thinking";
      }
      if (skipThinkingBlock) continue;

      // Translate Anthropic SSE to OpenAI SSE format
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        res.write(`data: ${JSON.stringify({
          id: completionId, object: "chat.completion.chunk", model,
          choices: [{ index: 0, delta: { content: event.delta.text }, finish_reason: null }],
        })}\n\n`);
      }
      if (event.type === "message_start" && event.message.usage) pt = event.message.usage.input_tokens;
      if (event.type === "message_delta" && event.usage) ct = event.usage.output_tokens;
      if (event.type === "message_delta" && event.delta.stop_reason) {
        const sr = event.delta.stop_reason;
        finishReason = sr === "end_turn" ? "stop" : sr === "max_tokens" ? "length" : sr === "tool_use" ? "tool_calls" : "stop";
      }
    }

    // Handle tool_use blocks from the final message
    const finalMsg = await streamResp.finalMessage().catch(() => null);
    let emittedToolCallFinish = false;
    if (finalMsg) {
      const toolUseBlocks = finalMsg.content.filter((b) => b.type === "tool_use") as ToolUseBlock[];
      if (toolUseBlocks.length > 0) {
        const tool_calls: OpenAIToolCall[] = toolUseBlocks.map((b) => ({
          id: b.id, type: "function",
          function: { name: b.name, arguments: JSON.stringify(b.input) },
        }));
        res.write(`data: ${JSON.stringify({
          id: completionId, object: "chat.completion.chunk", model,
          choices: [{ index: 0, delta: { tool_calls }, finish_reason: "tool_calls" }],
        })}\n\n`);
        emittedToolCallFinish = true;
      }
    }

    // Final chunk with finish_reason (required by strict OpenAI-compatible clients)
    if (!emittedToolCallFinish) {
      res.write(`data: ${JSON.stringify({
        id: completionId, object: "chat.completion.chunk", model,
        choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
      })}\n\n`);
    }

    res._proxyUsage = { prompt: pt, completion: ct };
    res.write("data: [DONE]\n\n");
    res.end();
  } else {
    const message = await anthropic.messages.create({ ...baseParams, stream: false });
    const { text, tool_calls } = anthropicBlocksToOpenAI(
      thinking.visible ? message.content as ContentBlockParam[] : message.content.filter((b) => b.type !== "thinking") as ContentBlockParam[]
    );

    res._proxyUsage = { prompt: message.usage.input_tokens, completion: message.usage.output_tokens };

    if (tool_calls.length > 0) {
      res.json({
        id: completionId, object: "chat.completion", model,
        choices: [{ index: 0, message: { role: "assistant", content: text || null, tool_calls }, finish_reason: "tool_calls" }],
        usage: { prompt_tokens: message.usage.input_tokens, completion_tokens: message.usage.output_tokens, total_tokens: message.usage.input_tokens + message.usage.output_tokens },
      });
    } else {
      res.json({
        id: completionId, object: "chat.completion", model,
        choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: message.stop_reason ?? "stop" }],
        usage: { prompt_tokens: message.usage.input_tokens, completion_tokens: message.usage.output_tokens, total_tokens: message.usage.input_tokens + message.usage.output_tokens },
      });
    }
  }
}

export default router;
