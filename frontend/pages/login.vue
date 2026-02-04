<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-100">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-xl font-semibold">Login</h1>
      </template>

      <div class="space-y-4">
        <UFormGroup label="Username">
          <UInput v-model="username" />
        </UFormGroup>
        <UFormGroup label="Password">
          <UInput v-model="password" type="password" />
        </UFormGroup>
        <UButton block @click="login">Login</UButton>
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
    const { data, error } = await useFetch(`${config.public.apiBase}/auth/login`, {
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
