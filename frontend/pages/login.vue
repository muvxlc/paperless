<template>
  <div class="flex items-center justify-center min-h-screen w-full bg-gradient-to-br from-amber-50/60 to-orange-100/40 dark:from-gray-950 dark:to-gray-900 p-4">
    <UCard class="w-full max-w-md shadow-lg ring-1 ring-gray-100 dark:ring-gray-800 rounded-3xl p-4">
      <template #header>
        <div class="text-center py-4">
          <span class="text-4xl">👋</span>
          <h1 class="text-2xl font-bold text-gray-950 dark:text-white mt-3">Welcome to Paperless</h1>
          <p class="text-xs text-gray-400 mt-1">Please enter your credentials to login</p>
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
      </div>
    </UCard>
  </div>
</template>

<script setup>
const username = ref('')
const password = ref('')
const auth = useAuthStore()
const config = useRuntimeConfig()

async function login() {
  try {
    const { data, error } = await useFetch(`${config.public.apiBase}/api/auth/login`, {
        method: 'POST',
        body: { username: username.value, password: password.value }
    })

    if (data.value) {
        auth.setToken(data.value.token)
        auth.setUser({ role: data.value.role, username: username.value })
        
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
</script>
