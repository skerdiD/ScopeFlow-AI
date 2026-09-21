import type { PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const PLAN_LIMITS: Record<string, number> = { free: 3, pro: 50, business: 9999 };

function currentPeriod(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getCurrentUsage(userId: number, db: PrismaClient | typeof prisma = prisma) {
  const period = currentPeriod();
  const [plan, usage] = await db.$transaction([
    db.userPlan.upsert({
      where: { userId },
      create: { userId, plan: "free" },
      update: {}
    }),
    db.usageRecord.upsert({
      where: { userId_period: { userId, period } },
      create: { userId, period },
      update: {}
    })
  ]);
  const isUnlimited = plan.plan === "business";
  const limit = isUnlimited ? null : (PLAN_LIMITS[plan.plan] ?? PLAN_LIMITS.free);
  return {
    plan: plan.plan,
    used: usage.aiGenerationsUsed,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - usage.aiGenerationsUsed),
    is_unlimited: isUnlimited,
    period: period.toISOString().slice(0, 7)
  };
}
