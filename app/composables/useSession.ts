import type { Profile } from '~~/shared/types/domain'

/** One sign-in model for both data modes. */
export function useSession() {
  const mode = useDataMode()
  const nuxtApp = useNuxtApp()
  const demoCookie = useCookie<string>('zth_demo', { default: () => '', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 })
  // Shared state is the source of truth within the app; the cookie carries it across reloads and SSR.
  const demoSession = useState<boolean>('zth-demo-session', () => demoCookie.value === '1')
  const user = useSupabaseUser()
  // The session lands before the claims right after a password sign-in; either one means signed in.
  const session = useSupabaseSession()
  const me = useState<Profile | null>('me', () => null)

  const loggedIn = computed(() => (mode === 'demo' ? demoSession.value : !!(user.value || session.value)))
  const userId = computed(() => (mode === 'demo' ? null : (user.value?.sub as string | undefined) ?? null))

  async function loadMe(force = false): Promise<Profile | null> {
    if (!loggedIn.value) {
      me.value = null
      return null
    }
    // A profile cached for another account (sign-out/sign-in without a reload) is stale.
    if (me.value && !force && (userId.value === null || me.value.id === userId.value)) return me.value
    me.value = await useRepo().me()
    return me.value
  }

  /** Right after a real sign-in: the language saved in the profile wins, then go home. */
  async function afterSignIn() {
    const { locale, setLocale } = nuxtApp.$i18n
    const profile = await loadMe(true).catch(() => null)
    if (profile?.locale && profile.locale !== locale.value) await setLocale(profile.locale)
    await navigateTo(nuxtApp.$localePath('/tracks'))
  }

  function enterDemo() {
    demoSession.value = true
    demoCookie.value = '1'
  }

  async function signOut() {
    me.value = null
    if (mode === 'demo') {
      demoSession.value = false
      demoCookie.value = ''
    }
    else await useSupabaseClient().auth.signOut()
  }

  return { mode, loggedIn, me, loadMe, afterSignIn, enterDemo, signOut }
}
