// IORedis connection for BullMQ
// Returns null if Redis is unavailable (server runs in simulation mode)
import { Redis } from "ioredis";
import logger from "../utils/logger.js";

let connection = null;
let initialized = false;

export function getRedisConnection() {
 if (initialized) return connection;
 initialized = true;

 const redisUrl = process.env.REDIS_URL;
 if (!redisUrl) {
 logger.warn("REDIS_URL not set — queue disabled, using simulation mode");
 return null;
 }

 try {
 const client = new Redis(redisUrl, {
 maxRetriesPerRequest: null,
 enableReadyCheck: false,
 lazyConnect: true,
 // Stop retrying after first failure in dev
 retryStrategy: (times) => {
 if (times > 1) return null; // Stop retrying
 return 500; // Wait 500ms before first retry
 },
 });

 // One-time connect attempt with timeout
 const connectPromise = client.connect().catch(() => null);
 const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));

 Promise.race([connectPromise, timeoutPromise]).then(() => {
 if (client.status === "ready") {
 connection = client;
 logger.info("Redis connected ");
 } else {
 logger.warn("Redis unavailable — queue disabled, using simulation mode");
 client.disconnect();
 connection = null;
 }
 });

 // Suppress unhandled error events
 client.on("error", () => {
 if (connection) {
 logger.warn("Redis disconnected — switching to simulation mode");
 connection = null;
 }
 });

 // Tentatively set connection, will be cleared if connect fails
 connection = client;
 return connection;
 } catch (err) {
 logger.warn(`Redis init failed: ${err.message} — using simulation mode`);
 return null;
 }
}

