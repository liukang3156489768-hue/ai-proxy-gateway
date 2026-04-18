import { Code2, Database, Zap, Lock } from "lucide-react";

const sections = [
  {
    icon: Code2,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    title: "请求路由",
    items: [
      "模型名称前缀路由：gpt-* → OpenAI，claude-* → Anthropic，gemini-* → Gemini",
      "所有请求经 proxyAuth 中间件验证 Bearer Token",
      "支持流式（SSE）与非流式两种响应模式",
    ],
  },
  {
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "多模态支持",
    items: [
      "OpenAI 格式 image_url 自动转换：base64 data-URI 和 HTTP URL 均支持",
      "Gemini：image → inlineData（base64）/ fileData（URL）",
      "Anthropic：image → { type: 'image', source: { type: 'base64' | 'url' } }",
    ],
  },
  {
    icon: Database,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    title: "Prompt 缓存",
    items: [
      "OpenAI：支持缓存的模型（gpt-4o、gpt-4.1、o 系列）自动命中缓存，无需额外配置",
      "Anthropic Claude 3+：system prompt 自动添加 cache_control: ephemeral，相同 system 后续请求命中缓存",
      "Gemini：Context Caching 需要预缓存 API，当前版本暂未实现",
    ],
  },
  {
    icon: Lock,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    title: "认证与记录",
    items: [
      "支持 Authorization: Bearer <key>、x-goog-api-key: <key>、?key=<key> 三种认证方式",
      "所有请求写入 PostgreSQL api_usage_logs 表，记录模型、Token 用量、延迟、费用、状态",
      "KEY 在日志中自动脱敏（前4后4显示）",
    ],
  },
];

export default function Tech() {
  return (
    <div className="px-6 py-6 max-w-[900px] mx-auto w-full space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded bg-blue-500" />
        <h2 className="text-base font-semibold text-white">技术参考</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((s) => (
          <div key={s.title} className="rounded-lg border border-[#1e2d3d] bg-[#111827] p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              </div>
              <span className="text-sm font-medium text-white">{s.title}</span>
            </div>
            <ul className="space-y-2">
              {s.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-400">
                  <span className="text-slate-600 flex-shrink-0 mt-0.5">›</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] p-5">
        <p className="text-sm font-medium text-white mb-3">技术栈</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "运行时", value: "Node.js + TypeScript" },
            { label: "框架", value: "Express.js" },
            { label: "数据库", value: "PostgreSQL + Drizzle ORM" },
            { label: "前端", value: "React + Vite + Tailwind" },
            { label: "AI SDK", value: "OpenAI / Anthropic / Google GenAI" },
            { label: "打包", value: "esbuild" },
            { label: "API Spec", value: "OpenAPI 3.1 + orval codegen" },
            { label: "部署", value: "Replit" },
          ].map((t) => (
            <div key={t.label} className="bg-[#0d1117] rounded p-2">
              <p className="text-[10px] text-slate-500 mb-0.5">{t.label}</p>
              <p className="text-xs text-slate-300 font-mono">{t.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
