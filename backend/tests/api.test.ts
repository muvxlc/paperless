import { describe, expect, it, beforeAll } from "bun:test";

const API_URL = "http://localhost:3001";

describe("Backend API Authentication", () => {
    let authToken = "";

    it("should register a new user", async () => {
        const username = `testuser_${Date.now()}`;
        const response = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username,
                password: "password123",
                role: "user"
            })
        });
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data).toHaveProperty("success", true);
    });

    it("should login with valid credentials", async () => {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: "admin", // Assumes admin exists from setup
                password: "password"
            })
        });
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data).toHaveProperty("token");
        expect(data).toHaveProperty("role", "admin");
        authToken = data.token;
    });

    it("should fail login with invalid credentials", async () => {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: "admin",
                password: "wrongpassword"
            })
        });
        expect(response.status).toBe(401);
    });
});

describe("Role Based Access Control", () => {
    let staffToken = "";
    let userToken = "";

    beforeAll(async () => {
        // Login as staff
        const staffRes = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "staff1", password: "password" })
        });
        const staffData = await staffRes.json();
        staffToken = staffData.token;

        // Login as user
        const userRes = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "user1", password: "password" })
        });
        const userData = await userRes.json();
        userToken = userData.token;
    });

    it("Staff should be allowed to upload (mock)", async () => {
        // We expect 500 or 200 depending on if paperless is up, but definitely NOT 403
        const form = new FormData();
        const blob = new Blob(["test"], { type: "text/plain" });
        form.append("file", blob);

        const response = await fetch(`${API_URL}/api/upload`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${staffToken}` },
            body: form
        });
        // 403 Forbidden is what we want to test AGAINST.
        expect(response.status).not.toBe(403);
    });

    it("User should NOT be allowed to upload", async () => {
        const form = new FormData();
        const blob = new Blob(["test"], { type: "text/plain" });
        form.append("file", blob);

        const response = await fetch(`${API_URL}/api/upload`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${userToken}` },
            body: form
        });
        expect(response.status).toBe(403);
    });
});
