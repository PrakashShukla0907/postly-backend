// Unit tests: User Service (profile, social accounts, AI keys)
import { jest } from "@jest/globals";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_32_chars_minimum_xx";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_32_chars_min_x";
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.DATABASE_URL = "file:./test.db";

jest.unstable_mockModule("../../src/database/index.js", () => ({
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    socialAccount: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    aiKey: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const { default: prisma } = await import("../../src/database/index.js");
const userService = await import("../../src/services/userService.js");

describe("User Service", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Profile ────────────────────────────────────────────────────────────
  describe("getProfile", () => {
    it("should return user profile", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u1", email: "test@test.com", name: "Test User",
        bio: "Hello", defaultTone: "professional", defaultLanguage: "en", createdAt: new Date(),
      });

      const profile = await userService.getProfile("u1");
      expect(profile.email).toBe("test@test.com");
      expect(profile.name).toBe("Test User");
    });

    it("should throw 404 if user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(userService.getProfile("nonexistent"))
        .rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    });
  });

  describe("updateProfile", () => {
    it("should update user profile fields", async () => {
      const updatedUser = {
        id: "u1", email: "test@test.com", name: "Updated Name",
        bio: "New bio", defaultTone: "casual", defaultLanguage: "en",
      };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await userService.updateProfile("u1", {
        name: "Updated Name",
        bio: "New bio",
        default_tone: "casual",
      });

      expect(result.name).toBe("Updated Name");
      expect(result.bio).toBe("New bio");
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "u1" } })
      );
    });
  });

  // ── Social Accounts ────────────────────────────────────────────────────
  describe("connectSocialAccount", () => {
    it("should upsert a social account and return it", async () => {
      const account = {
        id: "acc1", platform: "twitter", handle: "testuser", connectedAt: new Date(),
      };
      prisma.socialAccount.upsert.mockResolvedValue(account);

      const result = await userService.connectSocialAccount(
        "u1", "twitter", "testuser", "access_token_123", null
      );
      expect(result.platform).toBe("twitter");
      expect(result.handle).toBe("testuser");
    });
  });

  describe("listSocialAccounts", () => {
    it("should return an array of accounts", async () => {
      prisma.socialAccount.findMany.mockResolvedValue([
        { id: "a1", platform: "twitter", handle: "tweetuser", connectedAt: new Date() },
        { id: "a2", platform: "linkedin", handle: "linkeduser", connectedAt: new Date() },
      ]);

      const accounts = await userService.listSocialAccounts("u1");
      expect(accounts).toHaveLength(2);
      expect(accounts[0].platform).toBe("twitter");
    });

    it("should return empty array if no accounts", async () => {
      prisma.socialAccount.findMany.mockResolvedValue([]);
      const accounts = await userService.listSocialAccounts("u1");
      expect(accounts).toEqual([]);
    });
  });

  describe("disconnectSocialAccount", () => {
    it("should throw 404 if account not found", async () => {
      prisma.socialAccount.findFirst.mockResolvedValue(null);
      await expect(userService.disconnectSocialAccount("u1", "badId"))
        .rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    });

    it("should update disconnectedAt on found account", async () => {
      prisma.socialAccount.findFirst.mockResolvedValue({ id: "a1", userId: "u1" });
      prisma.socialAccount.update.mockResolvedValue({});

      await userService.disconnectSocialAccount("u1", "a1");
      expect(prisma.socialAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "a1" } })
      );
    });
  });

  // ── AI Keys ────────────────────────────────────────────────────────────
  describe("storeAiKeys", () => {
    it("should upsert AI keys", async () => {
      prisma.aiKey.upsert.mockResolvedValue({});
      await userService.storeAiKeys("u1", "sk-openai-key", null);
      expect(prisma.aiKey.upsert).toHaveBeenCalled();
    });
  });

  describe("getDecryptedAiKeys", () => {
    it("should return nulls when no keys exist", async () => {
      prisma.aiKey.findUnique.mockResolvedValue(null);
      const keys = await userService.getDecryptedAiKeys("u1");
      expect(keys.openai).toBeNull();
      expect(keys.anthropic).toBeNull();
    });
  });
});
