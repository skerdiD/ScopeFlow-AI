import { describe, expect, it, vi } from "vitest";
import { consumeGeneration, getCurrentUsage } from "../services/usage.service.js";

describe("usage service", () => {
  it("returns the current period and remaining free allowance", async () => {
    const db = {
      userPlan: { upsert: vi.fn().mockResolvedValue({ plan: "free" }) },
      usageRecord: { upsert: vi.fn().mockResolvedValue({ aiGenerationsUsed: 2 }) },
      $transaction: vi.fn().mockImplementation(async (queries: Array<Promise<unknown>>) => Promise.all(queries))
    };

    const result = await getCurrentUsage(7, db as never);

    expect(result).toMatchObject({ plan: "free", used: 2, limit: 3, remaining: 1, is_unlimited: false });
    expect(db.userPlan.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 7 } }));
  });

  it("represents business plans as unlimited", async () => {
    const db = {
      userPlan: { upsert: vi.fn().mockResolvedValue({ plan: "business" }) },
      usageRecord: { upsert: vi.fn().mockResolvedValue({ aiGenerationsUsed: 99 }) },
      $transaction: vi.fn().mockImplementation(async (queries: Array<Promise<unknown>>) => Promise.all(queries))
    };

    await expect(getCurrentUsage(7, db as never)).resolves.toMatchObject({
      limit: null,
      remaining: null,
      is_unlimited: true
    });
  });

  it("uses an atomic conditional increment at the free-plan limit", async () => {
    const tx = {
      userPlan: { upsert: vi.fn().mockResolvedValue({ plan: "free" }) },
      usageRecord: {
        upsert: vi.fn().mockResolvedValue({ id: 10n, aiGenerationsUsed: 3 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 10n, aiGenerationsUsed: 3 })
      }
    };

    const result = await consumeGeneration(7, tx as never);

    expect(result.consumed).toBe(false);
    expect(result.status.remaining).toBe(0);
    expect(tx.usageRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 10n, aiGenerationsUsed: { lt: 3 } },
      data: { aiGenerationsUsed: { increment: 1 } }
    }));
  });

  it("allows only one of two concurrent reservations near the limit", async () => {
    let used = 2;
    const tx = {
      userPlan: { upsert: vi.fn().mockResolvedValue({ plan: "free" }) },
      usageRecord: {
        upsert: vi.fn().mockImplementation(async () => ({ id: 10n, aiGenerationsUsed: used })),
        updateMany: vi.fn().mockImplementation(async () => {
          if (used >= 3) return { count: 0 };
          used += 1;
          return { count: 1 };
        }),
        findUniqueOrThrow: vi.fn().mockImplementation(async () => ({ id: 10n, aiGenerationsUsed: used }))
      }
    };

    const results = await Promise.all([
      consumeGeneration(7, tx as never),
      consumeGeneration(7, tx as never)
    ]);

    expect(results.filter((result) => result.consumed)).toHaveLength(1);
    expect(used).toBe(3);
  });
});
