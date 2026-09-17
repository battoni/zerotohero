// Domain types the screens work with, independent of where data comes from.
import type { TrackColor, TrackVisibility } from '../utils/track-list'

export type EvidenceKind = 'link' | 'note' | 'file' | 'certificate'
export type ActivityType = 'milestone_completed' | 'track_completed' | 'track_started' | 'track_followed'
export type Locale = 'en' | 'pt-BR'

export interface Profile {
  id: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
  locale: Locale
  onboarded: boolean
}

export interface Milestone {
  id: string
  phaseId: string
  title: string
  tag: string | null
  position: number
  dueDate: string | null
  completedAt: string | null
  timeSpentMinutes: number | null
}

export interface Phase {
  id: string
  title: string
  position: number
  milestones: Milestone[]
}

export interface Track {
  id: string
  ownerId: string
  title: string
  goal: string | null
  emoji: string
  color: TrackColor
  targetDate: string | null
  visibility: TrackVisibility
  sourceTrackId: string | null
  copiesCount: number
  createdAt: string
}

export interface TrackSummary extends Track {
  owner: Profile
  total: number
  done: number
  nextMilestoneTitle: string | null
  lastCompletedAt: string | null
}

export interface Evidence {
  id: string
  milestoneId: string
  kind: EvidenceKind
  url: string | null
  body: string | null
  learned: string | null
  fileName: string | null
  /** A stored file the viewer can open through /api/evidence/:id/file. */
  hasFile: boolean
  createdAt: string
}

export interface TrackDetail extends TrackSummary {
  phases: Phase[]
  followers: Profile[]
  isFollowing: boolean
  isOwner: boolean
  recentEvidence: (Evidence & { milestoneTitle: string })[]
}

/** What the editor sends. Ids are present for existing phases/milestones. */
export interface TrackInput {
  title: string
  goal: string | null
  emoji: string
  color: TrackColor
  targetDate: string | null
  visibility: TrackVisibility
  phases: {
    id?: string
    title: string
    milestones: { id?: string, title: string, tag: string | null, dueDate: string | null, completedAt?: string | null }[]
  }[]
}

export interface EvidenceInput {
  kind: EvidenceKind
  url?: string | null
  body?: string | null
  learned?: string | null
  file?: File | null
}

export interface CompleteInput {
  completedAt?: string
  timeSpentMinutes?: number | null
  evidence?: EvidenceInput | null
}

export interface FeedItem {
  id: string
  type: ActivityType
  actor: Profile
  track: Pick<Track, 'id' | 'title' | 'emoji' | 'color'>
  milestoneTitle: string | null
  createdAt: string
  kudosCount: number
  kudosByMe: boolean
}

export type FriendState = 'self' | 'none' | 'outgoing' | 'incoming' | 'friends'

export interface Friends {
  friends: Profile[]
  incoming: Profile[]
  outgoing: Profile[]
}

export interface ProfileDetail {
  profile: Profile
  friendState: FriendState
  completedAt: string[]
  evidenceCount: number
  certificateCount: number
  activeTracks: number
  finishedTracks: number
  tracks: TrackSummary[]
}

export type ExploreFilter = 'popular' | 'friends' | 'recent'
