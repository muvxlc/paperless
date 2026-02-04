import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const username = "admin";
const password = "password"; // Default password

async function seed() {
    console.log(`[Seed] Checking for admin user...`);
    try {
        const existing = await db.select().from(users).where(eq(users.username, username));
        if (existing.length === 0) {
            console.log(`[Seed] Creating default admin user...`);
            const hashedPassword = await Bun.password.hash(password);
            await db.insert(users).values({
                username,
                password: hashedPassword,
                role: 'admin'
            });
            console.log(`[Seed] Default admin created: ${username} / ${password}`);
        } else {
            console.log(`[Seed] Admin user already exists.`);
        }
        process.exit(0);
    } catch (e) {
        console.error("[Seed] Error seeding admin:", e);
        process.exit(1);
    }
}

seed();
