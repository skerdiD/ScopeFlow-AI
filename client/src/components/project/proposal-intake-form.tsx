import { useEffect, useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { GenerateProposalPayload } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

type ProposalIntakeFormProps = {
  loading?: boolean;
  onCancel?: () => void;
  onSubmit: (payload: GenerateProposalPayload) => Promise<void>;
  submitLabel?: string;
  initialValues?: Partial<ProposalIntakeFormValues>;
  prefillKey?: string;
};

export const budgetOptions = [
  "$2,000 - $5,000",
  "$5,000 - $10,000",
  "$10,000 - $25,000",
  "$25,000+",
];

export const timelineOptions = [
  "2-3 weeks",
  "1 month",
  "2-3 months",
  "4-6 months",
];

export type ProposalIntakeFormValues = Omit<GenerateProposalPayload, "user_id">;

const defaultFormValues: ProposalIntakeFormValues = {
  client_name: "",
  business_type: "",
  project_goals: "",
  required_features: "",
  budget_range: budgetOptions[2],
  timeline: timelineOptions[2],
  call_notes: "",
};

function buildInitialValues(initialValues?: Partial<ProposalIntakeFormValues>): ProposalIntakeFormValues {
  const mergedValues: ProposalIntakeFormValues = {
    ...defaultFormValues,
    ...initialValues,
  };

  const budgetRange = mergedValues.budget_range.trim();
  if (!budgetOptions.includes(budgetRange)) {
    mergedValues.budget_range = defaultFormValues.budget_range;
  }

  const timeline = mergedValues.timeline.trim();
  if (!timelineOptions.includes(timeline)) {
    mergedValues.timeline = defaultFormValues.timeline;
  }

  return mergedValues;
}

export function ProposalIntakeForm({
  loading = false,
  onCancel,
  onSubmit,
  submitLabel = "Generate Proposal",
  initialValues,
  prefillKey,
}: ProposalIntakeFormProps) {
  const { user } = useAuth();

  const [formValues, setFormValues] = useState<ProposalIntakeFormValues>(() =>
    buildInitialValues(initialValues)
  );

  useEffect(() => {
    setFormValues(buildInitialValues(initialValues));
  }, [prefillKey, initialValues]);

  function setField(name: keyof typeof formValues, value: string) {
    setFormValues((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      user_id: user?.id ?? "",
      client_name: formValues.client_name,
      business_type: formValues.business_type,
      project_goals: formValues.project_goals,
      required_features: formValues.required_features,
      budget_range: formValues.budget_range,
      timeline: formValues.timeline,
      call_notes: formValues.call_notes,
    });
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card className="mx-auto max-w-3xl">
        <CardContent className="space-y-8 p-6 md:p-8">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                1
              </span>
              <h2 className="text-2xl font-semibold">Client Information</h2>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Client Name</label>
                <Input
                  required
                  value={formValues.client_name}
                  onChange={(event) => setField("client_name", event.target.value)}
                  placeholder="Acme Inc."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Business Type</label>
                <Input
                  required
                  value={formValues.business_type}
                  onChange={(event) => setField("business_type", event.target.value)}
                  placeholder="Ecommerce, SaaS, Healthcare, Finance..."
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                2
              </span>
              <h2 className="text-2xl font-semibold">Project Details</h2>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Goals</label>
                <Textarea
                  required
                  value={formValues.project_goals}
                  onChange={(event) => setField("project_goals", event.target.value)}
                  placeholder="What should this project achieve?"
                  className="min-h-[110px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Required Features</label>
                <Textarea
                  required
                  value={formValues.required_features}
                  onChange={(event) => setField("required_features", event.target.value)}
                  placeholder="Key features or capabilities needed for delivery..."
                  className="min-h-[110px]"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                3
              </span>
              <h2 className="text-2xl font-semibold">Budget and Timeline</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Budget Range</label>
                <select
                  className="flex h-11 w-full rounded-2xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  value={formValues.budget_range}
                  onChange={(event) => setField("budget_range", event.target.value)}
                >
                  {budgetOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Timeline</label>
                <select
                  className="flex h-11 w-full rounded-2xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  value={formValues.timeline}
                  onChange={(event) => setField("timeline", event.target.value)}
                >
                  {timelineOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                4
              </span>
              <h2 className="text-2xl font-semibold">Additional Information</h2>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Call Notes</label>
              <Textarea
                value={formValues.call_notes}
                onChange={(event) => setField("call_notes", event.target.value)}
                placeholder="Optional context, risks, assumptions, or constraints..."
                className="min-h-[110px]"
              />
            </div>
          </section>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit" disabled={loading}>
              <Sparkles className="size-4" />
              {loading ? "Generating..." : submitLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
