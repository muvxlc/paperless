<template>
  <div class="flex items-center justify-center min-h-screen w-full bg-gradient-to-br from-amber-50/60 to-orange-100/40 dark:from-gray-950 dark:to-gray-900 p-4">
    <UCard class="w-full max-w-md shadow-lg ring-1 ring-gray-100 dark:ring-gray-800 rounded-3xl p-4">
      <template #header>
        <div class="text-center py-4">
          <span class="text-4xl">📄</span>
          <h1 class="text-2xl font-bold text-gray-950 dark:text-white mt-3">Welcome to Paperless</h1>
          <p class="text-xs text-gray-400 mt-1">Please enter your credentials or use Single Sign-On</p>
        </div>
      </template>

      <div class="space-y-5">
        <UFormGroup label="Username">
          <UInput v-model="username" icon="i-heroicons-user" placeholder="Enter username" size="lg" />
        </UFormGroup>
        <UFormGroup label="Password">
          <UInput v-model="password" type="password" icon="i-heroicons-key" placeholder="Enter password" size="lg" />
        </UFormGroup>
        <UButton block color="primary" size="lg" @click="login" class="mt-6 rounded-xl font-bold">
          Login
        </UButton>

        <div class="relative flex py-3 items-center">
          <div class="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
          <span class="flex-shrink mx-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">หรือเข้าสู่ระบบด้วย</span>
          <div class="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
        </div>

        <div class="grid grid-cols-1 gap-3">
          <UButton 
            block 
            color="indigo" 
            variant="soft" 
            size="lg" 
            icon="i-heroicons-identification" 
            @click="loginWithThaID" 
            class="rounded-xl font-bold py-3 text-sm flex items-center justify-center border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
          >
            เข้าสู่ระบบด้วย ThaID
          </UButton>
          <UButton 
            block 
            color="blue" 
            variant="soft" 
            size="lg" 
            icon="i-heroicons-shield-check" 
            @click="loginWithAuthentik" 
            class="rounded-xl font-bold py-3 text-sm flex items-center justify-center border border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-950/30"
          >
            เข้าสู่ระบบด้วย Authentik
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup>
const username = ref('')
const password = ref('')
const auth = useAuthStore()
const config = useRuntimeConfig()
const route = useRoute()

onMounted(async () => {
  // Capture OIDC callback query parameters if present
  const token = route.query.token
  const role = route.query.role
  const oidcUsername = route.query.username

  if (token && role && oidcUsername) {
    auth.setToken(token)
    auth.setUser({ role, username: decodeURIComponent(oidcUsername) })
    
    // Clean up URL query parameters
    window.history.replaceState({}, document.title, window.location.pathname)

    // Redirect to dashboard based on role
    if (role === 'staff') await navigateTo('/dashboard/staff', { external: true })
    else if (role === 'approver') await navigateTo('/dashboard/approver', { external: true })
    else if (role === 'user') await navigateTo('/dashboard/user', { external: true })
    else if (role === 'admin') await navigateTo('/dashboard/admin', { external: true })
    else await navigateTo('/', { external: true })
  }
})

async function login() {
  try {
    const { data, error } = await useFetch(`${config.public.apiBase}/api/auth/login`, {
        method: 'POST',
        body: { username: username.value, password: password.value }
    })

    if (data.value) {
        auth.setToken(data.value.token)
        auth.setUser({ role: data.value.role, username: data.value.username || username.value })
        
        const role = data.value.role
        if (role === 'staff') await navigateTo('/dashboard/staff', { external: true })
        else if (role === 'approver') await navigateTo('/dashboard/approver', { external: true })
        else if (role === 'user') await navigateTo('/dashboard/user', { external: true })
        else if (role === 'admin') await navigateTo('/dashboard/admin', { external: true })
        else await navigateTo('/', { external: true })
    } else if (error.value) {
        alert('Login failed')
    }
  } catch (e) {
      console.error(e)
  }
}

function loginWithThaID() {
  window.location.href = `${config.public.apiBase}/api/auth/thaid/login`
}

function loginWithAuthentik() {
  window.location.href = `${config.public.apiBase}/api/auth/authentik/login`
}
</script>
