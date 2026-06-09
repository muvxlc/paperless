export default defineNuxtRouteMiddleware((to, from) => {
    const auth = useAuthStore()

    // If user is not authenticated and trying to access dashboard/admin, redirect to login
    if (!auth.isAuthenticated && (to.path.startsWith('/dashboard') || to.path.startsWith('/admin'))) {
        return navigateTo('/login')
    }

    // If user is authenticated
    if (auth.isAuthenticated) {
        // Redirect from login page OR root page to their dashboard
        if (to.path === '/login' || to.path === '/') {
            if (auth.role === 'staff') return navigateTo('/dashboard/staff')
            if (auth.role === 'approver') return navigateTo('/dashboard/approver')
            if (auth.role === 'user') return navigateTo('/dashboard/user')
            if (auth.role === 'admin') return navigateTo('/dashboard/admin')
        }
    }

    // Role-based protection
    if (to.path.startsWith('/dashboard/staff') && auth.role !== 'staff' && auth.role !== 'admin') {
        return navigateTo('/')
    }
    if (to.path.startsWith('/dashboard/approver') && auth.role !== 'approver' && auth.role !== 'admin') {
        return navigateTo('/')
    }
    if (to.path.startsWith('/dashboard/user') && auth.role !== 'user' && auth.role !== 'admin') {
        return navigateTo('/')
    }
    if (to.path.startsWith('/dashboard/admin') && auth.role !== 'admin') {
        return navigateTo('/')
    }
    if (to.path.startsWith('/admin') && auth.role !== 'admin') {
        return navigateTo('/')
    }
})
