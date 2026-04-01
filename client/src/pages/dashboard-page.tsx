import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  FileText,
  FolderKanban,
  PlusCircle,
  Search,
  Sparkles,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { DashboardMetricCard } from "@/components/dashboard/dashboard-metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createProject, deleteProject, getProjects, type ProposalProject, type ProposalProjectPayload } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

type StatusFilter = "all" | "draft" | "in_review" | "completed";
type SortOption = "updated_desc" | "updated_asc" | "name_asc" | "name_desc";

function getStatusVariant(status: string) {
  if (status === "completed") {
    return "success";
  }
  if (status === "in_review") {
    return "warning";
  }
  return "secondary";
}

function getStatusLabel(status: string) {
  return status.replace("_", " ");
}

function formatRelativeTime(dateValue: string) {
  const now = Date.now();
  const date = new Date(dateValue).getTime();
  const diffMs = now - date;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "just now";
  }
  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)}m ago`;
  }
  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}h ago`;
  }
  if (diffMs < day * 30) {
    return `${Math.floor(diffMs / day)}d ago`;
  }

  return new Date(dateValue).toLocaleDateString();
}

export function DashboardPage() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isAllProjectsView = pathname === "/projects";

  const [projects, setProjects] = useState<ProposalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("updated_desc");

  const [activeDeleteId, setActiveDeleteId] = useState<number | null>(null);
  const [activeDuplicateId, setActiveDuplicateId] = useState<number | null>(null);

  useEffect(() => {
    async function loadProjects() {
      if (!user?.id) {
        return;
      }

      try {
        setLoading(true);
        const data = await getProjects(user.id);
        setProjects(data);
        setErrorMessage("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch projects.";
        setErrorMessage(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, [user?.id]);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [projects]);

  const allProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = sortedProjects.filter((project) => {
      const matchesSearch =
        !query ||
        project.project_name.toLowerCase().includes(query) ||
        project.client_name.toLowerCase().includes(query) ||
        project.project_type.toLowerCase().includes(query) ||
        project.status.toLowerCase().includes(query);

      const matchesStatus = statusFilter === "all" ? true : project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    const result = [...filtered];
    result.sort((a, b) => {
      if (sortOption === "updated_desc") {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
      if (sortOption === "updated_asc") {
        return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      }
      if (sortOption === "name_asc") {
        return a.project_name.localeCompare(b.project_name);
      }
      return b.project_name.localeCompare(a.project_name);
    });

    return result;
  }, [searchQuery, sortOption, sortedProjects, statusFilter]);

  const recentProjects = useMemo(() => sortedProjects.slice(0, 6), [sortedProjects]);
  const recentActivity = useMemo(() => sortedProjects.slice(0, 5), [sortedProjects]);

  const completionRate = useMemo(() => {
    if (projects.length === 0) {
      return 0;
    }
    return Math.round((projects.filter((project) => project.status === "completed").length / projects.length) * 100);
  }, [projects]);

  const draftWarningsCount = useMemo(() => {
    const warningThresholdMs = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return projects.filter((project) => {
      if (project.status !== "draft") {
        return false;
      }
      return now - new Date(project.updated_at).getTime() >= warningThresholdMs;
    }).length;
  }, [projects]);

  const metrics = useMemo(
    () => [
      {
        label: "Active Projects",
        value: String(projects.length),
        description: "Total proposals tracked in workspace",
        icon: FolderKanban,
        tone: "accent" as const
      },
      {
        label: "In Review",
        value: String(projects.filter((project) => project.status === "in_review").length),
        description: "Ready for scope refinement and approval",
        icon: Sparkles,
        tone: "neutral" as const
      },
      {
        label: "Completed",
        value: String(projects.filter((project) => project.status === "completed").length),
        description: "Finalized proposals ready for handoff",
        icon: CheckCircle2,
        tone: "success" as const
      },
      {
        label: "Draft Warnings",
        value: String(draftWarningsCount),
        description: "Drafts unchanged for more than 14 days",
        icon: AlertTriangle,
        tone: "warning" as const
      }
    ],
    [draftWarningsCount, projects]
  );

  async function handleDelete(projectId: number) {
    try {
      setActiveDeleteId(projectId);
      await deleteProject(String(projectId));
      setProjects((current) => current.filter((project) => project.id !== projectId));
      toast.success("Project deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete project.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setActiveDeleteId(null);
    }
  }

  async function handleDuplicate(project: ProposalProject) {
    try {
      setActiveDuplicateId(project.id);

      const payload: ProposalProjectPayload = {
        user_id: project.user_id,
        client_name: project.client_name,
        project_name: `${project.project_name} Copy`,
        project_type: project.project_type,
        budget: project.budget,
        timeline: project.timeline,
        requirements: project.requirements,
        summary: project.summary,
        scope: project.scope,
        deliverables: project.deliverables,
        milestones: project.milestones,
        risks: project.risks,
        missing_information: project.missing_information,
        scope_risks: project.scope_risks,
        unclear_requirements: project.unclear_requirements,
        suggested_questions: project.suggested_questions,
        status: "draft"
      };

      const duplicated = await createProject(payload);
      setProjects((current) => [duplicated, ...current]);
      toast.success("Project duplicated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to duplicate project.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setActiveDuplicateId(null);
    }
  }

  if (isAllProjectsView) {
    return (
      <div className="space-y-6">
        <section className="rounded-[1.75rem] border bg-card px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">All Projects</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage every proposal in one place with fast status and action controls.
              </p>
            </div>
            <Badge variant="secondary">{allProjects.length} visible</Badge>
          </div>
        </section>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 rounded-2xl pl-10"
                  placeholder="Search by project, client, type, or status..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>

              <select
                className="h-11 rounded-2xl border border-border bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value="all">All status</option>
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="completed">Completed</option>
              </select>

              <select
                className="h-11 rounded-2xl border border-border bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as SortOption)}
              >
                <option value="updated_desc">Newest updated</option>
                <option value="updated_asc">Oldest updated</option>
                <option value="name_asc">Name A-Z</option>
                <option value="name_desc">Name Z-A</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-0">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_130px_130px_220px] items-center border-b px-6 py-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground md:grid">
              <p>Project</p>
              <p>Status</p>
              <p>Updated</p>
              <p className="text-right">Quick Action</p>
            </div>

            {loading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : null}

            {!loading && errorMessage ? (
              <div className="p-6 text-sm text-destructive">{errorMessage}</div>
            ) : null}

            {!loading && !errorMessage && allProjects.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border bg-background">
                  <FolderKanban className="size-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-tight">No matching projects</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Refine your filters or create a new project to continue.
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <Link to="/projects/new">
                    <PlusCircle className="size-4" />
                    Create Project
                  </Link>
                </Button>
              </div>
            ) : null}

            {!loading && !errorMessage && allProjects.length > 0 ? (
              <div className="divide-y">
                {allProjects.map((project) => (
                  <div key={project.id} className="px-6 py-4">
                    <div className="hidden grid-cols-[minmax(0,1.4fr)_130px_130px_220px] items-center gap-3 md:grid">
                      <div className="min-w-0">
                        <Link to={`/projects/${project.id}`} className="truncate font-semibold hover:text-primary">
                          {project.project_name}
                        </Link>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {project.client_name} · {project.project_type || "Unspecified type"}
                        </p>
                      </div>

                      <Badge variant={getStatusVariant(project.status)}>{getStatusLabel(project.status)}</Badge>
                      <p className="text-sm text-muted-foreground">{formatRelativeTime(project.updated_at)}</p>

                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/projects/${project.id}`}>
                            <Eye className="size-4" />
                            Open
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicate(project)}
                          disabled={activeDuplicateId === project.id}
                        >
                          <Copy className="size-4" />
                          {activeDuplicateId === project.id ? "Duplicating..." : "Duplicate"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(project.id)}
                          disabled={activeDeleteId === project.id}
                        >
                          <Trash2 className="size-4" />
                          {activeDeleteId === project.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 md:hidden">
                      <div>
                        <Link to={`/projects/${project.id}`} className="font-semibold hover:text-primary">
                          {project.project_name}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {project.client_name} · {project.project_type || "Unspecified type"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <Badge variant={getStatusVariant(project.status)}>{getStatusLabel(project.status)}</Badge>
                        <p className="text-xs text-muted-foreground">{formatRelativeTime(project.updated_at)}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/projects/${project.id}`}>
                            <Eye className="size-4" />
                            Open
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicate(project)}
                          disabled={activeDuplicateId === project.id}
                        >
                          <Copy className="size-4" />
                          Duplicate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(project.id)}
                          disabled={activeDeleteId === project.id}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-card px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Workspace Overview
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Delivery Dashboard</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Keep proposal work organized with a clear view of active projects, progress health, and latest activity.
            </p>
          </div>

          <Button variant="outline" asChild>
            <Link to="/projects">
              View All Projects
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <DashboardMetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            description={metric.description}
            icon={metric.icon}
            tone={metric.tone}
          />
        ))}
      </section>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Recent Projects</CardTitle>
                <CardDescription>Latest proposal work with quick access.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/projects">
                  See all
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden grid-cols-[minmax(0,1.3fr)_120px_120px_96px] items-center border-b px-6 py-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground md:grid">
              <p>Project</p>
              <p>Status</p>
              <p>Updated</p>
              <p className="text-right">Action</p>
            </div>

            {loading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : null}

            {!loading && errorMessage ? (
              <div className="p-6 text-sm text-destructive">{errorMessage}</div>
            ) : null}

            {!loading && !errorMessage && recentProjects.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border bg-background">
                  <FileText className="size-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">No projects yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start your first proposal from the Add Project button in the topbar.
                </p>
              </div>
            ) : null}

            {!loading && !errorMessage && recentProjects.length > 0 ? (
              <div className="divide-y">
                {recentProjects.map((project) => (
                  <div key={project.id} className="px-6 py-4">
                    <div className="hidden grid-cols-[minmax(0,1.3fr)_120px_120px_96px] items-center gap-3 md:grid">
                      <div className="min-w-0">
                        <Link to={`/projects/${project.id}`} className="truncate font-semibold hover:text-primary">
                          {project.project_name}
                        </Link>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {project.client_name} · {project.project_type || "Unspecified type"}
                        </p>
                      </div>
                      <Badge variant={getStatusVariant(project.status)}>{getStatusLabel(project.status)}</Badge>
                      <p className="text-sm text-muted-foreground">{formatRelativeTime(project.updated_at)}</p>
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/projects/${project.id}`}>
                            <Eye className="size-4" />
                            Open
                          </Link>
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 md:hidden">
                      <div>
                        <Link to={`/projects/${project.id}`} className="font-semibold hover:text-primary">
                          {project.project_name}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {project.client_name} · {project.project_type || "Unspecified type"}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant={getStatusVariant(project.status)}>{getStatusLabel(project.status)}</Badge>
                        <p className="text-xs text-muted-foreground">{formatRelativeTime(project.updated_at)}</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/projects/${project.id}`}>
                          <Eye className="size-4" />
                          Open Project
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">AI Insights</CardTitle>
              <CardDescription>Actionable guidance based on current workspace state.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="font-medium">Completion rate: {completionRate}%</p>
                <p className="mt-1 text-muted-foreground">
                  Prioritize in-review projects to increase final delivery throughput this week.
                </p>
              </div>
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="font-medium">{draftWarningsCount} stale drafts detected</p>
                <p className="mt-1 text-muted-foreground">
                  Revisit old drafts and either archive or push them into review to reduce pipeline drag.
                </p>
              </div>
              <div className="rounded-xl border bg-background/70 p-3">
                <p className="font-medium">Template opportunity</p>
                <p className="mt-1 text-muted-foreground">
                  Convert your strongest completed proposal into a reusable template for faster turnaround.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Most recent project updates in your workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                recentActivity.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="flex items-start justify-between gap-3 rounded-xl border p-3 transition hover:bg-secondary/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{project.project_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {project.client_name} · {getStatusLabel(project.status)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock3 className="size-3.5" />
                      {formatRelativeTime(project.updated_at)}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
