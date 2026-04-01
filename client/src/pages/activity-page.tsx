import { useMemo, useState } from "react";
import { Activity as ActivityIcon } from "lucide-react";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { ActivityFilters } from "@/components/activity/activity-filters";
import { Badge } from "@/components/ui/badge";
import { groupActivityEventsByDate, type ActivityFilterActor, type ActivityFilterType } from "@/lib/activity";
import { useActivity } from "@/hooks/use-activity";

export function ActivityPage() {
  const { events, loading } = useActivity();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ActivityFilterType>("all");
  const [actorFilter, setActorFilter] = useState<ActivityFilterActor>("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const event of events) {
      if (!event.projectName.trim()) {
        continue;
      }
      const key = event.projectId ? `id:${event.projectId}` : `name:${event.projectName}`;
      if (!map.has(key)) {
        map.set(key, event.projectName);
      }
    }

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return events.filter((event) => {
      const matchesSearch =
        !query ||
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        event.projectName.toLowerCase().includes(query);

      const matchesType = typeFilter === "all" ? true : event.type === typeFilter;
      const matchesActor = actorFilter === "all" ? true : event.actor === actorFilter;

      const matchesProject = (() => {
        if (projectFilter === "all") {
          return true;
        }
        if (projectFilter.startsWith("id:")) {
          const projectId = projectFilter.replace("id:", "");
          return event.projectId === projectId;
        }
        const projectName = projectFilter.replace("name:", "");
        return event.projectName === projectName;
      })();

      return matchesSearch && matchesType && matchesActor && matchesProject;
    });
  }, [actorFilter, events, projectFilter, searchQuery, typeFilter]);

  const groupedEvents = useMemo(() => groupActivityEventsByDate(filteredEvents), [filteredEvents]);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border bg-card px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <ActivityIcon className="size-3.5 text-primary" />
              Workspace Timeline
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Track proposal, template, and project actions across your workspace in one clean timeline.
            </p>
          </div>
          <Badge variant="secondary">{filteredEvents.length} events</Badge>
        </div>
      </section>

      <ActivityFilters
        searchQuery={searchQuery}
        typeFilter={typeFilter}
        actorFilter={actorFilter}
        projectFilter={projectFilter}
        projectOptions={projectOptions}
        onSearchChange={setSearchQuery}
        onTypeFilterChange={setTypeFilter}
        onActorFilterChange={setActorFilter}
        onProjectFilterChange={setProjectFilter}
      />

      <ActivityFeed
        loading={loading}
        groups={groupedEvents}
        isFilteredEmpty={!loading && groupedEvents.length === 0}
      />
    </div>
  );
}
