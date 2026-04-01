import { Activity, Clock3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const activityPreview = [
  "Project version updated",
  "Proposal generated with AI",
  "Final version marked",
];

export function ActivityPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Activity</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            Workspace Activity Feed
          </CardTitle>
          <CardDescription>
            Review recent project actions and proposal updates in one timeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activityPreview.map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-xl border bg-background/60 px-4 py-3 text-sm">
              <Clock3 className="size-4 text-muted-foreground" />
              <span>{item}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
