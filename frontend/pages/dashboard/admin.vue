<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">Admin Dashboard</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <UCard>
        <template #header>
          <div class="font-semibold">System Status</div>
        </template>
        <div class="space-y-2">
          <div class="flex justify-between">
            <span>Server Status:</span>
            <UBadge color="green">Online</UBadge>
          </div>
          <div class="flex justify-between">
            <span>Database:</span>
            <UBadge color="green">Connected</UBadge>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="font-semibold">Quick Actions</div>
        </template>
        <div class="space-y-4">
          <UButton to="/dashboard/staff" block variant="soft" icon="i-heroicons-document-plus">
            Go into Staff Mode (Upload)
          </UButton>
          <UButton to="/dashboard/approver" block variant="soft" icon="i-heroicons-check-circle">
            Go into Approver Mode
          </UButton>
          <hr class="border-gray-100 dark:border-gray-800" />
          <UButton to="/admin/users" block color="black" icon="i-heroicons-users">
            User Management
          </UButton>
          <UButton to="/admin/logs" block color="gray" icon="i-heroicons-clipboard-document-list">
            Audit Logs
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
// Middleware is global
</script>
