import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  djangoUser: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("../lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../services/demo.service.js", () => ({ ensureDemoWorkspace: vi.fn() }));
vi.mock("../config/env.js", () => ({
  env: {
    NODE_ENV: "test",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "public-anon-key",
    SUPABASE_AUTH_CACHE_TTL: 0,
    DEMO_ACCOUNT_EMAIL: "demo@scopeflow.ai"
  }
}));

import { requireAuth } from "../middleware/auth.middleware.js";

function requestWithHeader(value?: string) {
  return {
    header: vi.fn().mockReturnValue(value)
  } as unknown as Request;
}

describe("Supabase authentication middleware", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("rejects a request without a bearer token", async () => {
    const next = vi.fn() as NextFunction;
    await requireAuth(requestWithHeader(), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it("verifies the token and resolves the local Django user mirror", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "supabase-user-1", email: "owner@example.com" })
    }));
    prismaMock.djangoUser.findFirst.mockResolvedValue(null);
    prismaMock.djangoUser.findUnique.mockResolvedValue({
      id: 7,
      username: "supabase-user-1",
      email: "owner@example.com"
    });
    const req = requestWithHeader("Bearer valid-token");
    const next = vi.fn() as NextFunction;

    await requireAuth(req, {} as Response, next);

    expect(fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/user",
      expect.objectContaining({
        headers: { Authorization: "Bearer valid-token", apikey: "public-anon-key" },
        redirect: "manual"
      })
    );
    expect(req.authUser).toMatchObject({ id: 7, username: "supabase-user-1", isDemo: false });
    expect(next).toHaveBeenCalledWith();
  });

  it("reuses the seeded local demo identity by email", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "remote-demo-id", email: "demo@scopeflow.ai" })
    }));
    prismaMock.djangoUser.findFirst.mockResolvedValue({
      id: 9,
      username: "demo-seed-account",
      email: "demo@scopeflow.ai"
    });
    const req = requestWithHeader("Bearer demo-token");

    await requireAuth(req, {} as Response, vi.fn());

    expect(req.authUser).toMatchObject({ username: "demo-seed-account", isDemo: true });
    expect(prismaMock.djangoUser.findUnique).not.toHaveBeenCalled();
  });
});
