import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { authRoutes } from './routes/auth'
import { jwt } from '@elysiajs/jwt'
import { PaperlessService } from './services/paperless'
import { db } from './db'
import { approvals, document_tracking, users, document_permissions, audit_logs, user_requests, chart_statuses, document_chart_status } from './db/schema'
import { eq, desc, and, inArray, lt, sql, or, isNotNull } from 'drizzle-orm'

// Memory storage for short-lived, one-time document view tokens
const viewTokens = new Map<string, { docId: number; userId: number; expiresAt: number }>();

function cleanExpiredTokens() {
    const now = Date.now();
    for (const [token, data] of viewTokens.entries()) {
        if (data.expiresAt < now) {
            viewTokens.delete(token);
        }
    }
}

async function sendDiscordNotification(webhookUrl: string | null, message: string) {
    if (!webhookUrl || !webhookUrl.startsWith('http')) return;
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message })
        });
    } catch (err) {
        console.error('[Discord Webhook] Failed to send notification:', err);
    }
}

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
        // System status (Admin Only)
        .get('/status', async ({ user, set }) => {
            if (user?.role !== 'admin') {
                set.status = 403
                return 'Forbidden'
            }

            let dbStatus = 'inactive'
            try {
                await db.execute(sql`SELECT 1`)
                dbStatus = 'active'
            } catch (e) {
                console.error('[Status Check] Database check failed:', e)
            }

            let paperlessStatus = 'inactive'
            try {
                const headers: Record<string, string> = {}
                const token = process.env.PAPERLESS_API_TOKEN
                const username = process.env.PAPERLESS_USERNAME
                const password = process.env.PAPERLESS_PASSWORD
                if (token && token.trim() !== '' && !token.includes('YOUR_')) {
                    headers['Authorization'] = `Token ${token}`
                } else if (username && password) {
                    const credentials = btoa(`${username}:${password}`)
                    headers['Authorization'] = `Basic ${credentials}`
                }
                const response = await fetch(`${process.env.PAPERLESS_API_URL || 'http://paperless-ngx:8000/api'}/`, {
                    headers
                })
                if (response.ok) {
                    paperlessStatus = 'active'
                }
            } catch (e) {
                console.error('[Status Check] Paperless check failed:', e)
            }

            return {
                server: 'active',
                database: dbStatus,
                paperless: paperlessStatus
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
            const tagsInput = body.tags as string || ''

            try {
                // Ensure 'Pending' tag exists
                const pendingTagId = await PaperlessService.getOrCreateTag('Pending');
                const tagIds = [pendingTagId];

                // Process custom tags if provided
                if (tagsInput) {
                    const tagNames = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
                    for (const name of tagNames) {
                        const tagId = await PaperlessService.getOrCreateTag(name);
                        if (!tagIds.includes(tagId)) {
                            tagIds.push(tagId);
                        }
                    }
                }

                // Upload with Tags
                const result = await PaperlessService.uploadDocument(file, title, tagIds);

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

                // Log Audit Event: UPLOAD
                if (user?.id) {
                    const targetId = paperlessDocId ? String(paperlessDocId) : (typeof result === 'string' ? result : (result.taskId || result.task_id || 'Unknown'));
                    await db.insert(audit_logs).values({
                        user_id: user.id as number,
                        action: 'UPLOAD',
                        target_id: targetId,
                        details: `Uploaded document: "${title || 'Untitled'}". Uploader: ${user.username}`
                    });
                }

                return { success: true, result }
            } catch (e: any) {
                set.status = 500
                return { error: e.message }
            }
        }, {
            body: t.Object({
                file: t.File(),
                title: t.Optional(t.String()),
                tags: t.Optional(t.String())
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
                        uploader_name: users.username,
                        name: users.name
                    })
                        .from(document_tracking)
                        .leftJoin(users, eq(document_tracking.uploader_id, users.id))
                        .where(eq(document_tracking.paperless_id, doc.id))
                        .limit(1);

                    return {
                        ...doc,
                        owner_name: tracking[0]?.name || tracking[0]?.uploader_name || 'System'
                    }
                }));

                return { ...docs, results: enrichedResults }
            } catch (e: any) {
                console.error('[API] Error fetching pending docs:', e);
                set.status = 500; return { error: e.message }
            }
        })
        // User: List available pending documents for requesting access
        .get('/available-pending', async ({ query, user, set }) => {
            if (!user) {
                set.status = 401; return 'Unauthorized'
            }
            try {
                const search = query.search as string || '';
                const page = Number(query.page) || 1;
                const pageSize = Number(query.limit) || Number(query.pageSize) || 12;

                // Build search query to include both Pending and Request tags
                const searchQuery = search 
                    ? `(tag:Pending OR tag:Request) AND ${search}` 
                    : 'tag:Pending OR tag:Request';
                
                // Fetch paginated, searched documents with tag 'Pending'
                const docs = await PaperlessService.getDocumentsAdvanced({
                    query: searchQuery,
                    page,
                    page_size: pageSize
                });
                
                // Fetch all requests by this user
                const userRequestsList = await db.select()
                    .from(user_requests)
                    .where(eq(user_requests.user_id, user.id));
                
                const requestedMap = new Map(userRequestsList.map(r => [r.paperless_id, r.status]));

                // Enrich results with request status for this user
                const enrichedResults = docs.results.map((doc: any) => {
                    return {
                        ...doc,
                        request_status: requestedMap.get(doc.id) || null // 'pending', 'approved', 'rejected' or null
                    }
                });

                return { ...docs, results: enrichedResults }
            } catch (e: any) {
                console.error('[API] Error fetching available pending docs:', e);
                set.status = 500; return { error: e.message }
            }
        })
        // User: Request access to a document
        .post('/request-access/:id', async ({ params, user, set }) => {
            if (!user) {
                set.status = 401; return 'Unauthorized'
            }
            const docId = parseInt(params.id)
            try {
                // Verify the document exists and has the 'Pending' or 'Request' tag
                const doc = await PaperlessService.getDocument(docId);
                const pendingId = await PaperlessService.getOrCreateTag('Pending');
                const requestId = await PaperlessService.getOrCreateTag('Request');
                
                const tags = doc.tags || [];
                if (!tags.includes(pendingId) && !tags.includes(requestId)) {
                    set.status = 400; return { error: 'Document is not available for requesting access.' }
                }

                // Check if user has already requested access to this document
                const existing = await db.select()
                    .from(user_requests)
                    .where(and(
                        eq(user_requests.paperless_id, docId),
                        eq(user_requests.user_id, user.id)
                    ));

                if (existing.length > 0) {
                    // If already requested and pending/approved, return error
                    if (existing[0].status === 'pending' || existing[0].status === 'approved') {
                        set.status = 400; return { error: 'Access already requested or approved.' }
                    }
                    // If rejected, allow requesting again! Update request back to pending
                    await db.update(user_requests)
                        .set({ status: 'pending', comment: null, created_at: new Date() })
                        .where(eq(user_requests.id, existing[0].id));
                } else {
                    // Create new request
                    await db.insert(user_requests).values({
                        paperless_id: docId,
                        user_id: user.id,
                        status: 'pending'
                    });
                }

                // Add the 'Request' tag to the document in Paperless-ngx so it appears in the Approver's request queue
                if (!tags.includes(requestId)) {
                    tags.push(requestId);
                    await PaperlessService.setDocumentTags(docId, tags);
                }

                // Log the audit log
                await db.insert(audit_logs).values({
                    user_id: user.id,
                    action: 'REQUEST_ACCESS',
                    target_id: String(docId),
                    details: `Requested access to document: "${doc.title}"`
                });

                // Notify Admins/Approvers with Discord webhooks
                try {
                    const notifyUsers = await db.select({ discord_webhook: users.discord_webhook })
                        .from(users)
                        .where(and(
                            or(eq(users.role, 'admin'), eq(users.role, 'approver')),
                            isNotNull(users.discord_webhook)
                        ));
                    
                    const requesterName = user.name ? `${user.name} (${user.username})` : user.username;
                    const message = `🔔 **New Document Request**\nUser **${requesterName}** has requested access to document: **"${doc.title}"**`;
                    
                    for (const nu of notifyUsers) {
                        if (nu.discord_webhook) {
                            sendDiscordNotification(nu.discord_webhook, message);
                        }
                    }
                } catch (err) {
                    console.error('[API] Error sending request-access Discord notification:', err);
                }

                return { success: true }
            } catch (e: any) {
                console.error('[API] Error requesting access:', e);
                set.status = 500; return { error: e.message }
            }
        })
        // User: Cancel request to a document
        .post('/cancel-request/:id', async ({ params, user, set }) => {
            if (!user) {
                set.status = 401; return 'Unauthorized'
            }
            const docId = parseInt(params.id)
            try {
                // Find existing request
                const existing = await db.select()
                    .from(user_requests)
                    .where(and(
                        eq(user_requests.paperless_id, docId),
                        eq(user_requests.user_id, user.id),
                        eq(user_requests.status, 'pending')
                    ));

                if (existing.length === 0) {
                    set.status = 404; return { error: 'Pending request not found.' }
                }

                // Delete all pending requests for this user and this document
                await db.delete(user_requests).where(and(
                    eq(user_requests.paperless_id, docId),
                    eq(user_requests.user_id, user.id),
                    eq(user_requests.status, 'pending')
                ));

                // Get document to check tags and do tag cleanup
                let docTitle = 'Untitled';
                try {
                    const doc = await PaperlessService.getDocument(docId);
                    docTitle = doc?.title || 'Untitled';
                    const pendingId = await PaperlessService.getOrCreateTag('Pending');
                    const requestId = await PaperlessService.getOrCreateTag('Request');

                    // Check if there are other pending requests for the same document
                    const otherPending = await db.select()
                        .from(user_requests)
                        .where(and(
                            eq(user_requests.paperless_id, docId),
                            eq(user_requests.status, 'pending')
                        ));

                    // If no other pending requests for this document, remove the Request tag and add Pending tag
                    let tags = doc.tags || [];
                    if (otherPending.length === 0) {
                        tags = tags.filter((t: number) => t !== requestId);
                        if (!tags.includes(pendingId)) {
                            tags.push(pendingId);
                        }
                        await PaperlessService.setDocumentTags(docId, tags);
                    }
                } catch (docErr) {
                    console.warn(`[API] Document #${docId} not found in Paperless on cancel-request, skipping tag cleanup.`);
                }

                // Log audit log
                await db.insert(audit_logs).values({
                    user_id: user.id,
                    action: 'CANCEL_REQUEST',
                    target_id: String(docId),
                    details: `Cancelled access request to document: "${docTitle}"`
                });

                return { success: true }
            } catch (e: any) {
                console.error('[API] Error cancelling request:', e);
                set.status = 500; return { error: e.message }
            }
        })
        // Approver/Admin: List User Requests (from user_requests table)
        .get('/requests', async ({ user, set }) => {
            if (user?.role !== 'approver' && user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }
            try {
                // Fetch all pending user requests
                const pendingRequests = await db.select({
                    id: user_requests.id,
                    paperless_id: user_requests.paperless_id,
                    user_id: user_requests.user_id,
                    username: users.username,
                    name: users.name,
                    created_at: user_requests.created_at
                })
                    .from(user_requests)
                    .leftJoin(users, eq(user_requests.user_id, users.id))
                    .where(eq(user_requests.status, 'pending'))
                    .orderBy(desc(user_requests.created_at));

                // Enrich with Paperless document details
                const enrichedResults = await Promise.all(pendingRequests.map(async (req: any) => {
                    try {
                        const doc = await PaperlessService.getDocument(req.paperless_id);
                        
                        // Find uploader info from document_tracking table
                        const tracking = await db.select({
                            uploader_name: users.username,
                            name: users.name
                        })
                        .from(document_tracking)
                        .leftJoin(users, eq(document_tracking.uploader_id, users.id))
                        .where(eq(document_tracking.paperless_id, doc.id))
                        .limit(1);

                        const uploaderName = tracking[0]?.name || tracking[0]?.uploader_name || 'System';

                        return {
                            id: doc.id, // Keep the document ID as key for viewing/downloading
                            request_id: req.id, // The ID of the request record itself
                            title: doc.title,
                            owner_id: req.user_id,
                            owner_name: req.name || req.username,
                            owner_username: req.username || null,
                            requester_name: req.name || req.username,
                            uploader_name: uploaderName,
                            uploader_username: tracking[0]?.uploader_name || null,
                            created_date: doc.created, // Original upload date
                            requested_date: req.created_at, // Request date
                            created: req.created_at,
                            tags: doc.tags || []
                        }
                    } catch (err) {
                        return null; // Document might have been deleted in Paperless
                    }
                }));

                // Filter out any null entries due to errors
                const results = enrichedResults.filter(r => r !== null);

                return { count: results.length, results }
            } catch (e: any) {
                console.error('[API] Error fetching user requests:', e);
                set.status = 500; return { error: e.message }
            }
        })
        // User: List My Requests (from user_requests table)
        .get('/my-requests', async ({ user, set }) => {
            if (!user) {
                set.status = 401; return 'Unauthorized'
            }
            try {
                const myRequests = await db.select({
                    id: user_requests.id,
                    paperless_id: user_requests.paperless_id,
                    status: user_requests.status,
                    comment: user_requests.comment,
                    created_at: user_requests.created_at
                })
                    .from(user_requests)
                    .where(eq(user_requests.user_id, user.id))
                    .orderBy(desc(user_requests.created_at));

                const enrichedResults = await Promise.all(myRequests.map(async (req: any) => {
                    try {
                        const doc = await PaperlessService.getDocument(req.paperless_id);
                        return {
                            id: doc.id,
                            title: doc.title,
                            status: req.status,
                            comment: req.comment,
                            created: req.created_at
                        }
                    } catch (err) {
                        return null;
                    }
                }));

                const results = enrichedResults.filter(r => r !== null);
                return { count: results.length, results }
            } catch (e: any) {
                console.error('[API] Error fetching my requests:', e);
                set.status = 500; return { error: e.message }
            }
        })
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
                const requestId = await PaperlessService.getOrCreateTag('Request');

                // Get current tags
                const doc = await PaperlessService.getDocument(docId);
                let currentTags = doc.tags || [];

                // Add Approved, Remove Pending, Rejected AND Request
                currentTags = currentTags.filter((t: any) => t !== pendingId && t !== rejectedId && t !== requestId);
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

                const finalUserIds = [...(userIds || [])];

                // Update approvals DB table status
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

                // Update user_requests status for the approved users
                if (finalUserIds && finalUserIds.length > 0) {
                    await db.update(user_requests)
                        .set({ status: 'approved' })
                        .where(and(
                            eq(user_requests.paperless_id, docId),
                            inArray(user_requests.user_id, finalUserIds),
                            eq(user_requests.status, 'pending')
                        ));
                }

                // Fetch Usernames for Audit Log
                let approvedForNames = 'None';
                if (finalUserIds && finalUserIds.length > 0) {
                    const approvedUsers = await db.select({ username: users.username })
                        .from(users)
                        .where(inArray(users.id, finalUserIds));
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
                if (finalUserIds && Array.isArray(finalUserIds) && finalUserIds.length > 0) {
                    // Clear existing only for the users being approved to avoid revoking other users
                    await db.delete(document_permissions)
                        .where(and(
                            eq(document_permissions.paperless_id, docId),
                            inArray(document_permissions.user_id, finalUserIds)
                        ));

                    for (const uid of finalUserIds) {
                        await db.insert(document_permissions).values({
                            paperless_id: docId,
                            user_id: uid,
                            can_download: typeof canDownload === 'boolean' ? canDownload : true
                        })
                    }
                }

                // Notify approved users via Discord webhooks
                try {
                    if (finalUserIds && finalUserIds.length > 0) {
                        const approvedUserWebhooks = await db.select({
                            username: users.username,
                            name: users.name,
                            discord_webhook: users.discord_webhook
                        })
                        .from(users)
                        .where(and(
                            inArray(users.id, finalUserIds),
                            isNotNull(users.discord_webhook)
                        ));

                        const message = `✅ **Document Approved**\nYour request for access to document: **"${doc.title}"** has been approved. You can now view it in your dashboard.`;

                        for (const au of approvedUserWebhooks) {
                            if (au.discord_webhook) {
                                sendDiscordNotification(au.discord_webhook, message);
                            }
                        }
                    }
                } catch (err) {
                    console.error('[API] Error sending approval Discord notification:', err);
                }

                return { success: true }
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })
        // Restore (Rejected -> Pending or Request)
        .post('/restore/:id', async ({ params, user, set }: any) => {
            if (user?.role !== 'approver' && user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }
            const docId = parseInt(params.id)
            try {
                const pendingId = await PaperlessService.getOrCreateTag('Pending');
                const rejectedId = await PaperlessService.getOrCreateTag('Rejected');
                const approvedId = await PaperlessService.getOrCreateTag('Approved');
                const requestId = await PaperlessService.getOrCreateTag('Request');

                const doc = await PaperlessService.getDocument(docId);
                let currentTags = doc.tags || [];

                // Remove Rejected and Approved and Pending and Request
                currentTags = currentTags.filter((t: number) => t !== rejectedId && t !== approvedId && t !== pendingId && t !== requestId);
                
                // Check if this document was requested by standard users
                const requestsCount = await db.select()
                    .from(user_requests)
                    .where(eq(user_requests.paperless_id, docId));

                const isUserRequest = requestsCount.length > 0;
                const restoreTagId = isUserRequest ? requestId : pendingId;
                const restoreTagName = isUserRequest ? 'Request' : 'Pending';

                if (!currentTags.includes(restoreTagId)) currentTags.push(restoreTagId);

                await PaperlessService.setDocumentTags(docId, currentTags);

                // Clear permissions for this document
                await db.delete(document_permissions).where(eq(document_permissions.paperless_id, docId));

                // Update DB status for approvals
                await db.update(approvals).set({ status: 'pending', comment: null }).where(eq(approvals.paperless_doc_id, docId));

                // Reset all requests for this document in user_requests back to pending
                await db.update(user_requests)
                    .set({ status: 'pending', comment: null })
                    .where(eq(user_requests.paperless_id, docId));

                // Log Restore
                await db.insert(audit_logs).values({
                    user_id: user.id as number,
                    action: 'RESTORE',
                    target_id: String(docId),
                    details: `Document: "${doc.title}". Restored to ${restoreTagName} by ${user.username}`
                })

                return { success: true }
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })
        // Approver: Reject Staff Uploaded document (Move to Rejected Tag)
        .post('/reject/:id', async ({ params, user, set, body }) => {
            if (user?.role !== 'approver' && user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }
            const docId = parseInt(params.id)
            const { comment } = (body || {}) as { comment?: string }
            try {
                // Get Tag IDs
                const pendingId = await PaperlessService.getOrCreateTag('Pending');
                const approvedId = await PaperlessService.getOrCreateTag('Approved');
                const rejectedId = await PaperlessService.getOrCreateTag('Rejected');
                const requestId = await PaperlessService.getOrCreateTag('Request');

                // Get current tags
                const doc = await PaperlessService.getDocument(docId);
                let currentTags = doc.tags || [];

                // Remove Approved, Pending, Request
                currentTags = currentTags.filter((t: number) => t !== approvedId && t !== pendingId && t !== requestId);

                // Add Rejected
                if (!currentTags.includes(rejectedId)) currentTags.push(rejectedId);

                await PaperlessService.setDocumentTags(docId, currentTags);

                // Update DB status and comment (upsert to handle missing approvals entries)
                const existing = await db.select().from(approvals).where(eq(approvals.paperless_doc_id, docId));
                if (existing.length > 0) {
                    await db.update(approvals).set({
                        status: 'rejected',
                        comment: comment || null,
                        actor_id: user.id as number,
                        created_at: new Date()
                    }).where(eq(approvals.paperless_doc_id, docId));
                } else {
                    await db.insert(approvals).values({
                        paperless_doc_id: docId,
                        status: 'rejected',
                        comment: comment || null,
                        actor_id: user.id as number
                    })
                }

                // Log Reject Event
                await db.insert(audit_logs).values({
                    user_id: user.id as number,
                    action: 'REJECT',
                    target_id: String(docId),
                    details: `Document: "${doc.title}". Rejected by ${user.username}. Comment: ${comment || 'None'}`
                })

                return { success: true }
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })
        // Approver: Reject specific User Request (from user_requests table)
        .post('/reject-request/:id', async ({ params, user, set, body }) => {
            if (user?.role !== 'approver' && user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }
            const requestId = parseInt(params.id)
            const { comment } = (body || {}) as { comment?: string }
            try {
                // Find request
                const reqs = await db.select().from(user_requests).where(eq(user_requests.id, requestId));
                if (reqs.length === 0) {
                    set.status = 404; return { error: 'Request not found' }
                }
                const requestObj = reqs[0];

                // Update request DB status
                await db.update(user_requests).set({
                    status: 'rejected',
                    comment: comment || null
                }).where(eq(user_requests.id, requestId));

                // Check if there are other pending requests for the same document
                const otherPending = await db.select()
                    .from(user_requests)
                    .where(and(
                        eq(user_requests.paperless_id, requestObj.paperless_id),
                        eq(user_requests.status, 'pending')
                    ));

                // If no more pending requests for this document, remove the Request tag from Paperless-ngx
                if (otherPending.length === 0) {
                    const docId = requestObj.paperless_id;
                    try {
                        const doc = await PaperlessService.getDocument(docId);
                        const pendingId = await PaperlessService.getOrCreateTag('Pending');
                        const approvedId = await PaperlessService.getOrCreateTag('Approved');
                        const rejectedId = await PaperlessService.getOrCreateTag('Rejected');
                        const requestIdTag = await PaperlessService.getOrCreateTag('Request');

                        let currentTags = doc.tags || [];
                        currentTags = currentTags.filter((t: number) => t !== requestIdTag && t !== approvedId && t !== pendingId);
                        
                        if (!currentTags.includes(pendingId)) {
                            currentTags.push(pendingId); // Ensure it keeps/re-acquires the 'Pending' tag if not already there
                        }
                        await PaperlessService.setDocumentTags(docId, currentTags);
                    } catch (docErr) {
                        console.warn(`[API] Document #${docId} not found in Paperless on reject-request, skipping tag cleanup.`);
                    }
                }

                // Fetch document details for the log
                let reqDocTitle = 'Untitled';
                try {
                    const reqDoc = await PaperlessService.getDocument(requestObj.paperless_id);
                    reqDocTitle = reqDoc?.title || 'Untitled';
                } catch (docErr) {
                    console.warn(`[API] Document #${requestObj.paperless_id} not found in Paperless on reject-request, using fallback title.`);
                }

                // Log Reject Event
                await db.insert(audit_logs).values({
                    user_id: user.id as number,
                    action: 'REJECT_REQUEST',
                    target_id: String(requestObj.paperless_id),
                    details: `Document: "${reqDocTitle}". Rejected access request ID ${requestId} by ${user.username}. Comment: ${comment || 'None'}`
                });

                // Notify requester via Discord webhook
                try {
                    const requester = await db.select({
                        discord_webhook: users.discord_webhook
                    })
                    .from(users)
                    .where(eq(users.id, requestObj.user_id))
                    .limit(1);

                    if (requester.length > 0 && requester[0].discord_webhook) {
                        const reasonText = comment ? `Reason: **"${comment}"**` : 'No reason provided.';
                        const message = `❌ **Request Rejected**\nYour request for access to document: **"${reqDocTitle}"** has been rejected. ${reasonText}`;
                        sendDiscordNotification(requester[0].discord_webhook, message);
                    }
                } catch (err) {
                    console.error('[API] Error sending reject Discord notification:', err);
                }

                return { success: true }
            } catch (e: any) {
                console.error('[API] Error rejecting user request:', e);
                set.status = 500; return { error: e.message }
            }
        })
        // Delete document (Admin only)
        .delete('/document/:id', async ({ params, user, set }) => {
            if (user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }
            const docId = parseInt(params.id)
            try {
                // Try to get document details to find the title for logging
                let docTitle = 'Untitled';
                try {
                    const doc = await PaperlessService.getDocument(docId);
                    if (doc && doc.title) {
                        docTitle = doc.title;
                    }
                } catch (err) {
                    console.warn(`[API] Document #${docId} metadata fetch failed before delete. Proceeding with DB cleanup.`, err);
                }

                // 1. Delete from Paperless-ngx
                await PaperlessService.deleteDocument(docId);

                // 2. Delete DB tracking and permissions entries
                await db.delete(document_tracking).where(eq(document_tracking.paperless_id, docId));
                await db.delete(document_permissions).where(eq(document_permissions.paperless_id, docId));
                await db.delete(approvals).where(eq(approvals.paperless_doc_id, docId));
                await db.delete(user_requests).where(eq(user_requests.paperless_id, docId));

                // 3. Log Audit Event: DELETE
                await db.insert(audit_logs).values({
                    user_id: user.id as number,
                    action: 'DELETE',
                    target_id: String(docId),
                    details: `Document: "${docTitle}". Deleted permanently by ${user.username}`
                });

                return { success: true }
            } catch (e: any) {
                console.error(`[API] Error deleting document #${docId}:`, e);
                set.status = 500; return { error: e.message }
            }
        })
        // Get Rejected documents
        .get('/rejected', async ({ user, set }: any) => {
            if (user?.role !== 'approver' && user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }
            try {
                // 1. Fetch from approvals table where status = 'rejected'
                const dbRejectedApprovals = await db.select({
                    paperless_id: approvals.paperless_doc_id,
                    comment: approvals.comment,
                    updated_at: approvals.created_at
                }).from(approvals).where(eq(approvals.status, 'rejected'));

                // 2. Fetch from user_requests table where status = 'rejected'
                const dbRejectedRequests = await db.select({
                    paperless_id: user_requests.paperless_id,
                    comment: user_requests.comment,
                    updated_at: user_requests.created_at,
                    user_id: user_requests.user_id
                }).from(user_requests).where(eq(user_requests.status, 'rejected'));

                // 3. Fetch documents with tag:Rejected from Paperless-ngx directly as a fallback
                let paperlessRejectedIds: number[] = [];
                try {
                    const paperlessRejectedDocs = await PaperlessService.getDocuments('tag:Rejected');
                    if (paperlessRejectedDocs && paperlessRejectedDocs.results) {
                        paperlessRejectedIds = paperlessRejectedDocs.results.map((d: any) => d.id);
                    }
                } catch (err) {
                    console.error('[API] Error fetching tag:Rejected from Paperless:', err);
                }

                // Combined unique document IDs that are rejected
                const allRejectedDocIds = Array.from(new Set([
                    ...dbRejectedApprovals.map(a => a.paperless_id),
                    ...dbRejectedRequests.map(r => r.paperless_id),
                    ...paperlessRejectedIds
                ]));

                // Fetch document details from Paperless for these IDs
                const enrichedDocs = await Promise.all(allRejectedDocIds.map(async (docId) => {
                    try {
                        const doc = await PaperlessService.getDocument(docId);
                        
                        // Find if it was a user request rejection or general upload rejection
                        const reqRej = dbRejectedRequests.find(r => r.paperless_id === docId);
                        const appRej = dbRejectedApprovals.find(a => a.paperless_id === docId);
                        
                        const comment = reqRej?.comment || appRej?.comment || 'No comment';
                        const date = reqRej?.updated_at || appRej?.updated_at || doc.created;
                        
                        // Find uploader info
                        const tracking = await db.select({
                            uploader_name: users.username,
                            name: users.name
                        })
                        .from(document_tracking)
                        .leftJoin(users, eq(document_tracking.uploader_id, users.id))
                        .where(eq(document_tracking.paperless_id, docId))
                        .limit(1);
                        
                        const uploaderName = tracking[0]?.name || tracking[0]?.uploader_name || 'System';
                        const uploaderUsername = tracking[0]?.uploader_name || null;

                        // Find requester info if it was a user request
                        let requesterName = null;
                        if (reqRej && reqRej.user_id) {
                            const reqUser = await db.select({
                                username: users.username,
                                name: users.name
                            }).from(users).where(eq(users.id, reqRej.user_id)).limit(1);
                            if (reqUser.length > 0) {
                                requesterName = reqUser[0].name ? `${reqUser[0].name} (${reqUser[0].username})` : reqUser[0].username;
                            }
                        }

                        return {
                            ...doc,
                            owner_name: uploaderName,
                            owner_username: uploaderUsername,
                            requester_name: requesterName,
                            approval_status: 'rejected',
                            approval_comment: comment,
                            rejected_date: date
                        };
                    } catch (err) {
                        return null; // Document deleted
                    }
                }));

                const results = enrichedDocs.filter(d => d !== null);
                return { results, count: results.length }
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })
        // Get All Charts/Documents
        .get('/all-charts', async ({ user, set }) => {
            if (user?.role !== 'approver' && user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }
            try {
                // Fetch all documents from Paperless
                const docs = await PaperlessService.getDocuments('');
                
                // Fetch tracking, approvals, requests, and chart statuses in bulk to avoid N+1 queries
                const trackings = await db.select({
                    paperless_id: document_tracking.paperless_id,
                    uploader_name: users.username,
                    name: users.name
                })
                .from(document_tracking)
                .leftJoin(users, eq(document_tracking.uploader_id, users.id));

                const allApprovals = await db.select().from(approvals);

                const allChartStatuses = await db.select({
                    paperless_id: document_chart_status.paperless_id,
                    status_id: document_chart_status.status_id,
                    status_name: chart_statuses.name,
                    status_color: chart_statuses.color
                })
                .from(document_chart_status)
                .leftJoin(chart_statuses, eq(document_chart_status.status_id, chart_statuses.id));

                // Create maps for lookup
                const trackingMap = new Map(trackings.map(t => [t.paperless_id, t]));
                const approvalMap = new Map(allApprovals.map(a => [a.paperless_doc_id, a]));
                const chartStatusMap = new Map(allChartStatuses.map(cs => [cs.paperless_id, cs]));

                // Enrich documents
                const enrichedResults = docs.results.map((doc: any) => {
                    const tracking = trackingMap.get(doc.id);
                    const approval = approvalMap.get(doc.id);
                    const cs = chartStatusMap.get(doc.id);

                    const approvalStatus = approval?.status || 'pending';

                    return {
                        ...doc,
                        owner_name: tracking?.name || tracking?.uploader_name || 'System',
                        owner_username: tracking?.uploader_name || null,
                        approval_status: approvalStatus,
                        approval_comment: approval?.comment || null,
                        chart_status: cs ? { id: cs.status_id, name: cs.status_name, color: cs.status_color } : null
                    };
                });

                return { results: enrichedResults, count: docs.count }
            } catch (e: any) {
                console.error('[API] Error fetching all-charts:', e);
                set.status = 500; return { error: e.message }
            }
        })
        // Get Chart Statuses list
        .get('/chart-statuses', async ({ user, set }) => {
            if (user?.role !== 'approver' && user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }
            try {
                const statuses = await db.select().from(chart_statuses).orderBy(chart_statuses.name);
                return statuses;
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })
        // Create a Chart Status
        .post('/chart-statuses', async ({ user, body, set }) => {
            if (user?.role !== 'admin' && user?.role !== 'approver') {
                set.status = 403; return 'Forbidden'
            }
            const { name, color } = (body || {}) as { name: string, color?: string }
            if (!name) {
                set.status = 400; return { error: 'Name is required' }
            }
            try {
                await db.insert(chart_statuses).values({
                    name,
                    color: color || 'gray'
                });
                return { success: true }
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })
        // Delete a Chart Status
        .delete('/chart-statuses/:id', async ({ params, user, set }) => {
            if (user?.role !== 'admin' && user?.role !== 'approver') {
                set.status = 403; return 'Forbidden'
            }
            const statusId = parseInt(params.id)
            try {
                await db.delete(chart_statuses).where(eq(chart_statuses.id, statusId));
                return { success: true }
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })
        // Set Document Chart Status
        .post('/documents/:id/chart-status', async ({ params, user, body, set }) => {
            if (user?.role !== 'approver' && user?.role !== 'admin') {
                set.status = 403; return 'Forbidden'
            }
            const docId = parseInt(params.id)
            const { status_id } = (body || {}) as { status_id: number | null }
            try {
                await db.delete(document_chart_status).where(eq(document_chart_status.paperless_id, docId));

                if (status_id !== null) {
                    await db.insert(document_chart_status).values({
                        paperless_id: docId,
                        status_id: status_id
                    });
                }
                return { success: true }
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
            // Audit Log: VIEW
            let userId = null;
            if (user) userId = user.id;
            
            // If user is missing (e.g. valid token but extraction failed?), we log as System or Anonymous?
            // Let's verify token from query if user is null
            if (!userId && query.token) {
                const profile = await jwt.verify(query.token);
                if (profile) userId = profile.id;
            }

            if (!userId) {
                set.status = 401; return 'Unauthorized'
            }

            const docId = parseInt(params.id);

            try {
                // Permission Check
                // Fetch user role
                const u = await db.select().from(users).where(eq(users.id, userId)).limit(1);
                const userRole = u[0]?.role;
                const username = u[0]?.username || 'unknown';

                let isAuthorized = false;
                let forceInline = false;

                if (userRole === 'admin' || userRole === 'approver' || userRole === 'staff') {
                    isAuthorized = true;
                } else if (userRole === 'user') {
                    // Check permissions
                    const perm = await db.select().from(document_permissions)
                        .where(and(
                            eq(document_permissions.paperless_id, docId),
                            eq(document_permissions.user_id, userId)
                        ));
                    
                    if (perm.length > 0) {
                        const canDownload = perm[0].can_download;
                        if (canDownload) {
                            isAuthorized = true;
                        } else {
                            // If user is restricted to View-Only (can_download is false), 
                            // we only authorize if they provide a valid one-time view token.
                            const viewToken = query.view_token;
                            if (viewToken) {
                                const storedToken = viewTokens.get(viewToken);
                                if (storedToken && storedToken.docId === docId && storedToken.userId === userId && storedToken.expiresAt >= Date.now()) {
                                    isAuthorized = true;
                                    forceInline = true; // Force inline headers for view-only
                                    viewTokens.delete(viewToken); // Consume one-time token immediately!
                                }
                            }
                        }
                    }
                }

                if (!isAuthorized) {
                    set.status = 403; return 'Forbidden';
                }

                // Fetch document title for audit log
                let viewDocTitle = 'Untitled';
                try {
                    const viewDoc = await PaperlessService.getDocument(docId);
                    if (viewDoc && viewDoc.title) {
                        viewDocTitle = viewDoc.title;
                    }
                } catch (viewDocErr) {
                    console.error('[API] Failed to fetch document title for audit log:', viewDocErr);
                }

                // Log the VIEW audit action
                await db.insert(audit_logs).values({
                    user_id: userId,
                    action: 'VIEW',
                    target_id: String(docId),
                    details: `Document: "${viewDocTitle}". ${forceInline ? 'Restricted view (No download)' : 'Downloaded/accessed'} by ${username}`
                })

                const response = await PaperlessService.downloadDocument(docId);

                // Forward headers
                const contentType = response.headers.get('content-type');
                if (contentType) set.headers['content-type'] = contentType;

                if (forceInline) {
                    set.headers['content-disposition'] = 'inline';
                    // Extra security headers to block downloads in PDF viewer plugins
                    set.headers['cache-control'] = 'no-store, no-cache, must-revalidate, max-age=0';
                } else {
                    const contentDisp = response.headers.get('content-disposition');
                    if (contentDisp) set.headers['content-disposition'] = contentDisp;
                }

                return await response.arrayBuffer();
            } catch (e: any) {
                set.status = 500; return { error: e.message }
            }
        })
        // View Wrapper (HTML with Right Click Protection)
        .get('/view/:id', async ({ params, query, user, set, jwt }: any) => {
            const docId = parseInt(params.id);
            // Auth Check
            let userId = null;
            let token = query.token;
            if (user) { userId = user.id; }
            else if (token) {
                const profile = await jwt.verify(token);
                if (profile) userId = profile.id;
            }

            if (!userId) { set.status = 401; return 'Unauthorized'; }

            try {
                // Verify user has permission to view the document
                const u = await db.select().from(users).where(eq(users.id, userId)).limit(1);
                const userRole = u[0]?.role;
                
                if (userRole === 'user') {
                    const perm = await db.select().from(document_permissions)
                        .where(and(
                            eq(document_permissions.paperless_id, docId),
                            eq(document_permissions.user_id, userId)
                        ));
                    if (perm.length === 0) {
                        set.status = 403; return 'Forbidden';
                    }
                }

                // Generate short-lived, one-time view token
                const viewToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
                cleanExpiredTokens();
                viewTokens.set(viewToken, { docId, userId, expiresAt: Date.now() + 15000 }); // Valid for 15 seconds

                // PDF.js Secure Viewer
                return new Response(`
                    <!DOCTYPE html>
                    <html lang="th">
                    <head>
                        <meta charset="UTF-8">
                        <title>Secure View</title>
                        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
                        <style>
                            body, html { 
                                margin: 0; 
                                padding: 0; 
                                background-color: #1a1a1a; 
                                height: 100%; 
                                overflow-y: auto; 
                                user-select: none;
                                -webkit-user-select: none;
                                -moz-user-select: none;
                                -ms-user-select: none;
                            }
                            #canvas-container { 
                                display: flex; 
                                flex-direction: column; 
                                align-items: center; 
                                padding: 20px; 
                                box-sizing: border-box;
                            }
                            .canvas-wrapper {
                                position: relative;
                                margin-bottom: 24px;
                                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                                border-radius: 4px;
                                overflow: hidden;
                                width: 100%;
                                max-width: 850px; /* Capped for desktop readability */
                            }
                            canvas { 
                                display: block;
                                width: 100% !important;
                                height: auto !important;
                            }
                            .canvas-overlay {
                                position: absolute;
                                top: 0;
                                left: 0;
                                width: 100%;
                                height: 100%;
                                z-index: 10;
                                background-color: rgba(255, 255, 255, 0.0);
                                cursor: default;
                            }
                            @media print {
                                body, html, #canvas-container, .canvas-wrapper, canvas { 
                                    display: none !important; 
                                }
                            }
                        </style>
                    </head>
                    <body oncontextmenu="return false;" onselectstart="return false;" ondragstart="return false;">
                        <div id="canvas-container"></div>
    
                        <script>
                            // Block context menu
                            document.addEventListener('contextmenu', event => event.preventDefault());
                            
                            // Block printing, saving and DevTools shortcuts
                            document.addEventListener('keydown', function(e) {
                                 // F12 key
                                 if (e.keyCode == 123) { e.preventDefault(); return false; }
                                 // Ctrl+Shift+I, J, C (Chrome DevTools)
                                 if (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74 || e.keyCode == 67)) { e.preventDefault(); return false; }
                                 // Cmd+Alt+I (Mac DevTools)
                                 if (e.metaKey && e.altKey && e.keyCode == 73) { e.preventDefault(); return false; }
                                 // Ctrl+S / Cmd+S (Save)
                                 if ((e.ctrlKey || e.metaKey) && e.keyCode == 83) { e.preventDefault(); return false; }
                                 // Ctrl+P / Cmd+P (Print)
                                 if ((e.ctrlKey || e.metaKey) && e.keyCode == 80) { e.preventDefault(); return false; }
                                 // Ctrl+U / Cmd+U (View Source)
                                 if ((e.ctrlKey || e.metaKey) && e.keyCode == 85) { e.preventDefault(); return false; }
                            });
    
                            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
                            // Request using both query auth token and the one-time view token
                            const url = '/api/download/${docId}?token=${token}&view_token=${viewToken}';
    
                            async function renderPDF() {
                                try {
                                    const loadingTask = pdfjsLib.getDocument(url);
                                    const pdf = await loadingTask.promise;
                                    const container = document.getElementById('canvas-container');
    
                                    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                                        const page = await pdf.getPage(pageNum);
                                        const scale = 1.5;
                                        const viewport = page.getViewport({scale: scale});
    
                                        // Create wrapper to contain canvas and transparent overlay
                                        const wrapper = document.createElement('div');
                                        wrapper.className = 'canvas-wrapper';
                                        
                                        const canvas = document.createElement('canvas');
                                        const context = canvas.getContext('2d');
                                        canvas.height = viewport.height;
                                        canvas.width = viewport.width;
                                        
                                        // Create transparent overlay to block drag, drop and right-click on canvas
                                        const overlay = document.createElement('div');
                                        overlay.className = 'canvas-overlay';
                                        
                                        wrapper.appendChild(canvas);
                                        wrapper.appendChild(overlay);
                                        container.appendChild(wrapper);
    
                                        const renderContext = {
                                            canvasContext: context,
                                            viewport: viewport
                                        };
                                        await page.render(renderContext).promise;
                                    }
                                } catch (err) {
                                    console.error('Error rendering PDF:', err);
                                    document.body.innerHTML = '<h2 style="color:white;text-align:center;margin-top:40px;font-family:sans-serif;">ไม่สามารถโหลดเอกสารได้ หรือสิทธิ์การเข้าชมหมดอายุ</h2>';
                                }
                            }
    
                            renderPDF();
                        </script>
                    </body>
                    </html>
                `, {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });
            } catch (err: any) {
                set.status = 500;
                return { error: err.message };
            }
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
            const actionFilter = query.action as string || '';

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

                const searchCond = searchFilters.length > 0 ? sql`(${sql.join(searchFilters, sql` OR `)})` : undefined;
                const actionCond = actionFilter ? eq(audit_logs.action, actionFilter) : undefined;

                // Base Query Condition
                let whereCondition = undefined;
                if (searchCond && actionCond) {
                    whereCondition = and(searchCond, actionCond);
                } else if (searchCond) {
                    whereCondition = searchCond;
                } else if (actionCond) {
                    whereCondition = actionCond;
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
                            name: users.name,
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
                            owner_name: tracking[0]?.name || tracking[0]?.uploader_name || 'System',
                            owner_username: tracking[0]?.uploader_name || null,
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
                return await db.select({ 
                    id: users.id, 
                    username: users.username, 
                    name: users.name, 
                    role: users.role,
                    discord_webhook: users.discord_webhook
                }).from(users);
            })
            // Create User
            .post('/', async ({ body, set }: any) => {
                const { username, password, role, name, discord_webhook } = body
                if (!username || !password || !role) {
                    set.status = 400; return 'Missing fields'
                }
                const hashedPassword = await Bun.password.hash(password)
                try {
                    await db.insert(users).values({
                        username,
                        password: hashedPassword,
                        role,
                        name: name || null,
                        discord_webhook: discord_webhook || null
                    })
                    return { success: true }
                } catch (e: any) {
                    set.status = 500; return { error: e.message }
                }
            })
            // Update User
            .put('/:id', async ({ params, body, set }: any) => {
                const id = parseInt(params.id)
                const { username, password, role, name, discord_webhook } = body

                const updateData: any = { username, role }
                if (password) {
                    updateData.password = await Bun.password.hash(password)
                }
                if (name !== undefined) {
                    updateData.name = name || null
                }
                if (discord_webhook !== undefined) {
                    updateData.discord_webhook = discord_webhook || null
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

// --- Self-Healing Sync: Clean up stale permissions and requests from past cancelled approvals ---
async function syncStalePermissions() {
    console.log('[Sync] Starting stale permissions cleanup...');
    try {
        // 0. Clean up duplicate pending user requests (keep only the newest one per user per document)
        try {
            await db.execute(sql`
                DELETE ur1 FROM user_requests ur1
                INNER JOIN user_requests ur2 
                ON ur1.user_id = ur2.user_id 
                AND ur1.paperless_id = ur2.paperless_id 
                AND ur1.status = 'pending'
                AND ur2.status = 'pending'
                AND ur1.id < ur2.id
            `);
            console.log('[Sync] Cleaned up duplicate pending user requests.');
        } catch (dupErr) {
            console.error('[Sync] Error cleaning up duplicate user requests:', dupErr);
        }

        const approvedId = await PaperlessService.getOrCreateTag('Approved');
        
        // 1. Get all unique document IDs across all DB tables
        const permIds = await db.select({ id: document_permissions.paperless_id }).from(document_permissions);
        const trackIds = await db.select({ id: document_tracking.paperless_id }).from(document_tracking);
        const appIds = await db.select({ id: approvals.paperless_doc_id }).from(approvals);
        const reqIds = await db.select({ id: user_requests.paperless_id }).from(user_requests);
        const chartIds = await db.select({ id: document_chart_status.paperless_id }).from(document_chart_status);

        const allDbDocIds = Array.from(new Set([
            ...permIds.map(p => p.id),
            ...trackIds.map(t => t.id),
            ...appIds.map(a => a.id),
            ...reqIds.map(r => r.id),
            ...chartIds.map(c => c.id)
        ]));
        console.log(`[Sync] Found ${allDbDocIds.length} unique document IDs across all DB tables.`);

        for (const docId of allDbDocIds) {
            try {
                // Fetch document from Paperless
                const doc = await PaperlessService.getDocument(docId);
                const tags = doc.tags || [];

                // If document does not have the 'Approved' tag, revoke permissions and reset status!
                if (!tags.includes(approvedId)) {
                    // Only revoke permissions if they exist
                    const existingPerms = await db.select().from(document_permissions).where(eq(document_permissions.paperless_id, docId));
                    if (existingPerms.length > 0) {
                        console.log(`[Sync] Document #${docId} ("${doc.title}") is not approved in Paperless. Revoking stale DB permissions...`);
                        await db.delete(document_permissions).where(eq(document_permissions.paperless_id, docId));
                    }

                    // Reset approvals
                    await db.update(approvals).set({ status: 'pending', comment: null }).where(eq(approvals.paperless_doc_id, docId));

                    // Reset user requests status back to pending
                    await db.update(user_requests).set({ status: 'pending', comment: null }).where(eq(user_requests.paperless_id, docId));
                }
            } catch (err: any) {
                // If document is not found in Paperless (deleted)
                if (err.message?.includes('not found') || err.message?.includes('404')) {
                    console.log(`[Sync] Document #${docId} not found in Paperless. Cleaning up all DB entries...`);
                    await db.delete(document_permissions).where(eq(document_permissions.paperless_id, docId));
                    await db.delete(document_tracking).where(eq(document_tracking.paperless_id, docId));
                    await db.delete(approvals).where(eq(approvals.paperless_doc_id, docId));
                    await db.delete(user_requests).where(eq(user_requests.paperless_id, docId));
                    await db.delete(document_chart_status).where(eq(document_chart_status.paperless_id, docId));
                } else {
                    console.error(`[Sync] Error checking document #${docId}:`, err.message);
                }
            }
        }
        console.log('[Sync] Stale permissions and deleted document cleanup complete.');
    } catch (e) {
        console.error('[Sync] Stale permissions cleanup failed:', e);
    }
}

// Run the sync function on startup in the background
syncStalePermissions().catch(err => console.error('[Sync] Error on startup sync:', err));

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
            const requestId = await PaperlessService.getOrCreateTag('Request');

            for (const doc of expiredDocs) {
                try {
                    const paperlessDoc = await PaperlessService.getDocument(doc.paperless_id);
                    let currentTags = paperlessDoc.tags || [];

                    // If it has "Approved" tag, remove it and add Pending or Request
                    if (currentTags.includes(approvedId)) {
                        currentTags = currentTags.filter((t: number) => t !== approvedId);

                        // Find uploader role
                        const tracking = await db.select({
                            role: users.role
                        })
                            .from(document_tracking)
                            .leftJoin(users, eq(document_tracking.uploader_id, users.id))
                            .where(eq(document_tracking.paperless_id, doc.paperless_id))
                            .limit(1);

                        const isUserRequest = tracking[0]?.role === 'user';
                        const targetTagId = isUserRequest ? requestId : pendingId;
                        const targetTagName = isUserRequest ? 'Request' : 'Pending';

                        if (!currentTags.includes(targetTagId)) {
                            currentTags.push(targetTagId);
                        }

                        await PaperlessService.setDocumentTags(doc.paperless_id, currentTags);
                        console.log(`[Scheduler] Reverted Doc ${doc.paperless_id} to ${targetTagName}.`);
                    }

                    // 1. Clear permissions for the expired document
                    await db.delete(document_permissions).where(eq(document_permissions.paperless_id, doc.paperless_id));

                    // 2. Reset approvals status back to pending
                    await db.update(approvals).set({ status: 'pending', comment: null }).where(eq(approvals.paperless_doc_id, doc.paperless_id));

                    // 3. Reset user requests status back to pending
                    await db.update(user_requests).set({ status: 'pending', comment: null }).where(eq(user_requests.paperless_id, doc.paperless_id));

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
