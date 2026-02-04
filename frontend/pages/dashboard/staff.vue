<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold mb-6">Staff Dashboard - Upload Documents</h1>
    
    <UCard class="max-w-lg">
      <div class="space-y-4">
        <UFormGroup label="Document Title">
          <UInput v-model="title" placeholder="Enter document title" />
        </UFormGroup>
        
        <UFormGroup label="File">
          <input type="file" @change="handleFileChange" class="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-primary-50 file:text-primary-700
            hover:file:bg-primary-100
          "/>
        </UFormGroup>

        <UButton @click="upload" :loading="loading">Upload Document</UButton>
      </div>
    </UCard>
  </div>
</template>

<script setup>
const title = ref('')
const file = ref(null)
const loading = ref(false)
const config = useRuntimeConfig()
const auth = useAuthStore()

function handleFileChange(event) {
  file.value = event.target.files[0]
}

async function upload() {
  if (!file.value) return alert('Please select a file')
  
  loading.value = true
  const formData = new FormData()
  formData.append('file', file.value)
  if (title.value) formData.append('title', title.value)

  try {
    const { data, error } = await useFetch(`${config.public.apiBase}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.token}`
      },
      body: formData
    })
    
    if (error.value) {
      alert('Upload failed: ' + error.value.data?.error || error.value.message)
    } else {
      alert('Upload successful!')
      title.value = ''
      file.value = null
    }
  } catch (e) {
    alert('Error uploading')
  } finally {
    loading.value = false
  }
}
</script>
