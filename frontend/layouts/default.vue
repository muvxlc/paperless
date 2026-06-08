<template>
  <div class="min-h-screen bg-amber-50/20 dark:bg-gray-950 font-sans antialiased text-gray-800 dark:text-gray-200 transition-colors duration-200">
    <!-- Authenticated Layout with Sidebar -->
    <div v-if="auth.isAuthenticated" class="max-w-[1600px] mx-auto min-h-screen flex flex-col md:flex-row p-0 md:p-6 gap-0 md:gap-6">
      
      <!-- Left Sidebar -->
      <aside class="w-full md:w-64 bg-white dark:bg-gray-900 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 p-6 flex flex-col justify-between shrink-0 rounded-none md:rounded-[2rem] shadow-sm">
        <div class="space-y-8">
          <!-- Logo / Brand -->
          <div class="flex items-center justify-between pl-2">
            <div class="flex items-center gap-2">
              <span class="text-2xl">👋</span>
              <span class="text-xl font-bold text-orange-500 tracking-tight">Paperless</span>
            </div>
            <!-- Mobile Menu Toggle or Theme toggle -->
            <div class="md:hidden flex items-center gap-2">
              <UButton
                :icon="isDark ? 'i-heroicons-moon' : 'i-heroicons-sun'"
                color="gray"
                variant="ghost"
                @click="isDark = !isDark"
              />
            </div>
          </div>
          
          <!-- Navigation Menu -->
          <nav class="space-y-1">
            <p class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 pl-2">Menu</p>
            
            <!-- Link to Role-specific Dashboard -->
            <NuxtLink 
              :to="dashboardPath" 
              class="flex items-center gap-3 px-4 py-3 rounded-xl transition"
              :class="[
                $route.path === dashboardPath 
                  ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-medium' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              ]"
            >
              <UIcon name="i-heroicons-squares-2x2" class="w-5 h-5" /> 
              Overview
            </NuxtLink>

            <!-- Staff Mode (Upload) Link (if Staff or Admin) -->
            <NuxtLink 
              v-if="auth.role === 'staff' || auth.role === 'admin'"
              to="/dashboard/staff" 
              class="flex items-center gap-3 px-4 py-3 rounded-xl transition"
              :class="[
                $route.path === '/dashboard/staff' 
                  ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-medium' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              ]"
            >
              <UIcon name="i-heroicons-arrow-up-tray" class="w-5 h-5" /> 
              Upload Documents
            </NuxtLink>

            <!-- Approver Mode Link (if Approver or Admin) -->
            <NuxtLink 
              v-if="auth.role === 'approver' || auth.role === 'admin'"
              to="/dashboard/approver" 
              class="flex items-center gap-3 px-4 py-3 rounded-xl transition"
              :class="[
                $route.path === '/dashboard/approver' 
                  ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-medium' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              ]"
            >
              <UIcon name="i-heroicons-check-badge" class="w-5 h-5" /> 
              Approval Queue
            </NuxtLink>

            <!-- User Management Link (if Admin) -->
            <NuxtLink 
              v-if="auth.role === 'admin'"
              to="/admin/users" 
              class="flex items-center gap-3 px-4 py-3 rounded-xl transition"
              :class="[
                $route.path === '/admin/users' 
                  ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-medium' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              ]"
            >
              <UIcon name="i-heroicons-users" class="w-5 h-5" /> 
              Manage Users
            </NuxtLink>

            <!-- Audit Logs Link (if Admin) -->
            <NuxtLink 
              v-if="auth.role === 'admin'"
              to="/admin/logs" 
              class="flex items-center gap-3 px-4 py-3 rounded-xl transition"
              :class="[
                $route.path === '/admin/logs' 
                  ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-medium' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              ]"
            >
              <UIcon name="i-heroicons-document-text" class="w-5 h-5" /> 
              Audit Logs
            </NuxtLink>
          </nav>
        </div>

        <!-- Sidebar Footer Actions -->
        <div class="mt-8 space-y-4">
          <!-- Theme Toggle -->
          <div class="hidden md:flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">Dark Mode</span>
            <UToggle v-slot="{ active }" v-model="isDark" />
          </div>

          <!-- Logged-in User Info -->
          <div class="flex items-center gap-3 px-2">
            <UAvatar 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" 
              alt="User" 
              size="sm"
            />
            <div class="min-w-0 flex-1">
              <p class="text-xs font-bold text-gray-800 dark:text-white truncate capitalize">{{ auth.user?.username || 'User' }}</p>
              <p class="text-[10px] text-gray-400 truncate capitalize">{{ auth.role }}</p>
            </div>
            <UButton
              icon="i-heroicons-arrow-right-on-rectangle"
              color="red"
              variant="ghost"
              size="xs"
              @click="handleLogout"
            />
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-none md:rounded-[2rem] shadow-xs overflow-hidden">
        
        <!-- Header -->
        <header class="flex flex-col sm:flex-row justify-between items-center border-b border-gray-100 dark:border-gray-800 p-6 gap-4">
          <div>
            <h2 class="text-xl font-bold text-gray-800 dark:text-white">
              {{ pageTitle }}
            </h2>
            <p class="text-xs text-gray-400 mt-0.5">Welcome back, nice to see you again!</p>
          </div>
          
          <!-- Search Bar & Back buttons -->
          <div class="flex items-center gap-3 w-full sm:w-auto">
            <UInput
              v-model="searchQuery"
              icon="i-heroicons-magnifying-glass"
              placeholder="Search documents..."
              @keyup.enter="handleSearch"
              class="w-full sm:w-64"
            />
            <button class="relative text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <UIcon name="i-heroicons-bell" class="w-6 h-6" />
              <span class="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        <!-- Dynamic Content Slot -->
        <main class="flex-1 p-6 md:p-8 overflow-y-auto">
          <slot />
        </main>
      </div>

    </div>

    <!-- Unauthenticated Layout (e.g. Login, Home) -->
    <div v-else class="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-amber-50/20 dark:bg-gray-950">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const colorMode = useColorMode()

const searchQuery = ref('')

// Computed color mode toggle
const isDark = computed({
  get () {
    return colorMode.value === 'dark'
  },
  set (val) {
    colorMode.preference = val ? 'dark' : 'light'
  }
})

const dashboardPath = computed(() => {
  if (auth.role === 'admin') return '/dashboard/admin'
  if (auth.role === 'approver') return '/dashboard/approver'
  if (auth.role === 'staff') return '/dashboard/staff'
  return '/dashboard/user'
})

const pageTitle = computed(() => {
  const path = route.path
  if (path === dashboardPath.value) return 'Overview'
  if (path === '/dashboard/staff') return 'Upload Documents'
  if (path === '/dashboard/approver') return 'Approval Queue'
  if (path === '/admin/users') return 'User Management'
  if (path === '/admin/logs') return 'System Audit Logs'
  return 'Document Center'
})

async function handleLogout() {
  auth.logout()
  await navigateTo('/login')
}

function handleSearch() {
  if (searchQuery.value.trim()) {
    router.push({ path: '/dashboard/search', query: { q: searchQuery.value } })
  }
}
</script>
