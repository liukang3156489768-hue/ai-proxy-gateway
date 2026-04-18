# AI Proxy Gateway

> 统一的 AI API 反代网关 — 完全兼容 OpenAI 格式，一个端点对接 OpenAI / Anthropic / Gemini 三大主流模型服务。

[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](https://github.com/liukang3156489768-hue/ai-proxy-gateway)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Stack](https://img.shields.io/badge/stack-pnpm%20monorepo-orange.svg)](https://pnpm.io/workspaces)

## ✨ 特性

- 🔌 **一个 API 端点，三家模型** — `/v1/chat/completions` 同时支持 OpenAI、Anthropic、Gemini
- 🎭 **完全 OpenAI 兼容** — 任何支持 OpenAI 格式的客户端（Cherry Studio / NextChat / ChatBox / OneAPI 等）都可直接接入
- 🧠 **流式 + 非流式** — 完整 SSE 流式响应，包含 `role` 起始帧和 `finish_reason` 终止帧，严格 OpenAI 客户端也能正确解析
- 🔧 **工具调用 (Function Calling)** — 三家模型统一翻译为 OpenAI tools 格式
- 🤔 **Anthropic Thinking** — 支持 Claude 4 系列扩展思考模式（可选显示思考内容）
- 🔑 **多客户端 Key 管理** — 自带管理面板，按 Key 统计调用次数、token、延迟、费用
- 📊 **实时仪表盘** — 中文 UI，调用日志、错误追踪、模型分布一目了然
- 💳 **基于 Replit Credits** — 通过 Replit AI Integrations 调用，无需自己持有上游 API Key

## 🏗️ 架构

```
┌───────────────┐
│  你的客户端    │ → OpenAI 格式请求
└───────┬───────┘
        │
        ↓ /v1/chat/completions
┌───────────────────────────────┐
│   AI Proxy Gateway (本项目)   │
│  • Bearer 鉴权 / 用量统计      │
│  • 模型路由 (按 model 名称)    │
│  • 请求/响应格式翻译          │
└──┬─────────────┬──────────────┘
   ↓             ↓             ↓
┌──────┐     ┌────────┐    ┌────────┐
│OpenAI│     │Anthropic│    │ Gemini │
└──────┘     └────────┘    └────────┘
```

## 📦 项目结构 (pnpm monorepo)

```
.
├── artifacts/
│   ├── api-server/         # Express API 网关 (端口由 PORT 决定)
│   ├── dashboard/          # React 管理面板 (Vite + Chakra UI)
│   └── mockup-sandbox/     # UI 组件预览
├── lib/
│   ├── api-spec/           # OpenAPI 规范 (TypeSpec)
│   ├── api-client-react/   # 自动生成的前端 SDK
│   ├── api-zod/            # Zod 校验 schema
│   ├── db/                 # Drizzle ORM + PostgreSQL schema
│   ├── integrations-openai-ai-server/    # OpenAI 客户端封装
│   ├── integrations-openai-ai-react/     # OpenAI React hooks
│   ├── integrations-anthropic-ai/        # Anthropic 客户端封装
│   └── integrations-gemini-ai/           # Gemini 客户端封装
└── package.json
```

## 🚀 在 Replit 上部署

1. **Fork 或 Import 本仓库到 Replit**
2. **配置三个 AI Integrations**（在 Replit 工作区）
   - `connector_openai`
   - `connector_anthropic`
   - `connector_gemini`
3. **创建数据库**：Replit 会自动注入 `DATABASE_URL`
4. **启动**：所有 workflow 已配置好，自动运行

## 🔑 使用方法

### 1. 在管理面板创建 Client Key
访问 dashboard → 创建客户端 → 生成 `sk-proxy-xxx` 格式的 Key

### 2. 在你的客户端配置
```
Base URL:  https://<your-repl>.replit.dev/v1
API Key:   sk-proxy-xxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ **Base URL 末尾不要加 `/`** —— Replit 边缘代理会对 `//` 路径返回 301 重定向，部分客户端不会跟随 POST 的 301。

### 3. 调用任意支持的模型
```bash
curl https://<your-repl>.replit.dev/v1/chat/completions \
  -H "Authorization: Bearer sk-proxy-xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4-5",
    "stream": true,
    "messages": [{"role":"user","content":"你好"}]
  }'
```

## 🧠 支持的模型

### OpenAI
`gpt-4o` · `gpt-4o-mini` · `gpt-4-turbo` · `o1` · `o1-mini` · `o3-mini` 等

### Anthropic Claude（Replit AI Integrations 限定）
`claude-opus-4-7` · `claude-opus-4-6` · `claude-opus-4-5` · `claude-opus-4-1`
`claude-sonnet-4-6` · `claude-sonnet-4-5`
`claude-haiku-4-5`

> ❌ 不支持旧版命名如 `claude-3-5-sonnet-20241022`，请使用上述新版名称。

### Gemini
`gemini-2.0-flash` · `gemini-2.0-flash-exp` · `gemini-1.5-pro` · `gemini-1.5-flash` 等

## 🔧 高级特性

### Anthropic Thinking 模式
```json
{
  "model": "claude-sonnet-4-6",
  "messages": [...],
  "thinking": { "enabled": true, "budget_tokens": 4096, "visible": false },
  "max_tokens": 8192
}
```
- `budget_tokens` 自动夹取在 `[1024, max_tokens-1]` 范围内
- `claude-opus-4-7` 自动剥离 `temperature/top_p/thinking` 参数（模型限制）

### 错误处理
- 上游 4xx/5xx 错误透传真实状态码 + 消息（不再统一吞为 500）
- 请求未支持模型时返回清晰的 404 `model_not_found`
- URL 含双斜杠时自动规范化（`/v1//chat/completions` → `/v1/chat/completions`）

## 📊 管理面板功能

- 客户端 Key 创建 / 启用 / 禁用
- 实时调用日志（请求体 / 响应体 / 延迟 / token / 费用）
- 按模型 / 按客户端的统计图表
- 错误追踪与详情查看

## 🛠️ 本地开发

```bash
pnpm install
pnpm --filter @workspace/db run db:push
pnpm --filter @workspace/api-server run dev    # 启动网关
pnpm --filter @workspace/dashboard run dev     # 启动管理面板
```

## 📝 版本说明

**v1.0.1** (当前版本)
- ✅ 修复 Anthropic streaming 缺失 `finish_reason` 终止帧
- ✅ 修复 thinking 模式 `budget_tokens` 边界问题
- ✅ `claude-opus-4-7` 自动剥离不兼容参数
- ✅ 请求前模型校验，未支持模型返回清晰 404
- ✅ 上游错误透传真实状态码
- ✅ URL 双斜杠自动规范化

## 📄 License

MIT
