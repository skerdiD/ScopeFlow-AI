import {
  CheckCircle2,
  Download,
  FilePlus2,
  FileStack,
  FolderKanban,
  RefreshCcw,
  Save,
  Sparkles,
  WandSparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { formatActivityTimestamp, type ActivityEvent, type ActivityType } from "@/lib/activity";
import { cn } from "@/lib/utils";

const typeStyleMap: Record<
  ActivityType,
  {
    icon: typeof Sparkles;
    iconWrap: string;
    iconColor: string;
  }
> = {
  project_created: {
    icon: FolderKanban,
    iconWrap: "bg-sky-500/10 border-sky-500/20",
    iconColor: "text-sky-600"
  },
  project_updated: {
    icon: RefreshCcw,
    iconWrap: "bg-indigo-500/10 border-indigo-500/20",
    iconColor: "text-indigo-600"
  },
  proposal_generated: {
    icon: Sparkles,
    iconWrap: "bg-primary/10 border-primary/20",
    iconColor: "text-primary"
  },
  section_regenerated: {
    icon: WandSparkles,
    iconWrap: "bg-violet-500/10 border-violet-500/20",
    iconColor: "text-violet-600"
  },
  version_saved: {
    icon: Save,
    iconWrap: "bg-emerald-500/10 border-emerald-500/20",
    iconColor: "text-emerald-600"
  },
  final_marked: {
    icon: CheckCircle2,
    iconWrap: "bg-emerald-500/10 border-emerald-500/20",
    iconColor: "text-emerald-600"
  },
  template_used: {
    icon: FileStack,
    iconWrap: "bg-primary/10 border-primary/20",
    iconColor: "text-primary"
  },
  template_created: {
    icon: FilePlus2,
    iconWrap: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-600"
  },
  pdf_exported: {
    icon: Download,
    iconWrap: "bg-slate-500/10 border-slate-500/20",
    iconColor: "text-slate-700"
  },
  status_changed: {
    icon: RefreshCcw,
    iconWrap: "bg-cyan-500/10 border-cyan-500/20",
    iconColor: "text-cyan-700"
  }
};

const actorBadgeStyles: Record<"user" | "system" | "ai", "secondary" | "outline" | "warning"> = {
  user: "secondary",
  system: "outline",
  ai: "warning"
};

type ActivityItemProps = {
  event: ActivityEvent;
  isLast: boolean;
};

export function ActivityItem({ event, isLast }: ActivityItemProps) {
  const style = typeStyleMap[event.type];
  const Icon = style.icon;

  return (
    <div className="relative pl-12">
      <div className="absolute left-0 top-0 flex flex-col items-center">
        <div className={cn("flex size-9 items-center justify-center rounded-xl border", style.iconWrap)}>
          <Icon className={cn("size-4", style.iconColor)} />
        </div>
        {!isLast ? <div className="mt-2 h-[calc(100%-2.25rem)] w-px bg-border" /> : null}
      </div>

      <div className="rounded-xl border bg-card px-4 py-3 transition hover:bg-secondary/20">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">{event.title}</p>
            {event.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
            ) : null}
          </div>

          <Badge variant={actorBadgeStyles[event.actor]}>{event.actor}</Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{formatActivityTimestamp(event.createdAt)}</span>
          {event.projectName ? <span>-</span> : null}
          {event.projectId ? (
            <Link to={`/projects/${event.projectId}`} className="font-medium text-primary hover:underline">
              {event.projectName}
            </Link>
          ) : event.projectName ? (
            <span>{event.projectName}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}