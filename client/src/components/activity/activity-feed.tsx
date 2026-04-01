import { Activity, FolderSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type ActivityGroup } from "@/lib/activity";
import { ActivityItem } from "@/components/activity/activity-item";

type ActivityFeedProps = {
  loading: boolean;
  groups: ActivityGroup[];
  isFilteredEmpty: boolean;
};

export function ActivityFeed({ loading, groups, isFilteredEmpty }: ActivityFeedProps) {
  if (loading) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardContent className="space-y-4 p-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isFilteredEmpty) {
    return (
      <Card className="border-dashed shadow-sm">
        <CardContent className="px-6 py-16 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border bg-background">
            <FolderSearch className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-xl font-semibold tracking-tight">No matching activity</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting search and filters to find specific workspace actions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.label} className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {group.label}
            </h2>
          </div>

          <div className="space-y-4">
            {group.events.map((event, index) => (
              <ActivityItem key={event.id} event={event} isLast={index === group.events.length - 1} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
