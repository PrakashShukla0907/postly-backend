// Integration tests: API endpoints using real SQLite test database
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
process.env.LOG_LEVEL = "error"; // suppress logs in tests

// Mock queue workers and bot to prevent Redis/Telegram init
jest.unstable_mockModule("../../src/queue/workers.js", () => ({
  startWorkers: jest.fn(),
}));

jest.unstable_mockModule("../../src/bot/index.js", () => ({
  startBot: jest.fn(),
  createBot: jest.fn(),
}));

// Dynamic import AFTER mocks are set
const { default: app } = await import("../../src/index.js");

describe("API Integration Tests", () => {
  const testEmail = `test_${Date.now()}@example.com`;
  let accessToken = null;

  describe("GET /api/health", () => {
    it("should return 200 with status ok", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("ok");
      expect(res.body.error).toBeNull();
    });
  });

  describe("POST /api/auth/register", () => {
    it("should return 400 for invalid email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "not-an-email", password: "password123", name: "Test" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for short password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "test@test.com", password: "short", name: "Test" });
      expect(res.status).toBe(400);
    });

    it("should register successfully with valid data", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: testEmail, password: "password123", name: "Test User" });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("access_token");
      expect(res.body.data).toHaveProperty("refresh_token");
      expect(res.body.data.user.email).toBe(testEmail);

      accessToken = res.body.data.access_token;
    });

    it("should return 409 if email already registered", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: testEmail, password: "password123", name: "Test User" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_TAKEN");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should return 400 for wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password: "wrongpassword" });
      expect(res.status).toBe(400);
    });

    it("should login successfully", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password: "password123" });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("access_token");
    });
  });

  describe("GET /api/auth/me (protected)", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return user data with valid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(testEmail);
    });
  });

  describe("GET /api/user/social-accounts (protected)", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/user/social-accounts");
      expect(res.status).toBe(401);
    });

    it("should return empty list with valid token", async () => {
      const res = await request(app)
        .get("/api/user/social-accounts")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.accounts)).toBe(true);
    });
  });

  describe("GET /api/dashboard/stats (protected)", () => {
    it("should return stats with valid token", async () => {
      const res = await request(app)
        .get("/api/dashboard/stats")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.stats).toHaveProperty("total_posts");
      expect(res.body.data.stats).toHaveProperty("success_rate");
    });
  });

  describe("404 handler", () => {
    it("should return 404 for unknown routes", async () => {
      const res = await request(app).get("/api/nonexistent");
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });
});
