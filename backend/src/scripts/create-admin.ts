import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const username = process.argv[2] || "admin";
const password = process.argv[3] || "password";

console.log(`[Script] Creating user: ${username}`);

try {
    // Check if exists
    const existing = await db.select().from(users).where(eq(users.username, username));
    if (existing.length > 0) {
        console.log(`[Script] User '${username}' already exists. Updating password...`);
        const hashedPassword = await Bun.password.hash(password);
        await db.update(users).set({ password: hashedPassword, role: 'admin' }).where(eq(users.username, username));
        console.log(`[Script] Password updated.`);
    } else {
        console.log(`[Script] Creating new admin user...`);
        const hashedPassword = await Bun.password.hash(password);
        await db.insert(users).values({
            username,
            password: hashedPassword,
            role: 'admin'
        });
        console.log(`[Script] User '${username}' created successfully.`);
    }
    process.exit(0);
} catch (e) {
    console.error("[Script] Error:", e);
    process.exit(1);
}
