import { describe, expect, it, vi } from "vitest";
import { getCurrentUsage } from "../services/usage.service.js";

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
});
