import mysql from "mysql2/promise";

declare var Bun: any; // Declare global for TS (runtime uses global Bun)

async function initDB() {
    console.log(`[Init] Connecting to DB Host: ${process.env.DB_HOST || 'localhost'}...`);

    // Create connection
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "db",
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    console.log("[Init] Connected. Running raw SQL schema creation...");

    try {
        // 1. Users Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'staff', 'approver', 'user') NOT NULL DEFAULT 'user'
            );
        `);
        console.log(" - Checked/Created table: users");

        // Ensure name, display_name, thaid_pid, authentik_sub, and discord_webhook columns exist in users table
        const addColumnSafely = async (columnName: string, sqlDefinition: string) => {
            try {
                const [cols]: any = await connection.execute(`SHOW COLUMNS FROM users LIKE '${columnName}'`);
                if (cols.length === 0) {
                    console.log(`[Init] Adding column '${columnName}' to users table...`);
                    await connection.execute(`ALTER TABLE users ADD COLUMN ${columnName} ${sqlDefinition}`);
                    console.log(`[Init] Column '${columnName}' added successfully.`);
                } else {
                    console.log(`[Init] Column '${columnName}' already exists.`);
                }
            } catch (err) {
                console.error(`[Init] Error checking/adding column '${columnName}':`, err);
            }
        };

        await addColumnSafely("name", "VARCHAR(255) NULL");
        await addColumnSafely("display_name", "VARCHAR(255) NULL");
        await addColumnSafely("thaid_pid", "VARCHAR(255) NULL UNIQUE");
        await addColumnSafely("authentik_sub", "VARCHAR(255) NULL UNIQUE");
        await addColumnSafely("discord_webhook", "VARCHAR(512) NULL");

        // 2. Approvals Table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS approvals (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                paperless_doc_id INT NOT NULL,
                status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
                actor_id BIGINT UNSIGNED,
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
            );
        `);
        console.log(" - Checked/Created table: approvals");

        // 3. Document Tracking
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS document_tracking (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                paperless_id INT NOT NULL UNIQUE,
                uploader_id BIGINT UNSIGNED,
                expires_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE SET NULL
            );
        `);
        console.log(" - Checked/Created table: document_tracking");

        // 4. Document Permissions
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS document_permissions (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                paperless_id INT NOT NULL,
                user_id BIGINT UNSIGNED,
                can_download BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
        console.log(" - Checked/Created table: document_permissions");

        // 5. Audit Logs
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                action VARCHAR(50) NOT NULL,
                target_id VARCHAR(255),
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log(" - Checked/Created table: audit_logs");

        // 6. User Requests
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_requests (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                paperless_id INT NOT NULL,
                user_id BIGINT UNSIGNED,
                status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
        console.log(" - Checked/Created table: user_requests");

        // 7. Chart Statuses
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS chart_statuses (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                color VARCHAR(50) NOT NULL DEFAULT 'gray',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log(" - Checked/Created table: chart_statuses");

        // 8. Document Chart Status
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS document_chart_status (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                paperless_id INT NOT NULL UNIQUE,
                status_id BIGINT UNSIGNED,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (status_id) REFERENCES chart_statuses(id) ON DELETE CASCADE
            );
        `);
        console.log(" - Checked/Created table: document_chart_status");

        // --- Seed Admin ---
        console.log("[Init] Checking for admin user...");
        const [rows]: any = await connection.execute("SELECT * FROM users WHERE username = ?", ["admin"]);

        if (rows.length === 0) {
            console.log("[Init] Creating default admin user (admin/password)...");
            const hashedPassword = await Bun.password.hash("password");
            await connection.execute(
                "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
                ["admin", hashedPassword, "admin"]
            );
            console.log("[Init] Admin user created successfully.");
        } else {
            console.log("[Init] Admin user already exists.");
        }

        console.log("[Init] Database initialization complete.");
        process.exit(0);

    } catch (e) {
        console.error("[Init] Error initializing database:", e);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

initDB();
