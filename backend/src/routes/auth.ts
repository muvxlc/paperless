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
import crypto from "crypto";

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

            return { token, role: user.role, username: user.name || user.username };
        },
        {
            body: t.Object({
                username: t.String(),
                password: t.String(),
            }),
        }
    )
    .get("/thaid/login", ({ cookie: { thaid_state }, set }) => {
        try {
            console.log("[OIDC] Initiating DOPA/ThaID login redirect...");
            const state = crypto.randomBytes(16).toString("hex");
            thaid_state.set({
                value: state,
                httpOnly: true,
                maxAge: 300, // 5 minutes
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });
            const authUrl = getThaIDAuthUrl(state);
            console.log("[OIDC] DOPA/ThaID Auth URL generated:", authUrl);
            return Response.redirect(authUrl, 302);
        } catch (e: any) {
            console.error("[OIDC Error] Failed to generate DOPA/ThaID Auth URL:", e);
            set.status = 500;
            return { error: e.message };
        }
    })
    .get("/thaid/callback", async ({ query, jwt, set, headers, cookie: { thaid_state } }) => {
        const code = query.code as string;
        const state = query.state as string;
        
        if (!code) {
            set.status = 400;
            return { error: "Authorization code missing" };
        }

        // Verify state to prevent CSRF
        if (!state || state !== thaid_state.value) {
            console.warn(`[OIDC CSRF Warning] State mismatch. Query state: ${state}, Cookie state: ${thaid_state.value}`);
            set.status = 400;
            return { error: "CSRF state verification failed" };
        }

        // Clear state cookie
        thaid_state.remove();

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
                // Update name if changed
                if (userRecord.name !== name) {
                    await db.update(users).set({ name }).where(eq(users.id, userRecord.id)).execute();
                }
            } else {
                // Fallback: check if username = pid exists
                const [existingByUsername] = await db.select().from(users).where(eq(users.username, pid)).execute();
                if (existingByUsername) {
                    userRecord = existingByUsername;
                    // Link with thaid_pid
                    await db.update(users).set({ thaid_pid: pid, name }).where(eq(users.id, userRecord.id)).execute();
                } else {
                    // Create new user
                    const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                    const hashedPassword = await Bun.password.hash(randomPassword);
                    
                    await db.insert(users).values({
                        username: pid,
                        password: hashedPassword,
                        role: "user", // Default role for DOPA users
                        name,
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
            const redirectUrl = `${frontendUrl}/login?token=${token}&role=${userRecord.role}&username=${encodeURIComponent(userRecord.name || userRecord.username)}`;
            return Response.redirect(redirectUrl, 302);
        } catch (e: any) {
            console.error("[OIDC Callback Error] DOPA:", e);
            set.status = 500;
            return { error: e.message };
        }
    })
    .get("/authentik/login", ({ cookie: { authentik_state }, set }) => {
        try {
            console.log("[OIDC] Initiating Authentik login redirect...");
            const state = crypto.randomBytes(16).toString("hex");
            authentik_state.set({
                value: state,
                httpOnly: true,
                maxAge: 300, // 5 minutes
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });
            const authUrl = getAuthentikAuthUrl(state);
            console.log("[OIDC] Authentik Auth URL generated:", authUrl);
            return Response.redirect(authUrl, 302);
        } catch (e: any) {
            console.error("[OIDC Error] Failed to generate Authentik Auth URL:", e);
            set.status = 500;
            return { error: e.message };
        }
    })
    .get("/authentik/callback", async ({ query, jwt, set, headers, cookie: { authentik_state } }) => {
        const code = query.code as string;
        const state = query.state as string;
        
        if (!code) {
            set.status = 400;
            return { error: "Authorization code missing" };
        }

        // Verify state to prevent CSRF
        if (!state || state !== authentik_state.value) {
            console.warn(`[OIDC CSRF Warning] State mismatch. Query state: ${state}, Cookie state: ${authentik_state.value}`);
            set.status = 400;
            return { error: "CSRF state verification failed" };
        }

        // Clear state cookie
        authentik_state.remove();

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
            let mappedRole: 'admin' | 'staff' | 'approver' | 'user' | null = null;
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
                // Update name/role if changed
                const updateFields: any = {};
                if (userRecord.name !== name) {
                    updateFields.name = name;
                }
                if (mappedRole && userRecord.role !== mappedRole) {
                    updateFields.role = mappedRole;
                }
                if (Object.keys(updateFields).length > 0) {
                    await db.update(users).set(updateFields).where(eq(users.id, userRecord.id)).execute();
                    // Update userRecord locally
                    userRecord = { ...userRecord, ...updateFields };
                }
            } else {
                // Fallback: check if username = preferredUsername exists
                const [existingByUsername] = await db.select().from(users).where(eq(users.username, preferredUsername)).execute();
                if (existingByUsername) {
                    userRecord = existingByUsername;
                    // Link with authentik_sub
                    const updateFields: any = { authentik_sub: sub, name };
                    if (mappedRole) {
                        updateFields.role = mappedRole;
                    }
                    await db.update(users).set(updateFields).where(eq(users.id, userRecord.id)).execute();
                    userRecord = { ...userRecord, ...updateFields };
                } else {
                    // Create new user
                    const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                    const hashedPassword = await Bun.password.hash(randomPassword);
                    
                    await db.insert(users).values({
                        username: preferredUsername,
                        password: hashedPassword,
                        role: mappedRole || "user",
                        name,
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
            const redirectUrl = `${frontendUrl}/login?token=${token}&role=${userRecord.role}&username=${encodeURIComponent(userRecord.name || userRecord.username)}`;
            return Response.redirect(redirectUrl, 302);
        } catch (e: any) {
            console.error("[OIDC Callback Error] Authentik:", e);
            set.status = 500;
            return { error: e.message };
        }
    });
