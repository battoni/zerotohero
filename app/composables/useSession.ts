import type { Profile } from '~~/shared/types/domain'

/** One sign-in model for both data modes. */
export function useSession() {
  const mode = useDataMode()
  const demoCookie = useCookie<string>('zth_demo', { default: () => '', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 })
  const user = useSupabaseUser()
  const me = useState<Profile | null>('me', () => null)

  const loggedIn = computed(() => (mode === 'demo' ? demoCookie.value === '1' : !!user.value))

  async function loadMe(force = false): Promise<Profile | null> {
    if (!loggedIn.value) {
      me.value = null
      return null
    }
    if (me.value && !force) return me.value
    me.value = await useRepo().me()
    return me.value
  }

  function enterDemo() {
    demoCookie.value = '1'
  }

  async function signOut() {
    me.value = null
    if (mode === 'demo') demoCookie.value = ''
    else await useSupabaseClient().auth.signOut()
  }

  return { mode, loggedIn, me, loadMe, enterDemo, signOut }
}
