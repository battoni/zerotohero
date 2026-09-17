import type { DataMode, DataRepository } from '~/repositories/types'
import { createDemoRepository, localStorageDemo } from '~/repositories/demo'
import { createSupabaseRepository } from '~/repositories/supabase'

const demoFiles = import.meta.glob('~~/seed/demo/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

let demoRepo: ReturnType<typeof createDemoRepository> | null = null
let supabaseRepo: DataRepository | null = null

export function useDataMode(): DataMode {
  return useRuntimeConfig().public.dataMode === 'demo' ? 'demo' : 'supabase'
}

export function useDemoRepo() {
  // Browser-only singleton: on the server each call gets a throwaway instance.
  if (import.meta.server) return createDemoRepository({ files: demoFiles })
  demoRepo ??= createDemoRepository({ files: demoFiles, storage: localStorageDemo() })
  return demoRepo
}

export function useRepo(): DataRepository {
  if (useDataMode() === 'demo') return useDemoRepo()
  if (import.meta.server) return createSupabaseRepository(useSupabaseClient())
  supabaseRepo ??= createSupabaseRepository(useSupabaseClient())
  return supabaseRepo
}
