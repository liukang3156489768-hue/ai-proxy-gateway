import { Router, type IRouter, Request, Response, NextFunction } from "express";
import { db, apiKeys } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

// ── Admin auth ────────────────────────────────────────────────────────────────
// Reads PROXY_API_KEYS env var; if empty, operates in open/bootstrap mode.
// Clients must send  Authorization: Bearer <master-key>  to access these routes.

const ADMIN_KEYS = (process.env["PROXY_API_KEYS"] ?? "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

function adminAuth(req: Request, res: Response, next: NextFunction): void {
  if (ADMIN_KEYS.length === 0) {
    next();
    return;
  }
  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token || !ADMIN_KEYS.includes(token)) {
    res.status(403).json({ error: { message: "Forbidden: invalid admin key", type: "auth_error" } });
    return;
  }
  next();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function generateKey(): { key: string; keyHash: string; keyPrefix: string } {
  const raw = crypto.randomBytes(24).toString("hex");
  const key = `sk-proxy-${raw}`;
  return {
    key,
    keyHash: hashKey(key),
    keyPrefix: key.slice(0, 18) + "...",
  };
}

function formatKey(k: typeof apiKeys.$inferSelect, includePlain = false) {
  return {
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    ...(includePlain ? { key: k.keyPlain ?? null } : {}),
    createdAt: k.createdAt.toISOString(),
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    isActive: k.isActive,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/keys", adminAuth, async (_req, res) => {
  const rows = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  // Include the full plaintext key (admin-authenticated endpoint), so the dashboard
  // can support "view forgotten key" + "copy full key" features.
  res.json(rows.map((r) => formatKey(r, true)));
});

router.post("/keys", adminAuth, async (req, res) => {
  const name = (req.body.name as string | undefined)?.trim();
  if (!name) {
    res.status(400).json({ error: { message: "name is required", type: "invalid_request_error" } });
    return;
  }

  const { key, keyHash, keyPrefix } = generateKey();
  const [inserted] = await db
    .insert(apiKeys)
    .values({ name, keyHash, keyPrefix, keyPlain: key })
    .returning();

  res.status(201).json({ ...formatKey(inserted!, true), key });
});

router.patch("/keys/:id/toggle", adminAuth, async (req, res) => {
  const id = parseInt(req.params["id"] ?? "");
  if (isNaN(id)) { res.status(400).json({ error: { message: "invalid id" } }); return; }

  const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
  if (!existing) { res.status(404).json({ error: { message: "Key not found" } }); return; }

  const [updated] = await db
    .update(apiKeys)
    .set({ isActive: !existing.isActive })
    .where(eq(apiKeys.id, id))
    .returning();

  res.json(formatKey(updated!));
});

router.delete("/keys/:id", adminAuth, async (req, res) => {
  const id = parseInt(req.params["id"] ?? "");
  if (isNaN(id)) { res.status(400).json({ error: { message: "invalid id" } }); return; }

  await db.delete(apiKeys).where(eq(apiKeys.id, id));
  res.json({ ok: true });
});

export { hashKey };
export default router;
