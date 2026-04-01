import { ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <Badge variant="outline">Workspace</Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-primary" />
              Proposal Preferences
            </CardTitle>
            <CardDescription>
              Configure proposal defaults, section behavior, and output style controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Personalization options for AI generation and proposal formatting will appear here.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Security
            </CardTitle>
            <CardDescription>
              Review account-level safeguards and connected session details.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Security controls and session history management will be available in this section.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
