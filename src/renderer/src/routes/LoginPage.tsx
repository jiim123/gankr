import { useState } from 'react'

export default function LoginPage() {
  const [pending, setPending] = useState(false)

  async function handleSignIn(): Promise<void> {
    setPending(true)
    try {
      // Opens Steam OpenID sign-in in the system browser. Main handles the
      // URL and shell.openExternal call; the renderer never touches either.
      await window.gankr.signInWithSteam()
    } finally {
      // Stays pending-looking briefly even after the call resolves, since
      // the actual sign-in happens in the browser tab that just opened.
      setPending(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-950">
      <div className="surface flex w-80 flex-col items-center gap-4 p-8">
        <div className="text-xl font-semibold tracking-tight text-white">Gankr</div>
        <p className="text-center text-sm text-neutral-400">
          Sign in with Steam to find people to play with.
        </p>
        <button
          type="button"
          className="btn-primary w-full"
          disabled={pending}
          onClick={() => void handleSignIn()}
        >
          Sign in through Steam
        </button>
        <p className="text-center text-xs text-neutral-500">
          Opens in your browser. Come back to this window when you are done.
        </p>
      </div>
    </div>
  )
}
