import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, Download, RefreshCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProjectForm } from "@/components/project/project-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteProject,
  getProject,
  markProjectFinal,
  restoreProjectVersion,
  updateProject,
  type ProposalProject,
  type ProposalProjectPayload,
  type ProposalVersion
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

type ProposalSectionKey = "summary" | "scope" | "deliverables" | "milestones" | "risks";

const editableSections: { key: ProposalSectionKey; title: string; placeholder: string }[] = [
  {
    key: "summary",
    title: "Summary",
    placeholder: "Add a strong high-level summary..."
  },
  {
    key: "scope",
    title: "Scope",
    placeholder: "Describe the scope clearly..."
  },
  {
    key: "deliverables",
    title: "Deliverables",
    placeholder: "List concrete deliverables..."
  },
  {
    key: "milestones",
    title: "Milestones",
    placeholder: "Outline phases and milestones..."
  },
  {
    key: "risks",
    title: "Risks",
    placeholder: "Capture risks, assumptions, and scope creep..."
  }
];

type SectionState = Record<ProposalSectionKey, string>;

function buildSectionState(project: ProposalProject): SectionState {
  return {
    summary: project.summary || "",
    scope: project.scope || "",
    deliverables: project.deliverables || "",
    milestones: project.milestones || "",
    risks: project.risks || ""
  };
}

export function ProjectDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProposalProject | null>(null);
  const [coreDraft, setCoreDraft] = useState<ProposalProjectPayload | null>(null);
  const [sectionDrafts, setSectionDrafts] = useState<SectionState>({
    summary: "",
    scope: "",
    deliverables: "",
    milestones: "",
    risks: ""
  });
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingProject, setSavingProject] = useState(false);
  const [savingSection, setSavingSection] = useState<ProposalSectionKey | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [markingFinal, setMarkingFinal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [projectSaveState, setProjectSaveState] = useState("Idle");
  const [sectionSaveStates, setSectionSaveStates] = useState<Record<ProposalSectionKey, string>>({
    summary: "Idle",
    scope: "Idle",
    deliverables: "Idle",
    milestones: "Idle",
    risks: "Idle"
  });
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadProject() {
      if (!id || !user?.id) {
        return;
      }

      try {
        setLoading(true);
        const data = await getProject(id, user.id);
        setProject(data);
        setSectionDrafts(buildSectionState(data));
        setSelectedVersionId(data.current_version_id ?? data.versions[0]?.id ?? null);
        setErrorMessage("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch project.";
        setErrorMessage(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [id, user?.id]);

  useEffect(() => {
    if (!project) {
      return;
    }

    setSectionDrafts(buildSectionState(project));
    setSelectedVersionId((current) => current ?? project.current_version_id ?? project.versions[0]?.id ?? null);
  }, [project]);

  const generatedSections = useMemo(() => {
    if (!project) {
      return [];
    }

    return [
      {
        title: "Summary",
        value: project.summary
      },
      {
        title: "Scope",
        value: project.scope
      },
      {
        title: "Deliverables",
        value: project.deliverables
      },
      {
        title: "Milestones",
        value: project.milestones
      },
      {
        title: "Risks",
        value: project.risks
      }
    ];
  }, [project]);

  const selectedVersion = useMemo<ProposalVersion | null>(() => {
    if (!project || !selectedVersionId) {
      return null;
    }

    return project.versions.find((version) => version.id === selectedVersionId) ?? null;
  }, [project, selectedVersionId]);

  function getStatusVariant(status: string) {
    if (status === "completed") {
      return "success";
    }

    if (status === "in_review") {
      return "warning";
    }

    return "secondary";
  }

  function updateSectionDraft(section: ProposalSectionKey, value: string) {
    setSectionDrafts((current) => ({
      ...current,
      [section]: value
    }));
    setSectionSaveStates((current) => ({
      ...current,
      [section]: "Unsaved"
    }));
  }

  function buildPayload(overrides?: Partial<ProposalProjectPayload>): ProposalProjectPayload {
    if (!project) {
      throw new Error("Project is not loaded.");
    }

    return {
      user_id: user?.id ?? project.user_id,
      client_name: coreDraft?.client_name ?? project.client_name,
      project_name: coreDraft?.project_name ?? project.project_name,
      project_type: coreDraft?.project_type ?? project.project_type,
      budget: coreDraft?.budget ?? project.budget,
      timeline: coreDraft?.timeline ?? project.timeline,
      requirements: coreDraft?.requirements ?? project.requirements,
      summary: sectionDrafts.summary,
      scope: sectionDrafts.scope,
      deliverables: sectionDrafts.deliverables,
      milestones: sectionDrafts.milestones,
      risks: sectionDrafts.risks,
      missing_information: project.missing_information ?? [],
      scope_risks: project.scope_risks ?? [],
      unclear_requirements: project.unclear_requirements ?? [],
      suggested_questions: project.suggested_questions ?? [],
      status: coreDraft?.status ?? project.status,
      ...overrides
    };
  }

  async function handleUpdateCore(payload: ProposalProjectPayload) {
    if (!id) {
      return;
    }

    try {
      setSavingProject(true);
      setProjectSaveState("Saving...");
      const updated = await updateProject(id, {
        ...buildPayload(),
        client_name: payload.client_name,
        project_name: payload.project_name,
        project_type: payload.project_type,
        budget: payload.budget,
        timeline: payload.timeline,
        requirements: payload.requirements,
        status: payload.status
      });
      setProject(updated);
      setProjectSaveState("Saved");
      setErrorMessage("");
      toast.success("Project details saved.");
    } catch (error) {
      setProjectSaveState("Error");
      const message = error instanceof Error ? error.message : "Failed to update project.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSavingProject(false);
    }
  }

  async function handleSaveSection(section: ProposalSectionKey) {
    if (!id || !project) {
      return;
    }

    try {
      setSavingSection(section);
      setSectionSaveStates((current) => ({
        ...current,
        [section]: "Saving..."
      }));

      const updated = await updateProject(id, buildPayload());
      setProject(updated);
      setSectionSaveStates((current) => ({
        ...current,
        [section]: "Saved as new version"
      }));
      setErrorMessage("");
      toast.success(`${section[0].toUpperCase()}${section.slice(1)} saved.`);
    } catch (error) {
      setSectionSaveStates((current) => ({
        ...current,
        [section]: "Error"
      }));
      const message = error instanceof Error ? error.message : "Failed to save section.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSavingSection(null);
    }
  }

  async function handleSaveAllProposalSections() {
    if (!id || !project) {
      return;
    }

    try {
      setSavingProject(true);
      setProjectSaveState("Saving version...");
      const updated = await updateProject(id, buildPayload());
      setProject(updated);
      setProjectSaveState("Saved as new version");
      setSectionSaveStates({
        summary: "Saved",
        scope: "Saved",
        deliverables: "Saved",
        milestones: "Saved",
        risks: "Saved"
      });
      setErrorMessage("");
      toast.success("Proposal changes saved as a new version.");
    } catch (error) {
      setProjectSaveState("Error");
      const message = error instanceof Error ? error.message : "Failed to save proposal changes.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSavingProject(false);
    }
  }

  async function handleRestoreVersion(versionId: number) {
    if (!id || !user?.id) {
      return;
    }

    try {
      setRestoringVersion(versionId);
      const updated = await restoreProjectVersion(id, {
        user_id: user.id,
        version_id: versionId
      });
      setProject(updated);
      setSelectedVersionId(versionId);
      setProjectSaveState("Switched version");
      setErrorMessage("");
      toast.success("Version switched.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to switch version.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setRestoringVersion(null);
    }
  }

  async function handleMarkFinal() {
    if (!id || !project) {
      return;
    }

    try {
      setMarkingFinal(true);
      const updated = await markProjectFinal(id, buildPayload({ status: "completed" }));
      setProject(updated);
      setSelectedVersionId(updated.current_version_id);
      setProjectSaveState("Marked final");
      setErrorMessage("");
      toast.success("Project marked as final.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to mark final version.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setMarkingFinal(false);
    }
  }

  async function handleDelete() {
    if (!id) {
      return;
    }

    try {
      setDeleting(true);
      await deleteProject(id);
      toast.success("Project deleted.");
      navigate("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete project.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleExportPdf() {
    if (!project) {
      return;
    }

    try {
      const { exportProjectToPdf } = await import("@/lib/pdf");
      exportProjectToPdf(project);
      toast.success("PDF exported.");
    } catch {
      toast.error("Failed to export PDF.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!project) {
    return <p className="text-sm text-destructive">{errorMessage || "Project not found."}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <Button variant="outline" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Link>
          </Button>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold">{project.project_name}</h1>
              <Badge variant={getStatusVariant(project.status)}>{project.status.replace("_", " ")}</Badge>
              {project.current_version_id ? (
                <Badge variant="secondary">
                  Current {project.versions.find((version) => version.id === project.current_version_id)?.label ?? "version"}
                </Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground">
              {project.client_name} - {project.project_type}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExportPdf}>
            <Download className="size-4" />
            Export PDF
          </Button>

          <Button variant="outline" onClick={handleMarkFinal} disabled={markingFinal}>
            <CheckCircle2 className="size-4" />
            {markingFinal ? "Marking..." : "Mark Final"}
          </Button>

          <Button variant="outline" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="size-4" />
            {deleting ? "Deleting..." : "Delete Project"}
          </Button>
        </div>
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Project Details</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Update client information and discovery notes.
                </p>
              </div>
              <Badge variant="secondary">{projectSaveState}</Badge>
            </CardHeader>
            <CardContent>
              <ProjectForm
                initialValues={project}
                submitLabel="Save Project Details"
                onSubmit={handleUpdateCore}
                onChange={setCoreDraft}
                loading={savingProject}
                sectionMode="core"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Proposal Sections</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Edit each section inline and save updates as versions.
                </p>
              </div>
              <Button variant="outline" onClick={handleSaveAllProposalSections} disabled={savingProject}>
                <Save className="size-4" />
                {savingProject ? "Saving..." : "Save All Changes"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              {editableSections.map((section) => (
                <div
                  key={section.key}
                  className="rounded-[1.5rem] border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{section.title}</h3>
                      <p className="text-sm text-muted-foreground">{sectionSaveStates[section.key]}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveSection(section.key)}
                        disabled={savingSection === section.key}
                      >
                        <Save className="size-4" />
                        {savingSection === section.key ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>

                  <div className="transition-all duration-200">
                    <Textarea
                      value={sectionDrafts[section.key]}
                      onChange={(event) => updateSectionDraft(section.key, event.target.value)}
                      placeholder={section.placeholder}
                      className="min-h-[180px] resize-y"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Switch between saved versions and track proposal evolution.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.versions.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed p-5 text-sm text-muted-foreground">
                  No versions yet. Save proposal sections to create version history.
                </div>
              ) : (
                project.versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => setSelectedVersionId(version.id)}
                    className={`w-full rounded-[1.25rem] border p-4 text-left transition ${
                      selectedVersionId === version.id ? "border-primary bg-primary/5" : "hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{version.label}</p>
                          {version.is_final ? <Badge variant="success">Final</Badge> : null}
                          {project.current_version_id === version.id ? <Badge variant="secondary">Current</Badge> : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {version.source} - {new Date(version.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Clock3 className="size-4 text-muted-foreground" />
                    </div>

                    {version.changed_sections.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {version.changed_sections.map((field) => (
                          <Badge key={`${version.id}-${field}`} variant="outline">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </button>
                ))
              )}

              {selectedVersion && selectedVersion.id !== project.current_version_id ? (
                <Button
                  className="w-full"
                  onClick={() => handleRestoreVersion(selectedVersion.id)}
                  disabled={restoringVersion === selectedVersion.id}
                >
                  <RefreshCcw className="size-4" />
                  {restoringVersion === selectedVersion.id ? "Switching..." : `Switch to ${selectedVersion.label}`}
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selected Version Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              {!selectedVersion ? (
                <p className="text-muted-foreground">Select a version to preview.</p>
              ) : (
                generatedSections.map((section) => (
                  <div key={`${selectedVersion.id}-${section.title}`}>
                    <p className="font-medium">{section.title}</p>
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                      {selectedVersion[section.title.toLowerCase() as ProposalSectionKey] ||
                        `No ${section.title.toLowerCase()} saved in this version.`}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
