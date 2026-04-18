import { useState } from "react";
import { Key, Shield, Globe, Sliders, Copy, Check, Link2 } from "lucide-react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="复制"
      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all flex-shrink-0 ${
        copied
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : "bg-[#1e2d3d] text-slate-400 border border-[#2d3f53] hover:text-slate-200 hover:border-[#3d5070]"
      }`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "已复制" : "复制"}
    </button>
  );
}

function ApiEndpointRow({ label, url, description }: { label: string; url: string; description: string }) {
  return (
    <div className="flex items-start gap-4 px-5 py-4 hover:bg-white/[0.02] border-b border-[#1e2d3d] last:border-0">
      <div className="w-8 h-8 rounded bg-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Link2 className="w-4 h-4 text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
        <p className="text-xs text-slate-500 mb-2">{description}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono text-violet-300 bg-[#0d1117] border border-[#1e2d3d] rounded px-3 py-1.5 truncate">
            {url}
          </code>
          <CopyButton text={url} />
        </div>
      </div>
    </div>
  );
}

interface SettingRow {
  label: string;
  description: string;
  value: string;
  badge?: string;
}

const settings: SettingRow[] = [
  {
    label: "Proxy Keys",
    description: "用于客户端 Bearer 认证的密钥列表，多个 key 用逗号分隔",
    value: "在 Replit Secrets 中配置 PROXY_API_KEYS",
    badge: "已配置",
  },
  {
    label: "OpenAI 集成",
    description: "通过 Replit AI Integrations 接入 OpenAI，费用计入 Replit Credits",
    value: "AI Integrations 自动管理",
    badge: "自动",
  },
  {
    label: "Anthropic 集成",
    description: "通过 Replit AI Integrations 接入 Anthropic Claude，费用计入 Replit Credits",
    value: "AI Integrations 自动管理",
    badge: "自动",
  },
  {
    label: "Gemini 集成",
    description: "通过 Replit AI Integrations 接入 Google Gemini，费用计入 Replit Credits",
    value: "AI Integrations 自动管理",
    badge: "自动",
  },
  {
    label: "Claude 默认输出 Token",
    description: "Claude 系列模型默认 max_tokens，调用方可通过参数覆盖",
    value: "30,000 tokens",
    badge: "已设置",
  },
  {
    label: "Anthropic Prompt 缓存",
    description: "对 Claude 3+ 系列的 system prompt 自动开启 prompt caching，相同 system 的后续请求命中缓存",
    value: "自动启用（system prompt cache_control: ephemeral）",
    badge: "启用",
  },
];

const icons = [Key, Shield, Globe, Globe, Sliders, Sliders];

export default function Settings() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const endpoints = [
    {
      label: "Base URL（OpenAI SDK 配置项）",
      url: `${origin}/proxy/v1`,
      description: "在 OpenAI SDK 或兼容客户端中将 base_url 设为此地址，配合 Proxy Key 即可接入所有模型",
    },
    {
      label: "聊天补全端点",
      url: `${origin}/proxy/v1/chat/completions`,
      description: "OpenAI 兼容的 /chat/completions 接口，支持流式输出（stream: true）与非流式两种模式",
    },
    {
      label: "健康检查",
      url: `${origin}/api/healthz`,
      description: "返回服务在线状态，可用于监控探针或连通性测试",
    },
    {
      label: "统计汇总",
      url: `${origin}/api/stats/summary`,
      description: "返回全量请求统计、Token 用量、费用及延迟汇总数据（JSON）",
    },
    {
      label: "按供应商统计",
      url: `${origin}/api/stats/usage-by-provider`,
      description: "返回按 OpenAI / Anthropic / Gemini 分组的详细调用统计",
    },
    {
      label: "支持模型列表",
      url: `${origin}/api/stats/models`,
      description: "返回当前代理支持的所有模型及定价信息（JSON 数组）",
    },
  ];

  return (
    <div className="px-6 py-6 max-w-[900px] mx-auto w-full space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded bg-blue-500" />
        <h2 className="text-base font-semibold text-white">系统设置</h2>
      </div>

      <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#1e2d3d] bg-[#0f1923]">
          <Link2 className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-white">API 接入链接</span>
          <span className="ml-auto text-[10px] text-slate-500 font-mono">需携带 Authorization: Bearer &lt;proxy-key&gt;</span>
        </div>
        {endpoints.map((ep) => (
          <ApiEndpointRow key={ep.label} {...ep} />
        ))}
      </div>

      <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] overflow-hidden divide-y divide-[#1e2d3d]">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#1e2d3d] bg-[#0f1923]">
          <Sliders className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">运行配置</span>
        </div>
        {settings.map((s, i) => {
          const Icon = icons[i] ?? Key;
          return (
            <div key={s.label} className="flex items-start gap-4 px-5 py-4 hover:bg-white/[0.02]">
              <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{s.label}</span>
                  {s.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                      {s.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                <p className="text-xs text-slate-400 font-mono mt-1">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
