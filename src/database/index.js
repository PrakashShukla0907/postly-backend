// Prisma client singleton
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "query" },
    { emit: "event", level: "error" },
    { emit: "event", level: "warn" },
  ],
});

if (process.env.NODE_ENV === "development" && process.env.LOG_LEVEL === "debug") {
  prisma.$on("query", (e) => {
    logger.debug(`Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
  });
}

prisma.$on("error", (e) => {
  logger.error(`Prisma error: ${e.message}`);
});

export default prisma;
