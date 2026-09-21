import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/error.middleware.js";
import { detailInclude } from "./project.service.js";

async function sharedProject(token: string) {
  const project = await prisma.proposalProject.findFirst({
    where: { shareToken: token, shareEnabled: true, isDemo: false },
    include: detailInclude
  });
  if (!project) throw new ApiError(404, "Not found.");
  return project;
}

export async function viewPublicProject(token: string) {
  const project = await sharedProject(token);
  if (project.viewedAt === null || project.status === "sent") {
    await prisma.proposalProject.update({
      where: { id: project.id },
      data: {
        viewedAt: project.viewedAt ?? new Date(),
        status: project.status === "sent" ? "viewed" : project.status
      }
    });
    return sharedProject(token);
  }
  return project;
}

export async function respondToPublicProject(token: string, input: {
  status: "approved" | "rejected";
  client_name: string;
  client_email: string;
  comment: string;
}) {
  const project = await sharedProject(token);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.proposalProject.update({
      where: { id: project.id },
      data: {
        status: input.status,
        clientNameResponse: input.client_name,
        clientEmailResponse: input.client_email,
        clientResponseComment: input.comment,
        approvedAt: input.status === "approved" ? now : null,
        rejectedAt: input.status === "rejected" ? now : null
      }
    });
    if (input.comment.trim()) {
      await tx.proposalClientComment.create({
        data: {
          projectId: project.id,
          clientName: input.client_name,
          clientEmail: input.client_email,
          comment: input.comment
        }
      });
    }
  });
  return sharedProject(token);
}

export async function addPublicComment(token: string, input: {
  client_name: string;
  client_email: string;
  comment: string;
}) {
  const project = await sharedProject(token);
  return prisma.proposalClientComment.create({
    data: {
      projectId: project.id,
      clientName: input.client_name,
      clientEmail: input.client_email,
      comment: input.comment
    }
  });
}
