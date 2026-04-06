import { useMemo, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { TemplateForm } from "@/components/templates/template-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTemplates } from "@/hooks/use-templates";
import { logActivity } from "@/lib/activity";
import { generateTemplateDraft } from "@/lib/api";
import type { TemplateDraftInput } from "@/lib/templates";

export function NewTemplatePage() {
  const navigate = useNavigate();
  const { templates, createTemplate } = useTemplates();
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = useMemo(() => {
    const categorySet = new Set<string>(templates.map((template) => template.category.trim()).filter(Boolean));
    return Array.from(categorySet).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  async function handleSaveTemplate(draft: TemplateDraftInput) {
    try {
      setSubmitting(true);
      const createdTemplate = createTemplate(draft);

      logActivity({
        type: "template_created",
        title: "Template created",
        description: `${createdTemplate.name} added to the template library.`,
        actor: "user",
        projectName: createdTemplate.name,
        metadata: {
          category: createdTemplate.category
        }
      });

      toast.success("Template created.");
      navigate("/templates");
    } catch {
      toast.error("Failed to create template.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateWithAi(prompt: string): Promise<TemplateDraftInput> {
    const draft = await generateTemplateDraft({
      user_prompt: prompt,
      existing_categories: categoryOptions
    });
    toast.success("AI template draft generated.");
    return draft;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-card px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              New Template
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Add Template</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Build a reusable proposal template manually or generate a first draft with AI from a short prompt.
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
        <Badge variant="outline">{categoryOptions.length} saved categories</Badge>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <TemplateForm
          mode="create"
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
