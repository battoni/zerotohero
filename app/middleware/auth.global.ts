const PUBLIC = new Set(['/', '/login', '/confirm', '/privacidade', '/termos'])

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, loadMe } = useSession()
  const localePath = useLocalePath()
  const path = to.path.replace(/^\/pt-BR(?=\/|$)/, '') || '/'

  if (!PUBLIC.has(path) && !loggedIn.value) {
    return navigateTo(localePath('/login'))
  }
  if (path === '/login' && loggedIn.value) {
    return navigateTo(localePath('/tracks'))
  }

  // First visit after sign-up: pick a handle before anything else.
  if (import.meta.client && loggedIn.value && !PUBLIC.has(path) && path !== '/welcome') {
    try {
      const me = await loadMe()
      if (me && !me.onboarded) return navigateTo(localePath('/welcome'))
    }
    catch {
      // Profile fetch failed (network): let the page render and show its own error.
    }
  }
})
