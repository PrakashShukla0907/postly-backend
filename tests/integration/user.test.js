// Integration tests: User profile & social account management
import request from "supertest";
import { jest } from "@jest/globals";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_32_chars_minimum_xx";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_32_chars_min_x";
process.env.JWT_EXPIRY = "15m";
process.env.JWT_REFRESH_EXPIRY = "7d";
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/postly_test?schema=public";
process.env.REDIS_URL = "";
process.env.LOG_LEVEL = "error";

jest.unstable_mockModule("../../src/queue/workers.js", () => ({
  startWorkers: jest.fn(),
}));

jest.unstable_mockModule("../../src/bot/index.js", () => ({
  startBot: jest.fn(),
  createBot: jest.fn(),
}));

const { default: app } = await import("../../src/index.js");

describe("User Profile & Social Accounts Integration Tests", () => {
  const testEmail = `user_${Date.now()}@example.com`;
  let accessToken = null;
  let accountId = null;

  beforeAll(async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email: testEmail, password: "securepass123", name: "User Tester" });
    accessToken = reg.body.data?.access_token;
  });

  // ── GET /api/user/profile ─────────────────────────────────────────────
  describe("GET /api/user/profile", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/user/profile");
      expect(res.status).toBe(401);
    });

    it("should return user profile with valid token", async () => {
      const res = await request(app)
        .get("/api/user/profile")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.name).toBe("User Tester");
    });
  });

  // ── PUT /api/user/profile ─────────────────────────────────────────────
  describe("PUT /api/user/profile", () => {
    it("should return 400 for empty update body", async () => {
      const res = await request(app)
        .put("/api/user/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("should update bio and name", async () => {
      const res = await request(app)
        .put("/api/user/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Updated Name", bio: "This is my bio" });

      expect(res.status).toBe(200);
      expect(res.body.data.user.name).toBe("Updated Name");
      expect(res.body.data.user.bio).toBe("This is my bio");
    });

    it("should update default_tone", async () => {
      const res = await request(app)
        .put("/api/user/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ default_tone: "casual" });

      expect(res.status).toBe(200);
      expect(res.body.data.user.defaultTone).toBe("casual");
    });

    it("should reject invalid tone value", async () => {
      const res = await request(app)
        .put("/api/user/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ default_tone: "aggressive" }); // not in allowed list
      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/user/social-accounts ────────────────────────────────────
  describe("POST /api/user/social-accounts", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).post("/api/user/social-accounts").send({});
      expect(res.status).toBe(401);
    });

    it("should return 400 for missing platform", async () => {
      const res = await request(app)
        .post("/api/user/social-accounts")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ handle: "testuser", access_token: "tok123" });
      expect(res.status).toBe(400);
    });

    it("should connect a social account", async () => {
      const res = await request(app)
        .post("/api/user/social-accounts")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          platform: "twitter",
          handle: "test_handle",
          access_token: "fake_access_token_123",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.account.platform).toBe("twitter");
      expect(res.body.data.account.handle).toBe("test_handle");
      accountId = res.body.data.account.id;
    });

    it("should return 400 for invalid platform", async () => {
      const res = await request(app)
        .post("/api/user/social-accounts")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ platform: "tiktok", handle: "tester", access_token: "tok" });
      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/user/social-accounts ────────────────────────────────────
  describe("GET /api/user/social-accounts", () => {
    it("should return list of connected accounts", async () => {
      const res = await request(app)
        .get("/api/user/social-accounts")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.accounts)).toBe(true);
      expect(res.body.data.accounts.length).toBeGreaterThan(0);
    });
  });

  // ── DELETE /api/user/social-accounts/:id ─────────────────────────────
  describe("DELETE /api/user/social-accounts/:id", () => {
    it("should disconnect a social account", async () => {
      if (!accountId) return;

      const res = await request(app)
        .delete(`/api/user/social-accounts/${accountId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe("Account disconnected");
    });

    it("should return 404 for non-existent account", async () => {
      const res = await request(app)
        .delete("/api/user/social-accounts/bad-id-123")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ── PUT /api/user/ai-keys ─────────────────────────────────────────────
  describe("PUT /api/user/ai-keys", () => {
    it("should return 400 if neither key is provided", async () => {
      const res = await request(app)
        .put("/api/user/ai-keys")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("should store AI keys successfully", async () => {
      const res = await request(app)
        .put("/api/user/ai-keys")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ openai_key: "sk-test-openai-key-12345" });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe("API keys stored securely");
    });
  });
});
