import { useMemo, useState } from "react";
import { ArrowLeft, PencilLine } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { TemplateForm } from "@/components/templates/template-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTemplates } from "@/hooks/use-templates";
import { generateTemplateDraft } from "@/lib/api";
import type { TemplateDraftInput } from "@/lib/templates";

export function EditTemplatePage() {
  const navigate = useNavigate();
  const { templateId = "" } = useParams();
  const { templates, loading, updateTemplate } = useTemplates();
  const [submitting, setSubmitting] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates]
  );

  const categoryOptions = useMemo(() => {
    const categorySet = new Set<string>(templates.map((template) => template.category.trim()).filter(Boolean));
    return Array.from(categorySet).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  async function handleSaveTemplate(draft: TemplateDraftInput) {
    if (!selectedTemplate) {
      toast.error("Template not found.");
      return;
    }

    try {
      setSubmitting(true);
      const updatedTemplate = updateTemplate(selectedTemplate.id, draft);
      if (!updatedTemplate) {
        toast.error("Template not found.");
        return;
      }
      toast.success("Template updated.");
      navigate("/templates");
    } catch {
      toast.error("Failed to update template.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateWithAi(prompt: string): Promise<TemplateDraftInput> {
    return generateTemplateDraft({
      user_prompt: prompt,
      existing_categories: categoryOptions
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <section className="rounded-[1.75rem] border bg-card px-6 py-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Loading template...</p>
        </section>
      </div>
    );
  }

  if (!selectedTemplate) {
    return (
      <div className="space-y-6">
        <section className="rounded-[1.75rem] border bg-card px-6 py-5 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Template Not Found</h1>
            <p className="text-sm text-muted-foreground">
              The template you are trying to edit is missing or was deleted.
            </p>
            <div className="pt-2">
              <Button variant="outline" onClick={() => navigate("/templates")}>
                <ArrowLeft className="size-4" />
                Back to Templates
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-card px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <PencilLine className="size-3.5 text-primary" />
              Edit Template
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Edit Template</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Update this template manually or regenerate improved section text with AI.
            </p>
          </div>

          <Button variant="outline" onClick={() => navigate("/templates")}>
            <ArrowLeft className="size-4" />
            Back to Templates
          </Button>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Template form</p>
        <Badge variant="outline">Last updated {new Date(selectedTemplate.updatedAt).toLocaleDateString()}</Badge>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <TemplateForm
          mode="edit"
          initialTemplate={selectedTemplate}
          categories={categoryOptions}
          submitting={submitting}
          onCancel={() => navigate("/templates")}
          onSubmit={handleSaveTemplate}
          onGenerateWithAi={handleGenerateWithAi}
          enableAiGenerator
        />
      </Card>
    </div>
  );
}
