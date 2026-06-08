<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-gray-800 dark:text-white">User Dashboard</h1>
      <p class="text-xs text-gray-400 mt-0.5">Access and view your approved documents.</p>
    </div>

    <!-- Stats Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <!-- Total Approved Documents -->
      <div class="bg-gradient-to-br from-blue-400 to-indigo-500 p-5 rounded-2xl text-white shadow-xs relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200">
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

    <!-- Document List Queue -->
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
          
          <div class="shrink-0 self-end sm:self-center">
            <!-- Full Download/View -->
            <UButton 
              v-if="doc.can_download !== false" 
              color="primary"
              variant="soft" 
              icon="i-heroicons-arrow-down-tray" 
              :to="`${config.public.apiBase}/api/download/${doc.id}?token=${auth.token}`" 
              target="_blank"
            >
              Download
            </UButton>
            
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

    <!-- Restricted Viewer Modal -->
    <UModal v-model="isViewerOpen" fullscreen>
        <UCard :ui="{ base: 'h-full flex flex-col', body: { base: 'flex-1 p-0' } }">
            <template #header>
                <div class="flex items-center justify-between">
                    <h3 class="font-bold text-gray-800 dark:text-white">{{ currentDoc?.title }} (View Only)</h3>
                    <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="isViewerOpen = false" />
                </div>
            </template>

            <div class="w-full h-full bg-gray-100 flex items-center justify-center relative group" @contextmenu.prevent>
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
import { ref, computed, onMounted } from 'vue'

const config = useRuntimeConfig()
const auth = useAuthStore()
const docs = ref([])
const loading = ref(false)

// Viewer State
const isViewerOpen = ref(false)
const currentDoc = ref(null)
const currentDocUrl = ref('')

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

onMounted(() => {
    fetchDocs()
})
</script>
