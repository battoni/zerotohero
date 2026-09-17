import type {
  CompleteInput, ExploreFilter, FeedItem, Friends, Locale, Profile, ProfileDetail,
  TrackDetail, TrackInput, TrackSummary,
} from '~~/shared/types/domain'

export type DataMode = 'demo' | 'supabase'

/** Everything the screens need. Two implementations: demo (in memory) and Supabase. */
export interface DataRepository {
  readonly mode: DataMode

  me(): Promise<Profile | null>
  updateProfile(patch: { handle?: string, displayName?: string | null, locale?: Locale, onboarded?: boolean }): Promise<Profile>

  listMyTracks(): Promise<TrackSummary[]>
  getTrack(id: string): Promise<TrackDetail | null>
  createTrack(input: TrackInput): Promise<string>
  updateTrack(id: string, input: TrackInput): Promise<void>
  deleteTrack(id: string): Promise<void>
  completeMilestone(milestoneId: string, input?: CompleteInput): Promise<void>
  reopenMilestone(milestoneId: string): Promise<void>
  setFollowing(trackId: string, following: boolean): Promise<void>

  explore(query: { search?: string, filter?: ExploreFilter }): Promise<TrackSummary[]>
  copyTrack(id: string): Promise<string>

  friends(): Promise<Friends>
  searchProfiles(query: string): Promise<Profile[]>
  requestFriend(userId: string): Promise<void>
  respondFriend(userId: string, accept: boolean): Promise<void>
  removeFriend(userId: string): Promise<void>
  /** Withdraws a request I sent that is still pending. */
  cancelRequest(userId: string): Promise<void>
  feed(): Promise<FeedItem[]>
  setKudos(activityId: string, on: boolean): Promise<void>

  profile(handle: string): Promise<ProfileDetail | null>
}

export class RepoError extends Error {
  constructor(public code: 'not_found' | 'forbidden' | 'invalid' | 'handle_taken' | 'network', message?: string) {
    super(message ?? code)
  }
}
