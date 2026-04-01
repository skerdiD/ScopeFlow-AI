import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FileStack, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ProposalIntakeForm } from "@/components/project/proposal-intake-form";
import { generateProposal, type GenerateProposalPayload } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { logActivity } from "@/lib/activity";
import { getTemplateById, mapTemplateToIntakePrefill } from "@/lib/templates";

export function NewProjectPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedTemplateId = searchParams.get("template")?.trim() || "";
  const selectedTemplate = useMemo(
    () => (selectedTemplateId ? getTemplateById(selectedTemplateId) : null),
    [selectedTemplateId]
  );
  const templatePrefill = useMemo(
    () => (selectedTemplate ? mapTemplateToIntakePrefill(selectedTemplate) : undefined),
    [selectedTemplate]
  );

  useEffect(() => {
    if (!selectedTemplateId) {
      return;
    }
    if (!selectedTemplate) {
      toast.error("Template not found. Load a template again from the Template Library.");
      setSearchParams({});
    }
  }, [selectedTemplate, selectedTemplateId, setSearchParams]);

  async function handleGenerateProposal(payload: GenerateProposalPayload) {
    try {
      setLoading(true);
      setErrorMessage("");
      const project = await generateProposal(payload);

      logActivity({
        type: "project_created",
        title: "Project created",
        description: `${project.project_name} was created for ${project.client_name}.`,
        projectId: project.id,
        projectName: project.project_name,
        actor: "user",
        metadata: {
          status: project.status
        }
      });

      logActivity({
        type: "proposal_generated",
        title: "Proposal generated with AI",
        description: `AI generated proposal content for ${project.project_name}.`,
        projectId: project.id,
        projectName: project.project_name,
        actor: "ai",
        metadata: {
          model: "gemini"
        }
      });

      toast.success("Proposal generated.");
      navigate(`/projects/${project.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate proposal.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">New Project</h1>
        <p className="mt-1 text-muted-foreground">Enter lightweight project details and generate a polished proposal with AI.</p>
      </div>

      {selectedTemplate ? (
        <Card className="border-border/70 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Template Applied</p>
              <p className="text-sm text-muted-foreground">
                Using <span className="font-medium text-foreground">{selectedTemplate.name}</span> to prefill this intake.
              </p>
              <div className="inline-flex items-center gap-2">
                <Badge variant="secondary">
                  <FileStack className="size-3.5" />
                  {selectedTemplate.category}
                </Badge>
                <Link to="/templates" className="text-xs font-medium text-primary hover:underline">
                  Back to templates
                </Link>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchParams({})}
              disabled={loading}
            >
              <XCircle className="size-4" />
              Clear Template
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <ProposalIntakeForm
        loading={loading}
        onSubmit={handleGenerateProposal}
        onCancel={() => navigate("/dashboard")}
        submitLabel="Generate Proposal"
        initialValues={templatePrefill}
        prefillKey={selectedTemplate?.id}
      />
    </div>
  );
}
