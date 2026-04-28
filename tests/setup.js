// Jest global setup - creates the test database
import { execSync } from "child_process";
import { existsSync, unlinkSync } from "fs";

export default async function globalSetup() {
  // Push the Prisma schema to the test database (force reset to clear old data)
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://user:password@localhost:5432/postly_test?schema=public",
    },
    stdio: "pipe",
  });
}
