// Hand-written mirror of supabase/migrations until `npm run db:types` can run
// against a real project. Keep it in sync with every migration.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type TrackColor = 'violet' | 'coral' | 'sky' | 'mint' | 'sun'
type TrackVisibility = 'private' | 'friends' | 'public'
type EvidenceKind = 'link' | 'note' | 'file' | 'certificate'
type FriendStatus = 'pending' | 'accepted'
type ActivityType = 'milestone_completed' | 'track_completed' | 'track_started' | 'track_followed'

type Table<Row, Required extends keyof Row> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>
  Update: Partial<Row>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: Table<{
        id: string
        handle: string
        display_name: string | null
        avatar_url: string | null
        locale: 'en' | 'pt-BR'
        onboarded_at: string | null
        created_at: string
      }, 'id' | 'handle'>
      tracks: Table<{
        id: string
        owner_id: string
        title: string
        goal: string | null
        emoji: string
        color: TrackColor
        target_date: string | null
        visibility: TrackVisibility
        source_track_id: string | null
        copies_count: number
        created_at: string
        updated_at: string
        archived_at: string | null
      }, 'title'>
      phases: Table<{
        id: string
        track_id: string
        title: string
        position: number
      }, 'track_id' | 'title'>
      milestones: Table<{
        id: string
        track_id: string
        phase_id: string
        title: string
        tag: string | null
        position: number
        due_date: string | null
        completed_at: string | null
        time_spent_minutes: number | null
        created_at: string
        updated_at: string
      }, 'track_id' | 'phase_id' | 'title'>
      evidences: Table<{
        id: string
        milestone_id: string
        owner_id: string
        kind: EvidenceKind
        url: string | null
        body: string | null
        learned: string | null
        storage_path: string | null
        created_at: string
      }, 'milestone_id' | 'kind'>
      friendships: Table<{
        requester_id: string
        addressee_id: string
        status: FriendStatus
        created_at: string
        responded_at: string | null
      }, 'requester_id' | 'addressee_id'>
      track_follows: Table<{
        user_id: string
        track_id: string
        created_at: string
      }, 'user_id' | 'track_id'>
      activities: Table<{
        id: string
        actor_id: string
        type: ActivityType
        track_id: string
        milestone_id: string | null
        created_at: string
      }, 'actor_id' | 'type' | 'track_id'>
      kudos: Table<{
        activity_id: string
        user_id: string
        created_at: string
      }, 'activity_id' | 'user_id'>
    }
    Views: {
      track_progress: {
        Row: {
          track_id: string
          total: number
          done: number
          next_milestone_id: string | null
          next_milestone_title: string | null
          last_completed_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      copy_track: { Args: { source: string }, Returns: string }
      create_track: { Args: { payload: Json }, Returns: string }
      update_track: { Args: { p_id: string, payload: Json }, Returns: undefined }
      are_friends: { Args: { a: string, b: string }, Returns: boolean }
      can_view_track: { Args: { p_track_id: string }, Returns: boolean }
    }
    Enums: {
      track_color: TrackColor
      track_visibility: TrackVisibility
      evidence_kind: EvidenceKind
      friend_status: FriendStatus
      activity_type: ActivityType
    }
    CompositeTypes: Record<string, never>
  }
}
