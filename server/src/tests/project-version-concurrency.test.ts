import { describe, expect, it } from "vitest";
import { createProjectVersion } from "../services/project.service.js";

describe("project version allocation", () => {
  it("serializes concurrent allocations into unique sequential versions", async () => {
    const versions: Array<{ id: bigint; versionNumber: number }> = [];
    let lockTail = Promise.resolve();

    async function transaction<T>(callback: (tx: Record<string, unknown>) => Promise<T>) {
      const previousLock = lockTail;
      let releaseLock: () => void = () => {};
      lockTail = new Promise<void>((resolve) => { releaseLock = resolve; });
      const tx = {
        $executeRaw: async () => previousLock,
        proposalVersion: {
          aggregate: async () => ({
            _max: { versionNumber: versions.reduce((max, item) => Math.max(max, item.versionNumber), 0) || null }
          }),
          create: async ({ data }: { data: { versionNumber: number } }) => {
            await Promise.resolve();
            const version = { id: BigInt(versions.length + 1), versionNumber: data.versionNumber };
            versions.push(version);
            return version;
          },
          findMany: async () => [],
          update: async () => undefined
        },
        proposalProject: { update: async () => undefined }
      };
      try {
        return await callback(tx);
      } finally {
        releaseLock();
      }
    }

    const project = {
      id: 41n,
      summary: "Summary",
      scope: "Scope",
      deliverables: "Deliverables",
      milestones: "Milestones",
      proposalTimeline: "Timeline",
      pricing: "Pricing",
      risks: "Risks",
      nextSteps: "Next"
    };

    await Promise.all([
      transaction((tx) => createProjectVersion(tx as never, project as never, "manual", ["scope"])),
      transaction((tx) => createProjectVersion(tx as never, project as never, "manual", ["pricing"]))
    ]);

    expect(versions.map((item) => item.versionNumber)).toEqual([1, 2]);
    expect(new Set(versions.map((item) => item.versionNumber)).size).toBe(2);
  });
});
