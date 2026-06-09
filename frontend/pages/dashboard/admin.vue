<template>
  <div class="space-y-8">
    <!-- Stats Cards Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Total Documents -->
      <div class="bg-gradient-to-br from-orange-400 to-amber-500 p-5 rounded-2xl text-white shadow-xs relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200">
        <div class="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-300">
          <UIcon name="i-heroicons-document-duplicate" class="w-24 h-24" />
        </div>
        <p class="text-xs opacity-90 font-medium mb-1 flex items-center gap-1">
          <UIcon name="i-heroicons-document-duplicate" class="w-4 h-4" /> Approved Documents
        </p>
        <p class="text-3xl font-extrabold tracking-tight">{{ approvedCount }}</p>
        <p class="text-[11px] opacity-75 mt-1">Processed successfully</p>
      </div>

      <!-- Pending Approvals -->
      <div class="bg-gradient-to-br from-blue-400 to-indigo-500 p-5 rounded-2xl text-white shadow-xs relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200">
        <div class="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-300">
          <UIcon name="i-heroicons-clock" class="w-24 h-24" />
        </div>
        <p class="text-xs opacity-90 font-medium mb-1 flex items-center gap-1">
          <UIcon name="i-heroicons-clock" class="w-4 h-4" /> Pending Approvals
        </p>
        <p class="text-3xl font-extrabold tracking-tight">{{ pendingCount }}</p>
        <p class="text-[11px] opacity-75 mt-1">Awaiting verification</p>
      </div>

      <!-- Users -->
      <div class="bg-gradient-to-br from-emerald-400 to-teal-500 p-5 rounded-2xl text-white shadow-xs relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200">
        <div class="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-300">
          <UIcon name="i-heroicons-users" class="w-24 h-24" />
        </div>
        <p class="text-xs opacity-90 font-medium mb-1 flex items-center gap-1">
          <UIcon name="i-heroicons-users" class="w-4 h-4" /> Registered Users
        </p>
        <p class="text-3xl font-extrabold tracking-tight">{{ usersCount }}</p>
        <p class="text-[11px] opacity-75 mt-1">Active staff/approvers/users</p>
      </div>

      <!-- Rejected -->
      <div class="bg-gradient-to-br from-red-400 to-rose-500 p-5 rounded-2xl text-white shadow-xs relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200">
        <div class="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-300">
          <UIcon name="i-heroicons-archive-box-x-mark" class="w-24 h-24" />
        </div>
        <p class="text-xs opacity-90 font-medium mb-1 flex items-center gap-1">
          <UIcon name="i-heroicons-archive-box-x-mark" class="w-4 h-4" /> Rejected Documents
        </p>
        <p class="text-3xl font-extrabold tracking-tight">{{ rejectedCount }}</p>
        <p class="text-[11px] opacity-75 mt-1">Declined documents</p>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <!-- Left Column: Logs & Status -->
      <div class="lg:col-span-2 space-y-6">
        <!-- System Logs -->
        <UCard class="shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
          <template #header>
            <div class="flex justify-between items-center">
              <h3 class="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <UIcon name="i-heroicons-clipboard-document-list" class="w-5 h-5 text-orange-500" /> Recent Audit Logs
              </h3>
              <UButton to="/admin/logs" variant="link" color="orange" size="xs">View All</UButton>
            </div>
          </template>

          <div v-if="loading" class="text-center py-10">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin text-3xl text-gray-400" />
          </div>

          <div v-else-if="recentLogs.length === 0" class="text-center py-10 text-gray-500 dark:text-gray-400 border border-dashed rounded-xl border-gray-200 dark:border-gray-800">
            No logs available.
          </div>

          <div v-else class="space-y-4">
            <div 
              v-for="log in recentLogs" 
              :key="log.id" 
              class="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800"
            >
              <div class="p-2 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-lg shrink-0">
                <UIcon name="i-heroicons-bolt" class="w-4 h-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                  <span class="capitalize text-orange-500">{{ log.username }}</span>
                  <span class="font-medium text-gray-500 dark:text-gray-400">{{ log.action }}</span>
                </p>
                <p class="text-[11px] text-gray-400 mt-0.5 truncate">{{ log.details }}</p>
                <p class="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                  <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" /> {{ formatTimestamp(log.created_at) }}
                </p>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Right Column: Status & Quick Actions -->
      <div class="space-y-6">
        <!-- Quick Actions -->
        <UCard class="shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
          <template #header>
            <h3 class="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-wrench-screwdriver" class="w-5 h-5 text-orange-500" /> Quick Actions
            </h3>
          </template>

          <div class="space-y-3">
            <UButton to="/dashboard/staff" block color="primary" variant="soft" icon="i-heroicons-arrow-up-tray" class="justify-start">
              Upload New Documents (Staff Mode)
            </UButton>
            <UButton to="/dashboard/approver" block color="indigo" variant="soft" icon="i-heroicons-check-badge" class="justify-start">
              Approval Queue (Approver Mode)
            </UButton>
            <UButton to="/admin/users" block color="emerald" variant="soft" icon="i-heroicons-users" class="justify-start">
              User Configuration Management
            </UButton>
            <UButton to="/admin/logs" block color="rose" variant="soft" icon="i-heroicons-document-text" class="justify-start">
              Audit Logs & Activity Records
            </UButton>
          </div>
        </UCard>

        <!-- System Health -->
        <UCard class="shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
          <template #header>
            <h3 class="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <UIcon name="i-heroicons-cpu-chip" class="w-5 h-5 text-orange-500" /> System Status
            </h3>
          </template>

          <div class="space-y-3 text-xs">
            <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
              <span class="text-gray-500 dark:text-gray-400">Server API:</span>
              <UBadge :color="systemStatus.server === 'active' ? 'green' : 'red'" variant="subtle" size="sm" class="flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full" :class="systemStatus.server === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'"></span>
                {{ systemStatus.server === 'active' ? 'Active' : 'Inactive' }}
              </UBadge>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
              <span class="text-gray-500 dark:text-gray-400">Database:</span>
              <UBadge :color="systemStatus.database === 'active' ? 'green' : 'red'" variant="subtle" size="sm" class="flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full" :class="systemStatus.database === 'active' ? 'bg-green-500' : 'bg-red-500'"></span>
                {{ systemStatus.database === 'active' ? 'Active' : 'Inactive' }}
              </UBadge>
            </div>
            <div class="flex justify-between items-center py-2">
              <span class="text-gray-500 dark:text-gray-400">Paperless Service:</span>
              <UBadge :color="systemStatus.paperless === 'active' ? 'green' : 'red'" variant="subtle" size="sm" class="flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full" :class="systemStatus.paperless === 'active' ? 'bg-green-500' : 'bg-red-500'"></span>
                {{ systemStatus.paperless === 'active' ? 'Active' : 'Inactive' }}
              </UBadge>
            </div>
          </div>
        </UCard>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const config = useRuntimeConfig()
const auth = useAuthStore()

const pendingCount = ref(0)
const approvedCount = ref(0)
const rejectedCount = ref(0)
const usersCount = ref(0)
const recentLogs = ref([])
const loading = ref(false)
const systemStatus = ref({
  server: 'inactive',
  database: 'inactive',
  paperless: 'inactive'
})

function formatTimestamp(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('th-TH', { 
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  })
}

async function fetchDashboardStats() {
  if (!auth.isAuthenticated) return
  loading.value = true
  try {
    const [pendingRes, approvedRes, rejectedRes, usersRes, logsRes, statusRes] = await Promise.all([
      $fetch(`${config.public.apiBase}/api/pending`, { headers: { 'Authorization': `Bearer ${auth.token}` } }),
      $fetch(`${config.public.apiBase}/api/approved`, { headers: { 'Authorization': `Bearer ${auth.token}` } }),
      $fetch(`${config.public.apiBase}/api/rejected`, { headers: { 'Authorization': `Bearer ${auth.token}` } }),
      $fetch(`${config.public.apiBase}/api/users`, { headers: { 'Authorization': `Bearer ${auth.token}` } }),
      $fetch(`${config.public.apiBase}/api/logs?limit=5`, { headers: { 'Authorization': `Bearer ${auth.token}` } }),
      $fetch(`${config.public.apiBase}/api/status`, { headers: { 'Authorization': `Bearer ${auth.token}` } }).catch(err => {
        console.error('Fetch system status error:', err)
        return { server: 'inactive', database: 'inactive', paperless: 'inactive' }
      })
    ])
    
    pendingCount.value = pendingRes?.results?.length || pendingRes?.count || 0
    approvedCount.value = approvedRes?.results?.length || approvedRes?.count || 0
    rejectedCount.value = rejectedRes?.results?.length || rejectedRes?.count || 0
    usersCount.value = usersRes?.length || 0
    recentLogs.value = logsRes?.data || []
    systemStatus.value = statusRes || { server: 'inactive', database: 'inactive', paperless: 'inactive' }
  } catch (err) {
    console.error('Fetch stats error:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboardStats()
})
</script>
