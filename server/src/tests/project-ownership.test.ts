import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  proposalProject: {
    findFirst: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));

import { deleteProject, getProject } from "../services/project.service.js";

describe("project ownership enforcement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries project detail by both id and authenticated owner", async () => {
    prismaMock.proposalProject.findFirst.mockResolvedValue(null);
    await expect(getProject("owner-a", 42n)).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.proposalProject.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 42n, userId: "owner-a" }
    }));
  });

  it("does not delete when the project is outside the authenticated owner scope", async () => {
    prismaMock.proposalProject.findFirst.mockResolvedValue(null);
    await expect(deleteProject("owner-a", 42n, false)).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.proposalProject.delete).not.toHaveBeenCalled();
  });

  it("blocks destructive demo actions before querying project data", async () => {
    await expect(deleteProject("demo-seed-user", 42n, true)).rejects.toMatchObject({ status: 403 });
    expect(prismaMock.proposalProject.findFirst).not.toHaveBeenCalled();
  });
});
