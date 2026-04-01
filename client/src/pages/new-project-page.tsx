import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ProposalIntakeForm } from "@/components/project/proposal-intake-form";
import { generateProposal, type GenerateProposalPayload } from "@/lib/api";

export function NewProjectPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleGenerateProposal(payload: GenerateProposalPayload) {
    try {
      setLoading(true);
      setErrorMessage("");
      const project = await generateProposal(payload);
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

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <ProposalIntakeForm
        loading={loading}
        onSubmit={handleGenerateProposal}
        onCancel={() => navigate("/dashboard")}
        submitLabel="Generate Proposal"
      />
    </div>
  );
}
