// Basic wrapper service for Paperless-ngx API

const PAPERLESS_API_URL = process.env.PAPERLESS_API_URL || 'http://paperless-ngx:8000/api';
const PAPERLESS_TOKEN = process.env.PAPERLESS_API_TOKEN;

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
            headers: {
                'Authorization': `Token ${PAPERLESS_TOKEN}`,
            },
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Paperless API Error: ${response.statusText}`);
        }

        return response.json(); // Usually returns the task ID
    },

    // Get all tags
    async getTags() {
        const response = await fetch(`${PAPERLESS_API_URL}/tags/`, {
            headers: { 'Authorization': `Token ${PAPERLESS_TOKEN}` }
        });
        if (!response.ok) return { results: [] };
        return response.json();
    },

    // Create a new tag
    async createTag(name: string) {
        const response = await fetch(`${PAPERLESS_API_URL}/tags/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${PAPERLESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, color: '#c0c0c0', is_inbox_tag: false })
        });
        if (!response.ok) throw new Error(`Failed to create tag: ${response.statusText}`);
        return response.json();
    },

    // Get ID of a tag by name, creating it if it doesn't exist
    async getOrCreateTag(name: string): Promise<number> {
        const tagsData = await this.getTags();
        const existing = tagsData.results.find((t: any) => t.name.toLowerCase() === name.toLowerCase());

        if (existing) return existing.id;

        const newTag = await this.createTag(name);
        return newTag.id;
    },

    // Get documents (can filter by query)
    async getDocuments(query: string = '') {
        const response = await fetch(`${PAPERLESS_API_URL}/documents/?query=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Token ${PAPERLESS_TOKEN}`,
            },
        });
        return response.json();
    },

    // Get documents by Tag ID
    async getDocumentsByTag(tagId: number) {
        const response = await fetch(`${PAPERLESS_API_URL}/documents/?tags__id__all=${tagId}`, {
            headers: {
                'Authorization': `Token ${PAPERLESS_TOKEN}`,
            },
        });
        if (!response.ok) throw new Error(`Failed to fetch docs by tag: ${response.statusText}`);
        return response.json();
    },

    // Update a document (e.g. add tags)
    async updateDocument(id: number, data: any) {
        const response = await fetch(`${PAPERLESS_API_URL}/documents/${id}/`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Token ${PAPERLESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            // Paperless sometimes returns 200 for success, sometimes 204
            // If not OK, throw
            throw new Error(`Failed to update document: ${response.statusText}`);
        }
        return response.json();
    },

    // Get document by ID to see current tags
    async getDocument(id: number) {
        const response = await fetch(`${PAPERLESS_API_URL}/documents/${id}/`, {
            headers: { 'Authorization': `Token ${PAPERLESS_TOKEN}` }
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
            headers: { 'Authorization': `Token ${PAPERLESS_TOKEN}` }
        });
        if (!response.ok) throw new Error('Failed to download document');
        return response; // Return the full response so we can stream it
    }
};
