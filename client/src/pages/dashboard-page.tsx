import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  FileText,
  FolderKanban,
  PlusCircle,
  Search,
  Sparkles,
  SquarePen,
  Trash2,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteProject, getProjects, createProject, type ProposalProject, type ProposalProjectPayload } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "draft" | "in_review" | "completed";
type DateFilter = "all" | "7d" | "30d" | "90d";
type SortOption = "updated_desc" | "updated_asc" | "name_asc" | "name_desc";

type StatCard = {
  label: string;
  value: string;
  description: string;
  icon: typeof FolderKanban;
  tone: string;
};

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProposalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
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

  const filteredProjects = useMemo(() => {
    const now = Date.now();

    const byDate = (project: ProposalProject) => {
      if (dateFilter === "all") {
        return true;
      }

      const updatedAt = new Date(project.updated_at).getTime();
      const diff = now - updatedAt;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const ninetyDays = 90 * 24 * 60 * 60 * 1000;

      if (dateFilter === "7d") {
        return diff <= sevenDays;
      }

      if (dateFilter === "30d") {
        return diff <= thirtyDays;
      }

      return diff <= ninetyDays;
    };

    const bySearch = (project: ProposalProject) => {
      const q = searchQuery.trim().toLowerCase();

      if (!q) {
        return true;
      }

      return (
        project.project_name.toLowerCase().includes(q) ||
        project.client_name.toLowerCase().includes(q) ||
        project.project_type.toLowerCase().includes(q) ||
        project.status.toLowerCase().includes(q)
      );
    };

    const byStatus = (project: ProposalProject) => {
      if (statusFilter === "all") {
        return true;
      }

      return project.status === statusFilter;
    };

    const result = projects.filter((project) => bySearch(project) && byStatus(project) && byDate(project));

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
  }, [projects, searchQuery, statusFilter, dateFilter, sortOption]);

  const stats = useMemo<StatCard[]>(() => {
    const total = projects.length;
    const drafts = projects.filter((project) => project.status === "draft").length;
    const completed = projects.filter((project) => project.status === "completed").length;
    const thisMonth = projects.filter((project) => {
      const projectDate = new Date(project.created_at);
      const now = new Date();

      return projectDate.getMonth() === now.getMonth() && projectDate.getFullYear() === now.getFullYear();
    }).length;

    return [
      {
        label: "Total Projects",
        value: String(total),
        description: "Active proposal workspace",
        icon: FolderKanban,
        tone: "from-violet-500/15 via-violet-500/5 to-transparent"
      },
      {
        label: "Drafts",
        value: String(drafts),
        description: "Still being shaped",
        icon: FileText,
        tone: "from-amber-500/15 via-amber-500/5 to-transparent"
      },
      {
        label: "Completed",
        value: String(completed),
        description: "Ready for delivery",
        icon: CheckCircle2,
        tone: "from-emerald-500/15 via-emerald-500/5 to-transparent"
      },
      {
        label: "This Month",
        value: String(thisMonth),
        description: "New opportunities added",
        icon: CalendarClock,
        tone: "from-sky-500/15 via-sky-500/5 to-transparent"
      }
    ];
  }, [projects]);

  const recentActivity = useMemo(() => {
    return [...projects]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 6);
  }, [projects]);

  const completionRate = useMemo(() => {
    if (projects.length === 0) {
      return 0;
    }

    return Math.round((projects.filter((project) => project.status === "completed").length / projects.length) * 100);
  }, [projects]);

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

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border bg-card shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.12),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_24%)]" />
        <div className="relative flex flex-col gap-8 px-6 py-8 md:px-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="size-3.5 text-primary" />
              ScopeFlow AI Workspace
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Proposal Dashboard</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Organize discovery notes, manage project scope, and move from vague client ideas to polished proposals with a clean premium workflow.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 backdrop-blur">
                <TrendingUp className="size-4 text-primary" />
                {completionRate}% completion rate
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 backdrop-blur">
                <Clock3 className="size-4 text-primary" />
                {filteredProjects.length} visible projects
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-sm">
              <Link to="/projects/new">
                <PlusCircle className="size-4" />
                New Project
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card
              key={stat.label}
              className="group relative overflow-hidden border-border/70 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br", stat.tone)} />
              <CardContent className="relative p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <p className="text-4xl font-semibold tracking-tight">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  </div>
                  <div className="flex size-12 items-center justify-center rounded-2xl border bg-background/80 shadow-sm backdrop-blur">
                    <Icon className="size-5 text-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-5 md:p-6">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px_200px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-11 rounded-2xl border-border/80 bg-background pl-10 shadow-none"
                    placeholder="Search by project, client, type, or status..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>

                <select
                  className="flex h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                >
                  <option value="all">All status</option>
                  <option value="draft">Draft</option>
                  <option value="in_review">In review</option>
                  <option value="completed">Completed</option>
                </select>

                <select
                  className="flex h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value as DateFilter)}
                >
                  <option value="all">All dates</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>

                <div className="relative">
                  <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    className="flex h-11 w-full rounded-2xl border border-border/80 bg-background pl-10 pr-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
                    value={sortOption}
                    onChange={(event) => setSortOption(event.target.value as SortOption)}
                  >
                    <option value="updated_desc">Newest updated</option>
                    <option value="updated_asc">Oldest updated</option>
                    <option value="name_asc">Name A-Z</option>
                    <option value="name_desc">Name Z-A</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Card className="border-border/70 shadow-sm">
                  <CardContent className="space-y-4 p-6">
                    <Skeleton className="h-6 w-52" />
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/70 shadow-sm">
                  <CardContent className="space-y-3 p-6">
                    <Skeleton className="h-5 w-72" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {errorMessage ? (
              <Card className="border-destructive/20 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm text-destructive">{errorMessage}</p>
                </CardContent>
              </Card>
            ) : null}

            {!loading && !errorMessage && filteredProjects.length === 0 ? (
              <Card className="overflow-hidden border-dashed shadow-sm">
                <CardContent className="relative flex flex-col items-center px-6 py-16 text-center">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_30%)]" />
                  <div className="relative flex size-16 items-center justify-center rounded-[1.75rem] border bg-background shadow-sm">
                    <FolderKanban className="size-7 text-muted-foreground" />
                  </div>
                  <h3 className="relative mt-5 text-2xl font-semibold tracking-tight">No matching projects</h3>
                  <p className="relative mt-2 max-w-md text-sm text-muted-foreground">
                    Try adjusting your filters or create a fresh project to start building a polished proposal workflow.
                  </p>
                  <Button asChild className="relative mt-6 shadow-sm">
                    <Link to="/projects/new">
                      <PlusCircle className="size-4" />
                      Create Project
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {filteredProjects.map((project) => (
              <Card
                key={project.id}
                className="group overflow-hidden border-border/70 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1 space-y-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <Link
                              to={`/projects/${project.id}`}
                              className="truncate text-xl font-semibold tracking-tight transition group-hover:text-primary"
                            >
                              {project.project_name}
                            </Link>
                            <Badge variant={getStatusVariant(project.status)}>
                              {getStatusLabel(project.status)}
                            </Badge>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {project.client_name} · {project.project_type}
                          </p>
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
                          <CalendarClock className="size-3.5" />
                          Updated {new Date(project.updated_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border bg-background/70 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Type</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{project.project_type || "Not set"}</p>
                        </div>
                        <div className="rounded-2xl border bg-background/70 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Budget</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{project.budget || "Not set"}</p>
                        </div>
                        <div className="rounded-2xl border bg-background/70 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Timeline</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{project.timeline || "Not set"}</p>
                        </div>
                        <div className="rounded-2xl border bg-background/70 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Client</p>
                          <p className="mt-2 truncate text-sm font-medium text-foreground">{project.client_name || "Not set"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:w-[220px] xl:justify-end">
                      <Button variant="outline" size="sm" asChild className="rounded-xl">
                        <Link to={`/projects/${project.id}`}>
                          <Eye className="size-4" />
                          View
                        </Link>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        <SquarePen className="size-4" />
                        Edit
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => handleDuplicate(project)}
                        disabled={activeDuplicateId === project.id}
                      >
                        <Copy className="size-4" />
                        {activeDuplicateId === project.id ? "Duplicating..." : "Duplicate"}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => handleDelete(project.id)}
                        disabled={activeDeleteId === project.id}
                      >
                        <Trash2 className="size-4" />
                        {activeDeleteId === project.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardContent className="p-6">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Recent Activity</p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">Latest project updates</h2>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-secondary">
                    <ArrowUpRight className="size-4 text-foreground" />
                  </div>
                </div>

                {recentActivity.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed p-6 text-sm text-muted-foreground">
                    No recent activity yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.map((project) => (
                      <Link
                        key={project.id}
                        to={`/projects/${project.id}`}
                        className="block rounded-[1.25rem] border p-4 transition hover:bg-secondary/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{project.project_name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {project.client_name} · {getStatusLabel(project.status)}
                            </p>
                          </div>
                          <Badge variant={getStatusVariant(project.status)}>
                            {getStatusLabel(project.status)}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Updated {new Date(project.updated_at).toLocaleString()}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardContent className="p-6">
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Workspace Insights</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">Performance snapshot</h2>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.25rem] border bg-background/70 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Completion rate</p>
                      <p className="text-sm font-semibold">{completionRate}%</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] bg-secondary/60 p-4 text-sm text-muted-foreground">
                    Keep projects in <span className="font-medium text-foreground">Draft</span> while collecting raw client notes,
                    then move them to <span className="font-medium text-foreground">In Review</span> when shaping scope and deliverables.
                  </div>

                  <div className="rounded-[1.25rem] bg-secondary/60 p-4 text-sm text-muted-foreground">
                    Duplicate your best-performing proposal structures to speed up delivery and keep a premium workflow across new leads.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}
