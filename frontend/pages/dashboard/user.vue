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

          <!-- Tab 2: Request Document Approval (Search & List) -->
          <div v-if="item.key === 'available'" class="space-y-6">
            <!-- Search & Filter Controls -->
            <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
              <UInput 
                v-model="searchQuery" 
                placeholder="Search documents by title, content..." 
                icon="i-heroicons-magnifying-glass" 
                class="w-full sm:w-96" 
                size="md" 
                @keyup.enter="fetchAvailableDocs"
              />
              <div class="flex items-center gap-3 w-full sm:w-auto justify-end">
                <span class="text-xs text-gray-500 font-medium whitespace-nowrap">Files per page:</span>
                <USelect v-model="pageSize" :options="[12, 24, 48]" class="w-20" size="sm" />
                <UButton icon="i-heroicons-arrow-path" color="gray" variant="ghost" @click="fetchAvailableDocs" :loading="loadingAvailable" />
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="loadingAvailable" class="text-center py-20">
              <UIcon name="i-heroicons-arrow-path" class="animate-spin text-4xl text-gray-400" />
              <p class="text-xs text-gray-400 mt-2">Loading available documents...</p>
            </div>

            <!-- Empty State -->
            <div v-else-if="availableDocs.length === 0" class="text-gray-500 dark:text-gray-400 text-center py-16 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
              <UIcon name="i-heroicons-document-magnifying-glass" class="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
              <p class="font-bold text-sm">No available documents found</p>
              <p class="text-xs text-gray-400 mt-1">Try adjusting your search query or check back later.</p>
            </div>

            <!-- Grid of Available Documents -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              <UCard 
                v-for="doc in availableDocs" 
                :key="doc.id" 
                class="hover:shadow-md hover:scale-[1.01] transition-all duration-200 ring-1 ring-gray-100 dark:ring-gray-800 flex flex-col h-full"
                :ui="{ body: { base: 'flex-1 flex flex-col justify-between' } }"
              >
                <div class="space-y-4">
                  <!-- File type icon and ID -->
                  <div class="flex justify-between items-start">
                    <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-500 shrink-0">
                      <UIcon 
                        :name="getFileIcon(doc.title || '')" 
                        :class="['text-3xl', getFileIconClass(doc.title || '')]" 
                      />
                    </div>
                    <span class="text-[10px] text-gray-400 font-semibold bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                      #{{ doc.id }}
                    </span>
                  </div>

                  <!-- Document Info -->
                  <div>
                    <h3 class="font-bold text-gray-800 dark:text-white line-clamp-2 min-h-[40px] text-sm" :title="doc.title">
                      {{ doc.title }}
                    </h3>
                    <p class="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                      <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
                      Created: {{ formatTimestamp(doc.created) }}
                    </p>
                  </div>
                </div>

                <!-- Footer (Actions) -->
                <template #footer>
                  <div class="flex items-center justify-between gap-2">
                    <!-- Approved Status -->
                    <UBadge v-if="doc.request_status === 'approved'" color="green" variant="subtle" class="w-full justify-center py-1.5 text-xs font-semibold">
                      <UIcon name="i-heroicons-check-circle" class="w-4 h-4 mr-1" /> Approved
                    </UBadge>

                    <!-- Pending Status -->
                    <UBadge v-else-if="doc.request_status === 'pending'" color="amber" variant="subtle" class="w-full justify-center py-1.5 text-xs font-semibold">
                      <UIcon name="i-heroicons-clock" class="w-4 h-4 mr-1 animate-pulse" /> Requested
                    </UBadge>

                    <!-- Rejected Status / Request Again -->
                    <div v-else-if="doc.request_status === 'rejected'" class="w-full flex flex-col gap-1.5">
                      <UBadge color="red" variant="subtle" class="w-full justify-center py-1 text-xs font-semibold">
                        <UIcon name="i-heroicons-x-circle" class="w-4 h-4 mr-1" /> Rejected
                      </UBadge>
                      <UButton 
                        block 
                        color="orange" 
                        size="xs" 
                        icon="i-heroicons-arrow-path" 
                        label="Request Again" 
                        :loading="requestingDocId === doc.id"
                        @click="requestAccess(doc.id)"
                      />
                    </div>

                    <!-- Not Requested Status -->
                    <UButton 
                      v-else 
                      block 
                      color="primary" 
                      size="xs" 
                      icon="i-heroicons-key" 
                      label="Request Access" 
                      :loading="requestingDocId === doc.id"
                      @click="requestAccess(doc.id)"
                    />
                  </div>
                </template>
              </UCard>
            </div>

            <!-- Pagination Bar -->
            <div v-if="availableDocs.length > 0" class="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
              <span class="text-xs text-gray-500 font-medium">
                Showing {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, totalDocs) }} of {{ totalDocs }} documents
              </span>
              <UPagination v-model="currentPage" :page-count="pageSize" :total="totalDocs" size="sm" />
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

// Available documents state (tab 2)
const availableDocs = ref([])
const loadingAvailable = ref(false)
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(12)
const totalDocs = ref(0)
const requestingDocId = ref(null)

const userTabs = [
  { key: 'approved', label: 'My Approved Documents', icon: 'i-heroicons-document-check' },
  { key: 'available', label: 'Request Document Approval', icon: 'i-heroicons-magnifying-glass' },
  { key: 'my-requests', label: 'My Request Status', icon: 'i-heroicons-clock' }
]

const downloadableCount = computed(() => {
  return docs.value.filter(d => d.can_download !== false).length
})

const viewOnlyCount = computed(() => {
  return docs.value.filter(d => d.can_download === false).length
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

// Available documents list (tab 2)
async function fetchAvailableDocs() {
  loadingAvailable.value = true
  try {
    const data = await $fetch(`${config.public.apiBase}/api/available-pending`, {
      headers: { 'Authorization': `Bearer ${auth.token}` },
      params: {
        search: searchQuery.value,
        page: currentPage.value,
        limit: pageSize.value,
        t: Date.now()
      }
    })
    if (data && data.results) {
      availableDocs.value = data.results
      totalDocs.value = data.count || 0
    } else {
      availableDocs.value = []
      totalDocs.value = 0
    }
  } catch (err) {
    console.error('Fetch available documents error:', err)
    availableDocs.value = []
    totalDocs.value = 0
  } finally {
    loadingAvailable.value = false
  }
}

// Request Access Action
async function requestAccess(docId) {
  requestingDocId.value = docId
  try {
    await $fetch(`${config.public.apiBase}/api/request-access/${docId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth.token}` }
    })
    // Refresh both list and my requests history
    await Promise.all([
      fetchAvailableDocs(),
      fetchMyRequests()
    ])
  } catch (err) {
    alert('Failed to request access: ' + (err.data?.error || err.message))
  } finally {
    requestingDocId.value = null
  }
}

// Watchers
watch([currentPage, pageSize], () => {
  fetchAvailableDocs()
})

let searchTimeout
watch(searchQuery, () => {
  currentPage.value = 1
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchAvailableDocs()
  }, 400)
})

// Watch active tab to refresh correct lists
watch(activeTab, (newTabIdx) => {
  if (newTabIdx === 0) {
    fetchDocs()
  } else if (newTabIdx === 1) {
    fetchAvailableDocs()
  } else if (newTabIdx === 2) {
    fetchMyRequests()
  }
})

// Helpers
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
    fetchAvailableDocs()
    fetchMyRequests()
})
</script>
