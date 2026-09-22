import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/error.middleware.js";
import { detailInclude } from "./project.service.js";

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

async function sharedProject(token: string, db: DatabaseClient = prisma) {
  if (!token || token.length > 64) throw new ApiError(404, "Not found.");
  const project = await db.proposalProject.findFirst({
    where: {
      shareToken: token,
      shareEnabled: true,
      shareExpiresAt: { gt: new Date() },
      isDemo: false
    },
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
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const project = await sharedProject(token, tx);
    const updated = await tx.proposalProject.updateMany({
      where: {
        id: project.id,
        shareEnabled: true,
        shareExpiresAt: { gt: now },
        approvedAt: null,
        rejectedAt: null,
        status: { notIn: ["approved", "rejected"] }
      },
      data: {
        status: input.status,
        clientNameResponse: input.client_name,
        clientEmailResponse: input.client_email,
        clientResponseComment: input.comment,
        approvedAt: input.status === "approved" ? now : undefined,
        rejectedAt: input.status === "rejected" ? now : undefined
      }
    });
    if (updated.count === 0) {
      const stillShared = await tx.proposalProject.findFirst({
        where: { id: project.id, shareEnabled: true, shareExpiresAt: { gt: new Date() }, isDemo: false },
        select: { id: true }
      });
      if (!stillShared) throw new ApiError(404, "Not found.");
      throw new ApiError(409, "A final response has already been recorded.");
    }
    if (input.comment.trim()) {
      await tx.proposalClientComment.create({
        data: {
          projectId: project.id,
          clientName: input.client_name,
          clientEmail: input.client_email,
          comment: input.comment,
          createdAt: new Date()
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
  return prisma.$transaction(async (tx) => {
    const project = await sharedProject(token, tx);
    return tx.proposalClientComment.create({
      data: {
        projectId: project.id,
        clientName: input.client_name,
        clientEmail: input.client_email,
        comment: input.comment,
        createdAt: new Date()
      }
    });
  });
}
