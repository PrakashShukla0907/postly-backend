// Unit tests: Dashboard Service
import { jest } from "@jest/globals";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/postly_test?schema=public";
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

jest.unstable_mockModule("../../src/database/index.js", () => ({
  default: {
    post: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    platformPost: {
      groupBy: jest.fn(),
    },
  },
}));

const { default: prisma } = await import("../../src/database/index.js");
const { getStats } = await import("../../src/services/dashboardService.js");

describe("Dashboard Service - getStats", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return zeroed stats when no posts exist", async () => {
    prisma.post.count.mockResolvedValue(0);
    prisma.post.groupBy.mockResolvedValue([]);
    prisma.platformPost.groupBy.mockResolvedValue([]);

    const stats = await getStats("u1");

    expect(stats.total_posts).toBe(0);
    expect(stats.success_rate).toBe(0);
    expect(stats.posts_by_platform).toEqual({});
    expect(stats.posts_by_status).toEqual({});
    expect(stats).toHaveProperty("this_week");
    expect(stats).toHaveProperty("this_month");
  });

  it("should compute success_rate from published count", async () => {
    // total_posts = 10, groupBy calls (count twice for week/month)
    prisma.post.count
      .mockResolvedValueOnce(10)   // total
      .mockResolvedValueOnce(5)    // this_week
      .mockResolvedValueOnce(8);   // this_month

    prisma.post.groupBy.mockResolvedValue([
      { status: "published", _count: { status: 7 } },
      { status: "failed", _count: { status: 3 } },
    ]);

    prisma.platformPost.groupBy.mockResolvedValue([
      { platform: "twitter", _count: { platform: 6 } },
      { platform: "linkedin", _count: { platform: 4 } },
    ]);

    const stats = await getStats("u1");

    expect(stats.total_posts).toBe(10);
    expect(stats.success_rate).toBe(70);
    expect(stats.posts_by_status.published).toBe(7);
    expect(stats.posts_by_status.failed).toBe(3);
    expect(stats.posts_by_platform.twitter).toBe(6);
    expect(stats.posts_by_platform.linkedin).toBe(4);
    expect(stats.this_week).toBe(5);
    expect(stats.this_month).toBe(8);
  });

  it("should handle 100% success rate", async () => {
    prisma.post.count.mockResolvedValue(5).mockResolvedValueOnce(5).mockResolvedValueOnce(3).mockResolvedValueOnce(5);
    prisma.post.groupBy.mockResolvedValue([
      { status: "published", _count: { status: 5 } },
    ]);
    prisma.platformPost.groupBy.mockResolvedValue([]);

    const stats = await getStats("u1");
    expect(stats.success_rate).toBe(100);
  });
});
