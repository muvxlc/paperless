<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-gray-800 dark:text-white">User Dashboard</h1>
      <p class="text-xs text-gray-400 mt-0.5">Access your approved documents and request approval for new files.</p>
    </div>

    <!-- Stats Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <!-- Total Approved Documents -->
      <div class="bg-gradient-to-br from-blue-400 to-indigo-500 p-5 rounded-2xl text-white shadow-xs relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200 cursor-pointer" @click="activeTab = 0">
        <div class="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-300">
          <UIcon name="i-heroicons-document-check" class="w-20 h-20" />
        </div>
        <p class="text-xs opacity-90 font-medium mb-1">Total Accessible Documents</p>
        <p class="text-3xl font-extrabold tracking-tight">{{ docs.length }}</p>
        <p class="text-[11px] opacity-75 mt-1">Available for you to review</p>
      </div>

      <!-- Full Access Documents -->
      <div class="bg-gradient-to-br from-emerald-400 to-teal-500 p-5 rounded-2xl text-white shadow-xs relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200">
        <div class="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-300">
          <UIcon name="i-heroicons-arrow-down-tray" class="w-20 h-20" />
        </div>
        <p class="text-xs opacity-90 font-medium mb-1">Downloadable Documents</p>
        <p class="text-3xl font-extrabold tracking-tight">{{ downloadableCount }}</p>
        <p class="text-[11px] opacity-75 mt-1">Full access granted</p>
      </div>

      <!-- View Only Documents -->
      <div class="bg-gradient-to-br from-orange-400 to-amber-500 p-5 rounded-2xl text-white shadow-xs relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200">
        <div class="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-300">
          <UIcon name="i-heroicons-eye" class="w-20 h-20" />
        </div>
        <p class="text-xs opacity-90 font-medium mb-1">View-Only Documents</p>
        <p class="text-3xl font-extrabold tracking-tight">{{ viewOnlyCount }}</p>
        <p class="text-[11px] opacity-75 mt-1">Restricted access (read-only)</p>
      </div>
    </div>

    <!-- Tabs Panel -->
    <UTabs :items="userTabs" v-model="activeTab" class="w-full">
      <template #item="{ item }">
        <div class="mt-4">
          
          <!-- Tab 1: My Approved Documents -->
          <div v-if="item.key === 'approved'" class="space-y-4">
            <UCard class="shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
              <template #header>
                <h3 class="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <UIcon name="i-heroicons-folder-open" class="w-5 h-5 text-orange-500" /> My Approved Documents
                </h3>
              </template>

              <div v-if="loading" class="text-center py-12">
                <UIcon name="i-heroicons-arrow-path" class="animate-spin text-4xl text-gray-400" />
              </div>

              <div v-else class="space-y-4">
                <div 
                  v-for="doc in docs" 
                  :key="doc.id" 
                  class="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 hover:shadow-xs transition-shadow duration-200 gap-4"
                >
                  <div class="flex items-start gap-4 min-w-0 flex-1">
                    <div class="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500 shrink-0">
                      <UIcon name="i-heroicons-document-text" class="text-2xl text-orange-500" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <h4 class="font-bold text-gray-800 dark:text-white truncate">{{ doc.title }}</h4>
                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1.5">
                        <span class="flex items-center gap-1">
                          <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
                          Created: {{ formatTimestamp(doc.created) }}
                        </span>
                        <span v-if="doc.expires_at" class="flex items-center gap-1 text-red-500">
                          <span>&bull;</span>
                          <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" />
                          Expires: {{ formatTimestamp(doc.expires_at) }}
                        </span>
                        <span>&bull;</span>
                        <UBadge 
                          size="xs" 
                          :color="doc.can_download !== false ? 'emerald' : 'orange'" 
                          variant="subtle"
                        >
                          {{ doc.can_download !== false ? 'Downloadable' : 'View Only' }}
                        </UBadge>
                      </div>
                    </div>
                  </div>
                  
                  <div class="shrink-0 self-end sm:self-center flex gap-2">
                    <!-- Full Download/View -->
                    <template v-if="doc.can_download !== false">
                      <UButton 
                        color="gray" 
                        variant="ghost" 
                        icon="i-heroicons-eye" 
                        :to="`${config.public.apiBase}/api/download/${doc.id}?token=${auth.token}&inline=true`" 
                        target="_blank"
                      >
                        View
                      </UButton>
                      <UButton 
                        color="primary"
                        variant="soft" 
                        icon="i-heroicons-arrow-down-tray" 
                        :to="`${config.public.apiBase}/api/download/${doc.id}?token=${auth.token}`" 
                        target="_blank"
                      >
                        Download
                      </UButton>
                    </template>
                    
                    <!-- Restricted View -->
                    <UButton 
                      v-else 
                      color="orange" 
                      variant="soft" 
                      icon="i-heroicons-eye" 
                      @click="openRestrictedView(doc)"
                    >
                      View Document
                    </UButton>
                  </div>
                </div>
                
                <div v-if="docs.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400 border border-dashed rounded-xl border-gray-200 dark:border-gray-800">
                  <UIcon name="i-heroicons-document-minus" class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                  <p class="font-medium text-sm">No approved documents</p>
                  <p class="text-xs text-gray-400 mt-1">You do not have any approved files assigned to your account yet.</p>
                </div>
              </div>
            </UCard>
          </div>

          <!-- Tab 2: Request Approval (Upload Form) -->
          <div v-if="item.key === 'upload'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Upload Zone -->
            <div class="lg:col-span-1">
              <UCard class="shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
                <template #header>
                  <h3 class="text-sm font-bold text-gray-800 dark:text-white">Request Document Approval</h3>
                </template>
                <div class="space-y-6">
                  <UFormGroup label="Select Document File">
                    <div 
                      @dragover.prevent="isDragging = true"
                      @dragleave.prevent="isDragging = false"
                      @drop.prevent="handleDrop"
                      :class="[
                        'relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 text-center cursor-pointer flex flex-col items-center justify-center min-h-[160px]',
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

                  <!-- Custom title (shown only if exactly 1 file is selected) -->
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
                      {{ uploading ? 'Uploading...' : 'Submit Approval Request' }}
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

            <!-- Upload Queue -->
            <div class="lg:col-span-2">
              <UCard class="shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 h-full flex flex-col">
                <template #header>
                  <div class="flex items-center justify-between">
                    <h3 class="text-sm font-bold text-gray-800 dark:text-white">Upload Queue</h3>
                    <UBadge size="sm" :color="queueBadgeColor" variant="subtle">
                      {{ filesList.length }} {{ filesList.length === 1 ? 'file' : 'files' }}
                    </UBadge>
                  </div>
                </template>

                <div v-if="filesList.length === 0" class="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-500 dark:text-gray-400 min-h-[250px]">
                  <UIcon name="i-heroicons-document-text" class="w-12 h-12 text-gray-300 dark:text-gray-700 mb-3" />
                  <p class="font-medium text-sm">No files selected</p>
                  <p class="text-xs text-gray-400 mt-1">Select files from the left to start uploading.</p>
                </div>

                <div v-else class="space-y-3 max-h-[400px] overflow-y-auto pr-2">
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
                          
                          <!-- Status feedback -->
                          <div class="mt-1 flex items-center space-x-2">
                            <span v-if="item.status === 'success'" class="text-xs text-green-500 dark:text-green-400 flex items-center font-medium">
                              <UIcon name="i-heroicons-check-circle" class="w-4 h-4 mr-1 flex-shrink-0" />
                              Sent successfully! Waiting for approval.
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
                          name="i-heroicons-check-badge" 
                          class="w-6 h-6 text-green-500" 
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
                </div>
              </UCard>
            </div>
          </div>

          <!-- Tab 3: My Request Status -->
          <div v-if="item.key === 'my-requests'" class="space-y-4">
            <UCard class="shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
              <template #header>
                <div class="flex justify-between items-center">
                  <h3 class="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <UIcon name="i-heroicons-clock" class="w-5 h-5 text-amber-500" /> My Requests History
                  </h3>
                  <UButton icon="i-heroicons-arrow-path" color="gray" variant="ghost" size="xs" @click="fetchMyRequests" :loading="loadingRequests" />
                </div>
              </template>

              <div v-if="loadingRequests" class="text-center py-12">
                <UIcon name="i-heroicons-arrow-path" class="animate-spin text-4xl text-gray-400" />
              </div>

              <div v-else-if="requestDocs.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400 border border-dashed rounded-xl border-gray-200 dark:border-gray-800">
                <UIcon name="i-heroicons-document-minus" class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                <p class="font-medium text-sm">No requested documents</p>
                <p class="text-xs text-gray-400 mt-1">You have not submitted any document requests yet.</p>
              </div>

              <div v-else class="space-y-4">
                <div 
                  v-for="doc in requestDocs" 
                  :key="doc.id" 
                  class="flex flex-col p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 hover:shadow-xs transition-shadow duration-200 gap-4"
                >
                  <div class="flex items-start gap-4 min-w-0 flex-1">
                    <div class="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500 shrink-0">
                      <UIcon 
                        :name="doc.status === 'approved' ? 'i-heroicons-check-circle' : (doc.status === 'rejected' ? 'i-heroicons-x-circle' : 'i-heroicons-clock')" 
                        :class="['text-2xl', doc.status === 'approved' ? 'text-green-500' : (doc.status === 'rejected' ? 'text-red-500' : 'text-amber-500')]" 
                      />
                    </div>
                    <div class="min-w-0 flex-1">
                      <h4 class="font-bold text-gray-800 dark:text-white truncate">{{ doc.title }}</h4>
                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1.5">
                        <span class="flex items-center gap-1">
                          <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
                          Requested: {{ formatTimestamp(doc.created) }}
                        </span>
                        <span>&bull;</span>
                        <UBadge 
                          size="xs" 
                          :color="doc.status === 'approved' ? 'emerald' : (doc.status === 'rejected' ? 'red' : 'orange')" 
                          variant="subtle"
                        >
                          {{ doc.status === 'approved' ? 'Approved' : (doc.status === 'rejected' ? 'Rejected' : 'Pending Review') }}
                        </UBadge>
                      </div>
                      
                      <!-- Display reject comment -->
                      <div v-if="doc.status === 'rejected' && doc.comment" class="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2.5 rounded-lg border border-red-100 dark:border-red-900/50 flex items-start gap-1">
                        <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 shrink-0 text-red-500" />
                        <div>
                          <span class="font-bold">Rejection Reason:</span> {{ doc.comment }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </UCard>
          </div>

        </div>
      </template>
    </UTabs>

    <!-- Restricted Viewer Modal -->
    <UModal v-model="isViewerOpen" fullscreen>
        <UCard :ui="{ base: 'h-full flex flex-col', body: { base: 'flex-1 p-0' } }">
            <template #header>
                <div class="flex items-center justify-between">
                    <h3 class="font-bold text-gray-800 dark:text-white">{{ currentDoc?.title }} (View Only)</h3>
                    <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="isViewerOpen = false" />
                </div>
            </template>

            <div class="w-full h-full bg-gray-900 dark:bg-gray-950 flex items-center justify-center relative group" @contextmenu.prevent>
                <iframe v-if="currentDocUrl" 
                        :src="currentDocUrl" 
                        class="w-full h-[85vh] border-none"
                        allow="fullscreen">
                </iframe>
                
                <!-- Overlay to prevent drag/drop or some interactions -->
                <div class="absolute inset-0 pointer-events-none"></div>
            </div>
        </UCard>
    </UModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const config = useRuntimeConfig()
const auth = useAuthStore()
const docs = ref([])
const requestDocs = ref([])
const loading = ref(false)
const loadingRequests = ref(false)
const activeTab = ref(0)

// Viewer State
const isViewerOpen = ref(false)
const currentDoc = ref(null)
const currentDocUrl = ref('')

// Upload queue state
const filesList = ref([])
const uploading = ref(false)
const isDragging = ref(false)
const fileInput = ref(null)

const userTabs = [
  { key: 'approved', label: 'My Approved Documents', icon: 'i-heroicons-document-check' },
  { key: 'upload', label: 'Request Approval (Upload)', icon: 'i-heroicons-cloud-arrow-up' },
  { key: 'my-requests', label: 'My Request Status', icon: 'i-heroicons-clock' }
]

const downloadableCount = computed(() => {
  return docs.value.filter(d => d.can_download !== false).length
})

const viewOnlyCount = computed(() => {
  return docs.value.filter(d => d.can_download === false).length
})

const queueBadgeColor = computed(() => {
  if (filesList.value.length === 0) return 'gray'
  if (filesList.value.every(f => f.status === 'success')) return 'green'
  if (filesList.value.some(f => f.status === 'failed')) return 'red'
  if (filesList.value.some(f => f.status === 'uploading')) return 'primary'
  return 'orange'
})

function formatTimestamp(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('th-TH', { 
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  })
}

function openRestrictedView(doc) {
    currentDoc.value = doc
    currentDocUrl.value = `${config.public.apiBase}/api/view/${doc.id}?token=${auth.token}`
    isViewerOpen.value = true
}

async function fetchDocs() {
  loading.value = true
  try {
    const data = await $fetch(`${config.public.apiBase}/api/approved`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
    })
    
    if (data && data.results) {
        docs.value = data.results
    } else {
        docs.value = []
    }
  } catch (err) {
    console.error('Fetch docs error:', err)
    docs.value = []
  } finally {
    loading.value = false
  }
}

async function fetchMyRequests() {
  loadingRequests.value = true
  try {
    const data = await $fetch(`${config.public.apiBase}/api/my-requests`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
    })
    if (data && data.results) {
        requestDocs.value = data.results
    } else {
        requestDocs.value = []
    }
  } catch (err) {
    console.error('Fetch my requests error:', err)
    requestDocs.value = []
  } finally {
    loadingRequests.value = false
  }
}

// Watch active tab to refresh correct lists
watch(activeTab, (newTabIdx) => {
  if (newTabIdx === 0) {
    fetchDocs()
  } else if (newTabIdx === 2) {
    fetchMyRequests()
  }
})

// Drag and drop handlers
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
  if (event.target) event.target.value = ''
}

function addFilesToList(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (filesList.value.some(item => item.name === file.name && item.size === file.size)) {
      continue
    }
    
    filesList.value.push({
      id: Math.random().toString(36).substring(7),
      file: file,
      name: file.name,
      size: file.size,
      title: '',
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

async function uploadSingle(item) {
  if (item.status === 'success' || item.status === 'processing') return true
  
  item.status = 'uploading'
  item.error = ''
  
  const formData = new FormData()
  formData.append('file', item.file)
  
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
    
    const taskId = typeof response.result === 'string' 
      ? response.result 
      : (response.result?.taskId || response.result?.task_id)

    if (taskId) {
      item.status = 'processing'
      pollTaskStatus(item, taskId)
    } else {
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

async function pollTaskStatus(item, taskId) {
  const maxRetries = 60
  let retries = 0
  
  while (retries < maxRetries) {
    try {
      const response = await $fetch(`${config.public.apiBase}/api/upload/status/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${auth.token}`
        }
      })
      
      if (response.status === 'SUCCESS') {
        item.status = 'success'
        fetchMyRequests() // Refresh requested documents list
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
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  item.status = 'failed'
  item.error = 'Processing timeout. Document is likely still processing in the background.'
  return false
}

async function uploadAll() {
  if (filesList.value.length === 0) return
  
  uploading.value = true
  
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

onMounted(() => {
    fetchDocs()
    fetchMyRequests()
})
</script>
