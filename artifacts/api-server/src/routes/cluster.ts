/**
 * Cluster bare-passthrough endpoints (B-node side)
 *
 * Exposes node quota to peer A-nodes under /cluster/*.
 * Validates client proxy key, swaps it for the local Replit AI integration
 * token, and forwards the request verbatim to the upstream provider.
 * Writes a kind=lent-out ledger entry for every request.
 *
 * Contract (永久冻结):
 *   /cluster/openai/*              → OpenAI / Replit AI proxy   (base URL already has /v1)
 *   /cluster/anthropic/v1/*        → Anthropic / Replit AI proxy (keep /v1)
 *   /cluster/gemini/models/*       → Gemini / Replit AI proxy   (base URL already has /v1beta)
 *   /cluster/gemini/upload/v1beta/files/*
 *                                  → Gemini upload               (strip /v1beta, keep /upload)
 *   /cluster/openrouter/api/v1/*   → OpenRouter / Replit AI proxy (keep /api/v1)
 */

import { Router, Request, Response, NextFunction } from "express";
import { proxyAuth } from "../middlewares/proxyAuth.js";
import { db, apiUsageLogs } from "@workspace/db";

const router = Router();

// ── Provider credentials (loaded once at startup) ───────────────────────────

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

const OPENAI_BASE = stripTrailingSlash(process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] ?? "");
const OPENAI_KEY = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "";

const ANTHROPIC_BASE = stripTrailingSlash(process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"] ?? "");
const ANTHROPIC_KEY = process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"] ?? "";

const GEMINI_BASE = stripTrailingSlash(process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"] ?? "");
const GEMINI_KEY = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"] ?? "";

const OPENROUTER_BASE = stripTrailingSlash(process.env["AI_INTEGRATIONS_OPENROUTER_BASE_URL"] ?? "");
const OPENROUTER_KEY = process.env["AI_INTEGRATIONS_OPENROUTER_API_KEY"] ?? "";

// ── Raw body capture (must run before express.json() consumes the stream) ───
// cluster.ts is mounted in app.ts BEFORE the JSON body-parser middleware.

export function rawBodyCapture(req: Request, _res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    (req as Request & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
    next();
  });
  req.on("error", next);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractModel(rawBody: Buffer | undefined): string {
  if (!rawBody || rawBody.length === 0) return "unknown";
  try {
    const parsed = JSON.parse(rawBody.toString("utf8")) as { model?: string };
    return typeof parsed.model === "string" ? parsed.model : "unknown";
  } catch {
    return "unknown";
  }
}

function buildQueryString(req: Request): string {
  const qi = req.url.indexOf("?");
  return qi !== -1 ? req.url.slice(qi) : "";
}

type Provider = "openai" | "anthropic" | "gemini" | "openrouter";

interface ForwardOptions {
  upstreamUrl: string;
  /** Authorization header value to send upstream, e.g. "Bearer sk-..." */
  authBearer?: string;
  /** x-goog-api-key value (Gemini) */
  googApiKey?: string;
  provider: Provider;
}

async function forwardRequest(req: Request, res: Response, opts: ForwardOptions): Promise<void> {
  const { upstreamUrl, authBearer, googApiKey, provider } = opts;
  const startTime = Date.now();

  const peerNodeId =
    (req.headers["x-peer-node-id"] as string | undefined) ??
    (req.headers["origin"] as string | undefined) ??
    "unknown";
  const clientKey = (req as Request & { proxyClientKey?: string }).proxyClientKey ?? "unknown";
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const model = extractModel(rawBody);
  const isStream = req.headers["accept"] === "text/event-stream";

  // Build upstream headers: bare passthrough, swap auth
  const upstreamHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    // Skip hop-by-hop and connection-management headers
    if (
      key === "host" ||
      key === "connection" ||
      key === "keep-alive" ||
      key === "proxy-authenticate" ||
      key === "proxy-authorization" ||
      key === "te" ||
      key === "trailers" ||
      key === "transfer-encoding" ||
      key === "upgrade" ||
      key === "content-length" // will be recalculated
    ) {
      continue;
    }
    // Strip client-facing auth — we inject the provider token below
    if (key === "authorization" || key === "x-goog-api-key") continue;
    upstreamHeaders[key] = Array.isArray(value) ? value.join(", ") : (value ?? "");
  }

  // Inject provider credentials
  if (authBearer) upstreamHeaders["authorization"] = `Bearer ${authBearer}`;
  if (googApiKey) upstreamHeaders["x-goog-api-key"] = googApiKey;

  // Body: raw buffer forwarded verbatim
  let upstreamBody: Buffer | undefined;
  if (rawBody && rawBody.length > 0) {
    upstreamBody = rawBody;
    upstreamHeaders["content-length"] = rawBody.length.toString();
  }

  let status = 500;
  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers: upstreamHeaders,
      body: upstreamBody as unknown as BodyInit | undefined,
      // @ts-expect-error Node.js fetch supports duplex for streaming
      duplex: "half",
    });

    status = upstreamRes.status;

    // Forward response status + headers bare
    res.status(upstreamRes.status);
    for (const [key, value] of upstreamRes.headers.entries()) {
      if (key === "transfer-encoding") continue;
      res.setHeader(key, value);
    }

    // Stream response body
    if (upstreamRes.body) {
      const reader = upstreamRes.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
    }
    res.end();
  } catch (err) {
    status = 500;
    if (!res.headersSent) {
      res.status(500).json({
        error: { message: String(err), type: "cluster_proxy_error", code: 500 },
      });
    }
  } finally {
    const latencyMs = Date.now() - startTime;
    db.insert(apiUsageLogs)
      .values({
        clientKey: `peer:${peerNodeId}/${clientKey}`,
        provider,
        model,
        latencyMs,
        status,
        isStream,
        requestPath: req.originalUrl,
        kind: "lent-out",
        peerNodeId,
      })
      .catch(() => {});
  }
}

// ── Route: OpenAI ─────────────────────────────────────────────────────────────
// /cluster/openai/*  →  ${OPENAI_BASE}/*
// OPENAI_BASE already contains /v1; cluster path has no /v1 prefix.
// Use router.use() (not router.all()) to avoid path-to-regexp v8 wildcard issues.
router.use("/openai", proxyAuth, async (req: Request, res: Response) => {
  const subPath = req.path || "/";
  const qs = buildQueryString(req);
  const upstreamUrl = `${OPENAI_BASE}${subPath}${qs}`;
  await forwardRequest(req, res, { upstreamUrl, authBearer: OPENAI_KEY, provider: "openai" });
});

// ── Route: Anthropic ──────────────────────────────────────────────────────────
// /cluster/anthropic/v1/*  →  ${ANTHROPIC_BASE}/v1/*
// Path retains /v1; ANTHROPIC_BASE has no version suffix.
router.use("/anthropic", proxyAuth, async (req: Request, res: Response) => {
  const subPath = req.path || "/";
  const qs = buildQueryString(req);
  const upstreamUrl = `${ANTHROPIC_BASE}${subPath}${qs}`;
  await forwardRequest(req, res, {
    upstreamUrl,
    authBearer: ANTHROPIC_KEY,
    provider: "anthropic",
  });
});

// ── Route: Gemini upload ───────────────────────────────────────────────────────
// /cluster/gemini/upload/v1beta/files/*
//   strip /v1beta → prepend /upload → ${GEMINI_BASE}/upload/files/*
// Must be registered BEFORE the /gemini catch-all below.
router.use("/gemini/upload", proxyAuth, async (req: Request, res: Response) => {
  // req.path here is /v1beta/files/... — strip /v1beta, prepend /upload
  const afterV1beta = (req.path || "/").replace(/^\/v1beta/, "");
  const subPath = `/upload${afterV1beta}`;
  const qs = buildQueryString(req);
  const upstreamUrl = `${GEMINI_BASE}${subPath}${qs}`;
  await forwardRequest(req, res, { upstreamUrl, googApiKey: GEMINI_KEY, provider: "gemini" });
});

// ── Route: Gemini chat ─────────────────────────────────────────────────────────
// /cluster/gemini/models/*  →  ${GEMINI_BASE}/models/*
// GEMINI_BASE already contains /v1beta; cluster path has no /v1beta prefix.
router.use("/gemini", proxyAuth, async (req: Request, res: Response) => {
  const subPath = req.path || "/";
  const qs = buildQueryString(req);
  const upstreamUrl = `${GEMINI_BASE}${subPath}${qs}`;
  await forwardRequest(req, res, { upstreamUrl, googApiKey: GEMINI_KEY, provider: "gemini" });
});

// ── Route: OpenRouter ──────────────────────────────────────────────────────────
// /cluster/openrouter/api/v1/*  →  ${OPENROUTER_BASE}/api/v1/*
// Path retains /api/v1; OPENROUTER_BASE has no /api/v1 suffix.
router.use("/openrouter", proxyAuth, async (req: Request, res: Response) => {
  const subPath = req.path || "/";
  const qs = buildQueryString(req);
  const upstreamUrl = `${OPENROUTER_BASE}${subPath}${qs}`;
  await forwardRequest(req, res, { upstreamUrl, authBearer: OPENROUTER_KEY, provider: "openrouter" });
});

export default router;
