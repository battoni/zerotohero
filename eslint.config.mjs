// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['plans/**', 'supabase/**', 'shared/types/database.ts'],
})
