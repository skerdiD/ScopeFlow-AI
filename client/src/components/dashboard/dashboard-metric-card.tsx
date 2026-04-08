import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricTone = "accent" | "neutral" | "success" | "warning";

const toneStyles: Record<MetricTone, { iconWrap: string; iconColor: string; glow: string; progress: string }> = {
  accent: {
    iconWrap: "bg-primary/10 border-primary/20",
    iconColor: "text-primary",
    glow: "from-primary/20",
    progress: "bg-primary"
  },
  neutral: {
    iconWrap: "bg-secondary border-border",
    iconColor: "text-foreground",
    glow: "from-slate-400/20",
    progress: "bg-slate-500"
  },
  success: {
    iconWrap: "bg-emerald-500/10 border-emerald-500/20",
    iconColor: "text-emerald-600",
    glow: "from-emerald-500/20",
    progress: "bg-emerald-500"
  },
  warning: {
    iconWrap: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-600",
    glow: "from-amber-500/20",
    progress: "bg-amber-500"
  }
};

type DashboardMetricCardProps = {
  label: string;
  value: string;
  description: string;
  meta?: string;
  progress?: number;
  icon: LucideIcon;
  tone?: MetricTone;
};

export function DashboardMetricCard({
  label,
  value,
  description,
  meta,
  progress,
  icon: Icon,
  tone = "neutral"
}: DashboardMetricCardProps) {
  const toneStyle = toneStyles[tone];
  const progressValue = typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : null;

  return (
    <Card className="relative overflow-hidden border-border/70 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", toneStyle.glow)} />
      <CardContent className="p-5">
        <div className="relative flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{meta || description}</p>
          </div>
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border",
              toneStyle.iconWrap
            )}
          >
            <Icon className={cn("size-4", toneStyle.iconColor)} />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{description}</p>
        {progressValue !== null ? (
          <div className="mt-4 space-y-1.5">
            <div className="h-1.5 rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full transition-all duration-500", toneStyle.progress)}
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{progressValue}% benchmark</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
