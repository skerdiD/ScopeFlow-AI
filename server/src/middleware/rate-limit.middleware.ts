import { createHash } from "node:crypto";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

function parseRate(value: string) {
  const match = value.trim().match(/^(\d+)\/(min|minute|hour)$/i);
  const limit = match ? Number(match[1]) : 60;
  const windowMs = match?.[2].toLowerCase().startsWith("hour") ? 60 * 60 * 1000 : 60 * 1000;
  return { limit, windowMs };
}

function limiter(value: string) {
  return rateLimit({
    ...parseRate(value),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator(req) {
      const identity = req.authUser?.username ?? ipKeyGenerator(req.ip ?? "");
      return createHash("sha256").update(identity).digest("hex");
    },
    handler(_req, res) {
      res.status(429).json({ detail: "Request was throttled. Please try again later." });
    }
  });
}

export const proposalGenerationLimiter = limiter(env.RATE_LIMIT_GENERATE_PROPOSAL);
export const templateGenerationLimiter = limiter(env.RATE_LIMIT_GENERATE_TEMPLATE);
export const aiActionLimiter = limiter(env.RATE_LIMIT_GENERATE_AI_ACTION);

export const generalRateLimiter = rateLimit({
  windowMs: 60_000,
  limit(req) {
    return parseRate(req.header("authorization") ? env.RATE_LIMIT_USER : env.RATE_LIMIT_ANON).limit;
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    const identity = req.header("authorization") ?? ipKeyGenerator(req.ip ?? "");
    return createHash("sha256").update(identity).digest("hex");
  },
  handler(_req, res) {
    res.status(429).json({ detail: "Request was throttled. Please try again later." });
  }
});
