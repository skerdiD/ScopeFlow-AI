import { Filter, Search, UserCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  ACTIVITY_ACTOR_OPTIONS,
  ACTIVITY_TYPE_OPTIONS,
  type ActivityFilterActor,
  type ActivityFilterType
} from "@/lib/activity";

type ProjectFilterOption = {
  value: string;
  label: string;
};

type ActivityFiltersProps = {
  searchQuery: string;
  typeFilter: ActivityFilterType;
  actorFilter: ActivityFilterActor;
  projectFilter: string;
  projectOptions: ProjectFilterOption[];
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: ActivityFilterType) => void;
  onActorFilterChange: (value: ActivityFilterActor) => void;
  onProjectFilterChange: (value: string) => void;
};

export function ActivityFilters({
  searchQuery,
  typeFilter,
  actorFilter,
  projectFilter,
  projectOptions,
  onSearchChange,
  onTypeFilterChange,
  onActorFilterChange,
  onProjectFilterChange
}: ActivityFiltersProps) {
  return (
    <div className="rounded-[1.5rem] border bg-card p-5 shadow-sm">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_200px_240px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-11 rounded-2xl pl-10"
            placeholder="Search by activity title, description, or project..."
          />
        </div>

        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <select
            className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
            value={typeFilter}
            onChange={(event) => onTypeFilterChange(event.target.value as ActivityFilterType)}
          >
            {ACTIVITY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <UserCircle2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <select
            className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
            value={actorFilter}
            onChange={(event) => onActorFilterChange(event.target.value as ActivityFilterActor)}
          >
            {ACTIVITY_ACTOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <select
          className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
          value={projectFilter}
          onChange={(event) => onProjectFilterChange(event.target.value)}
        >
          <option value="all">All projects</option>
          {projectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
