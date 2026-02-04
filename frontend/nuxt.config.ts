export default defineNuxtConfig({
    modules: ['@nuxt/ui', '@pinia/nuxt'],
    runtimeConfig: {
        public: {
            apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001'
        }
    },
    ui: {
        global: true,
    },
    devtools: { enabled: true }
})
