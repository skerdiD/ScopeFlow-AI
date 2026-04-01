import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricTone = "accent" | "neutral" | "success" | "warning";

const toneStyles: Record<MetricTone, { iconWrap: string; iconColor: string }> = {
  accent: {
    iconWrap: "bg-primary/10 border-primary/20",
    iconColor: "text-primary"
  },
  neutral: {
    iconWrap: "bg-secondary border-border",
    iconColor: "text-foreground"
  },
  success: {
    iconWrap: "bg-emerald-500/10 border-emerald-500/20",
    iconColor: "text-emerald-600"
  },
  warning: {
    iconWrap: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-600"
  }
};

type DashboardMetricCardProps = {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone?: MetricTone;
};

export function DashboardMetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "neutral"
}: DashboardMetricCardProps) {
  const toneStyle = toneStyles[tone];

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
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
      </CardContent>
    </Card>
  );
}
