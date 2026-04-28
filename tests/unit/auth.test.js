// Unit tests: Auth Service
import { jest } from "@jest/globals";

// Set test env before any imports
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_32_chars_minimum_xx";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_32_chars_min_x";
process.env.JWT_EXPIRY = "15m";
process.env.JWT_REFRESH_EXPIRY = "7d";
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.DATABASE_URL = "file:./test.db";

// Mock prisma
jest.unstable_mockModule("../../src/database/index.js", () => ({
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

const { default: prisma } = await import("../../src/database/index.js");
const authService = await import("../../src/services/authService.js");

describe("Auth Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("should throw if email already taken", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "existing-id", email: "test@example.com" });

      await expect(
        authService.register("test@example.com", "password123", "Test User")
      ).rejects.toMatchObject({ statusCode: 409, code: "EMAIL_TAKEN" });
    });

    it("should create user and return tokens", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: "new-user-id",
        email: "new@example.com",
        name: "New User",
        createdAt: new Date(),
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await authService.register("new@example.com", "password123", "New User");

      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(result.user.email).toBe("new@example.com");
    });
  });

  describe("login", () => {
    it("should throw if user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login("nobody@example.com", "password")
      ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_CREDENTIALS" });
    });
  });
});
