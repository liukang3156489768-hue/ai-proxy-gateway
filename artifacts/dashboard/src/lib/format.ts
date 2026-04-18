export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "$0.0000";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(amount);
}

export function formatCostShort(amount: number | null | undefined): string {
  if (amount == null) return "$0.00";
  return `$${amount.toFixed(2)}`;
}

export function formatNumber(num: number | null | undefined): string {
  if (num == null) return "0";
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatK(num: number | null | undefined): string {
  if (num == null) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return "0ms";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export function formatLatencyMs(ms: number | null | undefined): string {
  if (ms == null) return "-";
  return `${Math.round(ms)}ms`;
}

export function formatPercentage(val: number | null | undefined): string {
  if (val == null) return "0%";
  return `${(val * 100).toFixed(1)}%`;
}

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
