# Gankr — build plan

A desktop client that helps PC gamers find people to play with, form a lobby, launch
together, and build reputation from how the session went. Windows and Linux only.

This document is written to be used with Claude Code. Every phase has a goal, a list of
what gets built, a prompt you can paste, and a "done when" that tells you whether to move on.

---

## Repository instructions

Desktop client for finding people to play games with. Electron, React, TypeScript, Supabase.

### Hard rules

- Vocabulary is **lobby**, never "party" or "group". This applies to code, tables, and UI strings.
- Lobby statuses are exactly: `open`, `playing`, `closed`. No others.
- Windows and Linux only. Never write macOS-specific or web-specific code paths.
- Renderer has no OS access. `contextIsolation: true`, `nodeIntegration: false`.
  Everything privileged goes through a named IPC handler exposed in preload.
- Steam Web API key lives server-side only. Never in the renderer, never in a committed file.
- Never store a Steam friend code. It is derived from SteamID64 in the client.
- Never trust the client for ownership, membership, or reputation. Enforce in Postgres RLS
  or an Edge Function.
- Clicking "Start game" is intent. A running process is truth. Never mark someone in-game
  because they clicked a button.
- Feedback tags (positive and negative) are public on a profile, including who gave
  them — a deliberate reversal of this project's original design (see Phase 10).
  Reputation renders as the real numeric score (-500 to 500), not a coarse tier.

### Style

- TypeScript strict. No `any` without a comment explaining why.
- Prose in UI copy is plain and short. No exclamation marks, no "Oops!".
- Dark UI, neutral greys. Primary action colour is the brand accent
  (`oklch(0.6629 0.2272 35.97)`, bg-primary/text-primary-foreground), not white — white was
  the original placeholder, replaced in a design pass. Background is `oklch(0.1543 0 0)`
  (bg-background), titles and primary text are `oklch(0.9521 0 0)` (text-foreground).
  Secondary actions (Cancel, Leave lobby, etc.) stay transparent with a
  `oklch(0.4731 0.1535 37.42)` border (border-secondary-border) and text-foreground — never
  filled. One further accent (blue) is reserved for data values like match percentages,
  separate from the primary action colour.
- Prefer boring, obvious code. This is a solo project that has to stay maintainable.

### Architecture

- `src/main` — Electron main process. OS access, process detection, IPC handlers, tray.
- `src/preload` — the only bridge. Small, explicit, typed.
- `src/renderer` — React app. Knows nothing about Node.
- `src/shared` — types shared across the boundary.
- `supabase/` — schema migrations and Edge Functions.

### What this app is not

Not a Discord replacement. Not a social feed. Not a voice app. Text chat inside a lobby
is the only communication feature. The goal is always to get people into a game.

Work the phases in order. Each one assumes the previous is finished.

---

## Before you start

Have these ready:

- Steam Web API key (steamcommunity.com/dev/apikey)
- Supabase project, URL and both keys (anon and service role)
- Domain
- GitHub repo
- Code signing certificate for Windows (OV is fine to start)
- Node 20 or 22, VS Code

---

## Phase 0 — Ground rules

Claude Code makes better decisions when the constraints live in the repo instead of in
each prompt. Do this first and everything after it gets easier.

Create `CLAUDE.md` in the repo root with this content:

```markdown
# Gankr

Desktop client for finding people to play games with. Electron, React, TypeScript, Supabase.

## Hard rules

- Vocabulary is **lobby**, never "party" or "group". This applies to code, tables, and UI strings.
- Lobby statuses are exactly: `open`, `playing`, `closed`. No others.
- Windows and Linux only. Never write macOS-specific or web-specific code paths.
- Renderer has no OS access. `contextIsolation: true`, `nodeIntegration: false`.
  Everything privileged goes through a named IPC handler exposed in preload.
- Steam Web API key lives server-side only. Never in the renderer, never in a committed file.
- Never store a Steam friend code. It is derived from SteamID64 in the client.
- Never trust the client for ownership, membership, or reputation. Enforce in Postgres RLS
  or an Edge Function.
- Clicking "Start game" is intent. A running process is truth. Never mark someone in-game
  because they clicked a button.
- Feedback tags (positive and negative) are public on a profile, including who gave
  them — a deliberate reversal of this project's original design (see Phase 10).
  Reputation renders as the real numeric score (-500 to 500), not a coarse tier.

## Style

- TypeScript strict. No `any` without a comment explaining why.
- Prose in UI copy is plain and short. No exclamation marks, no "Oops!".
- Dark UI, neutral greys. Primary action colour is the brand accent
  (`oklch(0.6629 0.2272 35.97)`, bg-primary/text-primary-foreground), not white — white was
  the original placeholder, replaced in a design pass. Background is `oklch(0.1543 0 0)`
  (bg-background), titles and primary text are `oklch(0.9521 0 0)` (text-foreground).
  Secondary actions (Cancel, Leave lobby, etc.) stay transparent with a
  `oklch(0.4731 0.1535 37.42)` border (border-secondary-border) and text-foreground — never
  filled. One further accent (blue) is reserved for data values like match percentages,
  separate from the primary action colour.
- Prefer boring, obvious code. This is a solo project that has to stay maintainable.

## Architecture

- `src/main` — Electron main process. OS access, process detection, IPC handlers, tray.
- `src/preload` — the only bridge. Small, explicit, typed.
- `src/renderer` — React app. Knows nothing about Node.
- `src/shared` — types shared across the boundary.
- `supabase/` — schema migrations and Edge Functions.

## What this app is not

Not a Discord replacement. Not a social feed. Not a voice app. Text chat inside a lobby
is the only communication feature. The goal is always to get people into a game.
```

**Done when:** `CLAUDE.md` is committed and you have a `.gitignore` covering `.env`,
`node_modules`, `dist`, and any certificate files.

---

## Phase 1 — Detection spike

You already have this. Do not skip running it. Everything in Phase 8 depends on the
answers, and if detection is unreliable for the games your users play, the design changes.

Run the spike on Windows and Linux with at least four games. One Unreal game, one with
anti-cheat, one native Linux game, one Windows-only game running through Proton.

Record per game and per OS:

- The real process name, and whether it is stable across launches
- Seconds from launch click to process appearing
- Whether a launcher appears first under a different name
- Whether exit is detected within one poll
- On Linux, whether it matched by process name or by command line

**Deliverable:** a `docs/detection-findings.md` you write by hand, plus a first version of
`src/shared/game-processes.json` mapping appid to known process names.

**Done when:** you can state your real launch grace window as a number, and you know which
games need command-line matching.

---

## Phase 2 — Data layer

Nothing renders yet. Get the schema and its security right first, because retrofitting RLS
onto a social product is miserable.

> **Prompt for Claude Code**
>
> Set up the Supabase schema for Gankr as SQL migrations in `supabase/migrations/`.
>
> Tables:
> - `users` — id (references auth.users), display_name, avatar_url, region, languages,
>   created_at, last_seen_at
> - `steam_identities` — user_id, steam_id64 (text, unique), profile_visibility
>   ('public' | 'private' | 'unknown'), last_synced_at. Separate table on purpose so
>   profile rows can be read freely without exposing the Steam ID.
> - `games` — appid (text, pk), name, header_image, genres
> - `user_games` — user_id, appid, playtime_forever_minutes, playtime_2weeks_minutes,
>   source ('steam' | 'manual'), synced_at
> - `lobbies` — id, appid, owner_id, status ('open' | 'playing' | 'closed'), max_members,
>   region, mic ('required' | 'preferred' | 'off'), tone ('casual' | 'competitive'),
>   locked (bool), created_at, closed_at
> - `lobby_members` — lobby_id, user_id, joined_at, launch_clicked_at, game_started_at,
>   left_at, last_heartbeat, member_state ('in_lobby' | 'launching' | 'in_game' |
>   'launch_failed' | 'left')
> - `lobby_messages` — id, lobby_id, user_id (null for system), kind ('user' | 'system'),
>   body, seq (bigserial), created_at
> - `session_history` — id, lobby_id, appid, started_at, ended_at, member_count
> - `session_participants` — session_id, user_id, minutes_in_game
> - `compliments` — id, from_user_id, to_user_id, session_id, kind, created_at,
>   unique on (from_user_id, to_user_id, session_id)
> - `friendships` — user_id, friend_id, status, created_at
> - `reports` — id, reporter_id, reported_user_id, lobby_id, reason,
>   message_snapshot (jsonb), created_at
>
> Enable RLS on everything. Key policies:
> - Anyone signed in can read `users`, `games`, and open lobbies.
> - `steam_identities` is readable ONLY by the owner and by users who share an active
>   lobby with that user. Write this as a policy using an EXISTS join on lobby_members
>   where both rows have left_at is null.
> - `lobby_messages` readable only by current lobby members. Insert requires the sender
>   to be a member and to be the authenticated user.
> - `compliments` insert requires an existing `session_participants` row for both users
>   on that session.
> - No client-side insert on `session_history`, `session_participants`, or `reports`
>   snapshots. Those come from Edge Functions using the service role.
>
> Also write a `sweep_lobbies()` Postgres function that closes lobbies where no member has
> heartbeated within the grace window (2 minutes for status `open`, 10 minutes for
> `playing`), plus a hard 12 hour ceiling regardless of heartbeat. Schedule it with pg_cron
> every minute. When the owner leaves but other members remain, transfer ownership to the
> longest-present member instead of closing.
>
> Generate TypeScript types from the schema into `src/shared/db-types.ts`.

**Done when:** migrations apply cleanly, and you can prove in the SQL editor that user A
cannot select user B's `steam_identities` row unless they share an open lobby.

---

## Phase 3 — App shell

Still no features. Build the container, the security boundary, and the navigation.

> **Prompt for Claude Code**
>
> Scaffold the Gankr Electron app with electron-vite, React, TypeScript, and Tailwind.
>
> Main process (`src/main`):
> - Single BrowserWindow, 1200x800, dark background, no menu bar
> - `contextIsolation: true`, `nodeIntegration: false`, preload script
> - Tray icon. Closing the window hides to tray, it does not quit. Quit only from the
>   tray menu or Cmd/Ctrl+Q. This matters because quitting kills the heartbeat and would
>   close a live lobby.
> - Register the `gankr://` custom protocol for auth callbacks (both dev and packaged)
> - A typed IPC layer: every handler declared once in `src/shared/ipc.ts` and imported by
>   both sides so the channel names and payload types cannot drift
>
> Renderer (`src/renderer`):
> - React Router with routes: /login, /find, /players, /friends, /profile/:id, /settings
> - Left sidebar nav: Find lobby, Players, Friends, Profile, Settings. Sidebar labels use
>   exactly those words.
> - Top bar with an invites/notifications button showing an unread count
> - A persistent docked bar at the bottom of the window for the active lobby: game name,
>   member count, ready state, and a click to expand into the full lobby view. It must
>   survive navigation. This is the most important layout decision in the app, so build it
>   as a layout-level component, not a route.
> - Design tokens: neutral-950 background, neutral-900 surfaces, neutral-800 borders,
>   white primary buttons with dark text, blue for data such as match percentages, emerald
>   for live and ready states. No gradients used as decoration.
> - Empty states everywhere, with copy that offers the next action rather than saying
>   nothing was found.
>
> Stub every route with a placeholder. No Supabase calls yet.

**Done when:** `npm run dev` opens the app, all routes navigate, the window minimises to
tray and reopens, and the docked lobby bar stays put while you navigate.

---

## Phase 4 — Ship an empty app

Do this now, not at the end. Getting a signed installer working end to end takes longer
than expected, and you want it solved before you need it under pressure.

> **Prompt for Claude Code**
>
> Add packaging and release to Gankr.
>
> - Configure electron-builder for two targets only: Windows NSIS and Linux AppImage.
> - Add `electron-updater`, checking for updates on startup and again every 4 hours,
>   downloading in the background and installing on quit. Add a Settings row showing the
>   current version and update status.
> - GitHub Actions workflow triggered on tags matching `v*`: build on a Windows runner and
>   an Ubuntu runner, publish artifacts to a GitHub Release as a **draft**. Never publish
>   automatically, because clients that see a partial release will fail to update.
> - Windows signing reads the certificate from repo secrets. Linux AppImage is unsigned.
> - Document the release process in `docs/releasing.md`: bump version in package.json,
>   tag, wait for CI, verify artifacts, publish the draft.

Then actually do it. Install 1.0.0 on a machine, publish 1.0.1, and confirm the running
client picks it up.

**Done when:** an installed build updates itself from a real GitHub Release without you
touching it.

Note: if your repo is private, clients cannot read Releases without a token, and you must
not ship a token. Either make the repo public, or publish releases to your own domain with
a static `latest.yml`.

---

## Phase 5 — Steam auth, profile, library

> **Prompt for Claude Code**
>
> Implement Steam sign-in and library import for Gankr.
>
> Auth flow:
> - Login screen with a single "Sign in through Steam" button.
> - Main process opens the Steam OpenID URL in the **system browser**, never an embedded
>   webview, because embedded Steam logins get flagged as phishing.
> - The return URL points at a Supabase Edge Function, which verifies the response by
>   posting back to steamcommunity.com/openid/login with `openid.mode=check_authentication`.
>   Do not trust the callback parameters without this step.
> - On success the function finds or creates the Supabase user keyed on the SteamID64,
>   calls `GetPlayerSummaries` for personaname and avatarfull, upserts `users` and
>   `steam_identities`, then returns a session to the app via the `gankr://` protocol.
>
> Library import:
> - Edge Function calling `GetOwnedGames` with `include_appinfo=1` and
>   `include_played_free_games=1`. Playtime is in MINUTES, convert for display.
> - Upsert into `games` and `user_games`.
> - If the response is empty, the profile is probably private. Set
>   `profile_visibility='private'` and do not treat it as "owns nothing".
> - Re-sync on login when `last_synced_at` is older than 24 hours.
>
> Ownership helper in `src/renderer`: given an appid, return one of three states.
> - `owned` — a `user_games` row exists
> - `not_owned` — library is public and no row exists
> - `unknown` — profile visibility is private or unknown
>
> Every place the app shows a launch action must handle all three:
> owned shows "Start game", not_owned shows "You don't own this game" with a store link,
> unknown shows "Can't check your library" with a link to Steam privacy settings and a
> manual add option. Shipping only two states will tell real owners they don't own things.
>
> Profile page: avatar, name, region, top games by playtime, hours per game.

**Done when:** you sign in with a real Steam account, your avatar and games appear, and a
test account with a private profile shows the `unknown` state rather than an empty library.

---

## Phase 6 — Find lobby and create lobby

> **Prompt for Claude Code**
>
> Build the Find lobby page and lobby creation for Gankr.
>
> Find lobby opens on **lobbies, not games**. Live lobbies for games the user owns come
> first. Filters run across the top: game, region, mic, tone, free slots. Selecting a game
> is one filter, never a required first step.
>
> Search is **scored, not filtered**. Hard filters only on things that genuinely break a
> session: the game itself, a free slot, and language. Everything else is a preference that
> costs points:
> - Region: same region best, neighbouring region small penalty, far region large penalty
> - Mic mismatch: strong penalty, not exclusion
> - Tone: scaled by distance
> Return the top results ranked, and show the mismatch plainly on each card, for example
> "Mic required, yours is off" or "EU West". The player decides.
>
> Never show an empty result set. When nothing scores above the floor, show a "Create this
> lobby" card pre-filled with exactly the preferences they searched for. That converts a
> dead end into supply for the next person searching.
>
> Lobby cards show: game header image, member avatars, count, region, mic, tone, and when
> status is `open` with someone launching, a progress line reading "3 of 5 in game".
>
> Create lobby: game picker defaulting to owned games, max members, region, mic, tone.
> Available from anywhere, pre-filled with the game when started from a game context.
> Creating a lobby joins it and opens the lobby room.
>
> Use Supabase Realtime so new lobbies and membership changes appear without a refresh.

**Done when:** two accounts on two machines can see each other's lobbies appear live, and a
search with impossible preferences offers to create rather than showing nothing.

---

## Phase 7 — Lobby room and chat

> **Prompt for Claude Code**
>
> Build the Gankr lobby room.
>
> Layout: game header, member list with per-member state, requirements panel, and text
> chat. The docked bar from Phase 3 expands into this view.
>
> Chat rules:
> - **Every member can post.** The owner is not the only speaker.
> - Owner-only powers: kick a member, lock the lobby, edit requirements.
> - Order by server `created_at` plus the monotonic `seq` column. Never client time.
> - Rate limit 5 messages per 10 seconds, enforced server-side, not in the UI.
> - 500 character cap.
> - System messages share the same stream, same table, `kind='system'`: "Marcus joined",
>   "Nadia is ready", "Owner locked the lobby", "Marcus's launch failed, retrying".
> - Messages are deleted when the lobby closes. Chat is disposable by design.
>
> Reporting: a report action on each member captures a snapshot of the surrounding messages
> into `reports.message_snapshot` at report time, because the lobby and its chat will be
> gone by the time anyone reviews it.
>
> Realtime subscription filtered to the lobby id. Unread count on the docked bar when the
> lobby view is not open.

**Done when:** two accounts chat in real time, the owner can kick, a kicked member is
removed immediately on their own client, and a report captures readable context.

---

## Phase 8 — Launch and lifecycle

The heart of the product, and the reason it is a desktop app.

> **Prompt for Claude Code**
>
> Implement game launch and lobby lifecycle for Gankr.
>
> Detection lives in the main process behind one interface with two implementations,
> selected at runtime:
> - Windows: enumerate processes with name and command line
> - Linux: read `/proc`, match on process name for native games and on command line for
>   Windows games running under Proton or Wine
> Matching data comes from `src/shared/game-processes.json`, appid to process names. Treat
> it as data, not code, so a broken game is a row update.
>
> Member states: `in_lobby`, `launching`, `in_game`, `launch_failed`.
> - Clicking Start game opens `steam://rungameid/<appid>`, sets `launching`, and stamps
>   `launch_clicked_at`. This is intent only.
> - The state becomes `in_game` only when the process is actually detected. Never on click.
> - Debounce exits by a few seconds. Some games show a launcher first, hand off to the real
>   executable, and look like exit then start again.
> - If no process appears within the launch window from Phase 1, set `launch_failed` and
>   show a **Retry**, which resets the window for that member. Do not silently drop them.
> - Show the reason where you can. Check Steam is running before launching and say so
>   upfront rather than failing silently for five minutes.
> - Offer a manual override, "I'm in, continue without me", for games that defeat
>   detection. Log every use, because it tells you which process mappings need fixing.
> - After 3 failed retries, make "Leave lobby" the primary action so the others are not
>   stuck.
>
> Lobby status transitions:
> - `open` while anyone is still not in game. While some members are in game, show progress
>   on the card and name the stragglers inside the lobby, for example "Waiting on Marcus
>   and Nadia". Status stays `open`.
> - `playing` only when **all** current members are `in_game`.
> - `closed` when no member has heartbeated within the grace window. Deliberately
>   asymmetric: playing requires everyone, closing requires no one.
>
> Heartbeat: the main process pings every 30 seconds with the member's current state.
> Grace windows are 2 minutes for `open` and 10 minutes for `playing`. A hard 12 hour
> ceiling regardless. The `sweep_lobbies()` cron from Phase 2 does the closing in one query.
>
> On close: write `session_history` and `session_participants` with real per-member
> in-game minutes from `game_started_at` and `left_at`, then delete the lobby's messages.

**Done when:** two machines launch a real game, both flip to in_game from process detection
alone, the lobby reaches `playing`, and closing the game on both machines closes the lobby
and writes a history row with correct minutes.

---

## Phase 9 — Notifications and announcements

Build this before Friends, because friend requests and lobby invites both need somewhere to
land. One table plus realtime. No third-party service.

> **Prompt for Claude Code**
>
> Build notifications for Gankr.
>
> `notifications` table: id, user_id, type, actor_id, lobby_id, read_at, created_at.
> No message text column. Store the type and the ids and render the sentence in the client,
> so wording and translations can change without a migration.
>
> Rows are written server-side only, from Edge Functions or Postgres triggers. There is no
> client insert policy, or users can write into each other's feeds.
>
> Types:
> - `friend_request_received`
> - `friend_request_accepted`
> - `lobby_invite`
> - `lobby_full`
> - `all_members_ready`
> - `owner_launched`
> - `friend_online_in_owned_game`
> - `announcement`
>
> Resist adding more. Gaming apps that notify more than this get muted within a week.
>
> Platform announcements are a different shape and must not fan out. Store one
> `announcements` row with targeting rules, plus a small `announcement_reads` row per user
> who actually saw it. Never write one notification row per user for a broadcast. The client
> asks "any announcements for me I have not seen" on startup.
>
> Delivery is routed by window state, because this app will usually be behind a fullscreen
> game and a badge nobody can see is not a notification:
> - Window focused: in-app toast only
> - Window open but unfocused, or hidden in the tray: native OS notification plus a badge
> - Clicking a native notification restores the window and navigates to the right place
>
> Settings gets a per-type toggle. Announcements cannot be disabled, but they are rare and
> in-app only.

**Done when:** an invite from a second account produces a native notification while the
first client is in the tray, clicking it opens the lobby, and an announcement appears once
and stays read.

---

## Phase 10 — Reputation and session feedback

Two-sided feedback. **Amended from the original design**: both positive and negative
tags are public on a profile, including who gave them, and the reputation score renders
as the real -500..500 number rather than a coarse tier. This is a deliberate, later
product decision — the original design kept negative feedback private specifically to
avoid a "scarlet letter" harassment vector, and that risk is real and still applies; it
was accepted knowingly, not overlooked. The abuse-control mechanics below (budgets,
revenge detection, damping, decay, telemetry cross-check, graduated effects) are
unchanged from the original design — only visibility and the number-vs-tier choice
were reversed.

> **Prompt for Claude Code**
>
> Build the Gankr session feedback and reputation system.
>
> **When it happens.** The feedback window opens per member when **that member's** game
> exits, not when the whole lobby closes, and stays open for 10 minutes. It attaches to the
> `session_history` row so it survives the lobby closing.
>
> **Tags.**
> Positive: Friendly, Team Player, Fun to Play With, Leader, Respectful.
> Negative: Toxic, Rage Quitter, Poor Teamwork, AFK, Untrustworthy.
>
> Store both in one `feedback` table with a `polarity` column, not two tables:
> id, from_user_id, to_user_id, session_id, tag, polarity, created_at,
> unique on (from_user_id, to_user_id, session_id).
>
> **Visibility (amended — see the note above the prompt).**
> - Both positive and negative tags are public on a profile, with counts, including who
>   gave them. The 5 most recent received are shown as "X gave Y to Z", coloured by
>   polarity.
> - The user's own standing (and everyone else's) is shown as the real numeric score,
>   -500 to 500, coloured green toward positive and red toward negative. Not a coarse
>   tier.
>
> **Abuse controls, all enforced server-side in an Edge Function.**
> - Both users must have a `session_participants` row for that session, with at least 10
>   minutes of verified in-game overlap. No overlap means no feedback in either direction.
> - One submission per pair per session. Cap the same pair at one per week.
> - Give each user a small weekly budget of negative tags, for example 5. Scarcity makes
>   them meaningful and stops spray.
> - **Revenge detection:** if A gives B a negative and B gives A a negative on the same
>   session, weight both near zero.
> - **Serial negger damping:** a user whose feedback is overwhelmingly negative across many
>   sessions has their weight reduced. Their opinion stops counting before their ability to
>   express it does.
> - **Premade damping:** if several reporters were already Gankr friends before the session,
>   count them closer to one voice than to many, so a group cannot bury an outsider.
> - Nothing happens from a single negative. Effects require multiple independent reporters
>   across different sessions.
>
> **Cross-check against your own telemetry.** This is the advantage of being a desktop app.
> You already know from process detection when each member's game started and ended.
> - A `Rage Quitter` or `AFK` tag on someone whose process ran the full session length gets
>   discarded or heavily downweighted.
> - The same tags on someone who exited 4 minutes into a 40 minute session are corroborated
>   and count fully.
> Log which path was taken, since disagreement between tags and telemetry is a useful
> signal about the reporter.
>
> **Effects are graduated and never automatic bans.**
> 1. Invisible. Score moves, nothing else happens.
> 2. Soft matchmaking preference, so similarly rated players see each other's lobbies first.
> 3. In-app warning that describes the behaviour pattern. (Originally scoped to not name
>    reporters — moot now that individual feedback is public on the profile anyway.)
> 4. Restricted, meaning public lobbies are unavailable and they can only play with
>    existing friends.
> 5. Human review from the moderation queue.
>
> **Recovery must exist.** All feedback decays with age, negatives slightly faster than
> positives. Someone who had a bad month must be able to climb out through normal play, or
> the system just produces a permanent underclass who uninstall.
>
> **Profile page** shows the numeric reputation score, counts for every tag (positive and
> negative), and the 5 most recent feedback events received, named and coloured by
> polarity.
>
> Reputation tiers are computed by a scheduled function over weighted, decayed feedback.
> Never a leaderboard position, because leaderboards get farmed and bury every new user.

**Done when:** a real session produces the feedback prompt on exit, the server rejects
feedback without in-game overlap, a mutual negative pair cancels out, a Rage Quitter tag is
discarded when telemetry shows a full session, and no API response anywhere contains another
user's negative tags.

---

## Phase 11 — Friends, Steam handoff, Players

> **Prompt for Claude Code**
>
> Build Friends, the Steam add handoff, and the Players page for Gankr.
>
> Friend requests emit `friend_request_received` and `friend_request_accepted`
> notifications through the Phase 9 system.
>
> Steam handoff. Gankr cannot put people into a game's own party, so the last step is
> friending on Steam. Make that a designed moment rather than a gap.
> - Derive the friend code in the renderer:
>   `String(BigInt(steamId64) - 76561197960265728n)`. Never store it in the database.
> - Primary action is a per-member "Add on Steam" button opening
>   `steam://friends/add/<steamId64>`. Copying the friend code is the fallback when the
>   protocol handler does not fire.
> - One button per member in the lobby list, not one bulk copy button.
> - Only surface it when it is needed, after members are ready or launching.
> - Track locally which pairs have been added so the button flips to "Added" and stops
>   nagging. If two members already added each other, never show it again for that pair.
> - Fetching a member's Steam ID must go through the lobby-scoped policy from Phase 2.
>   Never return `steam_id64` in general profile or search responses.
>
> Friends page: Gankr friends with presence and current game. Import Steam friends who
> already have Gankr accounts via `GetFriendList` intersected with `steam_identities`,
> handling private friend lists gracefully. For Steam friends without accounts, offer an
> invite link to the download page.
>
> Players page: discover people, ranked by **compatibility**, not reputation. Reputation is
> a filter and a badge, never the sort axis. Filters: game, region, mic, tone, and a "well
> regarded" threshold. Each card links to the full profile.

**Done when:** the add-on-Steam button opens the Steam dialog, the button remembers pairs
already added, and a Steam ID cannot be read by a user who does not share a lobby.

---

## Phase 12 — Website

> **Prompt for Claude Code**
>
> Build the Gankr marketing site. Single page, no accounts, no app functionality.
>
> - One primary download button, OS-detected. Other platforms behind a small link. Not a
>   table of six links.
> - A **live lobby feed** showing real open lobbies: game, region, member count, tags.
>   This is the strongest thing on the page, because eleven parties forming right now
>   proves the platform is alive better than any copy. Serve it from a cached public
>   endpoint with no auth. Never expose usernames or Steam IDs.
> - If the feed is empty, show recent completed sessions instead. Never an empty grid.
> - Download links point at the current GitHub Release artifacts, resolved at build or
>   request time so they do not go stale.

**Done when:** the site shows real lobbies from production and the download button serves
the current build for the visitor's OS.

---

## Phase 13 — Hardening before beta

> **Prompt for Claude Code**
>
> Prepare Gankr for its first outside users.
>
> - Add Sentry to both main and renderer processes. Most of your bugs will be per-game
>   process detection quirks on machines you cannot reproduce, so error reports are the
>   only way you will see them.
> - Add a "Report a problem" action that attaches the last 50 detection events and the
>   current lobby state.
> - Audit every table for RLS coverage. Write a test that signs in as user A and asserts
>   that reads of user B's steam_identities, lobby_messages, and notifications all fail.
> - Rate limit server-side: message posting, lobby creation, friend requests, compliments.
> - Build a minimal admin view at a route gated by a `role` column: look up a user, see
>   their sessions, see reports against them, read the report snapshot, take an action, and
>   log every action taken. Charts can wait. This is moderation, not analytics.
> - Add a first-run checklist in the app: Steam running, library imported or manually
>   populated, notifications permitted.

**Done when:** you can trace a reported user from a report to their session history and act
on it, and an RLS test suite passes.

---

## What to do after beta

Do not build these until real usage asks for them.

- Steam Deck support. It is Linux, but Gaming Mode has no tray, so it needs its own design.
- macOS. Small slice of the multiplayer PC audience and the fiddliest signing.
- A mobile companion for "your lobby is ready" notifications. A thin client on the same
  API, not a port.
- Voice. Everyone already has Discord open. Only build it if people ask repeatedly.
- Tauri instead of Electron, if the resource footprint becomes a real complaint.

## The risk that is not technical

None of the above matters if Play tonight returns nothing. Matchmaking with 40 users is an
empty screen, and an empty screen on first run kills the product permanently for that user.

Before wide launch, pick one game, one region, and one time window, and get a few hundred
real people into it. A narrow live community beats a complete platform with nobody in it.