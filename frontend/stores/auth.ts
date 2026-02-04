export const useAuthStore = defineStore('auth', () => {
    const token = useCookie('auth_token', {
        maxAge: 60 * 60 * 24 * 7 // 1 week
    })
    const user = useCookie<any>('auth_user', {
        maxAge: 60 * 60 * 24 * 7
    })

    const isAuthenticated = computed(() => !!token.value)
    const role = computed(() => user.value?.role)

    function setToken(t: string) {
        token.value = t
    }

    function setUser(u: any) {
        user.value = u
    }

    function logout() {
        token.value = null
        user.value = null
        navigateTo('/login')
    }

    return {
        token,
        user,
        isAuthenticated,
        role,
        setToken,
        setUser,
        logout
    }
})
