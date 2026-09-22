import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";
import { rateLimitStore } from "../lib/rate-limit-store.js";

function parseRate(value: string) {
  const match = value.trim().match(/^(\d+)\/(min|minute|hour)$/i);
  const limit = match ? Number(match[1]) : 60;
  const windowMs = match?.[2].toLowerCase().startsWith("hour") ? 60 * 60 * 1000 : 60 * 1000;
  return { limit, windowMs };
}

export function verifiedUserKey(req: Request): string {
  if (!req.authUser) throw new Error("Authenticated rate limiter must run after authentication.");
  return `user:${req.authUser.id}`;
}

export function requestIpKey(req: Request): string {
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

function authenticatedLimiter(value: string, prefix: string) {
  return rateLimit({
    ...parseRate(value),
    standardHeaders: true,
    legacyHeaders: false,
    store: rateLimitStore(prefix),
    keyGenerator: verifiedUserKey,
    handler(_req, res) {
      res.status(429).json({ detail: "Request was throttled. Please try again later." });
    }
  });
}

function ipLimiter(value: string, prefix: string) {
  return rateLimit({
    ...parseRate(value),
    standardHeaders: true,
    legacyHeaders: false,
    store: rateLimitStore(prefix),
    keyGenerator: requestIpKey,
    handler(_req, res) {
      res.status(429).json({ detail: "Request was throttled. Please try again later." });
    }
  });
}

export const generalRateLimiter = ipLimiter(env.RATE_LIMIT_ANON, "global-ip");
export const publicProposalLimiter = ipLimiter(env.RATE_LIMIT_PUBLIC_PROPOSAL, "public-proposal-ip");
export const authenticatedRateLimiter = authenticatedLimiter(env.RATE_LIMIT_USER, "authenticated-user");
export const proposalGenerationLimiter = authenticatedLimiter(env.RATE_LIMIT_GENERATE_PROPOSAL, "generate-proposal-user");
export const templateGenerationLimiter = authenticatedLimiter(env.RATE_LIMIT_GENERATE_TEMPLATE, "generate-template-user");
export const aiActionLimiter = authenticatedLimiter(env.RATE_LIMIT_GENERATE_AI_ACTION, "ai-action-user");
