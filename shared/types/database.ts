// Placeholder until `npm run db:types` generates the real types from the Supabase project.
// Keep the shape `Database` so @nuxtjs/supabase can type the client.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          handle: string
          display_name: string | null
          avatar_url: string | null
          locale: 'en' | 'pt-BR'
          onboarded_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          handle: string
          display_name?: string | null
          avatar_url?: string | null
          locale?: 'en' | 'pt-BR'
          onboarded_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
