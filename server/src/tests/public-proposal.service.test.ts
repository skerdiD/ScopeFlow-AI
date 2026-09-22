import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  proposalProject: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  },
  proposalClientComment: { create: vi.fn() },
  $transaction: vi.fn()
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));

import { respondToPublicProject, viewPublicProject } from "../services/public-proposal.service.js";

const activeProject = {
  id: 12n,
  status: "viewed",
  viewedAt: new Date("2026-09-20T10:00:00.000Z")
};

describe("public proposal access and audit integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (client: typeof prismaMock) => unknown) => callback(prismaMock));
  });

  it("rejects disabled sharing without exposing proposal data", async () => {
    prismaMock.proposalProject.findFirst.mockResolvedValue(null);

    await expect(viewPublicProject("disabled-token")).rejects.toMatchObject({ status: 404, message: "Not found." });
    expect(prismaMock.proposalProject.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ shareEnabled: true, isDemo: false })
    }));
  });

  it("requires a non-expired share link", async () => {
    prismaMock.proposalProject.findFirst.mockResolvedValue(null);

    await expect(viewPublicProject("expired-token")).rejects.toMatchObject({ status: 404, message: "Not found." });
    expect(prismaMock.proposalProject.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ shareExpiresAt: { gt: expect.any(Date) } })
    }));
  });

  it("returns a valid, non-expired shared proposal", async () => {
    prismaMock.proposalProject.findFirst.mockResolvedValue(activeProject);

    await expect(viewPublicProject("valid-token")).resolves.toBe(activeProject);
  });

  it("returns conflict and preserves metadata when a final response already exists", async () => {
    prismaMock.proposalProject.findFirst
      .mockResolvedValueOnce(activeProject)
      .mockResolvedValueOnce({ id: activeProject.id });
    prismaMock.proposalProject.updateMany.mockResolvedValue({ count: 0 });

    await expect(respondToPublicProject("valid-token", {
      status: "rejected",
      client_name: "Second responder",
      client_email: "second@example.com",
      comment: "Overwrite attempt"
    })).rejects.toMatchObject({ status: 409 });

    expect(prismaMock.proposalClientComment.create).not.toHaveBeenCalled();
    expect(prismaMock.proposalProject.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ approvedAt: null, rejectedAt: null })
    }));
  });

  it("rejects malformed tokens with the same generic response and no database lookup", async () => {
    await expect(viewPublicProject("x".repeat(65))).rejects.toMatchObject({ status: 404, message: "Not found." });
    expect(prismaMock.proposalProject.findFirst).not.toHaveBeenCalled();
  });
});
