<template>
  <div class="p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">User Management</h1>
      <UButton icon="i-heroicons-plus" color="black" @click="openModal()">Add User</UButton>
    </div>

    <UCard>
      <UTable :columns="columns" :rows="users" :loading="loading">
        <template #role-data="{ row }">
          <UBadge :color="getRoleColor(row.role)" variant="subtle">{{ row.role }}</UBadge>
        </template>
        <template #actions-data="{ row }">
          <div class="flex gap-2">
            <UButton icon="i-heroicons-pencil-square" color="gray" variant="ghost" size="xs" @click="openModal(row)" />
            <UButton icon="i-heroicons-trash" color="red" variant="ghost" size="xs" @click="confirmDelete(row)" />
          </div>
        </template>
      </UTable>
    </UCard>

    <!-- User Modal -->
    <UModal v-model="isOpen">
      <UCard>
        <template #header>
          <h3 class="font-semibold">{{ isEditing ? 'Edit User' : 'Add User' }}</h3>
        </template>

        <form @submit.prevent="saveUser" class="space-y-4">
          <UFormGroup label="Username" required>
            <UInput v-model="form.username" />
          </UFormGroup>

          <UFormGroup label="Name">
            <UInput v-model="form.name" />
          </UFormGroup>

          <UFormGroup label="Password" :required="!isEditing" :help="isEditing ? 'Leave blank to keep current password' : ''">
            <UInput v-model="form.password" type="password" />
          </UFormGroup>

          <UFormGroup label="Role" required>
            <USelect v-model="form.role" :options="roles" />
          </UFormGroup>

          <div class="flex justify-end gap-2 pt-4">
            <UButton color="gray" variant="ghost" @click="isOpen = false">Cancel</UButton>
            <UButton type="submit" color="black" :loading="saving">Save</UButton>
          </div>
        </form>
      </UCard>
    </UModal>
  </div>
</template>

<script setup>
const config = useRuntimeConfig()
const auth = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const users = ref([])
const isOpen = ref(false)
const isEditing = ref(false)

const form = reactive({
  id: null,
  username: '',
  password: '',
  name: '',
  role: 'user'
})

const roles = [
  { label: 'Admin', value: 'admin' },
  { label: 'Approver', value: 'approver' },
  { label: 'User', value: 'user' }
]

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'username', label: 'Username' },
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'actions', label: 'Actions' }
]

function getRoleColor(role) {
  switch (role) {
    case 'admin': return 'red'
    case 'approver': return 'orange'
    case 'user': return 'green'
    default: return 'gray'
  }
}

async function fetchUsers() {
  if (!auth.isAuthenticated) return
  loading.value = true
  try {
    // Reuse the generic /api/users endpoint which we upgraded to support full list for admins
    const data = await $fetch(`${config.public.apiBase}/api/users`, {
      headers: { 'Authorization': `Bearer ${auth.token}` }
    })
    users.value = data
  } catch (err) {
    alert('Failed to load users: ' + err.message)
  } finally {
    loading.value = false
  }
}

function openModal(user = null) {
  if (user) {
    isEditing.value = true
    form.id = user.id
    form.username = user.username
    form.password = '' // Don't show hash
    form.name = user.name || ''
    form.role = user.role
  } else {
    isEditing.value = false
    form.id = null
    form.username = ''
    form.password = ''
    form.name = ''
    form.role = 'user'
  }
  isOpen.value = true
}

async function saveUser() {
  if (!form.username || (!isEditing.value && !form.password)) {
    alert('Please fill in required fields')
    return
  }

  saving.value = true
  try {
    if (isEditing.value) {
      await $fetch(`${config.public.apiBase}/api/users/${form.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${auth.token}` },
        body: { username: form.username, password: form.password || undefined, name: form.name, role: form.role }
      })
    } else {
      await $fetch(`${config.public.apiBase}/api/users`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}` },
        body: { username: form.username, password: form.password, name: form.name, role: form.role }
      })
    }
    isOpen.value = false
    fetchUsers()
  } catch (err) {
    alert('Failed to save: ' + err.message)
  } finally {
    saving.value = false
  }
}

async function confirmDelete(user) {
  if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) return

  try {
    await $fetch(`${config.public.apiBase}/api/users/${user.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${auth.token}` }
    })
    fetchUsers()
  } catch (err) {
    alert('Failed to delete: ' + err.message)
  }
}

onMounted(() => {
  fetchUsers()
})
</script>
