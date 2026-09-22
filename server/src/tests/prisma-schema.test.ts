import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

describe("database invariants", () => {
  it("enforces unique project version numbers in the database schema", () => {
    expect(schema).toContain('@@unique([projectId, versionNumber], map: "proposal_project_version_key")');
  });

  it("keeps share tokens and external Supabase identities unique", () => {
    expect(schema).toContain('@unique @map("share_token")');
    expect(schema).toContain('@unique(map: "auth_user_supabase_id_key")');
  });

  it("maps canonical numeric project ownership to LocalUser", () => {
    expect(schema).toMatch(/owner\s+LocalUser\?/);
    expect(schema).toContain('@@index([ownerId, updatedAt(sort: Desc)], map: "proposal_owner_updated_idx")');
  });
});
