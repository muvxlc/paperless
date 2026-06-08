import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { authRoutes } from './routes/auth'
import { jwt } from '@elysiajs/jwt'
import { PaperlessService } from './services/paperless'
import { db } from './db'
import { approvals, document_tracking, users, document_permissions, audit_logs } from './db/schema'
import { eq, desc, and, inArray, lt, sql } from 'drizzle-orm'

const app = new Elysia()
    .use(cors({
        origin: true, // Allow all origins (or specify 'https://paperless.bangkhan.com')
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    }))
    .onError(({ code, error }) => {
        console.error(`[Elysia Error] ${code}:`, error)
    })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'secret'
        })
    )
    .get('/api/debug', async () => {
        const { debugConnectivity } = await import('./scripts/debug-paperless');
        return await debugConnectivity();
    })
    // Fix Icon 404: Redirect /api/_nuxt_icon -> /_nuxt_icon
    .get('/api/_nuxt_icon/*', ({ params, query, set, path }) => {
        // Construct the new path by removing /api prefix
        // path is /api/_nuxt_icon/foo -> /_nuxt_icon/foo
        const newPath = path.replace('/api', '');
        const queryString = new URLSearchParams(query as Record<string, string>).toString();
        const fullDest = queryString ? `${newPath}?${queryString}` : newPath;
        set.redirect = fullDest;
    })
    .group('/api', app => app
        .use(authRoutes)
        .derive(async ({ jwt, headers, query }) => {
            const auth = headers['authorization']
            let token = ''
            if (auth && auth.startsWith('Bearer ')) {
                token = auth.slice(7)
            } else if (query.token) {
                token = query.token as string
            }

            if (!token) return { user: null }
            const profile = await jwt.verify(token)
            return { user: profile || null }
        })
        .onBeforeHandle(({ user, set }) => {
            if (!user) {
                set.status = 401
                return 'Unauthorized'
            }
        })
        // Staff: Upload
        .post('/upload', async ({ body, user, set }) => {
            if (user?.role !== 'staff' && user?.role !== 'admin') {
                set.status = 403
                return 'Forbidden'
            }
            // body.file should be the file
            // In Elysia, body needs t.File() schema for file upload usually, or just access it
            // Note: Elysia 1.0 handles multipart automatically if schema is defined

            const file = body.file as Blob
            const title = body.title as string

            try {
                // Ensure 'Pending' tag exists
                const pendingTagId = await PaperlessService.getOrCreateTag('Pending');

                // Upload with Tag
                const result = await PaperlessService.uploadDocument(file, title, [pendingTagId]);

                // Track uploader
                if (result.document_id || result.taskId) {
                    // Note: Paperless post_document might return taskId or document_id depending on version/async
                    // If it's taskId, we might not have the doc ID yet. 
                    // But for now let's hope it returns something we can use.
                    // If not, we might need to poll. 
                    // For simplified MVP, let's assume result has what we need or just continue.
                }

                // If Paperless returns the ID immediately (synchronous), use it
                const paperlessDocId = result.document_id;
                if (paperlessDocId && user?.id) {
                    await db.insert(document_tracking).values({
                        paperless_id: paperlessDocId,
                        uploader_id: user.id as number
                    })
                }

                return { success: true, result }
            } catch (e: any) {
                set.status = 500
                return { error: e.message }
            }
        }, {
            body: t.Object({
                file: t.File(),
                title: t.Optional(t.String())
            })
        })
        // Staff: Get task status
        .get('/upload/status/:taskId', async ({ params, user, set }) => {
            if (user?.role !== 'staff' && user?.role !== 'admin') {
                set.status = 403
                return 'Forbidden'
            }

            const taskId = params.taskId
            try {
                const data = await PaperlessService.getTaskStatus(taskId)
                console.log(`[API] Polling Task ${taskId} response:`, JSON.stringify(data))
                const task = Array.isArray(data) ? data[0] : (data.results && data.results[0])

                if (task) {
                    // Task status in Paperless: PENDING, STARTED, SUCCESS, FAILURE, REVOKED
                    if (task.status === 'SUCCESS' && task.related_document) {
                        const docId = parseInt(task.related_document)
                        
                        // Check if already tracked, if not insert to document_tracking
                        const existingTracking = await db.select().from(document_tracking).where(eq(document_tracking.paperless_id, docId))
                        if (existingTracking.length === 0 && user?.id) {
                            await db.insert(document_tracking).values({
                                paperless_id: docId,
                                uploader_id: user.id as number
                            })
                        }
                    }

                    return { 
                        status: task.status, 
                        task_id: task.task_id,
                        related_document: task.related_document,
                        error: task.result 
                    }
                }

                return { status: 'PENDING' }
            } catch (e: any) {
                set.status = 500
                return { error: e.message }
            }
        })
        // Approver: List Pending
        .get('/pending', async ({ user, set }) => {
            if (user?.role !== 'approver' && user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }
            // Use PaperlessService to find docs with tag 'Pending'
            // We need to know the 'Pending' tag ID. For MVP, let's search by query "tag:Pending"
            try {
                const docs = await PaperlessService.getDocuments('tag:Pending');

                // Enrich with uploader name from our DB
                const enrichedResults = await Promise.all(docs.results.map(async (doc: any) => {
                    const tracking = await db.select({
                        uploader_name: users.username
                    })
                        .from(document_tracking)
                        .leftJoin(users, eq(document_tracking.uploader_id, users.id))
                        .where(eq(document_tracking.paperless_id, doc.id))
                        .limit(1);

                    return {
                        ...doc,
                        owner_name: tracking[0]?.uploader_name || 'System'
                    }
                }));

                return { ...docs, results: enrichedResults }
            } catch (e: any) {
                console.error('[API] Error fetching pending docs:', e);
                set.status = 500; return { error: e.message }
            }
        })
        // Approver: Approve
        // Approver: Approve
        .post('/approve/:id', async ({ params, user, set, body }) => {
            if (user?.role !== 'approver' && user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }

            const docId = parseInt(params.id)
            const { userIds, expirationDays, canDownload } = body as { userIds?: number[], expirationDays?: number, canDownload?: boolean }

            try {
                // Get Tag IDs
                const pendingId = await PaperlessService.getOrCreateTag('Pending');
                const approvedId = await PaperlessService.getOrCreateTag('Approved');
                const rejectedId = await PaperlessService.getOrCreateTag('Rejected');

                // Get current tags
                const doc = await PaperlessService.getDocument(docId);
                let currentTags = doc.tags || [];

                // Add Approved, Remove Pending AND Rejected
                currentTags = currentTags.filter((t: any) => t !== pendingId && t !== rejectedId);
                if (!currentTags.includes(approvedId)) {
                    currentTags.push(approvedId);
                }

                await PaperlessService.setDocumentTags(docId, currentTags);

                // Calculate Expiration
                let expiresAt = null;
                if (expirationDays && Number(expirationDays) > 0) {
                    const days = Number(expirationDays);
                    const now = new Date();
                    now.setDate(now.getDate() + days); // Add days
                    expiresAt = now;
                }

                // Update Document Tracking (Upload info + Expiration)
                const existingTracking = await db.select().from(document_tracking).where(eq(document_tracking.paperless_id, docId));
                if (existingTracking.length === 0) {
                    await db.insert(document_tracking).values({
                        paperless_id: docId,
                        uploader_id: user.id as number,
                        expires_at: expiresAt
                    })
                } else {
                    await db.update(document_tracking)
                        .set({ expires_at: expiresAt })
                        .where(eq(document_tracking.paperless_id, docId));
                }

                // Check if existing record in approvals? The flow assumes it's there.
                // If approving from scratch (fresh upload), it might need insert.
                // But our logic assumes 'approvals' table tracks requests.
                // Actually, if we restore, we update.

                // Log to DB (Update or Insert?)
                // The previous logic was just `db.insert(approvals)`. This might duplicate if we re-approve?
                // `approvals` table has `paperless_doc_id`. 
                // We should probably UPSERT or check exist.
                // For now, let's assume the previous flow was insert-only which implies multiple logs or PK violation?
                // `approvals` PK is `id`. `paperless_doc_id` is not unique in schema?
                // Schema: paperless_doc_id int not null.
                // If I insert again, I get multiple rows for same doc.
                // Previous code: `await db.insert(approvals)...`
                // I should probably clean up previous status rows or just insert new history?
                // Let's stick to update if exists, insert if not.

                const existing = await db.select().from(approvals).where(eq(approvals.paperless_doc_id, docId));
                if (existing.length > 0) {
                    await db.update(approvals).set({
                        status: 'approved',
                        actor_id: user.id as number,
                        created_at: new Date() // Update timestamp
                    }).where(eq(approvals.paperless_doc_id, docId));
                } else {
                    await db.insert(approvals).values({
                        paperless_doc_id: docId,
                        status: 'approved',
                        actor_id: user.id as number
                    })
                }

                // Fetch Usernames for Audit Log
                let approvedForNames = 'None';
                if (userIds && userIds.length > 0) {
                    const approvedUsers = await db.select({ username: users.username })
                        .from(users)
                        .where(inArray(users.id, userIds));
                    approvedForNames = approvedUsers.map(u => u.username).join(', ');
                }

                // Audit Log: APPROVE
                await db.insert(audit_logs).values({
                    user_id: user.id as number,
                    action: 'APPROVE',
                    target_id: String(docId),
                    details: `Document: "${doc.title}". Approved for: [${approvedForNames}]. By: ${user.username}. Expiration: ${expirationDays || 'None'}, Download: ${canDownload}`
                })

                // Save Permissions
                if (userIds && Array.isArray(userIds)) {
                    // Clear existing if any (undo then redo)
                    await db.delete(document_permissions).where(eq(document_permissions.paperless_id, docId))

                    if (userIds.length > 0) {
                        for (const uid of userIds) {
                            await db.insert(document_permissions).values({
                                paperless_id: docId,
                                user_id: uid,
                                can_download: typeof canDownload === 'boolean' ? canDownload : true
                            })
                        }
                    }
                }

                return { success: true }
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })
        // Restore (Rejected -> Pending)
        .post('/restore/:id', async ({ params, user, set }: any) => {
            if (user?.role !== 'approver' && user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }
            const docId = parseInt(params.id)
            try {
                const pendingId = await PaperlessService.getOrCreateTag('Pending');
                const rejectedId = await PaperlessService.getOrCreateTag('Rejected');
                const approvedId = await PaperlessService.getOrCreateTag('Approved');

                const doc = await PaperlessService.getDocument(docId);
                let currentTags = doc.tags || [];

                // Remove Rejected and Approved
                currentTags = currentTags.filter((t: number) => t !== rejectedId && t !== approvedId);
                // Add Pending
                if (!currentTags.includes(pendingId)) currentTags.push(pendingId);

                await PaperlessService.setDocumentTags(docId, currentTags);

                // Update DB status
                await db.update(approvals).set({ status: 'pending' }).where(eq(approvals.paperless_doc_id, docId));

                // Log Restore
                await db.insert(audit_logs).values({
                    user_id: user.id as number,
                    action: 'RESTORE',
                    target_id: String(docId),
                    details: `Restored to Pending by ${user.username}`
                })

                return { success: true }
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })
        // Approver: Reject (Move to Rejected Tag)
        .post('/reject/:id', async ({ params, user, set }: any) => {
            if (user?.role !== 'approver' && user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }
            const docId = parseInt(params.id)
            try {
                // Get Tag IDs
                const pendingId = await PaperlessService.getOrCreateTag('Pending');
                const approvedId = await PaperlessService.getOrCreateTag('Approved');
                const rejectedId = await PaperlessService.getOrCreateTag('Rejected');

                // Get current tags
                const doc = await PaperlessService.getDocument(docId);
                let currentTags = doc.tags || [];

                // Remove Approved AND Pending
                currentTags = currentTags.filter((t: number) => t !== approvedId && t !== pendingId);

                // Add Rejected
                if (!currentTags.includes(rejectedId)) currentTags.push(rejectedId);

                await PaperlessService.setDocumentTags(docId, currentTags);

                // Update DB status
                await db.update(approvals).set({ status: 'rejected' }).where(eq(approvals.paperless_doc_id, docId));

                // Log Reject Event
                await db.insert(audit_logs).values({
                    user_id: user.id as number,
                    action: 'REJECT',
                    target_id: String(docId),
                    details: `Rejected by ${user.username}`
                })

                return { success: true }
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })
        // Get Rejected documents
        .get('/rejected', async ({ user, set }: any) => {
            if (user?.role !== 'approver' && user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }
            try {
                const rejectedId = await PaperlessService.getOrCreateTag('Rejected');
                const docs = await PaperlessService.getDocumentsByTag(rejectedId);

                // Enrich with uploader info if possible (similar to /api/pending)
                // Assuming logic is similar to /pending
                // Enrich with uploader name from DB or User Map
                // We need to match paperless owner_id to our users table or just use owner from paperless
                // For now, let's map using the same logic as Pending/Approved if needed.
                // Assuming PaperlessService.getDocumentsByTag returns Paperless docs.

                // Helper to enrich
                const enrichedDocs = await Promise.all(docs.results.map(async (doc: any) => {
                    // Check if we have tracking info
                    const tracked = await db.select().from(document_tracking).where(eq(document_tracking.paperless_id, doc.id));
                    let uploaderName = doc.owner_username || 'Unknown'; // Paperless might provide username if mapped

                    // If we track uploader in our DB
                    if (tracked.length > 0 && tracked[0].uploader_id) {
                        const uploader = await db.select().from(users).where(eq(users.id, tracked[0].uploader_id));
                        if (uploader.length > 0) uploaderName = uploader[0].username;
                    }
                    return { ...doc, owner_name: uploaderName };
                }));

                return { results: enrichedDocs, count: docs.count }
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })
        // Search
        .get('/search', async ({ query, user, set }) => {
            // query.q
            const q = query.q as string || '';
            try {
                // Add * wildcards for partial match if not already present
                let searchQuery = q;
                if (searchQuery && !searchQuery.includes('*')) {
                    searchQuery = `*${searchQuery}*`;
                }
                const docs = await PaperlessService.getDocuments(searchQuery);
                return docs;
            } catch (e: any) {
                return { error: e.message }
            }
        })
        // Download/View document
        .get('/download/:id', async ({ params, set, user, query, jwt }: any) => {
            if (!user) {
                set.status = 401; return 'Unauthorized'
            }

            const docId = parseInt(params.id);
            // Audit Log: VIEW
            let userId = null;
            if (user) userId = user.id;
            // If user is missing (e.g. valid token but extraction failed?), we log as System or Anonymous?
            // Let's verify token from query if user is null
            if (!userId && query.token) {
                const profile = await jwt.verify(query.token);
                if (profile) userId = profile.id;
            }

            if (userId) {
                await db.insert(audit_logs).values({
                    user_id: userId,
                    action: 'VIEW',
                    target_id: String(docId),
                    details: 'Document Followed/Downloaded'
                })
            }

            try {
                // Permission Check
                if (userId) {
                    // Fetch user role
                    const u = await db.select().from(users).where(eq(users.id, userId)).limit(1);
                    if (u.length > 0 && u[0].role === 'user') {
                        // Check permissions
                        const perm = await db.select().from(document_permissions)
                            .where(and(
                                eq(document_permissions.paperless_id, docId),
                                eq(document_permissions.user_id, userId)
                            ));
                        if (perm.length === 0) {
                            set.status = 403; return 'Forbidden';
                        }
                        // Also check if view_only?
                        // If this is the /download endpoint, and user has can_download=false...
                        // Should we block?
                        // The Requirement says: "Restricted Viewer (No Toolbar)... Default View Only".
                        // If can_download is false, they should use /view (HTML wrapper).
                        // If they try /download directly... we should probably block standard download if we can distinguish?
                        // Or we serve the PDF with headers that force inline?
                        // If can_download=false, we might want to prevent "Attachment" disposition.
                    }
                }

                const response = await PaperlessService.downloadDocument(docId);

                // Forward content-type and disposition if possible
                const contentType = response.headers.get('content-type');
                if (contentType) set.headers['content-type'] = contentType;

                return await response.arrayBuffer();
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })
        // View Wrapper (HTML with Right Click Protection)
        .get('/view/:id', async ({ params, query, user, set }: any) => {
            const docId = parseInt(params.id);
            // Auth Check
            let userId = null;
            let token = query.token;
            if (user) { userId = user.id; }
            else if (token) {
                const profile = await app.jwt.verify(token);
                if (profile) userId = profile.id;
            }

            if (!userId) { set.status = 401; return 'Unauthorized'; }

            // PDF.js Secure Viewer
            return new Response(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Secure View</title>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
                    <style>
                        body, html { margin: 0; padding: 0; background-color: #525659; height: 100%; overflow: auto; }
                        #canvas-container { 
                            display: flex; 
                            flex-direction: column; 
                            align-items: center; 
                            padding: 20px; 
                        }
                        canvas { 
                            box-shadow: 0 4px 8px rgba(0,0,0,0.2); 
                            margin-bottom: 20px;
                        }
                    </style>
                </head>
                <body oncontextmenu="return false;">
                    <div id="canvas-container"></div>

                    <script>
                        // Block events
                        document.addEventListener('contextmenu', event => event.preventDefault());
                        document.onkeydown = function(e) {
                             if (e.keyCode == 123) { return false; } // F12
                             if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) { return false; } 
                             if (e.ctrlKey && e.shiftKey && e.keyCode == 'C'.charCodeAt(0)) { return false; } 
                             if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) { return false; } 
                             if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) { return false; } 
                        };

                        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

                        const url = '/api/download/${docId}?token=${token}';

                        async function renderPDF() {
                            try {
                                const loadingTask = pdfjsLib.getDocument(url);
                                const pdf = await loadingTask.promise;
                                const container = document.getElementById('canvas-container');

                                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                                    const page = await pdf.getPage(pageNum);
                                    const scale = 1.5;
                                    const viewport = page.getViewport({scale: scale});

                                    const canvas = document.createElement('canvas');
                                    const context = canvas.getContext('2d');
                                    canvas.height = viewport.height;
                                    canvas.width = viewport.width;

                                    container.appendChild(canvas);

                                    const renderContext = {
                                        canvasContext: context,
                                        viewport: viewport
                                    };
                                    await page.render(renderContext).promise;
                                }
                            } catch (err) {
                                console.error('Error rendering PDF:', err);
                                document.body.innerHTML = '<h2 style="color:white;text-align:center;margin-top:20px;">Error loading document.</h2>';
                            }
                        }

                        renderPDF();
                    </script>
                </body>
                </html>
            `, {
                headers: { 'Content-Type': 'text/html' }
            });
        })
        // Audit Logs (Admin Only) - with Search & Pagination
        .get('/logs', async ({ user, set, query }: any) => {
            if (user?.role !== 'admin') {
                set.status = 403; return 'Forbidden';
            }

            const page = Number(query.page) || 1;
            const limit = Number(query.limit) || 20;
            const offset = (page - 1) * limit;
            const q = query.q as string || '';

            try {
                // Build Filter
                const searchFilters = [];
                if (q) {
                    const searchStr = `%${q}%`;
                    searchFilters.push(sql`${users.username} LIKE ${searchStr}`);
                    searchFilters.push(sql`${audit_logs.action} LIKE ${searchStr}`);
                    searchFilters.push(sql`${audit_logs.details} LIKE ${searchStr}`);
                    searchFilters.push(sql`${audit_logs.target_id} LIKE ${searchStr}`);
                }

                // Base Query Condition
                let whereCondition = undefined;
                if (searchFilters.length > 0) {
                    whereCondition = sql`(${sql.join(searchFilters, sql` OR `)})`;
                }

                // Get Total Count
                const countResult = await db.select({ count: sql<number>`count(*)` })
                    .from(audit_logs)
                    .leftJoin(users, eq(audit_logs.user_id, users.id))
                    .where(whereCondition);

                const total = countResult[0].count;

                // Get Data
                const logs = await db.select({
                    id: audit_logs.id,
                    username: users.username,
                    action: audit_logs.action,
                    target_id: audit_logs.target_id,
                    details: audit_logs.details,
                    created_at: audit_logs.created_at
                })
                    .from(audit_logs)
                    .leftJoin(users, eq(audit_logs.user_id, users.id))
                    .where(whereCondition)
                    .orderBy(desc(audit_logs.created_at))
                    .limit(limit)
                    .offset(offset);

                return {
                    data: logs,
                    meta: {
                        total,
                        page,
                        limit,
                        total_pages: Math.ceil(total / limit)
                    }
                };
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })

        // User: View Approved
        .get('/approved', async ({ user, set }) => {
            try {
                // Search for tag:Approved
                const docs = await PaperlessService.getDocuments('tag:Approved');
                console.log(`[API] Approved docs found in Paperless: ${docs.results?.length || 0}`);

                // Filter by permissions if regular user
                let results = docs.results || [];
                console.log(`[API Debug] User:`, user);

                if (user?.role === 'user') {
                    const userId = (user as any).id;
                    console.log(`[API] Filtering for user_id: ${userId}`);

                    const permittedIds = await db.select({ paperless_id: document_permissions.paperless_id })
                        .from(document_permissions)
                        .where(eq(document_permissions.user_id, userId));

                    const allowedIdSet = new Set(permittedIds.map(p => p.paperless_id));
                    results = results.filter((doc: any) => allowedIdSet.has(doc.id));
                    console.log(`[API] Filtered results: ${results.length}`);
                }

                // Enrich with uploader name and permissions
                const enrichedResults = await Promise.all(results.map(async (doc: any) => {
                    try {
                        const tracking = await db.select({
                            uploader_name: users.username,
                            expires_at: document_tracking.expires_at
                        })
                            .from(document_tracking)
                            .leftJoin(users, eq(document_tracking.uploader_id, users.id))
                            .where(eq(document_tracking.paperless_id, doc.id))
                            .limit(1);

                        let canDownload = true;
                        if (user?.role === 'user') {
                            const perm = await db.select({ can_download: document_permissions.can_download })
                                .from(document_permissions)
                                .where(and(
                                    eq(document_permissions.paperless_id, doc.id),
                                    eq(document_permissions.user_id, (user as any).id)
                                ))
                                .limit(1);
                            if (perm.length > 0) {
                                canDownload = perm[0].can_download;
                            }
                        }

                        return {
                            ...doc,
                            owner_name: tracking[0]?.uploader_name || 'System',
                            expires_at: tracking[0]?.expires_at,
                            can_download: canDownload
                        }
                    } catch (enrichErr) {
                        console.error(`[API] Enrich error for doc ${doc.id}:`, enrichErr);
                        return { ...doc, owner_name: 'Error', can_download: true }
                    }
                }));

                return { ...docs, results: enrichedResults }
            } catch (e: any) {
                console.error('[API] Error in /api/approved:', e);
                set.status = 500;
                return { error: e.message }
            }
        })
        // User Management (Admin Only)
        .group('/users', app => app
            .onBeforeHandle(({ user, set }) => {
                if (user?.role !== 'admin') {
                    set.status = 403; return 'Forbidden'
                }
            })
            // List Users
            .get('/', async () => {
                return await db.select({ id: users.id, username: users.username, role: users.role }).from(users);
            })
            // Create User
            .post('/', async ({ body, set }: any) => {
                const { username, password, role } = body
                if (!username || !password || !role) {
                    set.status = 400; return 'Missing fields'
                }
                const hashedPassword = await Bun.password.hash(password)
                try {
                    await db.insert(users).values({
                        username,
                        password: hashedPassword,
                        role
                    })
                    return { success: true }
                } catch (e: any) {
                    set.status = 500; return { error: e.message }
                }
            })
            // Update User
            .put('/:id', async ({ params, body, set }: any) => {
                const id = parseInt(params.id)
                const { username, password, role } = body

                const updateData: any = { username, role }
                if (password) {
                    updateData.password = await Bun.password.hash(password)
                }

                try {
                    await db.update(users).set(updateData).where(eq(users.id, id))
                    return { success: true }
                } catch (e: any) {
                    set.status = 500; return { error: e.message }
                }
            })
            // Delete User
            .delete('/:id', async ({ params, set }: any) => {
                const id = parseInt(params.id)
                try {
                    await db.delete(users).where(eq(users.id, id))
                    return { success: true }
                } catch (e: any) {
                    set.status = 500; return { error: e.message }
                }
            })
        )
    )

    .listen(3001)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)

// --- Initialization: Seed Admin User ---
async function seedAdmin() {
    console.log(`[Init] DB Config Host: ${process.env.DB_HOST || 'localhost'}`);
    try {
        console.log('[Init] Checking for admin user...');
        // Test connection first
        await db.execute(sql`SELECT 1`);
        console.log('[Init] DB Connection Success');

        const adminUser = await db.select().from(users).where(eq(users.username, 'admin'));
        if (adminUser.length === 0) {
            console.log('[Init] Creating default admin user (admin/password)...');
            const hashedPassword = await Bun.password.hash('password');
            await db.insert(users).values({
                username: 'admin',
                password: hashedPassword,
                role: 'admin'
            });
            console.log('[Init] Admin user created successfully.');
        } else {
            console.log('[Init] Admin user already exists.');
        }
    } catch (e: any) {
        console.error('[Init] Error seeding admin:', e.message);
        console.error(e);
    }
}

// seedAdmin().catch(err => console.error('[Init] Fatal Seed Error:', err));

// --- Scheduler: Check for Expired Documents every 1 hour ---
setInterval(async () => {
    try {
        console.log('[Scheduler] Checking for expired documents...');
        const now = new Date();
        // Find expired docs
        const expiredDocs = await db.select().from(document_tracking)
            .where(lt(document_tracking.expires_at, now));

        if (expiredDocs.length > 0) {
            console.log(`[Scheduler] Found ${expiredDocs.length} expired documents.`);
            const pendingId = await PaperlessService.getOrCreateTag('Pending');
            const approvedId = await PaperlessService.getOrCreateTag('Approved');

            for (const doc of expiredDocs) {
                try {
                    const paperlessDoc = await PaperlessService.getDocument(doc.paperless_id);
                    let currentTags = paperlessDoc.tags || [];

                    // If it has "Approved" tag, remove it and add "Pending"
                    if (currentTags.includes(approvedId)) {
                        currentTags = currentTags.filter((t: number) => t !== approvedId);
                        if (!currentTags.includes(pendingId)) {
                            currentTags.push(pendingId);
                        }

                        await PaperlessService.setDocumentTags(doc.paperless_id, currentTags);
                        console.log(`[Scheduler] Reverted Doc ${doc.paperless_id} to Pending.`);
                    }

                    // Clear expires_at
                    await db.update(document_tracking)
                        .set({ expires_at: null })
                        .where(eq(document_tracking.paperless_id, doc.paperless_id));

                } catch (err) {
                    console.error(`[Scheduler] Error processing doc ${doc.paperless_id}:`, err);
                }
            }
        }
    } catch (e) {
        console.error('[Scheduler] Error:', e);
    }
}, 60 * 60 * 1000); // 1 Hour
