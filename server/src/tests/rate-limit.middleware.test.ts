import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { requestIpKey, verifiedUserKey } from "../middleware/rate-limit.middleware.js";

function fakeRequest(ip: string, authorization: string, userId?: number) {
  return {
    ip,
    headers: { authorization },
    authUser: userId === undefined ? undefined : {
      id: userId,
      username: `user-${userId}`,
      email: "",
      supabaseUserId: `remote-${userId}`,
      isDemo: false
    }
  } as unknown as Request;
}

describe("rate-limit identities", () => {
  it("does not let fake Authorization headers create separate public identities", () => {
    const first = requestIpKey(fakeRequest("203.0.113.10", "Bearer fake-1"));
    const second = requestIpKey(fakeRequest("203.0.113.10", "Bearer fake-2"));

    expect(first).toBe(second);
    expect(first).not.toContain("fake");
  });

  it("uses only the verified local user id for authenticated limits", () => {
    const first = verifiedUserKey(fakeRequest("203.0.113.10", "Bearer token-a", 7));
    const second = verifiedUserKey(fakeRequest("198.51.100.8", "Bearer token-b", 7));
    const otherUser = verifiedUserKey(fakeRequest("203.0.113.10", "Bearer token-a", 8));

    expect(first).toBe("user:7");
    expect(second).toBe(first);
    expect(otherUser).not.toBe(first);
  });

  it("refuses to construct an authenticated identity before authentication", () => {
    expect(() => verifiedUserKey(fakeRequest("203.0.113.10", "Bearer fake"))).toThrow(
      "must run after authentication"
    );
  });
});
