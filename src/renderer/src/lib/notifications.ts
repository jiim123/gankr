import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Enums, Tables } from '@shared/db-types'
import { supabase } from './supabase'

export type NotificationType = Enums<'notification_type'>

type NotificationRow = Tables<'notifications'>
type AnnouncementRow = Tables<'announcements'>

/**
 * One unified item for the bell panel and the toast stack, merging the two
 * very differently-shaped sources (see Phase 9): rows from `notifications`
 * (server-written per-event rows, `read_at` marks them read) and rows from
 * `announcements` that this user hasn't seen yet (marking read means an
 * `announcement_reads` insert, never a `notifications` column update).
 * `body` is only ever populated for `source: 'announcement'` — every other
 * type is rendered from a template by `renderNotificationSentence`, never
 * stored as text (so wording can change without a migration).
 */
export interface NotificationItem {
  id: string
  source: 'notification' | 'announcement'
  type: NotificationType
  actorId: string | null
  lobbyId: string | null
  body: string | null
  isRead: boolean
  createdAt: string
}

function notificationRowToItem(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    source: 'notification',
    type: row.type,
    actorId: row.actor_id,
    lobbyId: row.lobby_id,
    body: null,
    isRead: row.read_at !== null,
    createdAt: row.created_at
  }
}

function announcementRowToItem(row: AnnouncementRow): NotificationItem {
  return {
    id: row.id,
    source: 'announcement',
    type: 'announcement',
    actorId: null,
    lobbyId: null,
    body: row.body,
    // Only ever fetched while unseen (see loadUnseenAnnouncements below), so
    // every announcement item that exists in this hook's state is unread by
    // construction — there's no read_at column on the row itself.
    isRead: false,
    createdAt: row.created_at
  }
}

function buildItems(
  notifications: readonly NotificationRow[],
  unseenAnnouncements: readonly AnnouncementRow[]
): NotificationItem[] {
  const items = [
    ...notifications.map(notificationRowToItem),
    ...unseenAnnouncements.map(announcementRowToItem)
  ]
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

async function loadUnseenAnnouncements(userId: string): Promise<AnnouncementRow[]> {
  // RLS already restricts `announcements` to untargeted rows or ones
  // matching this user's region (see migration), so this is just "every
  // visible announcement minus the ones already in announcement_reads" —
  // the literal "unseen announcements" query, run once on mount only.
  const [{ data: announcementRows }, { data: readRows }] = await Promise.all([
    supabase.from('announcements').select('*'),
    supabase.from('announcement_reads').select('announcement_id').eq('user_id', userId)
  ])
  const readIds = new Set((readRows ?? []).map((row) => row.announcement_id))
  return (announcementRows ?? []).filter((row) => !readIds.has(row.id))
}

/**
 * Batched, Map-joined name resolution — same pattern as lobby-summary.ts's
 * user/game joins. Every actor id and lobby id passed in gets an entry in
 * the returned maps even when the underlying row can't be found (a deleted
 * user, a deleted lobby), so `.has()` reliably means "resolution was
 * attempted" rather than "resolution succeeded" — the toast-readiness check
 * in useNotifications depends on that distinction. `gameNames` values are
 * `string | null` on purpose: `null` is the honest "couldn't resolve, use
 * the game-less fallback sentence" signal `renderNotificationSentence`
 * checks for; `actorNames` instead fills unresolvable ids with "Someone"
 * since none of the 8 templates has a game-less-style fallback for a
 * missing actor.
 */
async function resolveNotificationNames(
  rows: readonly NotificationRow[]
): Promise<{ actorNames: Map<string, string>; gameNames: Map<string, string | null> }> {
  const actorIds = [...new Set(rows.map((row) => row.actor_id).filter((id): id is string => id !== null))]
  const lobbyIds = [...new Set(rows.map((row) => row.lobby_id).filter((id): id is string => id !== null))]

  const [{ data: userRows }, { data: lobbyRows }] = await Promise.all([
    actorIds.length > 0
      ? supabase.from('users').select('id, display_name').in('id', actorIds)
      : Promise.resolve({ data: [] }),
    lobbyIds.length > 0
      ? supabase.from('lobbies').select('id, appid').in('id', lobbyIds)
      : Promise.resolve({ data: [] })
  ])

  const actorNames = new Map<string, string>()
  for (const id of actorIds) actorNames.set(id, 'Someone')
  for (const user of userRows ?? []) actorNames.set(user.id, user.display_name)

  const appids = [...new Set((lobbyRows ?? []).map((lobby) => lobby.appid))]
  const { data: gameRows } =
    appids.length > 0 ? await supabase.from('games').select('appid, name').in('appid', appids) : { data: [] }
  const gameNameByAppid = new Map((gameRows ?? []).map((game) => [game.appid, game.name]))

  const gameNames = new Map<string, string | null>()
  for (const id of lobbyIds) gameNames.set(id, null)
  for (const lobby of lobbyRows ?? []) gameNames.set(lobby.id, gameNameByAppid.get(lobby.appid) ?? null)

  return { actorNames, gameNames }
}

/**
 * The 8 notification sentences, rendered client-side from type + resolved
 * names rather than stored as text — see CLAUDE.md Phase 9 ("no message
 * text column"). `lobby_full` is the one template with a documented
 * game-less fallback; the same shape is applied to the other two
 * lobby-scoped types for consistency, since an unresolved game name is the
 * same kind of "still show something sensible" situation.
 */
export function renderNotificationSentence(
  item: NotificationItem,
  actorName: string | null,
  gameName: string | null
): string {
  const actor = actorName ?? 'Someone'
  switch (item.type) {
    case 'friend_request_received':
      return `${actor} sent you a friend request.`
    case 'friend_request_accepted':
      return `${actor} accepted your friend request.`
    case 'lobby_invite':
      return `${actor} invited you to a lobby.`
    case 'lobby_full':
      return gameName ? `Your ${gameName} lobby is full.` : 'Your lobby is full.'
    case 'all_members_ready':
      return gameName ? `Everyone in your ${gameName} lobby is ready.` : 'Everyone in your lobby is ready.'
    case 'owner_launched':
      return gameName ? `${actor} started ${gameName}.` : `${actor} started the game.`
    case 'friend_online_in_owned_game':
      return gameName ? `${actor} is playing ${gameName}.` : `${actor} is online.`
    case 'announcement':
      return item.body ?? ''
  }
}

/** Where clicking a notification item should take the user. The three
 * lobby-scoped types always resolve to expanding the recipient's own docked
 * lobby bar — there's no `/lobby/:id` route, and these are always about a
 * lobby the recipient is already in, so that's always correct. Friend-related
 * types (including "a friend is playing a game you own", which isn't a
 * friend-*request* but is still about a friend) go to /friends. lobby_invite
 * goes to /find, since a real "preview an unjoined lobby" view doesn't exist
 * yet. announcement has nowhere to go. */
export type NotificationTarget =
  | { kind: 'expand-docked-lobby' }
  | { kind: 'route'; path: string }
  | { kind: 'none' }

export function resolveNotificationTarget(type: NotificationType): NotificationTarget {
  switch (type) {
    case 'lobby_full':
    case 'all_members_ready':
    case 'owner_launched':
      return { kind: 'expand-docked-lobby' }
    case 'friend_request_received':
    case 'friend_request_accepted':
    case 'friend_online_in_owned_game':
      return { kind: 'route', path: '/friends' }
    case 'lobby_invite':
      return { kind: 'route', path: '/find' }
    case 'announcement':
      return { kind: 'none' }
  }
}

/** The 7 types Settings can toggle — `announcement` is deliberately excluded,
 * it can't be disabled (see CLAUDE.md Phase 9: "Announcements cannot be
 * disabled, but they are rare and in-app only"). */
export const TOGGLEABLE_NOTIFICATION_TYPES: readonly Exclude<NotificationType, 'announcement'>[] = [
  'friend_request_received',
  'friend_request_accepted',
  'lobby_invite',
  'lobby_full',
  'all_members_ready',
  'owner_launched',
  'friend_online_in_owned_game'
]

export function labelForNotificationType(type: Exclude<NotificationType, 'announcement'>): string {
  switch (type) {
    case 'friend_request_received':
      return 'Friend requests received'
    case 'friend_request_accepted':
      return 'Friend requests accepted'
    case 'lobby_invite':
      return 'Lobby invites'
    case 'lobby_full':
      return 'Lobby full'
    case 'all_members_ready':
      return 'Everyone in your lobby ready'
    case 'owner_launched':
      return 'Lobby owner started the game'
    case 'friend_online_in_owned_game':
      return 'Friend playing a game you own'
  }
}

export interface UseNotificationsResult {
  items: NotificationItem[]
  unreadCount: number
  actorNames: ReadonlyMap<string, string>
  gameNames: ReadonlyMap<string, string | null>
  toasts: NotificationItem[]
  dismissToast: (id: string) => void
  markRead: (item: NotificationItem) => Promise<void>
}

const MAX_VISIBLE_TOASTS = 3

/**
 * The renderer's one notification data source: `notifications` (fetched +
 * Realtime-subscribed) merged with unseen `announcements` (fetched once).
 * Also owns toast queuing, native-notification requests to main, and the
 * badge count push — see CLAUDE.md Phase 9's delivery-by-focus-state rules.
 */
export function useNotifications(userId: string | undefined): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unseenAnnouncements, setUnseenAnnouncements] = useState<AnnouncementRow[]>([])
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map())
  const [gameNames, setGameNames] = useState<Map<string, string | null>>(new Map())
  const [toasts, setToasts] = useState<NotificationItem[]>([])
  const [pendingToastIds, setPendingToastIds] = useState<string[]>([])

  // `null` means "first load hasn't completed yet". Once it has, this holds
  // every notification id seen so far, so a later Realtime INSERT can tell
  // a genuinely new arrival apart from the initial unread backlog — only
  // the former gets toasted/natively-notified. Otherwise every relaunch
  // would re-toast the whole backlog.
  const knownIdsRef = useRef<Set<string> | null>(null)

  const refreshNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([])
      knownIdsRef.current = null
      return
    }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    const rows = data ?? []
    setNotifications(rows)

    if (knownIdsRef.current === null) {
      knownIdsRef.current = new Set(rows.map((row) => row.id))
    } else {
      const newRows = rows.filter((row) => !knownIdsRef.current?.has(row.id))
      for (const row of rows) knownIdsRef.current.add(row.id)
      if (newRows.length > 0) {
        setPendingToastIds((current) => [...current, ...newRows.map((row) => row.id)])
      }
    }
  }, [userId])

  const refreshAnnouncements = useCallback(async () => {
    if (!userId) {
      setUnseenAnnouncements([])
      return
    }
    setUnseenAnnouncements(await loadUnseenAnnouncements(userId))
  }, [userId])

  useEffect(() => {
    void refreshNotifications()
  }, [refreshNotifications])

  useEffect(() => {
    // Startup-only by design (see CLAUDE.md Phase 9) — never re-run beyond
    // this mount-time fetch, unlike the notifications half above.
    void refreshAnnouncements()
  }, [refreshAnnouncements])

  useEffect(() => {
    if (!userId) return undefined
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => void refreshNotifications()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => void refreshNotifications()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, refreshNotifications])

  // Re-resolves the full actor/game name batch whenever the notification
  // set changes. Low volume by design (see CLAUDE.md "resist adding more"),
  // so re-resolving the whole batch on each change is simpler than a
  // diffing cache and cheap enough not to matter.
  useEffect(() => {
    let cancelled = false
    void resolveNotificationNames(notifications).then((result) => {
      if (cancelled) return
      setActorNames(result.actorNames)
      setGameNames(result.gameNames)
    })
    return () => {
      cancelled = true
    }
  }, [notifications])

  // Drains pendingToastIds as soon as each row's names are resolved (or
  // resolved-to-null), queuing a toast and asking main to consider a native
  // popup. Rows that fell out of the 50-row window before their names
  // resolved are dropped silently rather than toasted with stale data.
  useEffect(() => {
    if (pendingToastIds.length === 0) return

    const stillPending: string[] = []
    const newlyReady: NotificationRow[] = []
    for (const id of pendingToastIds) {
      const row = notifications.find((existing) => existing.id === id)
      if (!row) continue
      const actorReady = row.actor_id === null || actorNames.has(row.actor_id)
      const lobbyReady = row.lobby_id === null || gameNames.has(row.lobby_id)
      if (actorReady && lobbyReady) {
        newlyReady.push(row)
      } else {
        stillPending.push(id)
      }
    }
    if (newlyReady.length === 0) return

    setPendingToastIds(stillPending)
    for (const row of newlyReady) {
      const item = notificationRowToItem(row)
      setToasts((current) => [...current, item].slice(-MAX_VISIBLE_TOASTS))

      const actorName = row.actor_id ? (actorNames.get(row.actor_id) ?? null) : null
      const gameName = row.lobby_id ? (gameNames.get(row.lobby_id) ?? null) : null
      const sentence = renderNotificationSentence(item, actorName, gameName)
      void window.gankr.showNativeNotification({
        notificationId: item.id,
        type: item.type,
        title: 'Gankr',
        body: sentence,
        lobbyId: item.lobbyId
      })
    }
  }, [pendingToastIds, notifications, actorNames, gameNames])

  const items = useMemo(() => buildItems(notifications, unseenAnnouncements), [notifications, unseenAnnouncements])
  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items])

  useEffect(() => {
    void window.gankr.setBadgeCount(unreadCount)
  }, [unreadCount])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const markRead = useCallback(
    async (item: NotificationItem): Promise<void> => {
      if (item.isRead) return
      if (item.source === 'notification') {
        const readAt = new Date().toISOString()
        await supabase.from('notifications').update({ read_at: readAt }).eq('id', item.id)
        setNotifications((current) =>
          current.map((row) => (row.id === item.id ? { ...row, read_at: readAt } : row))
        )
      } else {
        if (!userId) return
        await supabase.from('announcement_reads').insert({ announcement_id: item.id, user_id: userId })
        // The unseen-announcements query is the only source for this half,
        // so once read it simply drops out of local state — it will never
        // come back from a future fetch either.
        setUnseenAnnouncements((current) => current.filter((row) => row.id !== item.id))
      }
    },
    [userId]
  )

  return { items, unreadCount, actorNames, gameNames, toasts, dismissToast, markRead }
}
