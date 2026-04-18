# AI Proxy Gateway

## Overview

统一 AI API 反代网关，整合 OpenAI / Anthropic / Gemini，完全兼容 OpenAI 格式。基于 Replit pnpm monorepo 构建，通过 Replit AI Integrations 接入各服务商（费用走 Replit Credits，无需自备 API Key）。

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + Recharts + Wouter

## Artifacts

- `artifacts/api-server` — Express API 服务（代理 + 统计 + 密钥管理），监听 `/api` 和 `/v1`
- `artifacts/dashboard` — React + Vite 管理面板（10 个功能页），监听 `/`

## Key Libs

- `lib/db` — Drizzle ORM schema (apiKeys, apiUsageLogs, conversations, messages)
- `lib/integrations-openai-ai-server` — OpenAI AI Integrations 封装（服务端）
- `lib/integrations-anthropic-ai` — Anthropic AI Integrations 封装
- `lib/integrations-gemini-ai` — Gemini AI Integrations 封装
- `lib/api-client-react` — 前端 React Query hooks (by Orval)
- `lib/api-spec` — OpenAPI spec 源文件 + Orval config

## Environment Variables (Secrets)

- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — PostgreSQL (auto)
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI via Replit
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — Anthropic via Replit
- `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY` — Gemini via Replit
- `SESSION_SECRET` — 会话加密密钥
- `PROXY_API_KEYS` — 主密钥（可选，留空则 Bootstrap 模式）

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/dashboard run dev` — run dashboard locally

## API Endpoints

- `GET /v1/models` — 获取支持的模型列表
- `POST /v1/chat/completions` — OpenAI 兼容对话
- `POST /v1/messages` — Anthropic 原生格式对话
- `GET /api/healthz` — 健康检查
- `GET /api/stats` — 请求统计
- `GET /api/keys` — 密钥管理

## 已知问题修复记录

- **2026-04-18**: 修复 Anthropic 思考模式（thinking）调用失败问题
  - `claude-opus-4-5/4-6/4-1/sonnet/haiku` 思考变体：`budget_tokens` 强制 ≥ 1024 且小于 `max_tokens`
  - `claude-opus-4-7`：不支持 `temperature`/`top_p`/`top_k` 参数及显式 `budget_tokens`，自动剥离这些字段
