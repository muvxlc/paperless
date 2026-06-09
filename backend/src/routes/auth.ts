import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { 
    getThaIDAuthUrl, 
    exchangeThaIDCode, 
    getThaIDUserInfo,
    getAuthentikAuthUrl, 
    exchangeAuthentikCode, 
    getAuthentikUserInfo,
    getFrontendUrl
} from "../services/oidc";

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

            return { token, role: user.role, username: user.display_name || user.username };
        },
        {
            body: t.Object({
                username: t.String(),
                password: t.String(),
            }),
        }
    )
    .get("/thaid/login", ({ set }) => {
        try {
            const authUrl = getThaIDAuthUrl();
            set.redirect = authUrl;
        } catch (e: any) {
            set.status = 500;
            return { error: e.message };
        }
    })
    .get("/thaid/callback", async ({ query, jwt, set, headers }) => {
        const code = query.code as string;
        if (!code) {
            set.status = 400;
            return { error: "Authorization code missing" };
        }

        try {
            // Exchange code for token
            const tokenResponse = await exchangeThaIDCode(code);
            const accessToken = tokenResponse.access_token;
            
            // Get user info
            const userInfo = await getThaIDUserInfo(accessToken);
            const pid = userInfo.pid;
            const name = userInfo.name || userInfo.given_name || userInfo.family_name || pid;

            if (!pid) {
                throw new Error("DOPA did not return Citizen ID (pid)");
            }

            // Find or create user
            let userRecord;
            const [existingByPid] = await db.select().from(users).where(eq(users.thaid_pid, pid)).execute();
            
            if (existingByPid) {
                userRecord = existingByPid;
                // Update display name if changed
                if (userRecord.display_name !== name) {
                    await db.update(users).set({ display_name: name }).where(eq(users.id, userRecord.id)).execute();
                }
            } else {
                // Fallback: check if username = pid exists
                const [existingByUsername] = await db.select().from(users).where(eq(users.username, pid)).execute();
                if (existingByUsername) {
                    userRecord = existingByUsername;
                    // Link with thaid_pid
                    await db.update(users).set({ thaid_pid: pid, display_name: name }).where(eq(users.id, userRecord.id)).execute();
                } else {
                    // Create new user
                    const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                    const hashedPassword = await Bun.password.hash(randomPassword);
                    
                    await db.insert(users).values({
                        username: pid,
                        password: hashedPassword,
                        role: "user", // Default role for DOPA users
                        display_name: name,
                        thaid_pid: pid
                    });
                    
                    // Retrieve newly created user
                    const [newUser] = await db.select().from(users).where(eq(users.thaid_pid, pid)).execute();
                    userRecord = newUser;
                }
            }

            // Generate JWT token
            const token = await jwt.sign({
                id: userRecord.id,
                username: userRecord.username,
                role: userRecord.role,
            });

            // Redirect back to frontend login page with token info
            const frontendUrl = getFrontendUrl(headers as any);
            const redirectUrl = `${frontendUrl}/login?token=${token}&role=${userRecord.role}&username=${encodeURIComponent(userRecord.display_name || userRecord.username)}`;
            set.redirect = redirectUrl;
        } catch (e: any) {
            console.error("[OIDC Callback Error] DOPA:", e);
            set.status = 500;
            return { error: e.message };
        }
    })
    .get("/authentik/login", ({ set }) => {
        try {
            const authUrl = getAuthentikAuthUrl();
            set.redirect = authUrl;
        } catch (e: any) {
            set.status = 500;
            return { error: e.message };
        }
    })
    .get("/authentik/callback", async ({ query, jwt, set, headers }) => {
        const code = query.code as string;
        if (!code) {
            set.status = 400;
            return { error: "Authorization code missing" };
        }

        try {
            // Exchange code for token
            const tokenResponse = await exchangeAuthentikCode(code);
            const accessToken = tokenResponse.access_token;
            
            // Get user info
            const userInfo = await getAuthentikUserInfo(accessToken);
            const sub = userInfo.sub;
            const preferredUsername = userInfo.preferred_username || userInfo.email || sub;
            const name = userInfo.name || preferredUsername;

            if (!sub) {
                throw new Error("Authentik did not return subject (sub)");
            }

            // Determine role based on groups
            let mappedRole: 'admin' | 'staff' | 'approver' | 'user' = 'user';
            if (userInfo.groups && Array.isArray(userInfo.groups)) {
                if (userInfo.groups.includes("admin")) {
                    mappedRole = "admin";
                } else if (userInfo.groups.includes("approver")) {
                    mappedRole = "approver";
                } else if (userInfo.groups.includes("staff")) {
                    mappedRole = "staff";
                }
            }

            // Find or create user
            let userRecord;
            const [existingBySub] = await db.select().from(users).where(eq(users.authentik_sub, sub)).execute();
            
            if (existingBySub) {
                userRecord = existingBySub;
                // Update display name/role if changed
                if (userRecord.display_name !== name || userRecord.role !== mappedRole) {
                    await db.update(users).set({ display_name: name, role: mappedRole }).where(eq(users.id, userRecord.id)).execute();
                }
            } else {
                // Fallback: check if username = preferredUsername exists
                const [existingByUsername] = await db.select().from(users).where(eq(users.username, preferredUsername)).execute();
                if (existingByUsername) {
                    userRecord = existingByUsername;
                    // Link with authentik_sub
                    await db.update(users).set({ authentik_sub: sub, display_name: name, role: mappedRole }).where(eq(users.id, userRecord.id)).execute();
                } else {
                    // Create new user
                    const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                    const hashedPassword = await Bun.password.hash(randomPassword);
                    
                    await db.insert(users).values({
                        username: preferredUsername,
                        password: hashedPassword,
                        role: mappedRole,
                        display_name: name,
                        authentik_sub: sub
                    });
                    
                    // Retrieve newly created user
                    const [newUser] = await db.select().from(users).where(eq(users.authentik_sub, sub)).execute();
                    userRecord = newUser;
                }
            }

            // Generate JWT token
            const token = await jwt.sign({
                id: userRecord.id,
                username: userRecord.username,
                role: userRecord.role,
            });

            // Redirect back to frontend login page with token info
            const frontendUrl = getFrontendUrl(headers as any);
            const redirectUrl = `${frontendUrl}/login?token=${token}&role=${userRecord.role}&username=${encodeURIComponent(userRecord.display_name || userRecord.username)}`;
            set.redirect = redirectUrl;
        } catch (e: any) {
            console.error("[OIDC Callback Error] Authentik:", e);
            set.status = 500;
            return { error: e.message };
        }
    });
