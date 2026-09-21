import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

const app = createApp();

describe("Express foundation", () => {
  it("returns the existing health-check payload", async () => {
    const response = await request(app).get("/api/health/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "ScopeFlow AI API" });
  });

  it("allows configured local frontend origins through CORS", async () => {
    const response = await request(app).get("/api/health/").set("Origin", "http://localhost:5173");

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("mounts protected project routes behind authentication", async () => {
    const response = await request(app).get("/api/projects/");

    expect(response.status).toBe(401);
    expect(response.body.detail).toBe("Authentication credentials were not provided.");
  });

  it("keeps unknown routes as JSON 404 responses", async () => {
    const response = await request(app).get("/api/not-a-route/");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ detail: "Not found." });
  });
});
