<template>
  <div class="p-8 max-w-6xl mx-auto">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Staff Dashboard - Upload Documents
        </h1>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Upload and track your documents for approval. Supports selecting or dragging multiple files.
        </p>
      </div>
      <UButton to="/dashboard/admin" variant="ghost" color="gray" icon="i-heroicons-arrow-left">
        Back to Admin Panel
      </UButton>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Upload Card -->
      <div class="lg:col-span-1">
        <UCard class="shadow-md ring-1 ring-gray-100 dark:ring-gray-800">
          <template #header>
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
              Add Documents
            </h3>
          </template>

          <div class="space-y-6">
            <!-- Custom Drag and Drop Dropzone -->
            <UFormGroup label="Select Files">
              <div 
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
                :class="[
                  'relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 text-center cursor-pointer flex flex-col items-center justify-center min-h-[160px]',
                  isDragging 
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20' 
                    : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                ]"
                @click="triggerFileInput"
              >
                <input 
                  ref="fileInput"
                  type="file" 
                  multiple 
                  class="hidden" 
                  @change="handleFileChange" 
                />
                <UIcon name="i-heroicons-cloud-arrow-up" class="w-10 h-10 text-gray-400 mb-3" />
                <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Drag & drop files here, or <span class="text-primary-500">browse</span>
                </div>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Supports PDF, PNG, JPG, JPEG, TXT
                </p>
              </div>
            </UFormGroup>

            <!-- Document Title (shown only if exactly 1 file is selected) -->
            <UFormGroup 
              v-if="filesList.length === 1" 
              label="Document Title"
              help="Defaults to filename if left empty."
            >
              <UInput 
                v-model="filesList[0].title" 
                placeholder="Enter document title" 
                icon="i-heroicons-pencil"
              />
            </UFormGroup>

            <div class="flex flex-col gap-2">
              <UButton 
                block 
                color="primary" 
                icon="i-heroicons-arrow-up-tray"
                @click="uploadAll" 
                :loading="uploading"
                :disabled="filesList.length === 0 || filesList.every(f => f.status === 'success')"
              >
                {{ uploading ? 'Uploading...' : 'Upload All Files' }}
              </UButton>
              <UButton 
                v-if="filesList.length > 0"
                block 
                variant="ghost" 
                color="gray" 
                icon="i-heroicons-trash"
                @click="clearAll"
                :disabled="uploading"
              >
                Clear Queue
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Selected Files Queue -->
      <div class="lg:col-span-2">
        <UCard class="shadow-md ring-1 ring-gray-100 dark:ring-gray-800 h-full flex flex-col">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                Upload Queue
              </h3>
              <UBadge size="sm" :color="queueBadgeColor" variant="subtle">
                {{ filesList.length }} {{ filesList.length === 1 ? 'file' : 'files' }}
              </UBadge>
            </div>
          </template>

          <div v-if="filesList.length === 0" class="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-500 dark:text-gray-400 min-h-[300px]">
            <UIcon name="i-heroicons-document-text" class="w-12 h-12 text-gray-300 dark:text-gray-700 mb-3" />
            <p class="font-medium text-sm">No files selected</p>
            <p class="text-xs text-gray-400 mt-1">Select files from the left to start uploading.</p>
          </div>

          <div v-else class="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            <TransitionGroup name="list" tag="div" class="space-y-3">
              <div 
                v-for="item in filesList" 
                :key="item.id"
                class="flex flex-col p-4 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 transition-all duration-300"
              >
                <div class="flex items-center justify-between min-w-0">
                  <div class="flex items-center space-x-4 min-w-0 flex-1">
                    <div class="flex-shrink-0">
                      <UIcon 
                        :name="getFileIcon(item.name)" 
                        :class="['w-8 h-8', getFileIconClass(item.name)]" 
                      />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center space-x-2">
                        <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {{ item.name }}
                        </p>
                        <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                          ({{ formatBytes(item.size) }})
                        </span>
                      </div>
                      
                      <!-- Progress bar or title / status info -->
                      <div class="mt-1 flex items-center space-x-2">
                        <span v-if="item.status === 'success'" :class="item.warning ? 'text-amber-500 dark:text-amber-400' : 'text-green-500 dark:text-green-400'" class="text-xs flex items-center font-medium">
                          <UIcon :name="item.warning ? 'i-heroicons-clock' : 'i-heroicons-check-circle'" class="w-4 h-4 mr-1 flex-shrink-0" />
                          <span v-if="item.warning">
                            Uploaded. {{ item.warning }}
                          </span>
                          <span v-else>
                            Uploaded successfully
                          </span>
                        </span>
                        <span v-else-if="item.status === 'processing'" class="text-xs text-orange-500 dark:text-orange-400 flex items-center font-medium">
                          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-1 animate-spin flex-shrink-0" />
                          Processing (OCR & indexing)...
                        </span>
                        <span v-else-if="item.status === 'failed'" class="text-xs text-red-500 dark:text-red-400 flex items-center font-medium truncate max-w-md">
                          <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 mr-1 flex-shrink-0" />
                          {{ item.error || 'Upload failed' }}
                        </span>
                        <span v-else-if="item.status === 'uploading'" class="text-xs text-blue-500 dark:text-blue-400 flex items-center font-medium">
                          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-1 animate-spin flex-shrink-0" />
                          Uploading...
                        </span>
                        <span v-else class="text-xs text-gray-400 dark:text-gray-500 flex items-center font-medium">
                          <UIcon name="i-heroicons-clock" class="w-4 h-4 mr-1 flex-shrink-0" />
                          Ready to upload
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center space-x-2 ml-4">
                    <UButton 
                      v-if="item.status === 'pending'" 
                      variant="ghost" 
                      color="red" 
                      icon="i-heroicons-trash"
                      size="xs"
                      @click="removeFile(item.id)"
                      :disabled="uploading"
                    />
                    <UIcon 
                      v-else-if="item.status === 'success'" 
                      :name="item.warning ? 'i-heroicons-clock' : 'i-heroicons-check-badge'" 
                      :class="['w-6 h-6', item.warning ? 'text-amber-500' : 'text-green-500']" 
                    />
                    <UButton 
                      v-else-if="item.status === 'failed'" 
                      variant="ghost" 
                      color="amber" 
                      icon="i-heroicons-arrow-path"
                      size="xs"
                      @click="uploadSingle(item)"
                      :disabled="uploading"
                    />
                  </div>
                </div>

                <!-- Input for Custom Title if multiple files are selected -->
                <div v-if="filesList.length > 1 && item.status === 'pending'" class="mt-3 pl-12">
                  <UInput 
                    v-model="item.title"
                    size="xs"
                    placeholder="Custom document title (optional)"
                    icon="i-heroicons-pencil"
                    :disabled="uploading"
                  />
                </div>
              </div>
            </TransitionGroup>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const filesList = ref([])
const uploading = ref(false)
const isDragging = ref(false)
const fileInput = ref(null)

const config = useRuntimeConfig()
const auth = useAuthStore()

const queueBadgeColor = computed(() => {
  if (filesList.value.length === 0) return 'gray'
  if (filesList.value.every(f => f.status === 'success')) return 'green'
  if (filesList.value.some(f => f.status === 'failed')) return 'red'
  if (filesList.value.some(f => f.status === 'uploading')) return 'primary'
  return 'orange'
})

function triggerFileInput() {
  fileInput.value?.click()
}

function handleDrop(event) {
  isDragging.value = false
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    addFilesToList(files)
  }
}

function handleFileChange(event) {
  const files = event.target.files
  if (files && files.length > 0) {
    addFilesToList(files)
  }
  // Reset file input value so same files can be selected again
  if (event.target) event.target.value = ''
}

function addFilesToList(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    // Check if file is already added
    if (filesList.value.some(item => item.name === file.name && item.size === file.size)) {
      continue
    }
    
    filesList.value.push({
      id: Math.random().toString(36).substring(7),
      file: file,
      name: file.name,
      size: file.size,
      title: '', // Custom title if provided
      status: 'pending',
      error: ''
    })
  }
}

function removeFile(id) {
  filesList.value = filesList.value.filter(item => item.id !== id)
}

function clearAll() {
  filesList.value = []
}

// Upload a single file item (used for retry or sequential uploads)
async function uploadSingle(item) {
  if (item.status === 'success' || item.status === 'processing') return true
  
  item.status = 'uploading'
  item.error = ''
  
  const formData = new FormData()
  formData.append('file', item.file)
  
  // Use custom title if specified, otherwise the backend defaults to filename
  if (item.title) {
    formData.append('title', item.title)
  }

  try {
    const response = await $fetch(`${config.public.apiBase}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      body: formData
    })
    
    // Extract task ID from response
    const taskId = typeof response.result === 'string' 
      ? response.result 
      : (response.result?.taskId || response.result?.task_id)

    if (taskId) {
      item.status = 'processing'
      // Start polling task status in the background so next file upload isn't blocked
      pollTaskStatus(item, taskId)
    } else {
      // If no task ID (synchronous upload), mark success immediately
      item.status = 'success'
    }
    return true
  } catch (err) {
    console.error('Upload error for file:', item.name, err)
    item.status = 'failed'
    item.error = err.data?.error || err.message || 'Error uploading file'
    return false
  }
}

// Poll Paperless-ngx task queue for the document processing status
async function pollTaskStatus(item, taskId) {
  const maxFastRetries = 90 // 180 seconds maximum polling time (every 2 seconds)
  const maxSlowRetries = 30 // Another 300 seconds maximum polling time (every 10 seconds)
  let retries = 0
  
  // Phase 1: Fast Polling (every 2 seconds for 3 minutes)
  while (retries < maxFastRetries) {
    try {
      const response = await $fetch(`${config.public.apiBase}/api/upload/status/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${auth.token}`
        }
      })
      
      // Paperless statuses: PENDING, STARTED, SUCCESS, FAILURE, REVOKED
      if (response.status === 'SUCCESS') {
        item.status = 'success'
        item.warning = ''
        return true
      } else if (response.status === 'FAILURE') {
        item.status = 'failed'
        item.error = response.error || 'OCR processing failed'
        return false
      } else if (response.status === 'REVOKED') {
        item.status = 'failed'
        item.error = 'Task was revoked'
        return false
      }
    } catch (err) {
      console.error('Error polling status for task:', taskId, err)
    }
    
    retries++
    await new Promise(resolve => setTimeout(resolve, 2000)) // Poll every 2 seconds
  }
  
  // Phase 2: Transition to Slow Polling (every 10 seconds for another 5 minutes)
  item.warning = 'Taking longer than expected. Still checking in the background...'
  retries = 0
  
  while (retries < maxSlowRetries) {
    try {
      const response = await $fetch(`${config.public.apiBase}/api/upload/status/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${auth.token}`
        }
      })
      
      if (response.status === 'SUCCESS') {
        item.status = 'success'
        item.warning = ''
        return true
      } else if (response.status === 'FAILURE') {
        item.status = 'failed'
        item.warning = ''
        item.error = response.error || 'OCR processing failed'
        return false
      } else if (response.status === 'REVOKED') {
        item.status = 'failed'
        item.warning = ''
        item.error = 'Task was revoked'
        return false
      }
    } catch (err) {
      console.error('Error polling status for task:', taskId, err)
    }
    
    retries++
    await new Promise(resolve => setTimeout(resolve, 10000)) // Poll every 10 seconds
  }
  
  // Phase 3: Absolute timeout (8 minutes total) - assume success in background
  item.status = 'success'
  item.warning = 'Processing timeout...'
  
  // Phase 4: Silent background polling (every 30 seconds for another 30 minutes)
  // This handles the case "what if it reports error or success later"
  // Run it asynchronously so we don't block the caller from returning true (success status)
  (async () => {
    let silentRetries = 0
    const maxSilentRetries = 60
    while (silentRetries < maxSilentRetries) {
      // Only continue polling if the item is still in 'success' status and has the timeout warning.
      if (item.status !== 'success' || item.warning !== 'Processing timeout...') {
        return
      }

      await new Promise(resolve => setTimeout(resolve, 30000)) // Poll every 30 seconds

      // Check again if status or warning has changed during the wait
      if (item.status !== 'success' || item.warning !== 'Processing timeout...') {
        return
      }

      try {
        const response = await $fetch(`${config.public.apiBase}/api/upload/status/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${auth.token}`
          }
        })

        if (response.status === 'SUCCESS') {
          item.status = 'success'
          item.warning = ''
          return
        } else if (response.status === 'FAILURE') {
          item.status = 'failed'
          item.warning = ''
          item.error = response.error || 'OCR processing failed'
          return
        } else if (response.status === 'REVOKED') {
          item.status = 'failed'
          item.warning = ''
          item.error = 'Task was revoked'
          return
        }
      } catch (err) {
        console.error('Error in silent polling for task:', taskId, err)
      }

      silentRetries++
    }
  })()

  return true
}

// Upload all files in the queue sequentially
async function uploadAll() {
  if (filesList.value.length === 0) return
  
  uploading.value = true
  
  // Only upload files that are not already successfully uploaded or processing
  const pendingFiles = filesList.value.filter(f => f.status !== 'success' && f.status !== 'processing')
  
  for (const item of pendingFiles) {
    await uploadSingle(item)
  }
  
  uploading.value = false
}

// Helpers
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function getFileIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf': return 'i-heroicons-document-arrow-down'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return 'i-heroicons-photo'
    case 'txt':
    case 'doc':
    case 'docx':
      return 'i-heroicons-document-text'
    default:
      return 'i-heroicons-document'
  }
}

function getFileIconClass(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf': return 'text-red-500'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return 'text-blue-500'
    case 'txt':
    case 'doc':
    case 'docx':
      return 'text-amber-500'
    default:
      return 'text-gray-500'
  }
}
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>

