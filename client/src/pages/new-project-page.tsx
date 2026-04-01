import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ProjectForm } from "@/components/project/project-form";
import { createProject, type ProposalProjectPayload } from "@/lib/api";

export function NewProjectPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleCreateProject(payload: ProposalProjectPayload) {
    try {
      setLoading(true);
      setErrorMessage("");
      const project = await createProject(payload);
      toast.success("Project created.");
      navigate(`/projects/${project.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create project.";
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
        <p className="mt-1 text-muted-foreground">Create a proposal project with client scope details.</p>
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <ProjectForm submitLabel="Create Project" onSubmit={handleCreateProject} loading={loading} />
    </div>
  );
}
