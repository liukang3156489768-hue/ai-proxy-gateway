import { useState } from "react";
import { useGetStatsRequests, getGetStatsRequestsQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatNumber, formatLatency } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";

const LIMIT = 50;

export default function Requests() {
  const [page, setPage] = useState(0);
  const offset = page * LIMIT;

  const { data, isLoading } = useGetStatsRequests(
    { limit: LIMIT, offset },
    { query: { queryKey: getGetStatsRequestsQueryKey({ limit: LIMIT, offset }) } }
  );

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-green-500/20 text-green-500 border-green-500/30";
    if (status >= 400 && status < 500) return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
    return "bg-red-500/20 text-red-500 border-red-500/30";
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">请求记录</h1>
          <p className="text-muted-foreground">网关原始遥测数据。</p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="font-mono text-xs">时间</TableHead>
              <TableHead className="font-mono text-xs">模型</TableHead>
              <TableHead className="font-mono text-xs text-right">Token（提示/补全/合计）</TableHead>
              <TableHead className="font-mono text-xs text-right">费用</TableHead>
              <TableHead className="font-mono text-xs text-right">延迟</TableHead>
              <TableHead className="font-mono text-xs text-center">状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(10).fill(0).map((_, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12 mx-auto" /></TableCell>
                </TableRow>
              ))
            ) : data?.requests?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  暂无请求记录
                </TableCell>
              </TableRow>
            ) : (
              data?.requests.map((req) => (
                <TableRow key={req.id} className="border-border hover:bg-muted/50 transition-colors" data-testid={`request-row-${req.id}`}>
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(req.createdAt), "MM-dd HH:mm:ss.SSS")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono text-sm font-medium">{req.model}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{req.provider}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {req.promptTokens ?? '-'} / {req.completionTokens ?? '-'} / <span className="text-foreground">{req.totalTokens ?? '-'}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-primary">
                    {formatCurrency(req.costUsd)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatLatency(req.latencyMs)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={getStatusColor(req.status)}>
                      {req.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground font-mono">
          共 {data?.total ? formatNumber(data.total) : '-'} 条
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0 || isLoading}
            data-testid="button-prev-page"
            className="border-border hover:bg-muted font-mono"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            上一页
          </Button>
          <div className="text-sm font-mono w-12 text-center">
            {page + 1}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={!data || data.requests.length < LIMIT || isLoading}
            data-testid="button-next-page"
            className="border-border hover:bg-muted font-mono"
          >
            下一页
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
