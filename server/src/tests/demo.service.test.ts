import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ projects: new Map<string, Record<string, unknown>>(), nextProjectId: 1n, nextVersionId: 1n }));
const tx = vi.hoisted(() => ({
  userPlan: { upsert: vi.fn(), deleteMany: vi.fn() },
  usageRecord: { upsert: vi.fn(), deleteMany: vi.fn() },
  proposalProject: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  proposalVersion: { deleteMany: vi.fn(), create: vi.fn() },
  aIUsageLog: { deleteMany: vi.fn(), create: vi.fn() },
  aIQualityReview: { deleteMany: vi.fn(), create: vi.fn() }
}));
const prismaMock = vi.hoisted(() => ({
  localUser: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../config/env.js", () => ({ env: { DEMO_ACCOUNT_EMAIL: "demo@scopeflow.ai" } }));

import { DEMO_PROJECTS, seedDemoWorkspace } from "../services/demo.service.js";

describe("demo workspace seeding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.projects.clear();
    state.nextProjectId = 1n;
    state.nextVersionId = 1n;
    prismaMock.localUser.findFirst.mockResolvedValue({ id: 9, username: "demo-seed-demo", email: "demo@scopeflow.ai" });
    tx.userPlan.upsert.mockResolvedValue({ plan: "pro" });
    tx.usageRecord.upsert.mockResolvedValue({ aiGenerationsUsed: 50 });
    tx.proposalProject.findMany.mockResolvedValue([]);
    tx.proposalProject.findFirst.mockImplementation(({ where }: { where: { projectName: string } }) => state.projects.get(where.projectName) ?? null);
    tx.proposalProject.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      const project = { ...data, id: state.nextProjectId++ };
      state.projects.set(String(data.projectName), project);
      return project;
    });
    tx.proposalProject.update.mockImplementation(({ where, data }: { where: { id: bigint }; data: Record<string, unknown> }) => {
      const entry = [...state.projects.entries()].find(([, project]) => project.id === where.id);
      if (!entry) throw new Error("Missing fake project");
      const project = { ...entry[1], ...data };
      state.projects.set(entry[0], project);
      return project;
    });
    tx.proposalVersion.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ ...data, id: state.nextVersionId++ }));
    tx.proposalProject.findUniqueOrThrow.mockImplementation(({ where }: { where: { id: bigint } }) => {
      const project = [...state.projects.values()].find((item) => item.id === where.id);
      return { currentVersionId: project?.currentVersionId ?? null };
    });
  });

  it("contains the same ten demo workspace projects", () => {
    expect(DEMO_PROJECTS).toHaveLength(10);
    expect(DEMO_PROJECTS.map((project) => project.projectName)).toContain("SaaS Landing Page Proposal");
    expect(DEMO_PROJECTS.map((project) => project.projectName)).toContain("Agency Retainer Proposal");
  });

  it("is idempotent by owner and project name", async () => {
    await seedDemoWorkspace();
    await seedDemoWorkspace();

    expect(state.projects.size).toBe(10);
    expect(tx.proposalProject.create).toHaveBeenCalledTimes(10);
    expect(tx.proposalVersion.create).toHaveBeenCalledTimes(46);
    expect(tx.aIUsageLog.create).toHaveBeenCalledTimes(16);
    expect(tx.aIQualityReview.create).toHaveBeenCalledTimes(8);
    expect(tx.proposalProject.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isDemo: true })
    }));
    expect(tx.proposalProject.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ updatedAt: expect.any(Date) })
    }));
  });

  it("scopes reset deletion to known demo projects owned by the demo account", async () => {
    tx.proposalProject.findMany.mockResolvedValue([{ id: 41n }, { id: 42n }]);

    await seedDemoWorkspace({ reset: true });

    expect(tx.proposalProject.findMany).toHaveBeenCalledWith({
      where: {
        isDemo: true,
        OR: [{ ownerId: 9 }, { ownerId: null, userId: "demo-seed-demo" }]
      },
      select: { id: true }
    });
    expect(tx.proposalProject.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: [41n, 42n] },
        isDemo: true,
        OR: [{ ownerId: 9 }, { ownerId: null, userId: "demo-seed-demo" }]
      }
    });
    expect(tx.aIUsageLog.deleteMany).toHaveBeenCalledWith({
      where: { userId: 9, projectId: { in: [41n, 42n] } }
    });
  });
});
