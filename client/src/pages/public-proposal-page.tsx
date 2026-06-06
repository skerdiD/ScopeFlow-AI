import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, MessageSquare, XCircle } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addPublicProposalComment, getPublicProposal, respondToPublicProposal, type PublicProposal } from "@/lib/api";

const sections: { key: keyof PublicProposal["content"]; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "scope", label: "Scope of Work" },
  { key: "deliverables", label: "Deliverables" },
  { key: "milestones", label: "Milestones" },
  { key: "proposal_timeline", label: "Timeline" },
  { key: "pricing", label: "Pricing" },
  { key: "risks", label: "Risks and Assumptions" },
  { key: "next_steps", label: "Next Steps" },
];

export function PublicProposalPage() {
  const { token = "" } = useParams();
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [comment, setComment] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    getPublicProposal(token)
      .then(setProposal)
      .catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : "Proposal link is unavailable."));
  }, [token]);

  async function respond(status: "approved" | "rejected") {
    try {
      setSubmitting(true);
      const updated = await respondToPublicProposal(token, {
        status,
        confirmed,
        client_name: clientName,
        client_email: clientEmail,
        comment,
      });
      setProposal(updated);
      setComment("");
      toast.success(status === "approved" ? "Proposal approved." : "Response recorded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record response.");
    } finally {
      setSubmitting(false);
    }
  }

  async function addComment() {
    if (!comment.trim()) {
      toast.error("Enter a comment first.");
      return;
    }
    try {
      setSubmitting(true);
      await addPublicProposalComment(token, { client_name: clientName, client_email: clientEmail, comment });
      setComment("");
      toast.success("Comment sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send comment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (errorMessage) {
    return <main className="mx-auto max-w-3xl p-6"><p className="text-sm text-destructive">{errorMessage}</p></main>;
  }
  if (!proposal) {
    return <main className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">Loading proposal...</main>;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <BrandLogo />
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">{proposal.project_name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Prepared for {proposal.client_name}</p>
              </div>
              <Badge variant="secondary" className="capitalize">{proposal.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <p><span className="font-medium">Project type:</span> {proposal.project_type || "-"}</p>
            <p><span className="font-medium">Budget:</span> {proposal.budget || "-"}</p>
            <p><span className="font-medium">Timeline:</span> {proposal.timeline || "-"}</p>
          </CardContent>
        </Card>

        {sections.map((section) => section.key !== "source_label" && proposal.content[section.key] ? (
          <Card key={section.key}>
            <CardHeader><CardTitle>{section.label}</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap leading-7 text-muted-foreground">{proposal.content[section.key]}</p></CardContent>
          </Card>
        ) : null)}

        {proposal.payment_url ? (
          <Button asChild variant="outline">
            <a href={proposal.payment_url} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />Open payment or deposit link</a>
          </Button>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Client Approval and Feedback</CardTitle>
            <p className="text-sm text-muted-foreground">This records client approval or feedback. It is not a legal e-signature.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Your name (optional)" />
              <Input type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} placeholder="Your email (optional)" />
            </div>
            <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Comment or feedback (optional)" />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
              <span>I confirm I approve this proposal.</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => respond("approved")} disabled={submitting || !confirmed}><CheckCircle2 className="size-4" />Approve proposal</Button>
              <Button variant="outline" onClick={() => respond("rejected")} disabled={submitting}><XCircle className="size-4" />Reject proposal</Button>
              <Button variant="outline" onClick={addComment} disabled={submitting || !comment.trim()}><MessageSquare className="size-4" />Send comment only</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
