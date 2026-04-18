import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { Zap, RefreshCw, Check, AlertCircle, ExternalLink, X } from "lucide-react";

const navItems = [
  { label: "概览", href: "/" },
  { label: "统计面板", href: "/stats" },
  { label: "模型管理", href: "/models" },
  { label: "密钥管理", href: "/keys" },
  { label: "系统设置", href: "/settings" },
  { label: "部署指南", href: "/deploy" },
  { label: "技术参考", href: "/tech" },
  { label: "实时日志", href: "/logs" },
  { label: "项目文档", href: "/docs" },
];

const BUILD_DATE = "2026-04-18";
const VERSION = "v1.0.1";

interface VersionCheckResult {
  ok: boolean;
  current: string;
  latest?: string;
  hasUpdate?: boolean;
  message?: string;
  latestCommit?: { shortSha: string; message: string; date: string; url: string };
  repoUrl?: string;
}

function UpdateModal({ result, loading, onClose }: { result: VersionCheckResult | null; loading: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#111827] border border-[#1e2d3d] rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-400" />
            版本检查
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">
            <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-blue-400" />
            正在检查 GitHub 仓库…
          </div>
        ) : !result ? (
          <p className="text-sm text-slate-500">未获取到结果</p>
        ) : !result.ok ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-amber-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{result.message ?? "检查失败"}</span>
            </div>
            <p className="text-xs text-slate-400">当前版本：<span className="font-mono text-slate-200">{result.current}</span></p>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className={`flex items-center gap-2 ${result.hasUpdate ? "text-amber-400" : "text-emerald-400"}`}>
              {result.hasUpdate ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              <span className="font-medium">
                {result.hasUpdate ? "发现新版本" : "已是最新版本"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs bg-[#0d1117] border border-[#1e2d3d] rounded-lg p-3">
              <div>
                <p className="text-slate-500 mb-1">当前版本</p>
                <p className="font-mono text-slate-200">{result.current}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">最新版本</p>
                <p className={`font-mono ${result.hasUpdate ? "text-amber-400" : "text-emerald-400"}`}>{result.latest}</p>
              </div>
            </div>
            {result.latestCommit && (
              <div className="bg-[#0d1117] border border-[#1e2d3d] rounded-lg p-3 space-y-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">最新提交</p>
                <p className="text-xs text-slate-200 break-words">{result.latestCommit.message}</p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {result.latestCommit.shortSha} · {new Date(result.latestCommit.date).toLocaleString("zh-CN")}
                </p>
              </div>
            )}
            {result.repoUrl && (
              <a
                href={result.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                查看 GitHub 仓库
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TopNav() {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  const isOnline = health?.status === "ok";

  const [modalOpen, setModalOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VersionCheckResult | null>(null);

  const checkUpdate = async () => {
    setModalOpen(true);
    setChecking(true);
    setResult(null);
    try {
      const resp = await fetch(`${window.location.origin}/api/version/check`);
      const data = (await resp.json()) as VersionCheckResult;
      setResult(data);
    } catch (err) {
      setResult({
        ok: false,
        current: VERSION,
        message: err instanceof Error ? err.message : "网络错误",
      });
    } finally {
      setChecking(false);
    }
  };

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
          <button
            onClick={checkUpdate}
            disabled={checking}
            data-testid="button-check-update"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#1e2d3d] text-xs text-slate-300 hover:bg-[#1e2d3d] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${checking ? "animate-spin" : ""}`} />
            {checking ? "检查中…" : "检查更新"}
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
      {modalOpen && (
        <UpdateModal result={result} loading={checking} onClose={() => setModalOpen(false)} />
      )}
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
