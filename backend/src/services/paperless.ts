// Basic wrapper service for Paperless-ngx API

const PAPERLESS_API_URL = process.env.PAPERLESS_API_URL || 'http://paperless-ngx:8000/api';
const PAPERLESS_TOKEN = process.env.PAPERLESS_API_TOKEN;
const PAPERLESS_USERNAME = process.env.PAPERLESS_USERNAME;
const PAPERLESS_PASSWORD = process.env.PAPERLESS_PASSWORD;

function getHeaders(extraHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...extraHeaders };

    if (PAPERLESS_TOKEN && PAPERLESS_TOKEN.trim() !== '' && !PAPERLESS_TOKEN.includes('YOUR_')) {
        headers['Authorization'] = `Token ${PAPERLESS_TOKEN}`;
    } else if (PAPERLESS_USERNAME && PAPERLESS_PASSWORD) {
        const credentials = btoa(`${PAPERLESS_USERNAME}:${PAPERLESS_PASSWORD}`);
        headers['Authorization'] = `Basic ${credentials}`;
    } else {
        console.warn('[PaperlessService] No Token or Credentials found for Paperless API!');
    }

    return headers;
}

export const PaperlessService = {
    // Upload a document to Paperless
    async uploadDocument(file: Blob, title?: string, tags: number[] = []) {
        const formData = new FormData();
        formData.append('document', file);
        if (title) formData.append('title', title);

        // Append tags
        tags.forEach(tagId => {
            formData.append('tags', tagId.toString());
        });

        const response = await fetch(`${PAPERLESS_API_URL}/documents/post_document/`, {
            method: 'POST',
            headers: getHeaders(), // Helper handles Auth
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Paperless API Error (Upload): ${response.status} ${response.statusText}`);
        }

        return response.json();
    },

    // Get all tags
    async getTags() {
        const response = await fetch(`${PAPERLESS_API_URL}/tags/`, {
            headers: getHeaders()
        });
        if (!response.ok) return { results: [] };
        return response.json();
    },

    // Create a new tag
    async createTag(name: string) {
        const response = await fetch(`${PAPERLESS_API_URL}/tags/`, {
            method: 'POST',
            headers: getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ name, color: '#c0c0c0', is_inbox_tag: false })
        });
        if (!response.ok) throw new Error(`Failed to create tag: ${response.statusText}`);
        return response.json();
    },

    // Get ID of a tag by name, creating it if it doesn't exist
    async getOrCreateTag(name: string): Promise<number> {
        const tagsData = await this.getTags();
        const existing = tagsData?.results?.find((t: any) => t.name.toLowerCase() === name.toLowerCase());

        if (existing) return existing.id;

        const newTag = await this.createTag(name);
        return newTag.id;
    },

    // Get documents (can filter by query)
    async getDocuments(query: string = '') {
        const response = await fetch(`${PAPERLESS_API_URL}/documents/?query=${encodeURIComponent(query)}`, {
            headers: getHeaders(),
        });
        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`Paperless API Error (GetDocs): ${response.status} ${txt}`);
        }
        return response.json();
    },

    // Get documents with advanced query filters, pagination, and tags
    async getDocumentsAdvanced(options: { tagId?: number; query?: string; page?: number; page_size?: number; ordering?: string }) {
        const params = new URLSearchParams();
        if (options.tagId) {
            params.append('tags__id__all', options.tagId.toString());
        }
        if (options.query) {
            params.append('query', options.query);
        }
        if (options.page) {
            params.append('page', options.page.toString());
        }
        if (options.page_size) {
            params.append('page_size', options.page_size.toString());
        }
        if (options.ordering) {
            params.append('ordering', options.ordering);
        } else {
            params.append('ordering', '-created'); // Default order newest first
        }

        const response = await fetch(`${PAPERLESS_API_URL}/documents/?${params.toString()}`, {
            headers: getHeaders(),
        });
        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`Paperless API Error (GetDocsAdvanced): ${response.status} ${txt}`);
        }
        return response.json();
    },

    // Get documents by Tag ID
    async getDocumentsByTag(tagId: number) {
        const response = await fetch(`${PAPERLESS_API_URL}/documents/?tags__id__all=${tagId}`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error(`Failed to fetch docs by tag: ${response.statusText}`);
        return response.json();
    },

    // Update a document (e.g. add tags)
    async updateDocument(id: number, data: any) {
        const response = await fetch(`${PAPERLESS_API_URL}/documents/${id}/`, {
            method: 'PATCH',
            headers: getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`Failed to update document: ${response.statusText}`);
        }
        return response.json();
    },

    // Get document by ID to see current tags
    async getDocument(id: number) {
        const response = await fetch(`${PAPERLESS_API_URL}/documents/${id}/`, {
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Document not found');
        return response.json();
    },

    // Custom function to handle approval flow -> e.g. add 'Approved' tag, remove 'Pending'
    async setDocumentTags(id: number, tags: number[]) {
        return this.updateDocument(id, { tags });
    },

    // Download a document
    async downloadDocument(id: number) {
        const response = await fetch(`${PAPERLESS_API_URL}/documents/${id}/download/`, {
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Failed to download document');
        return response; // Return the full response so we can stream it
    },

    // Get task status
    async getTaskStatus(taskId: string) {
        const response = await fetch(`${PAPERLESS_API_URL}/tasks/?task_id=${taskId}`, {
            headers: getHeaders()
        });
        if (!response.ok) throw new Error(`Failed to fetch task status: ${response.statusText}`);
        return response.json();
    },

    // Delete a document
    async deleteDocument(id: number) {
        const response = await fetch(`${PAPERLESS_API_URL}/documents/${id}/`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!response.ok && response.status !== 404) {
            throw new Error(`Failed to delete document from Paperless: ${response.statusText}`);
        }
        return true;
    }
};
