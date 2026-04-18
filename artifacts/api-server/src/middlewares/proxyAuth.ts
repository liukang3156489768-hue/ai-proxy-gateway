import { Request, Response, NextFunction } from "express";
import { db, apiKeys } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const PROXY_API_KEYS = (process.env["PROXY_API_KEYS"] ?? "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function extractToken(req: Request): string {
  // 1. Authorization: Bearer <token>
  const auth = req.headers["authorization"] ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();

  // 2. x-goog-api-key header (used by Gemini clients)
  const xGoog = req.headers["x-goog-api-key"];
  if (typeof xGoog === "string" && xGoog.trim()) return xGoog.trim();

  // 3. ?key= URL query parameter
  const keyParam = req.query["key"];
  if (typeof keyParam === "string" && keyParam.trim()) return keyParam.trim();

  return "";
}

export async function proxyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: { message: "Missing API key. Provide via Authorization: Bearer, x-goog-api-key header, or ?key= param.", type: "auth_error", code: 401 },
    });
    return;
  }

  // Fast path: check env var master keys
  if (PROXY_API_KEYS.length > 0 && PROXY_API_KEYS.includes(token)) {
    (req as Request & { proxyClientKey: string }).proxyClientKey = token;
    next();
    return;
  }

  // DB path: check dynamically generated keys
  try {
    const hash = hashKey(token);
    const [dbKey] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.isActive, true)));

    if (dbKey) {
      db.update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, dbKey.id))
        .catch(() => {});
      (req as Request & { proxyClientKey: string }).proxyClientKey = dbKey.name;
      next();
      return;
    }
  } catch {
    // DB error: fall through
  }

  // Bootstrap mode: no static keys AND no DB keys → allow through
  if (PROXY_API_KEYS.length === 0) {
    try {
      const allKeys = await db.select().from(apiKeys);
      if (allKeys.length === 0) {
        (req as Request & { proxyClientKey: string }).proxyClientKey = "anonymous";
        next();
        return;
      }
    } catch {
      // ignore
    }
  }

  res.status(403).json({ error: { message: "Invalid API key.", type: "auth_error", code: 403 } });
}
