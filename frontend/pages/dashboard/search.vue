<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold mb-6">Search Results: "{{ route.query.q }}"</h1>

    <div v-if="pending" class="text-gray-500">Searching...</div>
    <div v-else-if="results.length === 0" class="text-gray-500">No documents found.</div>

    <div v-else class="grid gap-4">
      <UCard v-for="doc in results" :key="doc.id">
        <div class="flex justify-between items-center">
          <div>
             <div class="flex items-center gap-2 mb-1">
                <UBadge v-for="tag in doc.tags" :key="tag" size="xs" color="gray">{{ tag }}</UBadge>
             </div>
            <h3 class="font-semibold text-lg">{{ doc.title }}</h3>
            <p class="text-sm text-gray-500">Created: {{ doc.created_date }}</p>
          </div>
          <!-- View Button / Download URL logic can go here -->
          <UButton :to="`${config.public.apiBase}/api/download/${doc.id}?token=${auth.token}&inline=true`" target="_blank" icon="i-heroicons-eye" color="gray" variant="ghost">
            View
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const config = useRuntimeConfig()
const auth = useAuthStore()
const results = ref([])
const pending = ref(false)

// Function to fetch search results
async function performSearch() {
  const q = route.query.q
  if (!q) return

  pending.value = true
  try {
      const { data } = await useFetch(`${config.public.apiBase}/api/search`, {
          params: { q },
          headers: { 'Authorization': `Bearer ${auth.token}` },
          server: false
      })
      
      if (data.value && data.value.results) {
          results.value = data.value.results
      } else {
          results.value = []
      }
  } catch (e) {
      console.error(e)
  } finally {
      pending.value = false
  }
}

// Watch for query changes to re-search
watch(() => route.query.q, () => {
    performSearch()
})

onMounted(() => {
    performSearch()
})
</script>
