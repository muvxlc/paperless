import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export const authRoutes = new Elysia({ prefix: "/auth" })
    .use(
        jwt({
            name: "jwt",
            secret: process.env.JWT_SECRET || "secret",
        })
    )
    .post(
        "/register",
        async ({ body, set }) => {
            const { username, password, role } = body;

            const existingUser = await db.select().from(users).where(eq(users.username, username)).execute();
            if (existingUser.length > 0) {
                set.status = 400;
                return { error: "User already exists" };
            }

            const hashedPassword = await Bun.password.hash(password);
            await db.insert(users).values({
                username,
                password: hashedPassword,
                role: role as any,
            });

            return { success: true };
        },
        {
            body: t.Object({
                username: t.String(),
                password: t.String(),
                role: t.Union([t.Literal("admin"), t.Literal("staff"), t.Literal("approver"), t.Literal("user")]),
            }),
        }
    )
    .post(
        "/login",
        async ({ body, jwt, set }) => {
            const { username, password } = body;
            const [user] = await db.select().from(users).where(eq(users.username, username)).execute();

            if (!user || !(await Bun.password.verify(password, user.password))) {
                set.status = 401;
                return { error: "Invalid credentials" };
            }

            const token = await jwt.sign({
                id: user.id,
                username: user.username,
                role: user.role,
            });

            return { token, role: user.role };
        },
        {
            body: t.Object({
                username: t.String(),
                password: t.String(),
            }),
        }
    );
