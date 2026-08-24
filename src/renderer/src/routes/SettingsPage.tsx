import { useState } from 'react'

export default function SettingsPage() {
  const [pingResult, setPingResult] = useState<string | null>(null)
  const [pinging, setPinging] = useState(false)

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

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">Settings</h1>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <section className="surface p-4">
          <h2 className="text-sm font-medium text-white">Account</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Not signed in. Region, languages, and notification preferences appear here once
            Steam sign-in is wired up.
          </p>
        </section>

        <section className="surface p-4">
          <h2 className="text-sm font-medium text-white">About</h2>
          <p className="mt-1 text-sm text-neutral-400">Gankr 0.1.0 (development build)</p>
        </section>

        <section className="surface p-4">
          <h2 className="text-sm font-medium text-white">Main process connection</h2>
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
