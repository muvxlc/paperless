<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold mb-6">Staff Dashboard - Upload Documents</h1>
    
    <UCard class="max-w-4xl">
      <div class="space-y-6">
        <!-- Upload Area -->
        <div class="space-y-4">
          <UFormGroup label="Select Files">
            <input 
              type="file" 
              multiple 
              @change="handleFilesChange" 
              accept=".pdf,.png,.jpg,.jpeg,.tiff"
              class="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-primary-50 file:text-primary-700
              hover:file:bg-primary-100"
            />
          </UFormGroup>
          <div class="flex justify-end">
             <UButton @click="uploadAll" :loading="isUploading" :disabled="files.length === 0">
                Upload {{ files.length }} Files
             </UButton>
          </div>
        </div>

        <!-- File List -->
        <div v-if="uploadQueue.length > 0" class="border-t pt-6">
           <h3 class="font-semibold mb-4">Upload Queue</h3>
           <div class="space-y-3">
              <div v-for="(item, index) in uploadQueue" :key="index" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                 <div class="flex items-center space-x-3 overflow-hidden">
                    <UIcon v-if="item.status === 'success'" name="i-heroicons-check-circle" class="text-green-500 w-5 h-5" />
                    <UIcon v-else-if="item.status === 'error'" name="i-heroicons-x-circle" class="text-red-500 w-5 h-5" />
                    <UIcon v-else-if="item.status === 'uploading' || item.status === 'processing'" name="i-heroicons-arrow-path" class="text-blue-500 w-5 h-5 animate-spin" />
                    <UIcon v-else name="i-heroicons-document" class="text-gray-400 w-5 h-5" />
                    
                    <div class="flex flex-col min-w-0">
                       <span class="truncate font-medium text-sm text-gray-500">{{ item.file.name }}</span>
                       <span class="text-xs text-gray-500">{{ item.message }}</span>
                    </div>
                 </div>
                 
                 <div class="flex items-center space-x-2">
                     <UBadge :color="statusColor(item.status)" variant="subtle">{{ item.status }}</UBadge>
                 </div>
              </div>
           </div>
        </div>

      </div>
    </UCard>
  </div>
</template>

<script setup>
const config = useRuntimeConfig()
const auth = useAuthStore()

const files = ref([])
const uploadQueue = ref([])
const isUploading = computed(() => uploadQueue.value.some(i => i.status === 'uploading' || i.status === 'processing'))

function handleFilesChange(event) {
  const newFiles = Array.from(event.target.files)
  files.value = newFiles
  
  // Initialize queue
  uploadQueue.value = newFiles.map(f => ({
    file: f,
    status: 'pending',
    message: 'Ready to upload',
    progress: 0,
    taskId: null
  }))
}

function statusColor(status) {
    switch (status) {
        case 'success': return 'green'
        case 'error': return 'red'
        case 'processing': return 'blue'
        case 'uploading': return 'blue'
        default: return 'gray'
    }
}

async function uploadAll() {
    const CONCURRENCY = 3; // Upload 3 files at a time
    const queue = uploadQueue.value.filter(item => item.status !== 'success');
    
    // Helper to process a chunk
    const worker = async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            if (item) await processItem(item);
        }
    };

    // Create worker pool
    const workers = Array(Math.min(queue.length, CONCURRENCY)).fill(null).map(() => worker());
    await Promise.all(workers);
}

async function processItem(item) {
    item.status = 'uploading'
    item.message = 'Uploading...'
    
    const formData = new FormData()
    formData.append('file', item.file)
    formData.append('title', item.file.name.replace(/\.[^/.]+$/, "")) // Remove extension for title

    try {
        const data = await $fetch(`${config.public.apiBase}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${auth.token}` },
            body: formData
        })

        const result = data.result
        
        if (result.task_id) {
            item.taskId = result.task_id
            item.status = 'processing'
            item.message = 'Processing in Paperless...'
            // Await the local polling promise
            await pollTaskStatus(item)
        } else if (result.document_id || result.document || result.id) {
             item.status = 'success'
             item.message = 'Upload Complete'
        } else {
             item.status = 'success'
             item.message = 'Uploaded (Async)'
        }

    } catch (e) {
        item.status = 'error'
        item.message = e.data?.error || e.message || 'Upload failed'
    }
}

function pollTaskStatus(item) {
    return new Promise((resolve) => {
        if (!item.taskId) {
            resolve();
            return;
        }
        
        const maxRetries = 1200; // approx 60 mins (to handle large backlogs)
        let attempts = 0;
        
        const poll = async () => {
            if (attempts >= maxRetries) {
                item.status = 'error'
                item.message = 'Processing timed out (Backlog too large)'
                resolve();
                return
            }
            
            try {
                 const data = await $fetch(`${config.public.apiBase}/api/tasks/${item.taskId}`, {
                    headers: { 'Authorization': `Bearer ${auth.token}` }
                })
                
                const status = data.status
                
                if (status === 'SUCCESS') {
                    item.status = 'success'
                    item.message = 'Processing Complete'
                    resolve();
                    return
                } else if (status === 'FAILURE') {
                    item.status = 'error'
                    item.message = `Processing Failed: ${data.result}`
                    resolve();
                    return
                } else if (status === 'PENDING') {
                    item.message = `Queued (${attempts}s)...`
                } else if (status === 'STARTED') {
                    item.message = 'Processing document...'
                }
                
                attempts++;
                setTimeout(poll, 3000)
                
            } catch (e) {
                console.error('Polling exception', e)
                attempts++;
                setTimeout(poll, 3000)
            }
        }
        
        poll()
    });
}
</script>
