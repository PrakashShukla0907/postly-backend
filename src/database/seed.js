// Postly - Database Seeder
// Run: npm run seed
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seed script...");

  // In a deployment-ready app, we don't clear the database using deleteMany 
  // or seed hardcoded demo users. We only seed essential data or an admin user
  // via secure environment variables.

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    console.log(`Checking for existing admin user: ${adminEmail}`);
    
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!existingUser) {
      console.log("Creating initial admin user from environment variables...");
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          name: process.env.ADMIN_NAME || "Admin",
          bio: "Postly System Administrator",
          defaultTone: "professional",
          defaultLanguage: "en",
        },
      });
      console.log(`Admin user ${adminEmail} created successfully.`);
    } else {
      console.log(`Admin user ${adminEmail} already exists. Skipping creation.`);
    }
  } else {
    console.log("No ADMIN_EMAIL or ADMIN_PASSWORD provided in environment.");
    console.log("Skipping admin user creation.");
  }

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
