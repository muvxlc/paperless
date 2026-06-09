<template>
  <div class="p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">System Audit Logs</h1>
      <div class="flex gap-4">
        <UInput v-model="q" placeholder="Search logs..." icon="i-heroicons-magnifying-glass" class="w-64" @keyup.enter="fetchLogs" />
        <UButton icon="i-heroicons-arrow-path" color="gray" variant="ghost" @click="fetchLogs" :loading="pending" />
      </div>
    </div>

    <UCard>
      <UTable :rows="logs" :columns="columns" :loading="pending">
        <template #created_at-data="{ row }">
          {{ formatTimestamp(row.created_at) }}
        </template>
        <template #action-data="{ row }">
            <UBadge :color="getActionColor(row.action)" variant="soft">{{ row.action }}</UBadge>
        </template>
      </UTable>

      <div class="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
        <UPagination v-model="page" :page-count="pageCount" :total="total" />
      </div>
    </UCard>
  </div>
</template>

<script setup>
const config = useRuntimeConfig()
const auth = useAuthStore()
const logs = ref([])
const pending = ref(false)

// Pagination & Search
const page = ref(1)
const pageCount = ref(20)
const total = ref(0)
const q = ref('')

const columns = [
  { key: 'created_at', label: 'Time' },
  { key: 'username', label: 'User' },
  { key: 'action', label: 'Action' },
  { key: 'target_id', label: 'Target ID' },
  { key: 'details', label: 'Details' }
]

function getActionColor(action) {
    switch (action) {
        case 'APPROVE': return 'green'
        case 'REJECT': return 'red'
        case 'VIEW': return 'blue'
        case 'LOGIN': return 'orange'
        default: return 'gray'
    }
}

function formatTimestamp(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('th-TH', { 
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

async function fetchLogs() {
  if (!auth.isAuthenticated) return
  pending.value = true
  try {
    const response = await $fetch(`${config.public.apiBase}/api/logs`, {
        headers: { 'Authorization': `Bearer ${auth.token}` },
        params: {
            page: page.value,
            limit: pageCount.value,
            q: q.value
        }
    })
    
    // Handle response structure { data, meta }
    if (response.data) {
        logs.value = response.data
        total.value = response.meta.total
    } else {
        logs.value = response // Fallback/Legacy
    }

  } catch (err) {
    if (err.data === 'Forbidden') {
        navigateTo('/')
    } else {
        alert('Failed to fetch logs: ' + err.message)
    }
  } finally {
    pending.value = false
  }
}

// Watchers
watch(page, () => {
    fetchLogs()
})

// Debounce Search
let timeout = null
watch(q, () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
        page.value = 1 // Reset to page 1 on search
        fetchLogs()
    }, 500)
})

onMounted(() => {
    fetchLogs()
})
</script>
