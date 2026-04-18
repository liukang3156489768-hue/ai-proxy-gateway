import { Rocket, CheckCircle2 } from "lucide-react";

const steps = [
  { step: "01", title: "Fork / Remix 项目", desc: "在 Replit 中 Remix 本项目，所有依赖自动安装。" },
  { step: "02", title: "配置 AI 集成", desc: "在 Replit AI Integrations 中启用 OpenAI、Anthropic、Gemini，费用计入 Replit Credits。" },
  { step: "03", title: "设置 Proxy Keys", desc: "在 Replit Secrets 中添加 PROXY_API_KEYS，多个 key 用英文逗号分隔。" },
  { step: "04", title: "启动服务", desc: "点击 Run 或 Deploy，API 服务器自动启动并监听请求。" },
  { step: "05", title: "验证连通性", desc: "使用 GET /api/healthz 验证服务在线；使用 Proxy Key 发送测试请求。" },
  { step: "06", title: "配置客户端", desc: "将 Base URL 设为 https://your-repl.replit.dev/proxy，填入 Proxy Key 作为 Bearer Token。" },
];

export default function Deploy() {
  return (
    <div className="px-6 py-6 max-w-[900px] mx-auto w-full space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded bg-blue-500" />
        <h2 className="text-base font-semibold text-white">部署指南</h2>
      </div>

      <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Rocket className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-medium text-white">快速部署步骤</span>
        </div>
        <div className="space-y-4">
          {steps.map((s) => (
            <div key={s.step} className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold font-mono text-blue-400">{s.step}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">{s.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] p-5">
        <p className="text-sm font-medium text-white mb-3">API 端点</p>
        <div className="space-y-2 font-mono text-xs">
          {[
            { method: "POST", path: "/proxy/v1/chat/completions", desc: "OpenAI 兼容聊天接口" },
            { method: "GET", path: "/api/healthz", desc: "健康检查" },
            { method: "GET", path: "/api/stats/summary", desc: "使用统计汇总" },
            { method: "GET", path: "/api/stats/usage-by-provider", desc: "按供应商统计" },
            { method: "GET", path: "/api/stats/models", desc: "支持模型列表" },
          ].map((ep) => (
            <div key={ep.path} className="flex items-center gap-3">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ep.method === "POST" ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"}`}>
                {ep.method}
              </span>
              <span className="text-slate-300">{ep.path}</span>
              <span className="text-slate-500">{ep.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <p className="text-xs text-emerald-300">所有 AI 服务商通过 Replit AI Integrations 接入，无需手动管理 API Key，费用自动计入 Replit Credits。</p>
      </div>
    </div>
  );
}
