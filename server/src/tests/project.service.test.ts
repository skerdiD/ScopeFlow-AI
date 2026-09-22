import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  proposalProject: {
    create: vi.fn(),
    update: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn()
  },
  proposalVersion: {
    aggregate: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  }
}));
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  proposalProject: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() }
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));

import { createProject, manageShareLink, updateProject } from "../services/project.service.js";

const baseProject = {
  id: 1n,
  userId: "owner-id",
  summary: "Initial",
  scope: "",
  deliverables: "",
  milestones: "",
  proposalTimeline: "",
  pricing: "",
  risks: "",
  nextSteps: ""
};

describe("project persistence transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.proposalProject.create.mockResolvedValue(baseProject);
    tx.proposalProject.update.mockResolvedValue(baseProject);
    tx.proposalProject.findUniqueOrThrow.mockResolvedValue(baseProject);
    tx.proposalVersion.aggregate.mockResolvedValue({ _max: { versionNumber: null } });
    tx.proposalVersion.create.mockResolvedValue({ id: 10n, versionNumber: 1 });
  });

  it("creates the project and initial version atomically under the authenticated owner", async () => {
    await createProject("owner-id", {
      client_name: "Acme",
      project_name: "Website",
      project_type: "Web Design",
      summary: "Initial"
    }, false);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(tx.proposalProject.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "owner-id", clientName: "Acme", isDemo: false })
    }));
    expect(tx.proposalVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ projectId: 1n, versionNumber: 1, source: "manual" })
    }));
  });

  it("creates a new version only for changed proposal sections", async () => {
    tx.proposalProject.findFirst.mockResolvedValue(baseProject);
    tx.proposalProject.update
      .mockResolvedValueOnce({ ...baseProject, summary: "Changed" })
      .mockResolvedValue(baseProject);

    await updateProject("owner-id", 1n, { summary: "Changed" });

    expect(tx.proposalVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ changedSections: ["summary"] })
    }));
  });

  it("sets a fresh expiration whenever sharing is enabled", async () => {
    prismaMock.proposalProject.findFirst
      .mockResolvedValueOnce({ ...baseProject, shareToken: "existing-token", shareEnabled: false, isDemo: false })
      .mockResolvedValueOnce({ ...baseProject, versions: [], clientComments: [] });

    await manageShareLink("owner-id", 1n, "generate", false);

    const update = prismaMock.proposalProject.update.mock.calls[0]?.[0];
    expect(update.data).toMatchObject({
      shareToken: "existing-token",
      shareEnabled: true
    });
    expect(update.data.shareCreatedAt).toBeInstanceOf(Date);
    expect(update.data.shareExpiresAt).toBeInstanceOf(Date);
    expect(update.data.shareExpiresAt.getTime()).toBeGreaterThan(update.data.shareCreatedAt.getTime());
  });
});
