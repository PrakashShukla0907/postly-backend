// BullMQ queue workers - process publishing jobs per platform
import { Worker } from "bullmq";
import { getRedisConnection } from "./connection.js";
import prisma from "../database/index.js";
import { updatePostAggregateStatus } from "../services/publishService.js";
import logger from "../utils/logger.js";

/**
 * Simulates posting to a social platform.
 * In production, replace this with actual platform API calls.
 */
async function simulatePlatformPost(platform, content) {
 // Simulate network delay
 await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));

 // 90% success rate in simulation
 if (Math.random() < 0.1) {
 throw new Error(`Simulated ${platform} API error`);
 }

 return { externalPostId: `${platform}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
}

async function processJob(job) {
 const { postId, platformPostId, platform, content } = job.data;
 logger.info(`Processing job: platform=${platform} postId=${postId} attempt=${job.attemptsMade + 1}`);

 // Mark as processing
 await prisma.platformPost.update({
 where: { id: platformPostId },
 data: {
 status: "processing",
 lastAttemptAt: new Date(),
 attempts: { increment: 1 },
 },
 });

 try {
 const result = await simulatePlatformPost(platform, content);

 // Success
 await prisma.platformPost.update({
 where: { id: platformPostId },
 data: {
 status: "published",
 publishedAt: new Date(),
 externalPostId: result.externalPostId,
 errorMessage: null,
 },
 });

 await updatePostAggregateStatus(postId);
 logger.info(` Published to ${platform}: ${result.externalPostId}`);
 } catch (err) {
 // Failure - BullMQ will retry based on job options
 await prisma.platformPost.update({
 where: { id: platformPostId },
 data: {
 status: job.attemptsMade + 1 >= job.opts.attempts ? "failed" : "queued",
 errorMessage: err.message,
 },
 });

 if (job.attemptsMade + 1 >= job.opts.attempts) {
 await updatePostAggregateStatus(postId);
 logger.error(` Failed to publish to ${platform} after ${job.opts.attempts} attempts: ${err.message}`);
 }

 throw err; // Re-throw to trigger BullMQ retry
 }
}

export function startWorkers() {
 const connection = getRedisConnection();
 if (!connection) {
 logger.warn("Redis unavailable — queue workers not started (simulation mode active)");
 return;
 }

 const queues = ["twitter-queue", "linkedin-queue", "instagram-queue", "threads-queue"];

 for (const queueName of queues) {
 const worker = new Worker(queueName, processJob, {
 connection,
 concurrency: 3,
 settings: {
 backoffStrategies: {
 postlyBackoff: (attemptsMade) => {
 // attemptsMade is 1 for the first failure
 // 1s -> 5s -> 25s
 return 1000 * Math.pow(5, attemptsMade - 1);
 },
 },
 },
 });

 worker.on("completed", (job) => {
 logger.info(`Job ${job.id} on ${queueName} completed`);
 });

 worker.on("failed", (job, err) => {
 logger.warn(`Job ${job?.id} on ${queueName} failed: ${err.message}`);
 });

 logger.info(`Worker started for ${queueName}`);
 }
}
