import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TEMPLATE_SECTION_CONFIG,
  createDefaultTemplateSections,
  getTemplateSectionLabel,
  type ProposalTemplate,
  type TemplateDraftInput,
  type TemplateSectionKey,
  type TemplateSections
} from "@/lib/templates";

type TemplateFormProps = {
  mode: "create" | "edit";
  initialTemplate?: ProposalTemplate | null;
  categories: string[];
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (draft: TemplateDraftInput) => Promise<void> | void;
};

type TemplateFormValues = {
  name: string;
  description: string;
  category: string;
  sections: TemplateSections;
};

function createInitialValues(initialTemplate?: ProposalTemplate | null): TemplateFormValues {
  if (!initialTemplate) {
    return {
      name: "",
      description: "",
      category: "",
      sections: createDefaultTemplateSections()
    };
  }

  return {
    name: initialTemplate.name,
    description: initialTemplate.description,
    category: initialTemplate.category,
    sections: createDefaultTemplateSections(initialTemplate.sections)
  };
}

export function TemplateForm({
  mode,
  initialTemplate,
  categories,
  submitting = false,
  onCancel,
  onSubmit
}: TemplateFormProps) {
  const [values, setValues] = useState<TemplateFormValues>(() => createInitialValues(initialTemplate));

  useEffect(() => {
    setValues(createInitialValues(initialTemplate));
  }, [initialTemplate, mode]);

  const includedSectionsCount = useMemo(
    () => TEMPLATE_SECTION_CONFIG.filter((section) => values.sections[section.key].included).length,
    [values.sections]
  );

  function updateSectionInclusion(sectionKey: TemplateSectionKey, included: boolean) {
    setValues((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionKey]: {
          ...current.sections[sectionKey],
          included
        }
      }
    }));
  }

  function updateSectionContent(sectionKey: TemplateSectionKey, content: string) {
    setValues((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionKey]: {
          ...current.sections[sectionKey],
          content
        }
      }
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      name: values.name.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
      sections: createDefaultTemplateSections(values.sections)
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="template-name">Template Name</Label>
          <Input
            id="template-name"
            required
            value={values.name}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                name: event.target.value
              }))
            }
            placeholder="Website Redesign Proposal"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="template-description">Description</Label>
          <Textarea
            id="template-description"
            required
            value={values.description}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                description: event.target.value
              }))
            }
            placeholder="Reusable structure for redesign projects with clear UX and delivery milestones."
            className="min-h-[96px]"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="template-category">Category / Project Type</Label>
          <Input
            id="template-category"
            required
            list="template-categories"
            value={values.category}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                category: event.target.value
              }))
            }
            placeholder="SaaS, E-commerce, Internal Tools..."
          />
          <datalist id="template-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Template Sections</h3>
            <p className="text-xs text-muted-foreground">
              Select sections to include and define default draft text.
            </p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
            <CheckCircle2 className="size-3.5 text-primary" />
            {includedSectionsCount} included
          </div>
        </div>

        <div className="space-y-3">
          {TEMPLATE_SECTION_CONFIG.map((section) => {
            const sectionValue = values.sections[section.key];
            const included = sectionValue.included;

            return (
              <div key={section.key} className="rounded-xl border bg-background/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{getTemplateSectionLabel(section.key)}</p>
                    <p className="text-xs text-muted-foreground">
                      {included ? "Included in generated proposal draft." : "Excluded from template output."}
                    </p>
                  </div>

                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/30"
                      checked={included}
                      onChange={(event) => updateSectionInclusion(section.key, event.target.checked)}
                    />
                    Include
                  </label>
                </div>

                <Textarea
                  value={sectionValue.content}
                  onChange={(event) => updateSectionContent(section.key, event.target.value)}
                  placeholder={`Default ${getTemplateSectionLabel(section.key).toLowerCase()} content...`}
                  className="mt-3 min-h-[88px]"
                  disabled={!included}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : mode === "create" ? "Create Template" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
