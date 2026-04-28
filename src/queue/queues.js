// BullMQ queue definitions
import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";

const connection = getRedisConnection();

const defaultJobOptions = {
  attempts: parseInt(process.env.JOB_MAX_ATTEMPTS || "4"), // 1 initial + 3 retries
  backoff: {
    type: "postlyBackoff",
  },
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 86400 },
};

function createQueue(name) {
  if (!connection) return null;
  return new Queue(name, { connection, defaultJobOptions });
}

export const twitterQueue = createQueue("twitter-queue");
export const linkedinQueue = createQueue("linkedin-queue");
export const instagramQueue = createQueue("instagram-queue");
export const threadsQueue = createQueue("threads-queue");
