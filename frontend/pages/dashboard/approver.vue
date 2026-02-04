<template>
  <div class="p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Approver Dashboard</h1>
      <div class="flex items-center gap-4">
        <span class="text-sm text-gray-500">Filter by Uploader:</span>
        <USelect v-model="selectedUser" :options="userOptions" placeholder="All Users" class="w-48" />
        <UButton icon="i-heroicons-arrow-path" color="gray" variant="ghost" @click="fetchData(true)" :loading="pending" />
      </div>
    </div>

    <UTabs :items="tabs" v-model="activeTab" class="w-full">
      <template #item="{ item }">
        <div class="mt-4">
          <div v-if="pending" class="text-center py-10">
             <UIcon name="i-heroicons-arrow-path" class="animate-spin text-4xl text-gray-400" />
          </div>
          
          <div v-else-if="filteredDocs.length === 0" class="text-gray-500 text-center py-10 border-2 border-dashed border-gray-200 rounded-lg">
            No documents found in "{{ item.label }}".
          </div>

          <div v-else class="grid gap-4">
            <UCard v-for="doc in filteredDocs" :key="doc.id" class="hover:shadow-md transition-shadow">
              <div class="flex justify-between items-center">
                <div class="flex items-start gap-4">
                  <UIcon :name="item.key === 'pending' ? 'i-heroicons-document-magnifying-glass' : 'i-heroicons-check-badge'" 
                         :class="item.key === 'pending' ? 'text-blue-500' : 'text-green-500'" 
                         class="text-2xl mt-1" />
                  <div>
                    <h3 class="font-semibold text-lg">{{ doc.title }}</h3>
                    <div class="flex items-center gap-2 text-sm text-gray-500 mt-1">
                       <UBadge size="xs" color="gray" variant="soft" icon="i-heroicons-user">{{ doc.owner_name || 'System' }}</UBadge>
                       <span>&bull;</span>
                       <span>Uploaded: {{ formatTimestamp(doc.created_date || doc.created) }}</span>
                    </div>
                  </div>
                </div>
                
                <div class="flex gap-2">
                  <!-- View: All Tabs -->
                  <UButton color="gray" variant="ghost" icon="i-heroicons-eye" :to="`${config.public.apiBase}/api/download/${doc.id}?token=${auth.token}`" target="_blank">View</UButton>
                  
                  <!-- Approve: Pending & Rejected -->
                  <UButton v-if="item.key === 'pending' || item.key === 'rejected'" color="green" icon="i-heroicons-check" @click="openApproveModal(doc.id)">Approve</UButton>
                  
                  <!-- Reject: Pending Only -->
                  <UButton v-if="item.key === 'pending'" color="red" variant="soft" icon="i-heroicons-x-mark" label="Reject" @click="reject(doc.id)" />
                  
                  <!-- Undo Approval: Approved Only (Moves back to Pending) -->
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

            <p class="text-sm text-gray-500">Select users who are allowed to see this document:</p>
            
            <div class="max-h-60 overflow-y-auto space-y-2 border rounded p-2">
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
const config = useRuntimeConfig()
const auth = useAuthStore()
const pendingDocs = ref([])
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
  if (activeTab.value === 0) return pendingDocs.value
  if (activeTab.value === 1) return approvedDocs.value
  return rejectedDocs.value
})

const filteredDocs = computed(() => {
  if (!selectedUser.value) return currentDocs.value
  return currentDocs.value.filter(doc => doc.owner_name === selectedUser.value)
})

function selectAll() {
    selectedUserIds.value = targetUsers.value.map(u => u.id)
}

function openApproveModal(id) {
    selectedDocId.value = id
    selectedUserIds.value = []
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
        fetchData()
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
    let endpoint = '/api/pending'
    if (activeTab.value === 1) endpoint = '/api/approved'
    else if (activeTab.value === 2) endpoint = '/api/rejected'

    const data = await $fetch(`${config.public.apiBase}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${auth.token}` },
        params: forceRefetch ? { t: Date.now() } : {}
    })
    
    if (activeTab.value === 0) {
      pendingDocs.value = data?.results || (Array.isArray(data) ? data : [])
    } else if (activeTab.value === 1) {
      approvedDocs.value = data?.results || (Array.isArray(data) ? data : [])
    } else {
      rejectedDocs.value = data?.results || (Array.isArray(data) ? data : [])
    }
  } catch (err) {
    console.error('Fetch data error:', err)
    if (activeTab.value === 2) rejectedDocs.value = [] // clear on error
  } finally {
    pending.value = false
  }
}

watch(activeTab, () => {
  fetchData()
})

async function reject(id) {
  if (!confirm('Are you sure you want to reject this document?')) return

  try {
    await $fetch(`${config.public.apiBase}/api/reject/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}` }
    })
    fetchData()
  } catch (err) {
    alert('Failed to reject: ' + err.message)
  }
}

async function restore(id, isUndo = false) {
    const msg = isUndo ? 'Undo approval and move back to Pending?' : 'Move back to Pending?'
    if (!confirm(msg)) return
    try {
        await $fetch(`${config.public.apiBase}/api/restore/${id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${auth.token}` }
        })
        fetchData()
    } catch (err) {
        alert('Failed to restore: ' + err.message)
    }
}

onMounted(() => {
    fetchUsers()
    fetchData()
})
</script>
