<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold mb-6">User Dashboard - Approved Documents</h1>
    
    <div v-if="loading" class="text-center py-10">
       <UIcon name="i-heroicons-arrow-path" class="animate-spin text-4xl text-gray-400" />
    </div>

    <div v-else class="grid gap-4">
      <UCard v-for="doc in docs" :key="doc.id" class="hover:shadow-sm transition-shadow">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="font-semibold text-lg">{{ doc.title }}</h3>
            <div class="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <span>Created: {{ formatTimestamp(doc.created) }}</span>
                <span v-if="doc.expires_at" class="text-red-500 font-medium">Expires: {{ formatTimestamp(doc.expires_at) }}</span>
            </div>
          </div>
          
          <div>
              <!-- Full Download/View -->
              <UButton v-if="doc.can_download !== false" 
                       variant="ghost" icon="i-heroicons-arrow-down-tray" 
                       :to="`${config.public.apiBase}/api/download/${doc.id}?token=${auth.token}`" target="_blank">
                  Download
              </UButton>
              
              <!-- Restricted View -->
              <UButton v-else 
                       color="orange" variant="soft" icon="i-heroicons-eye" 
                       @click="openRestrictedView(doc)">
                  View Only
              </UButton>
          </div>
        </div>
      </UCard>
      
      <div v-if="docs.length === 0" class="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg">
          No approved documents found.
      </div>
    </div>

    <!-- Restricted Viewer Modal -->
    <UModal v-model="isViewerOpen" fullscreen>
        <UCard :ui="{ base: 'h-full flex flex-col', body: { base: 'flex-1 p-0' } }">
            <template #header>
                <div class="flex items-center justify-between">
                    <h3 class="font-semibold">{{ currentDoc?.title }} (View Only)</h3>
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
const config = useRuntimeConfig()
const auth = useAuthStore()
const docs = ref([])
const loading = ref(false)

// Viewer State
const isViewerOpen = ref(false)
const currentDoc = ref(null)
const currentDocUrl = ref('')

function formatTimestamp(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('th-TH', { 
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  })
}

function openRestrictedView(doc) {
    currentDoc.value = doc
    // Use Server-side Wrapper for View Only (Enhanced Protection)
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
