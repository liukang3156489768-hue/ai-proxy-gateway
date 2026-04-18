import { useEffect, useState } from "react";
import {
  useGetStatsSummary, getGetStatsSummaryQueryKey,
  useGetStatsUsageByProvider, getGetStatsUsageByProviderQueryKey,
  useGetStatsUsageOverTime, getGetStatsUsageOverTimeQueryKey,
} from "@workspace/api-client-react";

interface ClientUsage {
  clientKey: string;
  clientName: string;
  requestCount: number;
  errorCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  lastUsedAt: string | null;
}
import { formatK, formatCostShort, formatLatency, formatLatencyMs, formatNumber } from "@/lib/format";
import { RefreshCw, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";

const PROVIDER_COLORS: Record<string, string> = {
  gemini: "#3b82f6",
  anthropic: "#f97316",
  openai: "#22c55e",
};

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Gemini",
  anthropic: "Anthropic",
  openai: "OpenAI",
};

function MetricCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{icon}</span>
        <span className="text-xs text-slate-400 font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}

function SuccessCircle({ rate, success, failure }: { rate: number; success: number; failure: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(1, Math.max(0, rate)));
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-4">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={radius} fill="none"
          stroke="#22c55e" strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="44" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="monospace">
          {pct}%
        </text>
      </svg>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-slate-300">成功 <span className="font-mono font-semibold text-emerald-400">{success}</span></span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
          <span className="text-slate-300">失败 <span className="font-mono font-semibold text-red-400">{failure}</span></span>
        </div>
      </div>
    </div>
  );
}

export default function Stats() {
  const qc = useQueryClient();
  const [lastRefresh, setLastRefresh] = useState(() => new Date());

  const { data: summary } = useGetStatsSummary({ query: { queryKey: getGetStatsSummaryQueryKey() } });
  const { data: byProvider } = useGetStatsUsageByProvider({ query: { queryKey: getGetStatsUsageByProviderQueryKey() } });
  const { data: overTime } = useGetStatsUsageOverTime({ query: { queryKey: getGetStatsUsageOverTimeQueryKey() } });

  const [byClient, setByClient] = useState<ClientUsage[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`${window.location.origin}/api/stats/usage-by-client`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ClientUsage[]) => { if (!cancelled) setByClient(data); })
      .catch(() => { if (!cancelled) setByClient([]); });
    return () => { cancelled = true; };
  }, [lastRefresh]);

  const totalCalls = byProvider?.reduce((s, p) => s + p.requestCount, 0) ?? 0;
  const totalClientCalls = byClient.reduce((s, c) => s + c.requestCount, 0);

  const handleRefresh = () => {
    qc.invalidateQueries();
    setLastRefresh(new Date());
  };

  const handleReset = async () => {
    if (!confirm("确认清空所有统计数据吗？")) return;
    qc.invalidateQueries();
  };

  const formatHour = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, "0")}:00`;
  };

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="px-6 py-6 max-w-[1200px] mx-auto w-full space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded bg-blue-500" />
          <h2 className="text-base font-semibold text-white">统计面板</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono">更新于 {formatTime(lastRefresh)}</span>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600/80 hover:bg-red-600 text-white text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            重置
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="使用统计" icon="📊">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-500 mb-1">请求次数</p>
              <p className="text-2xl font-bold font-mono text-white">{formatNumber(summary?.totalRequests ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-1">流式请求</p>
              <p className="text-2xl font-bold font-mono text-cyan-400">{formatNumber(summary?.streamRequests ?? 0)}</p>
            </div>
          </div>
        </MetricCard>

        <MetricCard title="Token 用量" icon="⚡">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-500 mb-1">输入</p>
              <p className="text-2xl font-bold font-mono text-amber-400">{formatK(summary?.totalInputTokens ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-1">输出</p>
              <p className="text-2xl font-bold font-mono text-orange-400">{formatK(summary?.totalOutputTokens ?? 0)}</p>
            </div>
          </div>
        </MetricCard>

        <MetricCard title="预估开销" icon="💰">
          <div>
            <p className="text-[10px] text-slate-500 mb-1">总开销</p>
            <p className="text-2xl font-bold font-mono text-red-400">{formatCostShort(summary?.totalCostUsd ?? 0)}</p>
            <div className="flex gap-4 mt-2">
              <div>
                <p className="text-[10px] text-slate-500">输入</p>
                <p className="text-xs font-mono text-slate-400">{formatCostShort(0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">输出</p>
                <p className="text-xs font-mono text-slate-400">{formatCostShort(0)}</p>
              </div>
            </div>
          </div>
        </MetricCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="成功率" icon="✅">
          <SuccessCircle
            rate={summary?.successRate ?? 1}
            success={summary?.successCount ?? 0}
            failure={summary?.failureCount ?? 0}
          />
        </MetricCard>

        <MetricCard title="性能指标" icon="🎯">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-500 mb-1">平均耗时</p>
              <p className="text-2xl font-bold font-mono text-violet-400">{formatLatency(summary?.avgLatencyMs ?? 0)}</p>
              <div className="mt-2 h-1 rounded bg-violet-500/40" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-1">平均 TTFT</p>
              <p className="text-2xl font-bold font-mono text-blue-400">
                {summary?.avgLatencyMs ? formatLatency((summary.avgLatencyMs ?? 0) * 0.7) : "-"}
              </p>
              <div className="mt-2 h-1 rounded bg-blue-500/40" />
            </div>
          </div>
        </MetricCard>

        <MetricCard title="按供应商开销" icon="🪙">
          {!byProvider || byProvider.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {byProvider.map((p) => (
                <div key={p.provider} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PROVIDER_COLORS[p.provider] ?? "#94a3b8" }}
                    />
                    <span className="text-xs text-slate-300">{PROVIDER_LABELS[p.provider] ?? p.provider}</span>
                  </div>
                  <span className="text-xs font-mono text-red-400">{formatCostShort(p.totalCostUsd)}</span>
                </div>
              ))}
            </div>
          )}
        </MetricCard>
      </div>

      <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">📈</span>
          <span className="text-sm font-medium text-white">供应商调用分布</span>
        </div>
        {!byProvider || byProvider.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">暂无数据</p>
        ) : (
          <div className="space-y-3">
            {byProvider.map((p) => {
              const pct = totalCalls > 0 ? (p.requestCount / totalCalls) * 100 : 0;
              const color = PROVIDER_COLORS[p.provider] ?? "#94a3b8";
              return (
                <div key={p.provider} className="flex items-center gap-3" data-testid={`provider-bar-${p.provider}`}>
                  <div className="flex items-center gap-2 w-24 flex-shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs text-slate-300">{PROVIDER_LABELS[p.provider] ?? p.provider}</span>
                  </div>
                  <div className="flex-1 h-2 bg-[#1e2d3d] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono w-28 text-right flex-shrink-0">
                    <span className="text-slate-400">{p.requestCount} 次</span>
                    <span className="text-slate-500">{pct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {overTime && overTime.length > 0 && (
        <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">📉</span>
            <span className="text-sm font-medium text-white">近 24 小时请求量</span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overTime} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "6px", fontSize: "12px" }}
                  labelFormatter={formatHour}
                  formatter={(v: number) => [v, "请求数"]}
                />
                <Area type="monotone" dataKey="requestCount" stroke="#3b82f6" fill="url(#areaGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e2d3d]">
          <span className="text-base">👥</span>
          <span className="text-sm font-medium text-white">按客户端密钥统计消耗</span>
          <span className="ml-auto text-xs text-slate-500 font-mono">{byClient.length} 个客户端 · 共 {totalClientCalls} 次</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2d3d]">
                {["密钥名称", "请求", "错误", "输入 TOKEN", "输出 TOKEN", "总 TOKEN", "预估开销", "平均耗时", "最近使用"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-slate-500 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byClient.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-slate-500">暂无客户端调用数据</td>
                </tr>
              ) : (
                byClient.map((c) => (
                  <tr
                    key={c.clientKey}
                    className="border-b border-[#1e2d3d]/50 last:border-0 hover:bg-white/[0.02]"
                    data-testid={`client-row-${c.clientKey.slice(0, 8)}`}
                  >
                    <td className="px-4 py-3">
                      <span className="text-slate-200 font-medium">{c.clientName}</span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-white">{c.requestCount}</td>
                    <td className={`px-4 py-3 font-mono ${c.errorCount > 0 ? "text-red-400" : "text-slate-400"}`}>{c.errorCount}</td>
                    <td className="px-4 py-3 font-mono text-amber-400">{formatK(c.inputTokens)}</td>
                    <td className="px-4 py-3 font-mono text-orange-400">{formatK(c.outputTokens)}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{formatK(c.totalTokens)}</td>
                    <td className="px-4 py-3 font-mono text-red-400">{formatCostShort(c.totalCostUsd)}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{formatLatencyMs(c.avgLatencyMs)}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e2d3d]">
          <span className="text-base">📋</span>
          <span className="text-sm font-medium text-white">按供应商详细统计</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2d3d]">
                {["供应商", "调用", "流式", "错误", "输入 TOKEN", "输出 TOKEN", "预估开销", "平均耗时", "平均 TTFT"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-slate-500 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!byProvider || byProvider.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-slate-500">暂无数据</td>
                </tr>
              ) : (
                byProvider.map((p) => (
                  <tr key={p.provider} className="border-b border-[#1e2d3d]/50 last:border-0 hover:bg-white/[0.02]" data-testid={`provider-row-${p.provider}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PROVIDER_COLORS[p.provider] ?? "#94a3b8" }} />
                        <span className="text-slate-200 font-medium">{PROVIDER_LABELS[p.provider] ?? p.provider}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-white">{p.requestCount}</td>
                    <td className="px-4 py-3 font-mono text-cyan-400">{p.streamCount}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{p.errorCount}</td>
                    <td className="px-4 py-3 font-mono text-amber-400">{formatK(p.inputTokens)}</td>
                    <td className="px-4 py-3 font-mono text-orange-400">{formatK(p.outputTokens)}</td>
                    <td className="px-4 py-3 font-mono text-red-400">{formatCostShort(p.totalCostUsd)}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{formatLatencyMs(p.avgLatencyMs)}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">-</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
