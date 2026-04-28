// Integration tests: Post & Content endpoints with real SQLite test database
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

// Mock queue workers and bot
jest.unstable_mockModule("../../src/queue/workers.js", () => ({
  startWorkers: jest.fn(),
}));

jest.unstable_mockModule("../../src/bot/index.js", () => ({
  startBot: jest.fn(),
  createBot: jest.fn(),
}));

// Mock content generation to avoid real AI API calls
jest.unstable_mockModule("../../src/services/contentService.js", () => ({
  generateContent: jest.fn().mockResolvedValue({
    generated: {
      twitter: { content: "Test Twitter content #postly", char_count: 29, hashtags: ["#postly"] },
      linkedin: { content: "Test LinkedIn content about Postly.", char_count: 35, hashtags: [] },
    },
    model_used: "gpt-4o",
    tokens_used: 100,
  }),
}));

const { default: app } = await import("../../src/index.js");

describe("Posts & Content Integration Tests", () => {
  const testEmail = `posts_${Date.now()}@example.com`;
  let accessToken = null;
  let postId = null;

  // Register and login before tests
  beforeAll(async () => {
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email: testEmail, password: "password123", name: "Post Tester" });
    accessToken = reg.body.data?.access_token;
  });

  // ── POST /api/content/generate ────────────────────────────────────────
  describe("POST /api/content/generate", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).post("/api/content/generate").send({});
      expect(res.status).toBe(401);
    });

    it("should return 400 for missing required fields", async () => {
      const res = await request(app)
        .post("/api/content/generate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ idea: "Test idea" }); // missing post_type, platforms, tone, model
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should generate content successfully", async () => {
      const res = await request(app)
        .post("/api/content/generate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          idea: "Announcing the launch of Postly AI",
          post_type: "announcement",
          platforms: ["twitter", "linkedin"],
          tone: "professional",
          language: "en",
          model: "openai",
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("generated");
      expect(res.body.data.generated).toHaveProperty("twitter");
      expect(res.body.data.generated.twitter).toHaveProperty("content");
      expect(res.body.data.generated.twitter).toHaveProperty("char_count");
    });

    it("should reject invalid model", async () => {
      const res = await request(app)
        .post("/api/content/generate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          idea: "Some idea",
          post_type: "announcement",
          platforms: ["twitter"],
          tone: "professional",
          model: "invalid_model",
        });
      expect(res.status).toBe(400);
    });

    it("should reject invalid platform", async () => {
      const res = await request(app)
        .post("/api/content/generate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          idea: "Some idea",
          post_type: "announcement",
          platforms: ["tiktok"], // invalid
          tone: "professional",
          model: "openai",
        });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/posts/publish ───────────────────────────────────────────
  describe("POST /api/posts/publish", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).post("/api/posts/publish").send({});
      expect(res.status).toBe(401);
    });

    it("should return 400 for missing fields", async () => {
      const res = await request(app)
        .post("/api/posts/publish")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ idea: "Missing fields" });
      expect(res.status).toBe(400);
    });

    it("should create and queue a post successfully", async () => {
      const res = await request(app)
        .post("/api/posts/publish")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          idea: "Launch announcement for Postly",
          post_type: "announcement",
          platforms: ["twitter", "linkedin"],
          tone: "professional",
          language: "en",
          model: "openai",
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("post");
      expect(res.body.data.post).toHaveProperty("id");
      expect(res.body.data).toHaveProperty("platform_statuses");
      postId = res.body.data.post.id;
    });
  });

  // ── GET /api/posts ────────────────────────────────────────────────────
  describe("GET /api/posts", () => {
    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/posts");
      expect(res.status).toBe(401);
    });

    it("should return paginated list of posts", async () => {
      const res = await request(app)
        .get("/api/posts")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty("total");
      expect(res.body.meta).toHaveProperty("page");
      expect(res.body.meta).toHaveProperty("limit");
    });

    it("should support pagination params", async () => {
      const res = await request(app)
        .get("/api/posts?page=1&limit=5")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
    });
  });

  // ── GET /api/posts/:id ────────────────────────────────────────────────
  describe("GET /api/posts/:id", () => {
    it("should return 404 for non-existent post", async () => {
      const res = await request(app)
        .get("/api/posts/nonexistent-id-123")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });

    it("should return post details for valid id", async () => {
      if (!postId) return;
      const res = await request(app)
        .get(`/api/posts/${postId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.post.id).toBe(postId);
      expect(res.body.data.post).toHaveProperty("platformPosts");
    });
  });

  // ── POST /api/posts/schedule ──────────────────────────────────────────
  describe("POST /api/posts/schedule", () => {
    it("should return 400 without publish_at field", async () => {
      const res = await request(app)
        .post("/api/posts/schedule")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          idea: "Scheduled post idea",
          post_type: "educational",
          platforms: ["linkedin"],
          tone: "professional",
          model: "openai",
          // missing publish_at
        });
      expect(res.status).toBe(400);
    });

    it("should schedule a post successfully with valid publish_at", async () => {
      const publishAt = new Date(Date.now() + 60000).toISOString(); // 1 min from now
      const res = await request(app)
        .post("/api/posts/schedule")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          idea: "Scheduled announcement",
          post_type: "announcement",
          platforms: ["twitter"],
          tone: "professional",
          language: "en",
          model: "openai",
          publish_at: publishAt,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.post).toHaveProperty("id");
    });
  });

  // ── DELETE /api/posts/:id ─────────────────────────────────────────────
  describe("DELETE /api/posts/:id (cancel)", () => {
    it("should cancel a queued post", async () => {
      if (!postId) return;

      // Create a fresh post to cancel
      const newPost = await request(app)
        .post("/api/posts/publish")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          idea: "Post to be cancelled",
          post_type: "story",
          platforms: ["threads"],
          tone: "casual",
          language: "en",
          model: "openai",
        });

      const cancelId = newPost.body.data?.post?.id;
      if (!cancelId) return;

      const res = await request(app)
        .delete(`/api/posts/${cancelId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain("cancelled");
    });

    it("should return 404 for non-existent post", async () => {
      const res = await request(app)
        .delete("/api/posts/totally-fake-id")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });
});
