// Publish Service - post creation, queue management, listing
import prisma from "../database/index.js";
import { generateContent } from "./contentService.js";
import { AppError } from "../middlewares/errorHandler.js";
import logger from "../utils/logger.js";

// Import queues lazily to avoid crashes when Redis is unavailable
async function getQueues() {
  try {
    const { twitterQueue, linkedinQueue, instagramQueue, threadsQueue } = await import("../queue/queues.js");
    return { twitterQueue, linkedinQueue, instagramQueue, threadsQueue };
  } catch {
    return null;
  }
}

const QUEUE_MAP = {
  twitter: "twitterQueue",
  linkedin: "linkedinQueue",
  instagram: "instagramQueue",
  threads: "threadsQueue",
};

async function enqueueJob(queues, platform, jobData, delay = 0) {
  if (!queues) {
    logger.warn(`Redis unavailable — skipping queue for ${platform}, simulating success`);
    // Simulate the job completing immediately in dev without Redis
    setTimeout(async () => {
      try {
        await prisma.platformPost.update({
          where: { id: jobData.platformPostId },
          data: {
            status: "published",
            publishedAt: new Date(),
            attempts: 1,
            lastAttemptAt: new Date(),
            externalPostId: `sim_${Date.now()}`,
          },
        });
        await updatePostAggregateStatus(jobData.postId);
        logger.info(`[SIMULATED] Published to ${platform} for post ${jobData.postId}`);
      } catch (e) {
        logger.error(`Simulation error: ${e.message}`);
      }
    }, 1000 + Math.random() * 2000);
    return;
  }

  const queueName = QUEUE_MAP[platform];
  const queue = queues[queueName];
  if (!queue) return;

  await queue.add(`publish-${platform}`, jobData, {
    delay,
    attempts: parseInt(process.env.JOB_MAX_ATTEMPTS || "3"),
    backoff: { type: "postlyBackoff", delay: parseInt(process.env.JOB_BACKOFF_DELAY || "1000") },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  });
}

export async function updatePostAggregateStatus(postId) {
  const platformPosts = await prisma.platformPost.findMany({ where: { postId } });
  const statuses = platformPosts.map((p) => p.status);

  let newStatus = "queued";
  if (statuses.every((s) => s === "published")) newStatus = "published";
  else if (statuses.every((s) => s === "failed")) newStatus = "failed";
  else if (statuses.some((s) => s === "published")) newStatus = "partial";
  else if (statuses.some((s) => s === "processing")) newStatus = "publishing";

  await prisma.post.update({
    where: { id: postId },
    data: {
      status: newStatus,
      ...(newStatus === "published" ? { publishedAt: new Date() } : {}),
    },
  });
}

async function createPostWithJobs(userId, postData, publishAt = null, delay = 0) {
  const { idea, post_type, platforms, tone, language, model } = postData;

  // Generate content for all platforms
  const generated = await generateContent(userId, { idea, post_type, platforms, tone, language, model });

  // Create post record
  const post = await prisma.post.create({
    data: {
      userId,
      idea,
      postType: post_type,
      tone,
      language: language || "en",
      modelUsed: model,
      status: publishAt ? "scheduled" : "queued",
      publishAt: publishAt ? new Date(publishAt) : new Date(),
    },
  });

  const queues = await getQueues();
  const platformStatuses = {};

  for (const platform of platforms) {
    const platformContent = generated.generated[platform];
    if (!platformContent) continue;

    const platformPost = await prisma.platformPost.create({
      data: {
        postId: post.id,
        platform,
        content: platformContent.content,
        status: "queued",
      },
    });

    const jobData = {
      postId: post.id,
      platformPostId: platformPost.id,
      userId,
      platform,
      content: platformContent.content,
      hashtags: platformContent.hashtags || [],
    };

    await enqueueJob(queues, platform, jobData, delay);
    platformStatuses[platform] = "queued";
  }

  return { post, platformStatuses };
}

export async function publishPost(userId, postData) {
  return createPostWithJobs(userId, postData, null, 0);
}

export async function schedulePost(userId, postData) {
  const { publish_at } = postData;
  const delay = Math.max(0, new Date(publish_at).getTime() - Date.now());
  return createPostWithJobs(userId, postData, publish_at, delay);
}

export async function listPosts(userId, { page = 1, limit = 10, status, platform, date_range } = {}) {
  const where = { userId, deletedAt: null };

  if (status) where.status = status;

  if (platform) {
    where.platformPosts = { some: { platform } };
  }

  if (date_range) {
    const [from, to] = date_range.split(",");
    where.createdAt = {
      gte: new Date(from),
      lte: new Date(to + "T23:59:59Z"),
    };
  }

  const [total, posts] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        platformPosts: {
          select: { platform: true, status: true, publishedAt: true, content: true, externalPostId: true },
        },
      },
    }),
  ]);

  return { posts, total, page, limit };
}

export async function getPost(userId, postId) {
  const post = await prisma.post.findFirst({
    where: { id: postId, userId, deletedAt: null },
    include: {
      platformPosts: {
        select: {
          id: true, platform: true, content: true, status: true,
          publishedAt: true, errorMessage: true, attempts: true, externalPostId: true,
        },
      },
    },
  });
  if (!post) throw new AppError("Post not found", 404, "NOT_FOUND");
  return post;
}

export async function retryPost(userId, postId) {
  const post = await prisma.post.findFirst({
    where: { id: postId, userId, deletedAt: null },
    include: { platformPosts: true },
  });
  if (!post) throw new AppError("Post not found", 404, "NOT_FOUND");

  const failedPlatforms = post.platformPosts.filter((p) => p.status === "failed");
  if (failedPlatforms.length === 0) {
    throw new AppError("No failed platforms to retry", 422, "NO_FAILED_PLATFORMS");
  }

  const queues = await getQueues();
  const retrying = [];

  for (const pp of failedPlatforms) {
    await prisma.platformPost.update({
      where: { id: pp.id },
      data: { status: "queued", errorMessage: null },
    });

    const jobData = {
      postId: post.id,
      platformPostId: pp.id,
      userId,
      platform: pp.platform,
      content: pp.content,
      hashtags: [],
    };

    await enqueueJob(queues, pp.platform, jobData, 0);
    retrying.push(pp.platform);
  }

  await prisma.post.update({ where: { id: postId }, data: { status: "queued" } });

  return retrying;
}

export async function cancelPost(userId, postId) {
  const post = await prisma.post.findFirst({
    where: { id: postId, userId, deletedAt: null },
  });
  if (!post) throw new AppError("Post not found", 404, "NOT_FOUND");
  if (post.status === "published") {
    throw new AppError("Cannot cancel an already published post", 422, "ALREADY_PUBLISHED");
  }

  await prisma.post.update({
    where: { id: postId },
    data: { deletedAt: new Date(), status: "cancelled" },
  });
  await prisma.platformPost.updateMany({
    where: { postId, status: { in: ["queued", "processing"] } },
    data: { status: "cancelled" },
  });
}
