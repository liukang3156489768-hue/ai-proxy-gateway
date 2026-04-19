# AI Proxy Gateway

## 项目简介

统一 AI API 反代网关，当前版本 **v1.0.3**。

以单一 OpenAI 兼容接口（`/v1/chat/completions`）聚合 OpenAI、Anthropic、Gemini、OpenRouter 四路上游，内置中文管理面板、API 密钥管理、按客户端用量统计、实时日志、成本追踪。全量基于 Replit AI Integrations，无需配置任何第三方 API Key，费用自动走 Replit Credits。

---

## 版本历史

### v1.0.3（当前）
- **集群透传节点（Cluster Bare-Passthrough）**：新增 `/cluster/openai/*`、`/cluster/anthropic/*`、`/cluster/gemini/*`、`/cluster/openrouter/*` 裸透传路由，B 节点携带 proxy-key 过来，网关验证后替换为本地 Replit AI Token 再转发上游，实现跨节点配额互借。每次转发写入 `kind=lent-out` 账本并记录 `peerNodeId`。
- **OpenRouter 多模型支持**：接入 OpenRouter 作为第四路渠道，内置 8 个 `openrouter/anthropic/claude-*` 模型（haiku、sonnet、opus 及其最新版）。模型标识以 `openrouter/` 前缀区分直连 Anthropic 渠道。
- **DB 变更**：`api_usage_logs` 表新增 `kind`（默认 `proxy`，可选 `lent-out`）及 `peer_node_id` 可空字段。

### v1.0.2
- 完整 OpenAI 兼容路由（`/v1/chat/completions`、`/v1/models`）
- Anthropic Messages API 转换层（`/proxy/anthropic/v1/messages`）
- 中文管理面板：首页概览、API 密钥管理、用量统计、实时请求日志、模型列表、文档、部署说明
- API 密钥 CRUD + 限速/过期配置
- 按模型/提供商/时间维度统计

---

## 架构

```
/v1/*          → API Server（OpenAI 兼容入口）
/proxy/*       → API Server（各提供商原生格式透传）
/cluster/*     → API Server（集群节点裸透传，挂载于 body-parser 之前）
/api/*         → API Server（管理 REST API）
/              → Dashboard（React + Vite 中文管理面板）
```

---

## 技术栈

- **Monorepo 工具**：pnpm workspaces
- **Node.js 版本**：24
- **包管理器**：pnpm
- **TypeScript 版本**：5.9
- **API 框架**：Express 5
- **数据库**：PostgreSQL + Drizzle ORM
- **校验**：Zod (`zod/v4`)、`drizzle-zod`
- **API 代码生成**：Orval（基于 OpenAPI spec）
- **构建**：esbuild（CJS bundle）
- **前端**：React + Vite + Tailwind + shadcn/ui

---

## 常用命令

```bash
pnpm run typecheck                              # 全量类型检查
pnpm run build                                  # typecheck + 构建所有包
pnpm --filter @workspace/api-spec run codegen  # 从 OpenAPI spec 重新生成 hooks/Zod schema
pnpm --filter @workspace/db run push           # 推送 DB schema 变更（仅开发环境）
pnpm --filter @workspace/api-server run dev    # 本地运行 API Server
```

---

## 重要文件

| 文件 | 说明 |
|------|------|
| `artifacts/api-server/src/app.ts` | Express 应用入口，集群路由挂载在 body-parser 之前 |
| `artifacts/api-server/src/routes/proxy.ts` | `/v1/chat/completions` 路由 + 各提供商 handler |
| `artifacts/api-server/src/routes/cluster.ts` | 集群裸透传路由（5 个端点） |
| `artifacts/api-server/src/lib/providers.ts` | 全部支持模型列表（含 8 个 OpenRouter Claude 模型） |
| `artifacts/api-server/src/middlewares/proxyAuth.ts` | proxy-key 鉴权中间件 |
| `lib/db/src/schema/apiUsageLogs.ts` | 用量日志表（含 kind + peerNodeId 字段） |
| `lib/db/src/schema/apiKeys.ts` | API 密钥表 |
| `lib/api-spec/openapi.yaml` | OpenAPI 规范文件 |
| `artifacts/dashboard/src/pages/` | 各管理面板页面 |
