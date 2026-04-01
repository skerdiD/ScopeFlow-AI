import { FileStack, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">Templates</h1>
        <Badge variant="secondary">Coming soon</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileStack className="size-5 text-primary" />
            Proposal Template Library
          </CardTitle>
          <CardDescription>
            Save reusable proposal structures, scope blocks, and milestone frameworks for faster generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Template packs will support different project types, budgets, and delivery models.</p>
          <p className="flex items-center gap-2">
            <WandSparkles className="size-4 text-primary" />
            AI-assisted template suggestions will be available in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
