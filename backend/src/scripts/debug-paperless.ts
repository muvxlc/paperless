import { PaperlessService } from '../services/paperless';

export async function debugConnectivity() {
    try {
        console.log('[Debug] Testing Paperless Connectivity...');
        const tags = await PaperlessService.getTags();
        return {
            success: true,
            message: 'Connected to Paperless successfully',
            tagCount: tags.results?.length || 0
        };
    } catch (e: any) {
        console.error('[Debug] Paperless Connection Failed:', e);
        return {
            success: false,
            message: e.message,
            details: e.toString()
        };
    }
}
