import { useGetSupportedModels, getGetSupportedModelsQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  anthropic: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  gemini: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
};

const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  openai: "通过 Replit AI 集成接入的 OpenAI 模型",
  anthropic: "通过 Replit AI 集成接入的 Anthropic Claude 模型",
  gemini: "通过 Replit AI 集成接入的 Google Gemini 模型",
};

export default function Models() {
  const { data: models, isLoading } = useGetSupportedModels({ query: { queryKey: getGetSupportedModelsQueryKey() } });

  const grouped = models?.reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {} as Record<string, typeof models[0][]>);

  return (
    <div className="px-6 py-6 max-w-[1200px] mx-auto w-full space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded bg-blue-500" />
        <h2 className="text-base font-semibold text-white">模型管理</h2>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full bg-[#111827]" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {["openai", "anthropic", "gemini"].map((provider) => {
            const providerModels = grouped?.[provider] ?? [];
            if (providerModels.length === 0) return null;
            return (
              <div key={provider} className="rounded-lg border border-[#1e2d3d] bg-[#111827] overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2d3d] bg-[#0f1923]">
                  <Badge variant="outline" className={PROVIDER_COLORS[provider] ?? ""}>
                    {PROVIDER_LABELS[provider] ?? provider}
                  </Badge>
                  <span className="text-xs text-slate-400">{PROVIDER_DESCRIPTIONS[provider] ?? ""}</span>
                  <span className="ml-auto text-xs text-slate-500 font-mono">{providerModels.length} 个模型</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#1e2d3d] hover:bg-transparent">
                      <TableHead className="text-xs text-slate-500 font-medium">模型 ID</TableHead>
                      <TableHead className="text-xs text-slate-500 font-medium">说明</TableHead>
                      <TableHead className="text-xs text-slate-500 font-medium text-right">输入价格 / 百万 Token</TableHead>
                      <TableHead className="text-xs text-slate-500 font-medium text-right">输出价格 / 百万 Token</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providerModels.map((model) => (
                      <TableRow
                        key={model.id}
                        className="border-[#1e2d3d]/50 hover:bg-white/[0.02]"
                        data-testid={`model-row-${model.id}`}
                      >
                        <TableCell className="font-mono text-xs text-slate-200 font-medium">{model.id}</TableCell>
                        <TableCell className="text-xs text-slate-400 max-w-sm truncate">{model.description}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-amber-400">
                          {formatCurrency(model.inputCostPer1M)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-orange-400">
                          {formatCurrency(model.outputCostPer1M)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
