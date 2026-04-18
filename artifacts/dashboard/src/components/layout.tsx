import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { Zap, RefreshCw } from "lucide-react";

const navItems = [
  { label: "概览", href: "/" },
  { label: "统计面板", href: "/stats" },
  { label: "资源监控", href: "/monitor" },
  { label: "模型管理", href: "/models" },
  { label: "密钥管理", href: "/keys" },
  { label: "系统设置", href: "/settings" },
  { label: "部署指南", href: "/deploy" },
  { label: "技术参考", href: "/tech" },
  { label: "实时日志", href: "/logs" },
  { label: "项目文档", href: "/docs" },
];

const BUILD_DATE = "2026-04-17";
const VERSION = "v1.0";

export function TopNav() {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  const isOnline = health?.status === "ok";

  return (
    <header className="w-full border-b border-[#1e2d3d] bg-[#0d1117] sticky top-0 z-50">
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(139,92,246,0.5)]">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-lg leading-none">AI Proxy Gateway</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600/80 text-white font-mono font-semibold">{VERSION}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">构建时间：{BUILD_DATE}</div>
          </div>
        </div>

        <p className="hidden lg:block text-xs text-slate-400 flex-1 text-center px-4 truncate">
          统一 AI API 代理网关 · 整合 OpenAI / Anthropic / Gemini · 完全兼容 OpenAI 格式
        </p>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#1e2d3d] text-xs text-slate-300 hover:bg-[#1e2d3d] transition-colors">
            <RefreshCw className="w-3 h-3" />
            检查更新
          </button>
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium ${isOnline ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-red-400"}`} />
            {isOnline ? "在线" : "离线"}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" />
            已认证
          </div>
        </div>
      </div>

      <nav className="px-6 flex items-center gap-0 overflow-x-auto scrollbar-none">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`relative px-4 py-2.5 text-sm whitespace-nowrap cursor-pointer transition-colors border-b-2 ${
                  isActive
                    ? "text-white border-blue-500 bg-blue-500/5"
                    : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5"
                }`}
                data-testid={`nav-${item.href.replace("/", "") || "home"}`}
              >
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-200 selection:bg-blue-500/30 selection:text-blue-200">
      <TopNav />
      <main className="min-h-[calc(100vh-89px)]">
        {children}
      </main>
    </div>
  );
}
