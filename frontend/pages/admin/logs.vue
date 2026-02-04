<template>
  <div class="p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">System Audit Logs</h1>
      <UButton icon="i-heroicons-arrow-path" color="gray" variant="ghost" @click="fetchLogs" :loading="pending" />
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
    </UCard>
  </div>
</template>

<script setup>
const config = useRuntimeConfig()
const auth = useAuthStore()
const logs = ref([])
const pending = ref(false)

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
  pending.value = true
  try {
    const data = await $fetch(`${config.public.apiBase}/api/logs`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
    })
    logs.value = data || []
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

onMounted(() => {
    fetchLogs()
})
</script>
