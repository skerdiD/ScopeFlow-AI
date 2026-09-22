import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { TokenUsage } from "./gemini.service.js";

const PLAN_LIMITS: Record<string, number> = { free: 3, pro: 50, business: 9999 };
type Db = PrismaClient | Prisma.TransactionClient | typeof prisma;

function currentPeriod(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getCurrentUsage(userId: number, db: PrismaClient | typeof prisma = prisma) {
  const period = currentPeriod();
  const now = new Date();
  const [plan, usage] = await db.$transaction([
    db.userPlan.upsert({
      where: { userId },
      create: { userId, plan: "free", createdAt: now },
      update: {}
    }),
    db.usageRecord.upsert({
      where: { userId_period: { userId, period } },
      create: { userId, period, aiGenerationsUsed: 0, createdAt: now },
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

export async function consumeGeneration(userId: number, tx: Prisma.TransactionClient) {
  const period = currentPeriod();
  const now = new Date();
  const plan = await tx.userPlan.upsert({ where: { userId }, create: { userId, plan: "free", createdAt: now }, update: {} });
  const usage = await tx.usageRecord.upsert({
    where: { userId_period: { userId, period } },
    create: { userId, period, aiGenerationsUsed: 0, createdAt: now },
    update: {}
  });
  if (plan.plan === "business") {
    const updated = await tx.usageRecord.update({ where: { id: usage.id }, data: { aiGenerationsUsed: { increment: 1 } } });
    return { consumed: true, status: usageShape(plan.plan, updated.aiGenerationsUsed, period) };
  }
  const limit = PLAN_LIMITS[plan.plan] ?? PLAN_LIMITS.free;
  const result = await tx.usageRecord.updateMany({
    where: { id: usage.id, aiGenerationsUsed: { lt: limit } },
    data: { aiGenerationsUsed: { increment: 1 } }
  });
  const updated = await tx.usageRecord.findUniqueOrThrow({ where: { id: usage.id } });
  return { consumed: result.count === 1, status: usageShape(plan.plan, updated.aiGenerationsUsed, period) };
}

function usageShape(plan: string, used: number, period: Date) {
  const isUnlimited = plan === "business";
  const limit = isUnlimited ? null : (PLAN_LIMITS[plan] ?? PLAN_LIMITS.free);
  return {
    plan, used, limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    is_unlimited: isUnlimited,
    period: period.toISOString().slice(0, 7)
  };
}

export async function logAiAction(input: {
  userId: number;
  actionType: string;
  status: "success" | "failure";
  projectId?: bigint;
  promptVersionId?: bigint;
  errorMessage?: string;
  tokenUsage?: TokenUsage;
}, db: Db = prisma) {
  const clean = (value: number | undefined) => Number.isInteger(value) && (value ?? -1) >= 0 ? value : undefined;
  return db.aIUsageLog.create({
    data: {
      userId: input.userId,
      actionType: input.actionType,
      status: input.status,
      projectId: input.projectId,
      promptVersionId: input.promptVersionId,
      errorMessage: (input.errorMessage ?? "").slice(0, 2000),
      inputTokens: clean(input.tokenUsage?.input_tokens),
      outputTokens: clean(input.tokenUsage?.output_tokens),
      totalTokens: clean(input.tokenUsage?.total_tokens),
      createdAt: new Date()
    }
  });
}

export async function canGenerate(userId: number) {
  const status = await getCurrentUsage(userId);
  return { allowed: status.is_unlimited || status.used < (status.limit ?? 0), status };
}
