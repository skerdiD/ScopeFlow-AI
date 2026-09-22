import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import { env } from "../config/env.js";

const redisClient = env.REDIS_URL ? createClient({ url: env.REDIS_URL }) : null;
let connectPromise: Promise<unknown> | null = null;

if (redisClient) {
  redisClient.on("error", (error) => {
    console.error("Redis rate-limit store error:", error instanceof Error ? error.message : "Unknown Redis error");
  });
}

function connectRedis() {
  if (!redisClient) throw new Error("Redis is not configured.");
  if (!connectPromise) {
    connectPromise = redisClient.connect().catch((error) => {
      connectPromise = null;
      throw error;
    });
  }
  return connectPromise;
}

export function rateLimitStore(prefix: string) {
  if (!redisClient) return undefined;
  return new RedisStore({
    prefix: `scopeflow:rate-limit:${prefix}:`,
    sendCommand: async (...args: string[]) => {
      await connectRedis();
      return redisClient.sendCommand(args);
    }
  });
}

export async function disconnectRateLimitStore() {
  if (redisClient?.isOpen) await redisClient.quit();
}
