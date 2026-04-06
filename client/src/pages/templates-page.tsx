import { useMemo, useState } from "react";
import { FileStack, Filter, FolderOpenDot, PlusCircle, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { TemplateCard } from "@/components/templates/template-card";
import { TemplateForm } from "@/components/templates/template-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTemplates } from "@/hooks/use-templates";
import { logActivity } from "@/lib/activity";
import {
  type ProposalTemplate,
  type TemplateDraftInput
} from "@/lib/templates";

type TemplateDialogMode = "edit" | null;

export function TemplatesPage() {
  const navigate = useNavigate();
  const { templates, loading, updateTemplate, duplicateTemplate, removeTemplate } = useTemplates();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogMode, setDialogMode] = useState<TemplateDialogMode>(null);
  const [activeTemplate, setActiveTemplate] = useState<ProposalTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProposalTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateBusyId, setDuplicateBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const categorySet = new Set<string>(templates.map((template) => template.category.trim()).filter(Boolean));
    return ["all", ...Array.from(categorySet).sort((a, b) => a.localeCompare(b))];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesCategory = categoryFilter === "all" ? true : template.category === categoryFilter;
      const matchesSearch =
        !query ||
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.category.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, searchQuery, templates]);

  function openCreateDialog() {
    navigate("/templates/new");
  }

  function openEditDialog(template: ProposalTemplate) {
    setDialogMode("edit");
    setActiveTemplate(template);
  }

  function closeTemplateDialog() {
    setDialogMode(null);
    setActiveTemplate(null);
  }

  async function handleSaveTemplate(draft: TemplateDraftInput) {
    try {
      setSubmitting(true);

      if (dialogMode === "edit" && activeTemplate) {
        updateTemplate(activeTemplate.id, draft);
        toast.success("Template updated.");
      }

      closeTemplateDialog();
    } catch {
      toast.error("Failed to save template.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDuplicateTemplate(template: ProposalTemplate) {
    try {
      setDuplicateBusyId(template.id);
      const duplicated = duplicateTemplate(template.id);
      if (duplicated) {
        logActivity({
          type: "template_created",
          title: "Template duplicated",
          description: `${duplicated.name} created from ${template.name}.`,
          actor: "user",
          projectName: duplicated.name,
          metadata: {
            sourceTemplate: template.name
          }
        });
      }
      toast.success("Template duplicated.");
    } catch {
      toast.error("Failed to duplicate template.");
    } finally {
      setDuplicateBusyId(null);
    }
  }

  async function handleDeleteTemplate() {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleteBusyId(deleteTarget.id);
      removeTemplate(deleteTarget.id);
      toast.success("Template deleted.");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete template.");
    } finally {
      setDeleteBusyId(null);
    }
  }

  function handleUseTemplate(template: ProposalTemplate) {
    logActivity({
      type: "template_used",
      title: "Template used for new project",
      description: `${template.name} applied to prefill project intake.`,
      actor: "user",
      projectName: template.name,
      metadata: {
        templateId: template.id,
        category: template.category
      }
    });
    navigate(`/projects/new?template=${encodeURIComponent(template.id)}`);
    toast.success(`Template "${template.name}" loaded.`);
  }

  const noTemplates = !loading && templates.length === 0;
  const noMatches = !loading && templates.length > 0 && filteredTemplates.length === 0;

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-card px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <FileStack className="size-3.5 text-primary" />
              Template Library
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Proposal Templates</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Build reusable proposal structures and start new projects with clean, consistent inputs.
            </p>
          </div>

          <Button onClick={openCreateDialog}>
            <PlusCircle className="size-4" />
            Add Template
          </Button>
        </div>
      </section>

      <Card className="border-border/70 shadow-sm">
        <div className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-11 rounded-2xl pl-10"
              placeholder="Search templates by name, category, or description..."
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
              className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category === "all" ? "All categories" : category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-[1.5rem] border bg-card p-5 shadow-sm">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-5/6" />
              <Skeleton className="mt-6 h-8 w-full" />
            </div>
          ))}
        </div>
      ) : null}

      {noTemplates ? (
        <Card className="overflow-hidden border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border bg-background shadow-sm">
              <FolderOpenDot className="size-7 text-muted-foreground" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold tracking-tight">No templates yet</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Create your first reusable template to standardize project intake and proposal quality.
            </p>
            <Button className="mt-6" onClick={openCreateDialog}>
              <PlusCircle className="size-4" />
              Add First Template
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {noMatches ? (
        <Card className="border-dashed shadow-sm">
          <CardContent className="px-6 py-14 text-center">
            <h3 className="text-xl font-semibold tracking-tight">No templates match your filters</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Try a broader search or switch to a different category.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="outline" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
              <Button variant="outline" onClick={() => setCategoryFilter("all")}>
                Show All Categories
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && filteredTemplates.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{filteredTemplates.length}</span> templates
            </p>
            <Badge variant="outline">{templates.length} total</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onUseTemplate={handleUseTemplate}
                onEditTemplate={openEditDialog}
                onDuplicateTemplate={handleDuplicateTemplate}
                onDeleteTemplate={setDeleteTarget}
                duplicating={duplicateBusyId === template.id}
                deleting={deleteBusyId === template.id}
              />
            ))}
          </div>
        </div>
      ) : null}

      <Dialog open={dialogMode !== null} onOpenChange={(open) => (!open ? closeTemplateDialog() : null)}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-h-[88vh] sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b px-5 py-4 sm:px-6">
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Refine this template and keep your proposal structure consistent.</DialogDescription>
          </DialogHeader>

          <TemplateForm
            mode="edit"
            initialTemplate={activeTemplate}
            categories={categoryOptions.filter((category) => category !== "all")}
            submitting={submitting}
            onCancel={closeTemplateDialog}
            onSubmit={handleSaveTemplate}
            className="min-h-0"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              This will permanently remove{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={Boolean(deleteBusyId)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={handleDeleteTemplate} disabled={Boolean(deleteBusyId)}>
              <Trash2 className="size-4" />
              {deleteBusyId ? "Deleting..." : "Delete Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
