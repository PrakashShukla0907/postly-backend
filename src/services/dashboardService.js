// Dashboard Service - stats and analytics
import prisma from "../database/index.js";

export async function getStats(userId) {
  const [totalPosts, byStatus, byPlatform] = await Promise.all([
    prisma.post.count({ where: { userId, deletedAt: null } }),

    prisma.post.groupBy({
      by: ["status"],
      where: { userId, deletedAt: null },
      _count: { status: true },
    }),

    prisma.platformPost.groupBy({
      by: ["platform"],
      where: { post: { userId, deletedAt: null } },
      _count: { platform: true },
    }),
  ]);

  // This week / this month
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

  const [thisWeek, thisMonth] = await Promise.all([
    prisma.post.count({ where: { userId, deletedAt: null, createdAt: { gte: weekAgo } } }),
    prisma.post.count({ where: { userId, deletedAt: null, createdAt: { gte: monthAgo } } }),
  ]);

  const statusMap = {};
  for (const s of byStatus) statusMap[s.status] = s._count.status;

  const platformMap = {};
  for (const p of byPlatform) platformMap[p.platform] = p._count.platform;

  const published = statusMap.published || 0;
  const successRate = totalPosts > 0 ? Math.round((published / totalPosts) * 1000) / 10 : 0;

  return {
    total_posts: totalPosts,
    success_rate: successRate,
    posts_by_platform: platformMap,
    posts_by_status: statusMap,
    this_week: thisWeek,
    this_month: thisMonth,
  };
}
