import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProposalProject, ProposalProjectPayload } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

type ProjectFormProps = {
  initialValues?: ProposalProject | null;
  onSubmit: (payload: ProposalProjectPayload) => Promise<void>;
  onChange?: (payload: ProposalProjectPayload) => void;
  submitLabel: string;
  loading?: boolean;
  sectionMode?: "all" | "core";
};

const emptyValues = {
  client_name: "",
  project_name: "",
  project_type: "",
  budget: "",
  timeline: "",
  requirements: "",
  summary: "",
  scope: "",
  deliverables: "",
  milestones: "",
  risks: "",
  status: "draft"
};

export function ProjectForm({
  initialValues,
  onSubmit,
  onChange,
  submitLabel,
  loading = false,
  sectionMode = "all"
}: ProjectFormProps) {
  const { user } = useAuth();

  const startValues = useMemo(
    () => ({
      ...emptyValues,
      ...initialValues
    }),
    [initialValues]
  );

  const [formValues, setFormValues] = useState(startValues);

  useEffect(() => {
    setFormValues(startValues);
  }, [startValues]);

  useEffect(() => {
    if (!onChange) {
      return;
    }

    onChange({
      user_id: user?.id ?? "",
      client_name: formValues.client_name,
      project_name: formValues.project_name,
      project_type: formValues.project_type,
      budget: formValues.budget,
      timeline: formValues.timeline,
      requirements: formValues.requirements,
      summary: formValues.summary,
      scope: formValues.scope,
      deliverables: formValues.deliverables,
      milestones: formValues.milestones,
      risks: formValues.risks,
      missing_information: initialValues?.missing_information ?? [],
      scope_risks: initialValues?.scope_risks ?? [],
      unclear_requirements: initialValues?.unclear_requirements ?? [],
      suggested_questions: initialValues?.suggested_questions ?? [],
      status: formValues.status
    });
  }, [formValues, initialValues, onChange, user?.id]);

  function setField(name: string, value: string) {
    setFormValues((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      user_id: user?.id ?? "",
      client_name: formValues.client_name,
      project_name: formValues.project_name,
      project_type: formValues.project_type,
      budget: formValues.budget,
      timeline: formValues.timeline,
      requirements: formValues.requirements,
      summary: formValues.summary,
      scope: formValues.scope,
      deliverables: formValues.deliverables,
      milestones: formValues.milestones,
      risks: formValues.risks,
      missing_information: initialValues?.missing_information ?? [],
      scope_risks: initialValues?.scope_risks ?? [],
      unclear_requirements: initialValues?.unclear_requirements ?? [],
      suggested_questions: initialValues?.suggested_questions ?? [],
      status: formValues.status
    });
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card>
        <CardContent className="grid gap-6 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Client name</label>
              <Input
                value={formValues.client_name}
                onChange={(event) => setField("client_name", event.target.value)}
                placeholder="Acme Inc."
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Project name</label>
              <Input
                value={formValues.project_name}
                onChange={(event) => setField("project_name", event.target.value)}
                placeholder="Website Redesign"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project type</label>
              <Input
                value={formValues.project_type}
                onChange={(event) => setField("project_type", event.target.value)}
                placeholder="Web App"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select
                className="flex h-11 w-full rounded-2xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                value={formValues.status}
                onChange={(event) => setField("status", event.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Budget</label>
              <Input
                value={formValues.budget}
                onChange={(event) => setField("budget", event.target.value)}
                placeholder="€2,000 - €5,000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Timeline</label>
              <Input
                value={formValues.timeline}
                onChange={(event) => setField("timeline", event.target.value)}
                placeholder="4 to 6 weeks"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Requirements</label>
            <Textarea
              value={formValues.requirements}
              onChange={(event) => setField("requirements", event.target.value)}
              placeholder="Client goals, features, notes from discovery..."
            />
          </div>

          {sectionMode === "all" ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Summary</label>
                <Textarea
                  value={formValues.summary}
                  onChange={(event) => setField("summary", event.target.value)}
                  placeholder="High-level project overview..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Scope</label>
                <Textarea
                  value={formValues.scope}
                  onChange={(event) => setField("scope", event.target.value)}
                  placeholder="Scope of work..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Deliverables</label>
                <Textarea
                  value={formValues.deliverables}
                  onChange={(event) => setField("deliverables", event.target.value)}
                  placeholder="List main deliverables..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Milestones</label>
                <Textarea
                  value={formValues.milestones}
                  onChange={(event) => setField("milestones", event.target.value)}
                  placeholder="Main phases and milestones..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Risks</label>
                <Textarea
                  value={formValues.risks}
                  onChange={(event) => setField("risks", event.target.value)}
                  placeholder="Risks, missing details, or possible scope creep..."
                />
              </div>
            </>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : submitLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}