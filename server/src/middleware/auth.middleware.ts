import type { RequestHandler } from "express";
import { createHash } from "node:crypto";
import { env } from "../config/env.js";
import { ApiError } from "./error.middleware.js";
import { prisma } from "../lib/prisma.js";
import { ensureDemoWorkspace } from "../services/demo.service.js";

type CacheEntry = {
  expiresAt: number;
  payload: Record<string, unknown>;
};

const authCache = new Map<string, CacheEntry>();

function isDemoIdentity(email: string, username: string): boolean {
  return email.trim().toLowerCase() === env.DEMO_ACCOUNT_EMAIL || username.startsWith("demo-seed-");
}

async function fetchSupabaseUser(token: string): Promise<Record<string, unknown>> {
  const cacheKey = createHash("sha256").update(token).digest("hex");
  const cached = authCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new ApiError(401, "Supabase auth environment is not configured.");
  }

  if (env.NODE_ENV === "production" && !env.SUPABASE_URL.toLowerCase().startsWith("https://")) {
    throw new ApiError(401, "SUPABASE_URL must use HTTPS in production.");
  }

  const endpoint = `${env.SUPABASE_URL.replace(/\/+$/, "")}/auth/v1/user`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY
      },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new ApiError(401, "Supabase auth request failed.");
  }

  if (!response.ok) {
    throw new ApiError(401, "Invalid or expired auth token.");
  }

  const payload = (await response.json()) as Record<string, unknown>;
  if (!payload || typeof payload !== "object") {
    throw new ApiError(401, "Supabase auth response payload was invalid.");
  }

  if (env.SUPABASE_AUTH_CACHE_TTL > 0) {
    authCache.set(cacheKey, {
      expiresAt: Date.now() + env.SUPABASE_AUTH_CACHE_TTL * 1000,
      payload
    });
  }

  return payload;
}

async function getOrCreateDjangoUser(supabaseUserId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail) {
    const demoUser = await prisma.djangoUser.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      orderBy: { id: "asc" }
    });
    if (demoUser && isDemoIdentity(demoUser.email, demoUser.username)) {
      return demoUser;
    }
  }

  const existing = await prisma.djangoUser.findUnique({ where: { username: supabaseUserId } });
  if (existing) {
    if (email && existing.email !== email) {
      return prisma.djangoUser.update({
        where: { id: existing.id },
        data: { email }
      });
    }
    return existing;
  }

  const now = new Date();
  return prisma.djangoUser.create({
    data: {
      username: supabaseUserId,
      email,
      password: "!",
      firstName: "",
      lastName: "",
      isStaff: false,
      isActive: true,
      isSuperuser: false,
      dateJoined: now
    }
  });
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const authHeader = req.header("authorization")?.trim() ?? "";
    const [scheme, token] = authHeader.split(" ");

    if (!authHeader || scheme?.toLowerCase() !== "bearer" || !token) {
      throw new ApiError(401, "Authentication credentials were not provided.");
    }

    const supabaseUser = await fetchSupabaseUser(token.trim());
    const supabaseUserId = String(supabaseUser.id ?? "").trim();
    if (!supabaseUserId) {
      throw new ApiError(401, "Invalid Supabase user payload.");
    }

    const email = String(supabaseUser.email ?? "").trim();
    const djangoUser = await getOrCreateDjangoUser(supabaseUserId, email);
    await ensureDemoWorkspace(djangoUser);

    req.supabaseUser = supabaseUser;
    req.authUser = {
      id: djangoUser.id,
      username: djangoUser.username,
      email: djangoUser.email,
      supabaseUserId,
      isDemo: isDemoIdentity(djangoUser.email, djangoUser.username)
    };

    next();
  } catch (error) {
    next(error);
  }
};
