import { useState } from "react";
import { useGetStatsRequests, getGetStatsRequestsQueryKey } from "@workspace/api-client-react";
import { formatCostShort, formatNumber, formatLatencyMs } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";

const LIMIT = 50;

const PROVIDER_COLORS: Record<string, string> = {
  gemini: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  anthropic: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  openai: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function Logs() {
  const [page, setPage] = useState(0);
  const offset = page * LIMIT;

  const { data, isLoading } = useGetStatsRequests(
    { limit: LIMIT, offset },
    { query: { queryKey: getGetStatsRequestsQueryKey({ limit: LIMIT, offset }) } }
  );

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (status >= 400 && status < 500) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded bg-blue-500" />
          <h2 className="text-base font-semibold text-white">实时日志</h2>
        </div>
        <div className="text-xs font-mono text-slate-500">
          共 {data?.total ? formatNumber(data.total) : "-"} 条记录
        </div>
      </div>

      <div className="rounded-lg border border-[#1e2d3d] bg-[#111827] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[#1e2d3d] hover:bg-transparent">
              <TableHead className="font-mono text-xs text-slate-500 font-medium">时间</TableHead>
              <TableHead className="font-mono text-xs text-slate-500 font-medium">模型</TableHead>
              <TableHead className="font-mono text-xs text-slate-500 font-medium text-right">输入 Token</TableHead>
              <TableHead className="font-mono text-xs text-slate-500 font-medium text-right">输出 Token</TableHead>
              <TableHead className="font-mono text-xs text-slate-500 font-medium text-right">合计</TableHead>
              <TableHead className="font-mono text-xs text-slate-500 font-medium text-right">费用</TableHead>
              <TableHead className="font-mono text-xs text-slate-500 font-medium text-right">耗时</TableHead>
              <TableHead className="font-mono text-xs text-slate-500 font-medium text-center">状态</TableHead>
              <TableHead className="font-mono text-xs text-slate-500 font-medium text-center">流式</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(10).fill(0).map((_, i) => (
                <TableRow key={i} className="border-[#1e2d3d]">
                  {Array(9).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full bg-[#1e2d3d]" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.requests?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                  暂无请求记录
                </TableCell>
              </TableRow>
            ) : (
              data?.requests.map((req) => (
                <TableRow
                  key={req.id}
                  className="border-[#1e2d3d]/50 hover:bg-white/[0.02] transition-colors"
                  data-testid={`request-row-${req.id}`}
                >
                  <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                    {format(new Date(req.createdAt), "MM-dd HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-mono text-xs text-slate-200 font-medium">{req.model}</div>
                      <Badge variant="outline" className={`text-[10px] px-1 py-0 mt-0.5 ${PROVIDER_COLORS[req.provider] ?? "text-slate-400"}`}>
                        {req.provider}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-amber-400">
                    {req.promptTokens ?? "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-orange-400">
                    {req.completionTokens ?? "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-slate-300 font-semibold">
                    {req.totalTokens ?? "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-red-400">
                    {formatCostShort(req.costUsd)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-slate-400">
                    {formatLatencyMs(req.latencyMs)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`text-[10px] ${getStatusColor(req.status)}`}>
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {req.isStream ? (
                      <span className="text-[10px] text-cyan-400 font-mono">SSE</span>
                    ) : (
                      <span className="text-[10px] text-slate-600">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500 font-mono">
          第 {page + 1} 页 · 每页 {LIMIT} 条
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || isLoading}
            data-testid="button-prev-page"
            className="border-[#1e2d3d] bg-transparent hover:bg-[#1e2d3d] text-slate-300 font-mono text-xs h-7"
          >
            <ChevronLeft className="h-3 w-3 mr-1" />
            上一页
          </Button>
          <span className="text-xs font-mono text-slate-400 w-8 text-center">{page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!data || data.requests.length < LIMIT || isLoading}
            data-testid="button-next-page"
            className="border-[#1e2d3d] bg-transparent hover:bg-[#1e2d3d] text-slate-300 font-mono text-xs h-7"
          >
            下一页
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
