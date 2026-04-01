import { CalendarClock, Copy, Ellipsis, PencilLine, Trash2, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  getIncludedTemplateSections,
  getTemplateSectionLabel,
  type ProposalTemplate
} from "@/lib/templates";

type TemplateCardProps = {
  template: ProposalTemplate;
  onUseTemplate: (template: ProposalTemplate) => void;
  onEditTemplate: (template: ProposalTemplate) => void;
  onDuplicateTemplate: (template: ProposalTemplate) => void;
  onDeleteTemplate: (template: ProposalTemplate) => void;
  duplicating?: boolean;
  deleting?: boolean;
};

export function TemplateCard({
  template,
  onUseTemplate,
  onEditTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  duplicating = false,
  deleting = false
}: TemplateCardProps) {
  const includedSections = getIncludedTemplateSections(template);
  const visibleTags = includedSections.slice(0, 3);

  return (
    <Card className="group border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-lg font-semibold tracking-tight">{template.name}</p>
            <p className="line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
          </div>
          <Badge variant="secondary">{template.category}</Badge>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Included Sections ({includedSections.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {visibleTags.map((sectionKey) => (
              <span
                key={sectionKey}
                className="rounded-full border bg-background px-2 py-1 text-xs text-muted-foreground"
              >
                {getTemplateSectionLabel(sectionKey)}
              </span>
            ))}
            {includedSections.length > visibleTags.length ? (
              <span className="rounded-full border bg-background px-2 py-1 text-xs text-muted-foreground">
                +{includedSections.length - visibleTags.length} more
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5" />
            Updated {new Date(template.updatedAt).toLocaleDateString()}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button className="flex-1" onClick={() => onUseTemplate(template)}>
            <WandSparkles className="size-4" />
            Use Template
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={`Template actions for ${template.name}`}>
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditTemplate(template)}>
                <PencilLine className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicateTemplate(template)} disabled={duplicating}>
                <Copy className="size-4" />
                {duplicating ? "Duplicating..." : "Duplicate"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDeleteTemplate(template)}
                variant="destructive"
                disabled={deleting}
              >
                <Trash2 className="size-4" />
                {deleting ? "Deleting..." : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
