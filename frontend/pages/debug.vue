<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold">Debug Auth</h1>
    <pre class="bg-gray-100 p-4 rounded mt-4">
Is Authenticated: {{ auth.isAuthenticated }}
Role: {{ auth.role }}
Token: {{ auth.token }}
User Object: {{ auth.user }}
    </pre>
    <UButton to="/login" class="mt-4">Go to Login</UButton>
  </div>
</template>

<script setup>
const auth = useAuthStore()
</script>
