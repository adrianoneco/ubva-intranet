import { db } from "./db";
import { categories, users } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from 'crypto';

async function seed() {
  console.log("Seeding database...");

  // Create a basic .env file with default admin credentials if none exists.
  // This provides a default user for development environments.
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      const defaultEnv = `ADMIN_USER=admin\nADMIN_PASSWORD=admin\nSESSION_SECRET=change-me\n`;
      fs.writeFileSync(envPath, defaultEnv, { encoding: 'utf8', flag: 'w' });
      console.log('✓ Created default .env with ADMIN_USER=admin (change in production)');
    } else {
      console.log('✓ .env already exists, skipping .env creation');
    }
  } catch (e) {
    console.warn('⚠️ Could not create .env file:', e);
  }

  // Ensure there is a default admin user in the database for development.
  try {
    const [existingAdmin] = await db.select().from(users).where(eq(users.username, 'admin'));
    if (!existingAdmin) {
      const password = process.env.ADMIN_PASSWORD || 'admin';
      const salt = crypto.randomBytes(16).toString('hex');
      const iterations = 100000;
      const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
      await db.insert(users).values({ username: 'admin', passwordHash: hash, salt, iterations });
      console.log('✓ Created default admin user in database (username=admin)');
    } else {
      console.log('✓ Admin user already present in database');
    }
  } catch (e) {
    console.warn('⚠️ Could not ensure admin user in database:', e);
  }

  const existingCategories = await db.select().from(categories);
  
  if (existingCategories.length === 0) {
    await db.insert(categories).values([
      { name: "Work", color: "#3B82F6" },
      { name: "Personal", color: "#10B981" },
      { name: "Shopping", color: "#F59E0B" },
      { name: "Health", color: "#EF4444" },
      { name: "Learning", color: "#8B5CF6" },
    ]);
    console.log("✓ Categories seeded");
  } else {
    console.log("✓ Categories already exist, skipping seed");
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
