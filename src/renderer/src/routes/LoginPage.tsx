export default function LoginPage() {
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
          onClick={() => {
            // Steam OpenID flow is built in Phase 5.
            console.log('sign in through steam')
          }}
        >
          Sign in through Steam
        </button>
      </div>
    </div>
  )
}
