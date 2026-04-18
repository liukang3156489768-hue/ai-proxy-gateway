import { useGetStatsSummary, getGetStatsSummaryQueryKey } from "@workspace/api-client-react";
import { formatLatency, formatNumber } from "@/lib/format";
import { Activity, Cpu, Clock, TrendingUp } from "lucide-react";

function MetricBox({ icon: Icon, label, value, color }: { icon: React.ComponentType<{className?: string}>; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}

export default function Monitor() {
  const { data: summary } = useGetStatsSummary({ query: { queryKey: getGetStatsSummaryQueryKey() } });

  return (
    <div className="px-6 py-6 max-w-[1200px] mx-auto w-full space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded bg-blue-500" />
        <h2 className="text-base font-semibold text-white">资源监控</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricBox
          icon={Activity}
          label="总请求数"
          value={formatNumber(summary?.totalRequests ?? 0)}
          color="text-blue-400"
        />
        <MetricBox
          icon={TrendingUp}
          label="近 24h 请求"
          value={formatNumber(summary?.requestsLast24h ?? 0)}
          color="text-cyan-400"
        />
        <MetricBox
          icon={Clock}
          label="平均响应时间"
          value={formatLatency(summary?.avgLatencyMs ?? 0)}
          color="text-violet-400"
        />
        <MetricBox
          icon={Cpu}
          label="成功率"
          value={`${Math.round((summary?.successRate ?? 1) * 100)}%`}
          color="text-emerald-400"
        />
      </div>

      <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] p-8 text-center">
        <Cpu className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-400">CPU / 内存监控</p>
        <p className="text-xs text-slate-600 mt-1">此功能在 Replit 托管环境中以基础系统指标呈现</p>
      </div>
    </div>
  );
}
