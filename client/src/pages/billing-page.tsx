import { CheckCircle2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { UsageCard } from "@/components/billing/usage-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsageStatus, type UsageStatus } from "@/lib/api";

const plans = [
  {
    name: "Free",
    key: "free",
    price: "$0",
    description: "For occasional proposal drafting.",
    allowance: "3 AI proposals/month",
    features: ["Core proposal generation", "Project workspace", "Version history"]
  },
  {
    name: "Pro",
    key: "pro",
    price: "Coming soon",
    description: "For active freelancers and solo consultants.",
    allowance: "50 AI proposals/month",
    features: ["Higher AI usage", "Reusable templates", "Export-ready workflow"]
  },
  {
    name: "Business",
    key: "business",
    price: "Coming soon",
    description: "For agencies and high-volume teams.",
    allowance: "High-volume usage",
    features: ["Large monthly allowance", "Team-ready workflow", "Future priority support"]
  }
];

export function BillingPage() {
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadUsage = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUsageStatus();
      setUsage(data);
      setErrorMessage("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load usage.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-card px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="size-3.5" />
              Plans
            </Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Usage and Billing</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Review your monthly AI proposal usage and compare plans. Payments are mocked until Stripe is connected.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadUsage()} disabled={loading}>
            Refresh Usage
          </Button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <UsageCard usage={usage} loading={loading} errorMessage={errorMessage} />

        <section className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = usage?.plan === plan.key;

            return (
              <Card key={plan.key} className={isCurrent ? "border-primary/50 shadow-sm" : "border-border/70 shadow-sm"}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                    {isCurrent ? <Badge>Current</Badge> : null}
                  </div>
                  <p className="pt-3 text-2xl font-semibold tracking-tight">{plan.price}</p>
                  <p className="text-sm font-medium text-primary">{plan.allowance}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full" disabled>
                    {isCurrent ? "Current Plan" : "Upgrade Coming Soon"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </div>
  );
}
