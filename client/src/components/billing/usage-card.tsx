import { AlertTriangle, ArrowUpRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { UsageStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

type UsageCardProps = {
  usage: UsageStatus | null;
  loading?: boolean;
  errorMessage?: string;
  compact?: boolean;
};

function formatPlan(plan: string) {
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)} Plan`;
}

export function UsageCard({ usage, loading = false, errorMessage = "", compact = false }: UsageCardProps) {
  const isAtLimit = Boolean(usage && !usage.is_unlimited && usage.remaining === 0);
  const isCloseToLimit = Boolean(usage && !usage.is_unlimited && usage.remaining !== null && usage.remaining <= 1 && usage.remaining > 0);
  const usageLabel = usage?.is_unlimited ? `${usage.used} AI generations used this month` : `${usage?.used ?? 0} / ${usage?.limit ?? 0} AI generations used this month`;

  return (
    <Card className={cn("border-border/70 shadow-sm", isAtLimit ? "border-destructive/40 bg-destructive/5" : "")}>
      <CardHeader className={compact ? "pb-2" : undefined}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="size-4 text-primary" />
              AI Usage
            </CardTitle>
            <CardDescription>Monthly proposal generation allowance.</CardDescription>
          </div>
          {usage ? <Badge variant={isAtLimit ? "warning" : "secondary"}>{formatPlan(usage.plan)}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-4 w-56" />
          </div>
        ) : null}

        {!loading && errorMessage ? (
          <div className="rounded-xl border bg-background/70 p-3 text-sm text-muted-foreground">{errorMessage}</div>
        ) : null}

        {!loading && usage ? (
          <>
            <div>
              <div className="flex items-end justify-between gap-3">
                <p className="text-sm font-medium">{usageLabel}</p>
                <p className="text-xs text-muted-foreground">{usage.period}</p>
              </div>
              {!usage.is_unlimited ? (
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full rounded-full bg-primary", isAtLimit ? "bg-destructive" : isCloseToLimit ? "bg-amber-500" : "")}
                    style={{ width: `${Math.min(100, Math.round((usage.used / Math.max(usage.limit ?? 1, 1)) * 100))}%` }}
                  />
                </div>
              ) : (
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full w-full rounded-full bg-emerald-500" />
                </div>
              )}
            </div>

            {isAtLimit ? (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-background/80 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p>You have reached your monthly AI generation limit. Upgrade to generate more proposals.</p>
              </div>
            ) : isCloseToLimit ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                You are close to your monthly limit. Consider upgrading before your next proposal push.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {usage.is_unlimited ? "Your business plan has high-volume generation available." : `${usage.remaining} generations remaining this month.`}
              </p>
            )}

            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/billing">
                View Plans
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
