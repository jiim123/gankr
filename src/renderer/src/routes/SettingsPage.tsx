import { useCallback, useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/ipc'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { LANGUAGES, REGIONS } from '../lib/lobby-options'

function describeUpdateStatus(status: UpdateStatus | null): string {
  if (!status) return 'Checking for updates.'
  switch (status.state) {
    case 'checking':
      return 'Checking for updates.'
    case 'available':
      return `Update ${status.version} available, downloading.`
    case 'not-available':
      return 'Up to date.'
    case 'downloading':
      return `Downloading update, ${status.percent}%.`
    case 'downloaded':
      return `Update ${status.version} ready, installs on quit.`
    case 'error':
      return `Update check failed: ${status.message}`
  }
}

interface ProfileFields {
  displayName: string | null
  avatarUrl: string | null
  region: string | null
  languages: string[]
}

/** Same loadProfile/useCallback+useEffect pattern ProfilePage.tsx already
 * uses. Pulls display info alongside region/languages so the Account
 * section can show something real instead of a stale "Not signed in." */
async function loadProfileFields(userId: string): Promise<ProfileFields> {
  const { data } = await supabase
    .from('users')
    .select('display_name, avatar_url, region, languages')
    .eq('id', userId)
    .maybeSingle()
  return {
    displayName: data?.display_name ?? null,
    avatarUrl: data?.avatar_url ?? null,
    region: data?.region ?? null,
    languages: data?.languages ?? []
  }
}

export default function SettingsPage() {
  const { session } = useSession()

  const [pingResult, setPingResult] = useState<string | null>(null)
  const [pinging, setPinging] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)

  const [profile, setProfile] = useState<ProfileFields>({
    displayName: null,
    avatarUrl: null,
    region: null,
    languages: []
  })
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const refreshProfile = useCallback(async () => {
    if (!session) {
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    const result = await loadProfileFields(session.user.id)
    setProfile(result)
    setProfileLoading(false)
  }, [session])

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  useEffect(() => {
    void window.gankr.getVersion().then((response) => setVersion(response.version))
    void window.gankr.getUpdateStatus().then((status) => setUpdateStatus(status))
    return window.gankr.onUpdateStatusChanged((status) => setUpdateStatus(status))
  }, [])

  const checkingOrDownloading =
    updateStatus?.state === 'checking' || updateStatus?.state === 'downloading'

  async function runCheckForUpdates() {
    await window.gankr.checkForUpdates()
  }

  async function runPing() {
    setPinging(true)
    try {
      const response = await window.gankr.ping('hello from renderer')
      setPingResult(`main replied "${response.message}" at ${new Date(response.receivedAt).toLocaleTimeString()}`)
    } catch (error) {
      setPingResult(`ipc call failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setPinging(false)
    }
  }

  function setRegion(region: string | null) {
    setSaved(false)
    setProfile((current) => ({ ...current, region }))
  }

  function toggleLanguage(language: string) {
    setSaved(false)
    setProfile((current) => ({
      ...current,
      languages: current.languages.includes(language)
        ? current.languages.filter((existing) => existing !== language)
        : [...current.languages, language]
    }))
  }

  async function handleSaveRegionLanguages() {
    if (!session) return
    setSaving(true)
    try {
      await supabase
        .from('users')
        .update({ region: profile.region, languages: profile.languages })
        .eq('id', session.user.id)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <section className="surface p-4">
          <h2 className="text-sm font-medium text-foreground">Account</h2>
          {profileLoading ? (
            <p className="mt-1 text-sm text-neutral-400">Loading…</p>
          ) : (
            <div className="mt-2 flex items-center gap-3">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-neutral-800" aria-hidden="true" />
              )}
              <div>
                <div className="text-sm font-medium text-foreground">{profile.displayName ?? 'Signed in'}</div>
                <div className="text-xs text-neutral-500">{session?.user.email}</div>
              </div>
            </div>
          )}
        </section>

        <section className="surface p-4">
          <h2 className="text-sm font-medium text-foreground">Region &amp; languages</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Used to rank Find lobby results and to keep lobbies that don&apos;t share a language
            with you out of your search.
          </p>

          <label className="mt-3 block text-xs text-neutral-400">
            Region
            <select
              className="field mt-1 w-full max-w-xs"
              value={profile.region ?? ''}
              onChange={(event) => setRegion(event.target.value || null)}
            >
              <option value="">Not set</option>
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3">
            <span className="block text-xs text-neutral-400">Languages</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {LANGUAGES.map((language) => {
                const active = profile.languages.includes(language)
                return (
                  <button
                    key={language}
                    type="button"
                    onClick={() => toggleLanguage(language)}
                    className={[
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                    ].join(' ')}
                  >
                    {language}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleSaveRegionLanguages()}
              disabled={saving || profileLoading}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && <span className="text-sm text-emerald-400">Saved.</span>}
          </div>
        </section>

        <section className="surface p-4">
          <h2 className="text-sm font-medium text-foreground">Software update</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Gankr {version ?? '…'}. {describeUpdateStatus(updateStatus)}
          </p>
          <button
            type="button"
            className="btn-secondary mt-3"
            onClick={() => void runCheckForUpdates()}
            disabled={checkingOrDownloading}
          >
            Check for updates
          </button>
        </section>

        <section className="surface p-4">
          <h2 className="text-sm font-medium text-foreground">Main process connection</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Sends a message over the typed IPC channel and shows what main sends back.
          </p>
          <button type="button" className="btn-secondary mt-3" onClick={() => void runPing()} disabled={pinging}>
            {pinging ? 'Pinging…' : 'Ping main process'}
          </button>
          {pingResult && <p className="mt-3 text-sm text-emerald-400">{pingResult}</p>}
        </section>
      </div>
    </div>
  )
}
