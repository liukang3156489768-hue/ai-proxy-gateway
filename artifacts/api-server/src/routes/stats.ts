import { Router, type IRouter } from "express";
import { db, apiUsageLogs } from "@workspace/db";
import { sql, desc, count, sum, avg, gte } from "drizzle-orm";
import { SUPPORTED_MODELS } from "../lib/providers.js";

const router: IRouter = Router();

router.get("/stats/summary", async (req, res) => {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [allTime] = await db
    .select({
      totalRequests: count(),
      totalInputTokens: sum(apiUsageLogs.promptTokens),
      totalOutputTokens: sum(apiUsageLogs.completionTokens),
      totalTokens: sum(apiUsageLogs.totalTokens),
      totalCostUsd: sum(apiUsageLogs.costUsd),
      avgLatencyMs: avg(apiUsageLogs.latencyMs),
      successCount: sql<number>`count(*) filter (where ${apiUsageLogs.status} < 400)`,
      streamCount: sql<number>`count(*) filter (where ${apiUsageLogs.isStream} = true)`,
    })
    .from(apiUsageLogs);

  const [last24hData] = await db
    .select({
      requestsLast24h: count(),
      tokensLast24h: sum(apiUsageLogs.totalTokens),
      costLast24h: sum(apiUsageLogs.costUsd),
    })
    .from(apiUsageLogs)
    .where(gte(apiUsageLogs.createdAt, last24h));

  const totalRequests = Number(allTime?.totalRequests ?? 0);
  const successCount = Number(allTime?.successCount ?? 0);
  const failureCount = totalRequests - successCount;

  res.json({
    totalRequests,
    totalTokens: Number(allTime?.totalTokens ?? 0),
    totalInputTokens: Number(allTime?.totalInputTokens ?? 0),
    totalOutputTokens: Number(allTime?.totalOutputTokens ?? 0),
    totalCostUsd: Number(allTime?.totalCostUsd ?? 0),
    avgLatencyMs: Number(allTime?.avgLatencyMs ?? 0),
    successRate: totalRequests > 0 ? successCount / totalRequests : 1,
    successCount,
    failureCount,
    streamRequests: Number(allTime?.streamCount ?? 0),
    requestsLast24h: Number(last24hData?.requestsLast24h ?? 0),
    tokensLast24h: Number(last24hData?.tokensLast24h ?? 0),
    costLast24h: Number(last24hData?.costLast24h ?? 0),
  });
});

router.get("/stats/requests", async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
  const offset = Number(req.query["offset"] ?? 0);

  const [requests, [{ total }]] = await Promise.all([
    db
      .select()
      .from(apiUsageLogs)
      .orderBy(desc(apiUsageLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(apiUsageLogs),
  ]);

  res.json({
    requests: requests.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      clientKey: maskKey(r.clientKey),
    })),
    total: Number(total),
  });
});

router.get("/stats/usage-by-model", async (_req, res) => {
  const rows = await db
    .select({
      model: apiUsageLogs.model,
      provider: apiUsageLogs.provider,
      requestCount: count(),
      totalTokens: sum(apiUsageLogs.totalTokens),
      totalCostUsd: sum(apiUsageLogs.costUsd),
      avgLatencyMs: avg(apiUsageLogs.latencyMs),
    })
    .from(apiUsageLogs)
    .groupBy(apiUsageLogs.model, apiUsageLogs.provider)
    .orderBy(desc(count()));

  res.json(
    rows.map((r) => ({
      model: r.model,
      provider: r.provider,
      requestCount: Number(r.requestCount),
      totalTokens: Number(r.totalTokens ?? 0),
      totalCostUsd: Number(r.totalCostUsd ?? 0),
      avgLatencyMs: Number(r.avgLatencyMs ?? 0),
    }))
  );
});

router.get("/stats/usage-by-provider", async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT
      provider,
      count(*)::int                                                    AS request_count,
      count(*) filter (where is_stream = true)::int                   AS stream_count,
      count(*) filter (where status >= 400)::int                      AS error_count,
      coalesce(sum(prompt_tokens), 0)::int                            AS input_tokens,
      coalesce(sum(completion_tokens), 0)::int                        AS output_tokens,
      coalesce(sum(cost_usd), 0)::float                               AS total_cost_usd,
      coalesce(avg(latency_ms), 0)::float                             AS avg_latency_ms
    FROM api_usage_logs
    GROUP BY provider
    ORDER BY request_count DESC
  `);

  const arr = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? [];

  res.json(
    (arr as Array<{
      provider: string;
      request_count: number;
      stream_count: number;
      error_count: number;
      input_tokens: number;
      output_tokens: number;
      total_cost_usd: number;
      avg_latency_ms: number;
    }>).map((r) => ({
      provider: r.provider,
      requestCount: Number(r.request_count),
      streamCount: Number(r.stream_count),
      errorCount: Number(r.error_count),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      totalCostUsd: Number(r.total_cost_usd),
      avgLatencyMs: Number(r.avg_latency_ms),
    }))
  );
});

router.get("/stats/usage-over-time", async (_req, res) => {
  const result = await db.execute(sql`
    SELECT
      date_trunc('hour', created_at) AS hour,
      count(*)::int AS request_count,
      coalesce(sum(total_tokens), 0)::int AS total_tokens,
      coalesce(sum(cost_usd), 0)::float AS total_cost_usd
    FROM api_usage_logs
    WHERE created_at >= now() - interval '24 hours'
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];

  res.json(
    (rows as Array<{ hour: Date; request_count: number; total_tokens: number; total_cost_usd: number }>).map((r) => ({
      hour: r.hour instanceof Date ? r.hour.toISOString() : String(r.hour),
      requestCount: Number(r.request_count),
      totalTokens: Number(r.total_tokens),
      totalCostUsd: Number(r.total_cost_usd),
    }))
  );
});

router.get("/stats/models", (_req, res) => {
  res.json(SUPPORTED_MODELS);
});

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

export default router;
