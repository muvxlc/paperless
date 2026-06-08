<template>
  <div class="space-y-8">
    <!-- Header with controls -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-white">Approver Dashboard</h1>
        <p class="text-xs text-gray-400 mt-0.5">Review, approve, or reject uploaded documents.</p>
      </div>
      <div class="flex items-center gap-3 w-full sm:w-auto">
        <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">Filter by Uploader:</span>
        <USelect v-model="selectedUser" :options="userOptions" placeholder="All Users" class="w-48" />
        <UButton icon="i-heroicons-arrow-path" color="gray" variant="ghost" @click="fetchData(true)" :loading="pending" />
      </div>
    </div>

    <!-- Stats Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-6">
      <!-- Pending Card -->
      <div class="bg-gradient-to-br from-blue-400 to-indigo-500 p-5 rounded-2xl text-white shadow-xs relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200 cursor-pointer" @click="activeTab = 0">
        <div class="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-300">
          <UIcon name="i-heroicons-clock" class="w-20 h-20" />
        </div>
        <p class="text-xs opacity-90 font-medium mb-1">Pending Review</p>
        <p class="text-3xl font-extrabold tracking-tight">{{ pendingDocs.length }}</p>
        <p class="text-[11px] opacity-75 mt-1">Requires approval</p>
      </div>

      <!-- User Requests Card -->
      <div class="bg-gradient-to-br from-amber-400 to-orange-500 p-5 rounded-2xl text-white shadow-xs relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200 cursor-pointer" @click="activeTab = 1">
        <div class="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-300">
          <UIcon name="i-heroicons-user-group" class="w-20 h-20" />
        </div>
        <p class="text-xs opacity-90 font-medium mb-1">User Requests</p>
        <p class="text-3xl font-extrabold tracking-tight">{{ requestDocs.length }}</p>
        <p class="text-[11px] opacity-75 mt-1">Files requested by users</p>
      </div>

      <!-- Approved Card -->
      <div class="bg-gradient-to-br from-emerald-400 to-teal-500 p-5 rounded-2xl text-white shadow-xs relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200 cursor-pointer" @click="activeTab = 2">
        <div class="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-300">
          <UIcon name="i-heroicons-check-circle" class="w-20 h-20" />
        </div>
        <p class="text-xs opacity-90 font-medium mb-1">Approved Documents</p>
        <p class="text-3xl font-extrabold tracking-tight">{{ approvedDocs.length }}</p>
        <p class="text-[11px] opacity-75 mt-1">Granted user access</p>
      </div>

      <!-- Rejected Card -->
      <div class="bg-gradient-to-br from-red-400 to-rose-500 p-5 rounded-2xl text-white shadow-xs relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200 cursor-pointer" @click="activeTab = 3">
        <div class="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-300">
          <UIcon name="i-heroicons-x-circle" class="w-20 h-20" />
        </div>
        <p class="text-xs opacity-90 font-medium mb-1">Rejected Documents</p>
        <p class="text-3xl font-extrabold tracking-tight">{{ rejectedDocs.length }}</p>
        <p class="text-[11px] opacity-75 mt-1">Declined access</p>
      </div>
    </div>

    <!-- Tabs and Document Queue -->
    <UTabs :items="tabs" v-model="activeTab" class="w-full">
      <template #item="{ item }">
        <div class="mt-4">
          <div v-if="pending" class="text-center py-12">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin text-4xl text-gray-400" />
          </div>
          
          <div v-else-if="filteredDocs.length === 0" class="text-gray-500 dark:text-gray-400 text-center py-12 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
            <UIcon name="i-heroicons-folder-open" class="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p class="font-medium text-sm">No documents found</p>
            <p class="text-xs text-gray-400 mt-1">There are no files in the "{{ item.label }}" state matching the filters.</p>
          </div>

          <div v-else class="grid gap-4">
            <UCard 
              v-for="doc in filteredDocs" 
              :key="doc.id" 
              class="hover:shadow-md transition-shadow ring-1 ring-gray-100 dark:ring-gray-800"
            >
              <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex items-start gap-4 min-w-0 flex-1">
                  <div class="p-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-gray-500 shrink-0">
                    <UIcon 
                      :name="item.key === 'pending' || item.key === 'requests' ? 'i-heroicons-document-magnifying-glass' : (item.key === 'approved' ? 'i-heroicons-check-badge' : 'i-heroicons-x-circle')" 
                      :class="['text-2xl', item.key === 'pending' ? 'text-blue-500' : (item.key === 'requests' ? 'text-amber-500' : (item.key === 'approved' ? 'text-green-500' : 'text-red-500'))]" 
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="font-bold text-gray-800 dark:text-white truncate">{{ doc.title }}</h3>
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1.5">
                      <span class="flex items-center gap-1">
                        <UIcon name="i-heroicons-user" class="w-3.5 h-3.5" />
                        Uploaded by: <span class="font-semibold text-orange-500">{{ doc.owner_name || 'System' }}</span>
                      </span>
                      <span>&bull;</span>
                      <span class="flex items-center gap-1">
                        <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
                        Uploaded: {{ formatTimestamp(doc.created_date || doc.created) }}
                      </span>
                      <span v-if="doc.expires_at" class="flex items-center gap-1 text-red-500">
                        <span>&bull;</span>
                        <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" />
                        Expires: {{ formatTimestamp(doc.expires_at) }}
                      </span>
                      <span v-if="doc.comment && item.key === 'rejected'" class="flex items-center gap-1 text-red-500 font-semibold">
                        <span>&bull;</span>
                        <UIcon name="i-heroicons-chat-bubble-left-right" class="w-3.5 h-3.5" />
                        Reason: {{ doc.comment }}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <!-- View: All Tabs -->
                  <UButton color="gray" variant="ghost" icon="i-heroicons-eye" :to="`${config.public.apiBase}/api/download/${doc.id}?token=${auth.token}&inline=true`" target="_blank">
                    View
                  </UButton>
                  
                  <!-- Approve: Pending, Requests & Rejected -->
                  <UButton v-if="item.key === 'pending' || item.key === 'requests' || item.key === 'rejected'" color="green" icon="i-heroicons-check" @click="openApproveModal(doc.id, doc.owner_id)">
                    Approve
                  </UButton>
                  
                  <!-- Reject: Pending & Requests Only -->
                  <UButton v-if="item.key === 'pending' || item.key === 'requests'" color="red" variant="soft" icon="i-heroicons-x-mark" label="Reject" @click="reject(doc.id, item.key === 'requests' ? doc.request_id : null)" />
                  
                  <!-- Undo Approval: Approved Only -->
                  <UButton v-if="item.key === 'approved'" color="orange" variant="soft" icon="i-heroicons-arrow-uturn-left" label="Undo Approval" @click="restore(doc.id, true)" />

                  <!-- Restore: Rejected Only -->
                  <UButton v-if="item.key === 'rejected'" color="gray" variant="soft" icon="i-heroicons-arrow-path" label="Restore" @click="restore(doc.id)" />
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </template>
    </UTabs>

    <!-- Approval Modal -->
    <UModal v-model="isApproveModalOpen">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
              Approve Document
            </h3>
            <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" class="-my-1" @click="isApproveModalOpen = false" />
          </div>
        </template>

        <div class="p-4 space-y-4">
            <!-- Expiration Duration -->
            <div>
                 <p class="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Expiration Duration (Days)</p>
                 <div class="flex gap-4">
                     <label v-for="days in [5, 7, 10, 15]" :key="days" class="flex items-center gap-1 cursor-pointer">
                         <input type="radio" name="expiration" :value="days" v-model="selectedExpiration" class="accent-green-500" />
                         <span class="text-sm text-gray-700 dark:text-gray-300">{{ days }} Days</span>
                     </label>
                 </div>
            </div>

            <!-- Download Permission -->
            <div>
                 <p class="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Permissions</p>
                 <UCheckbox v-model="allowDownload" label="Allow Download (Uncheck for View Only)" />
            </div>

            <hr class="border-gray-200 dark:border-gray-700" />

            <p class="text-xs text-gray-500 mb-2">Select users who are allowed to see this document:</p>
            
            <div class="max-h-60 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div v-for="u in targetUsers" :key="u.id" class="flex items-center gap-2">
                    <UCheckbox :id="`user-${u.id}`" v-model="selectedUserIds" :value="u.id" :label="u.username" />
                </div>
                <div v-if="targetUsers.length === 0" class="text-xs text-gray-400 italic">No users found to assign.</div>
            </div>

            <div class="flex items-center gap-2 mt-2">
                <UButton size="xs" color="gray" @click="selectAll">Select All</UButton>
                <UButton size="xs" color="gray" @click="selectedUserIds = []">Deselect All</UButton>
            </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" @click="isApproveModalOpen = false">Cancel</UButton>
            <UButton color="green" :loading="approving" @click="confirmApprove">Confirm Approval</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const config = useRuntimeConfig()
const auth = useAuthStore()
const pendingDocs = ref([])
const requestDocs = ref([])
const approvedDocs = ref([])
const rejectedDocs = ref([])
const availableUsers = ref([])
const pending = ref(false)
const approving = ref(false)
const activeTab = ref(0)
const selectedUser = ref(null)

// Approval Modal State
const isApproveModalOpen = ref(false)
const selectedDocId = ref(null)
const selectedUserIds = ref([])
const selectedExpiration = ref(5) // Default 5 days
const allowDownload = ref(false) // Default false (View Only)

const tabs = [
  { key: 'pending', label: 'Pending Approvals' },
  { key: 'requests', label: 'User Requests' },
  { key: 'approved', label: 'Recently Approved' },
  { key: 'rejected', label: 'Rejected Documents' }
]

const userOptions = computed(() => {
  const options = [{ label: 'All Users', value: null }]
  availableUsers.value.forEach(u => {
    options.push({ label: u.username, value: u.username })
  })
  return options
})

const targetUsers = computed(() => {
    // Only users with role 'user' can see approved docs
    return availableUsers.value.filter(u => u.role === 'user')
})

const currentDocs = computed(() => {
  const tabIdx = Number(activeTab.value)
  if (tabIdx === 0) return pendingDocs.value
  if (tabIdx === 1) return requestDocs.value
  if (tabIdx === 2) return approvedDocs.value
  return rejectedDocs.value
})

const filteredDocs = computed(() => {
  if (!selectedUser.value) return currentDocs.value
  return currentDocs.value.filter(doc => doc.owner_name === selectedUser.value)
})

function selectAll() {
    selectedUserIds.value = targetUsers.value.map(u => u.id)
}

function openApproveModal(id, ownerId = null) {
    selectedDocId.value = id
    selectedUserIds.value = ownerId ? [ownerId] : []
    selectedExpiration.value = 5
    allowDownload.value = false
    isApproveModalOpen.value = true
}

async function confirmApprove() {
    if (selectedUserIds.value.length === 0) {
        if (!confirm('No users selected. Only Admins/Approvers will see this. Continue?')) return
    }
    
    approving.value = true
    try {
        await $fetch(`${config.public.apiBase}/api/approve/${selectedDocId.value}`, {
            method: 'POST',
            body: { 
                userIds: selectedUserIds.value,
                expirationDays: selectedExpiration.value,
                canDownload: allowDownload.value
            },
            headers: { 'Authorization': `Bearer ${auth.token}` }
        })
        
        isApproveModalOpen.value = false
        fetchData(true)
    } catch (err) {
        alert('Failed to approve: ' + err.message)
    } finally {
        approving.value = false
    }
}

function formatTimestamp(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('th-TH', { 
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  })
}

async function fetchUsers() {
  try {
    const data = await $fetch(`${config.public.apiBase}/api/users`, {
      headers: { 'Authorization': `Bearer ${auth.token}` }
    })
    if (data) {
      availableUsers.value = data
    }
  } catch (err) {
    console.error('Fetch users error:', err)
  }
}

async function fetchData(forceRefetch = false) {
  pending.value = true
  try {
    const [pendingRes, requestsRes, approvedRes, rejectedRes] = await Promise.all([
      $fetch(`${config.public.apiBase}/api/pending`, {
        headers: { 'Authorization': `Bearer ${auth.token}` },
        params: forceRefetch ? { t: Date.now() } : {}
      }),
      $fetch(`${config.public.apiBase}/api/requests`, {
        headers: { 'Authorization': `Bearer ${auth.token}` },
        params: forceRefetch ? { t: Date.now() } : {}
      }),
      $fetch(`${config.public.apiBase}/api/approved`, {
        headers: { 'Authorization': `Bearer ${auth.token}` },
        params: forceRefetch ? { t: Date.now() } : {}
      }),
      $fetch(`${config.public.apiBase}/api/rejected`, {
        headers: { 'Authorization': `Bearer ${auth.token}` },
        params: forceRefetch ? { t: Date.now() } : {}
      })
    ])
    
    pendingDocs.value = pendingRes?.results || (Array.isArray(pendingRes) ? pendingRes : [])
    requestDocs.value = requestsRes?.results || (Array.isArray(requestsRes) ? requestsRes : [])
    approvedDocs.value = approvedRes?.results || (Array.isArray(approvedRes) ? approvedRes : [])
    rejectedDocs.value = rejectedRes?.results || (Array.isArray(rejectedRes) ? rejectedRes : [])
  } catch (err) {
    console.error('Fetch data error:', err)
  } finally {
    pending.value = false
  }
}

async function reject(id, requestId = null) {
  const comment = prompt('โปรดระบุเหตุผลในการปฏิเสธคำขอนี้ (ไม่บังคับ):')
  if (comment === null) return // User cancelled the prompt

  try {
    const url = requestId 
      ? `${config.public.apiBase}/api/reject-request/${requestId}` 
      : `${config.public.apiBase}/api/reject/${id}`;
      
    await $fetch(url, {
        method: 'POST',
        body: { comment },
        headers: { 'Authorization': `Bearer ${auth.token}` }
    })
    fetchData(true)
  } catch (err) {
    alert('Failed to reject: ' + err.message)
  }
}

async function restore(id, isUndo = false) {
    const msg = isUndo ? 'Undo approval and move back to Pending/Request queue?' : 'Move back to Pending/Request queue?'
    if (!confirm(msg)) return
    try {
        await $fetch(`${config.public.apiBase}/api/restore/${id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${auth.token}` }
        })
        fetchData(true)
    } catch (err) {
        alert('Failed to restore: ' + err.message)
    }
}

onMounted(() => {
    fetchUsers()
    fetchData()
})
</script>
