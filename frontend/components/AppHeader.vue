<template>
  <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4">
    <div class="container mx-auto flex items-center justify-between">
      <div class="flex items-center gap-4">
        <UButton
          icon="i-heroicons-arrow-left"
          color="gray"
          variant="ghost"
          @click="$router.back()"
          aria-label="Back"
        />
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">
          Paperless
        </h1>
      </div>

        <div class="flex items-center gap-2">
          <UInput
            v-model="searchQuery"
            icon="i-heroicons-magnifying-glass"
            placeholder="Search docs..."
            @keyup.enter="handleSearch"
            class="w-64"
          />
        </div>

      <div class="flex items-center gap-4" v-if="auth.isAuthenticated">
        <UBadge color="primary" variant="subtle" class="capitalize">
          {{ auth.role }}
        </UBadge>
        <UButton
          v-if="auth.role === 'admin'"
          icon="i-heroicons-users"
          color="gray"
          variant="ghost"
          label="Manage Users"
          to="/admin/users"
        />
        <UButton
          icon="i-heroicons-arrow-right-start-on-rectangle"
          color="red"
          variant="ghost"
          label="Logout"
          @click="handleLogout"
        />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const router = useRouter()
const searchQuery = ref('')

async function handleLogout() {
  auth.logout()
}

function handleSearch() {
  if (searchQuery.value.trim()) {
      router.push({ path: '/dashboard/search', query: { q: searchQuery.value } })
  }
}
</script>
