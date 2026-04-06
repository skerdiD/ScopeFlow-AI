import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
  enableAiGenerator?: boolean;
  onGenerateWithAi?: (prompt: string) => Promise<TemplateDraftInput>;
  className?: string;
};

type TemplateFormValues = {
  name: string;
  description: string;
  category: string;
  sections: TemplateSections;
};

const CUSTOM_CATEGORY_VALUE = "__custom__";

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

function createInitialExpandedSections(
  initialTemplate?: ProposalTemplate | null
): Record<TemplateSectionKey, boolean> {
  return TEMPLATE_SECTION_CONFIG.reduce(
    (accumulator, section, index) => {
      const sectionValue = initialTemplate?.sections?.[section.key];
      const hasContent = Boolean(sectionValue?.content?.trim());
      const isIncluded = Boolean(sectionValue?.included);
      accumulator[section.key] = initialTemplate
        ? isIncluded || hasContent
        : index < 3;
      return accumulator;
    },
    {} as Record<TemplateSectionKey, boolean>
  );
}

function createExpandedSectionsFromValues(sections: TemplateSections): Record<TemplateSectionKey, boolean> {
  return TEMPLATE_SECTION_CONFIG.reduce(
    (accumulator, section) => {
      const sectionValue = sections[section.key];
      accumulator[section.key] = Boolean(sectionValue?.included) || Boolean(sectionValue?.content?.trim());
      return accumulator;
    },
    {} as Record<TemplateSectionKey, boolean>
  );
}

function normalizeCategoryOptions(categories: string[]) {
  return [...new Set(categories.map((category) => category.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function TemplateForm({
  mode,
  initialTemplate,
  categories,
  submitting = false,
  onCancel,
  onSubmit,
  enableAiGenerator = false,
  onGenerateWithAi,
  className
}: TemplateFormProps) {
  const categoryOptions = useMemo(() => normalizeCategoryOptions(categories), [categories]);
  const [values, setValues] = useState<TemplateFormValues>(() => createInitialValues(initialTemplate));
  const [expandedSections, setExpandedSections] = useState<Record<TemplateSectionKey, boolean>>(
    () => createInitialExpandedSections(initialTemplate)
  );
  const [useCustomCategory, setUseCustomCategory] = useState<boolean>(() => {
    const initialCategory = createInitialValues(initialTemplate).category;
    return !initialCategory || !normalizeCategoryOptions(categories).includes(initialCategory);
  });
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    const initialValues = createInitialValues(initialTemplate);
    setValues(initialValues);
    setExpandedSections(createInitialExpandedSections(initialTemplate));
    const incomingCategory = initialValues.category;
    setUseCustomCategory(!incomingCategory || !categoryOptions.includes(incomingCategory));
    setAiPrompt("");
    setAiError("");
  }, [initialTemplate, mode, categoryOptions]);

  const includedSectionsCount = useMemo(
    () => TEMPLATE_SECTION_CONFIG.filter((section) => values.sections[section.key].included).length,
    [values.sections]
  );

  function toggleSection(sectionKey: TemplateSectionKey) {
    setExpandedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey]
    }));
  }

  function setAllSectionsExpanded(expanded: boolean) {
    setExpandedSections(
      TEMPLATE_SECTION_CONFIG.reduce(
        (accumulator, section) => {
          accumulator[section.key] = expanded;
          return accumulator;
        },
        {} as Record<TemplateSectionKey, boolean>
      )
    );
  }

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
    if (included) {
      setExpandedSections((current) => ({
        ...current,
        [sectionKey]: true
      }));
    }
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
    if (!values.category.trim()) {
      return;
    }

    await onSubmit({
      name: values.name.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
      sections: createDefaultTemplateSections(values.sections)
    });
  }

  async function handleGenerateWithAi() {
    if (!enableAiGenerator || !onGenerateWithAi) {
      return;
    }

    const prompt = aiPrompt.trim();
    if (!prompt) {
      setAiError("Please enter a short description before generating.");
      return;
    }

    try {
      setAiGenerating(true);
      setAiError("");
      const generated = await onGenerateWithAi(prompt);
      const normalizedSections = createDefaultTemplateSections(generated.sections);
      const generatedCategory = generated.category.trim();

      setValues((current) => ({
        ...current,
        name: generated.name.trim() || current.name,
        description: generated.description.trim() || current.description,
        category: generatedCategory || current.category,
        sections: normalizedSections
      }));
      setExpandedSections(createExpandedSectionsFromValues(normalizedSections));
      setUseCustomCategory(!generatedCategory || !categoryOptions.includes(generatedCategory));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate template.";
      setAiError(message);
    } finally {
      setAiGenerating(false);
    }
  }

  return (
    <form className={cn("flex min-h-0 flex-1 flex-col", className)} onSubmit={handleSubmit}>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
        {mode === "create" && enableAiGenerator && onGenerateWithAi ? (
          <div className="space-y-3 rounded-xl border bg-muted/35 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Generate Template AI</h3>
              <p className="text-xs text-muted-foreground">
                Write a short prompt and AI will draft a full template like your sample library.
              </p>
            </div>

            <Textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Example: SEO landing page redesign for B2B SaaS with clear conversion flow"
              className="min-h-[92px]"
            />

            {aiError ? <p className="text-xs text-destructive">{aiError}</p> : null}

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleGenerateWithAi}
                disabled={submitting || aiGenerating || !aiPrompt.trim()}
              >
                <Sparkles className="size-4" />
                {aiGenerating ? "Generating Template..." : "Generate Template AI"}
              </Button>
            </div>
          </div>
        ) : null}

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
            <select
              id="template-category"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
              value={useCustomCategory ? CUSTOM_CATEGORY_VALUE : values.category}
              onChange={(event) => {
                const selected = event.target.value;
                if (selected === CUSTOM_CATEGORY_VALUE) {
                  setUseCustomCategory(true);
                  setValues((current) => ({ ...current, category: "" }));
                  return;
                }
                setUseCustomCategory(false);
                setValues((current) => ({ ...current, category: selected }));
              }}
            >
              {categoryOptions.length === 0 ? (
                <option value={CUSTOM_CATEGORY_VALUE}>Custom category</option>
              ) : null}
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              <option value={CUSTOM_CATEGORY_VALUE}>Custom category...</option>
            </select>
            {useCustomCategory ? (
              <Input
                required
                value={values.category}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    category: event.target.value
                  }))
                }
                placeholder="Type custom category"
              />
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Template Sections</h3>
              <p className="text-xs text-muted-foreground">
                Select sections to include and define default draft text.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
                <CheckCircle2 className="size-3.5 text-primary" />
                {includedSectionsCount} included
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setAllSectionsExpanded(true)}>
                Expand All
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setAllSectionsExpanded(false)}>
                Collapse All
              </Button>
            </div>
          </div>

          <div className="space-y-3 pb-1">
            {TEMPLATE_SECTION_CONFIG.map((section) => {
              const sectionValue = values.sections[section.key];
              const included = sectionValue.included;
              const isExpanded = expandedSections[section.key];

              return (
                <div key={section.key} className="rounded-xl border bg-background/70">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{getTemplateSectionLabel(section.key)}</p>
                      <p className="text-xs text-muted-foreground">
                        {included ? "Included in generated proposal draft." : "Excluded from template output."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/30"
                          checked={included}
                          onChange={(event) => updateSectionInclusion(section.key, event.target.checked)}
                        />
                        Include
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleSection(section.key)}
                        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${getTemplateSectionLabel(section.key)}`}
                      >
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </Button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="border-t px-3 pb-3 pt-3">
                      <Textarea
                        value={sectionValue.content}
                        onChange={(event) => updateSectionContent(section.key, event.target.value)}
                        placeholder={`Default ${getTemplateSectionLabel(section.key).toLowerCase()} content...`}
                        className="min-h-[88px]"
                        disabled={!included}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t bg-background/95 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : mode === "create" ? "Create Template" : "Save Changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
