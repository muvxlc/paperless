<template>
  <div class="h-screen w-screen flex flex-col lg:flex-row bg-gray-50 dark:bg-gray-950 font-sans antialiased text-gray-800 dark:text-gray-200 transition-colors duration-200 overflow-hidden">
    <!-- Authenticated Layout -->
    <div v-if="auth.isAuthenticated" class="h-full w-full flex flex-col lg:flex-row overflow-hidden">
      
      <!-- Mobile Top Bar (Tablet & Phone) -->
      <header class="lg:hidden flex items-center justify-between h-16 px-6 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shrink-0 z-20">
        <div class="flex items-center gap-3">
          <UButton
            icon="i-heroicons-bars-3"
            color="gray"
            variant="ghost"
            size="md"
            @click="isSidebarOpen = true"
            aria-label="Open menu"
          />
          <div class="flex items-center gap-2">
            <span class="text-xl">📄</span>
            <span class="text-lg font-bold text-orange-500 tracking-tight">Paperless</span>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <UButton
            :icon="isDark ? 'i-heroicons-moon' : 'i-heroicons-sun'"
            color="gray"
            variant="ghost"
            size="sm"
            @click="isDark = !isDark"
          />
          <UAvatar 
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" 
            alt="User" 
            size="sm"
          />
        </div>
      </header>

      <!-- Desktop Sidebar (Permanent on Left) -->
      <aside class="hidden lg:flex w-74 h-full bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 p-6 flex-col justify-between shrink-0 shadow-xs">
        <div class="space-y-8">
          <!-- Brand -->
          <div class="flex items-center gap-2 pl-2">
            <span class="text-2xl">📄</span>
            <span class="text-xl font-bold text-orange-500 tracking-tight">Paperless</span>
          </div>
          
          <!-- Navigation -->
          <nav class="space-y-1">
            <p class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 pl-2">Menu</p>
            <NuxtLink 
              v-for="item in navItems" 
              :key="item.to"
              :to="item.to" 
              class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150"
              :class="[
                $route.path === item.to 
                  ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold shadow-2xs' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              ]"
            >
              <UIcon :name="item.icon" class="w-5 h-5 shrink-0" /> 
              <span>{{ item.label }}</span>
            </NuxtLink>
          </nav>
        </div>

        <!-- Sidebar Footer -->
        <div class="space-y-4">
          <!-- Theme Toggle -->
          <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium font-sans">Dark Mode</span>
            <UToggle v-model="isDark" />
          </div>

          <!-- Profile Badge -->
          <div class="flex items-center gap-3 px-2 pt-2 border-t border-gray-100 dark:border-gray-800">
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

      <!-- Mobile Sidebar Drawer (Slides over from left) -->
      <USlideover v-model="isSidebarOpen" side="left" class="lg:hidden">
        <div class="h-full flex flex-col bg-white dark:bg-gray-900 p-6 justify-between">
          <div class="space-y-8">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-2xl">📄</span>
                <span class="text-xl font-bold text-orange-500 tracking-tight">Paperless</span>
              </div>
              <UButton
                icon="i-heroicons-x-mark"
                color="gray"
                variant="ghost"
                @click="isSidebarOpen = false"
              />
            </div>

            <nav class="space-y-1">
              <p class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 pl-2">Menu</p>
              <NuxtLink 
                v-for="item in navItems" 
                :key="item.to"
                :to="item.to" 
                class="flex items-center gap-3 px-4 py-3 rounded-xl transition"
                :class="[
                  $route.path === item.to 
                    ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                ]"
                @click="isSidebarOpen = false"
              >
                <UIcon :name="item.icon" class="w-5 h-5 shrink-0" /> 
                <span>{{ item.label }}</span>
              </NuxtLink>
            </nav>
          </div>

          <div class="space-y-4">
            <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
              <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">Dark Mode</span>
              <UToggle v-model="isDark" />
            </div>
            <div class="flex items-center gap-3 px-2 pt-2 border-t border-gray-100 dark:border-gray-800">
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
        </div>
      </USlideover>

      <!-- Main Workspace (Header + Content) -->
      <div class="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-white dark:bg-gray-900">
        
        <!-- Header -->
        <header class="flex justify-between items-center h-16 border-b border-gray-100 dark:border-gray-800 px-6 sm:px-8 shrink-0 bg-white dark:bg-gray-900 z-10">
          <div>
            <h2 class="text-lg font-bold text-gray-950 dark:text-white">
              {{ pageTitle }}
            </h2>
          </div>
          
          <!-- Search Bar & Controls -->
          <div class="flex items-center gap-4">
            <UInput
              v-model="searchQuery"
              icon="i-heroicons-magnifying-glass"
              placeholder="Search documents..."
              @keyup.enter="handleSearch"
              class="hidden sm:block w-64"
            />
            <button class="relative text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <UIcon name="i-heroicons-bell" class="w-6 h-6" />
              <span class="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        <!-- Page Scroll Container -->
        <main class="flex-1 overflow-y-auto p-6 sm:p-8 bg-amber-50/10 dark:bg-gray-950/20">
          <slot />
        </main>
      </div>

    </div>

    <!-- Unauthenticated Layout -->
    <div v-else class="h-full w-full flex items-center justify-center p-6 bg-amber-50/20 dark:bg-gray-950 overflow-y-auto">
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
const isSidebarOpen = ref(false)

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

const navItems = computed(() => {
  const items = [
    { label: 'Overview', to: dashboardPath.value, icon: 'i-heroicons-squares-2x2' }
  ]
  if (auth.role === 'staff' || auth.role === 'admin') {
    items.push({ label: 'Upload Documents', to: '/dashboard/staff', icon: 'i-heroicons-arrow-up-tray' })
  }
  if (auth.role === 'approver' || auth.role === 'admin') {
    items.push({ label: 'Approval Queue', to: '/dashboard/approver', icon: 'i-heroicons-check-badge' })
  }
  if (auth.role === 'admin') {
    items.push({ label: 'Manage Users', to: '/admin/users', icon: 'i-heroicons-users' })
    items.push({ label: 'Audit Logs', to: '/admin/logs', icon: 'i-heroicons-document-text' })
  }
  return items
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
