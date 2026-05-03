export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(80%_80%_at_50%_0%,#edf4ff_0%,#ffffff_55%,#f8f5ec_100%)]">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-start justify-center gap-6 px-6">
        <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">
          Echo Archive
        </div>
        <h1 className="text-5xl font-semibold text-zinc-950 sm:text-6xl">
          Audio processing, now connected.
        </h1>
        <p className="max-w-2xl text-base text-zinc-600">
          This workspace is wired for uploads, queue tracking, and local
          processing. Head to the dashboard to test the pipeline.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-zinc-800"
            href="/dashboard"
          >
            Open dashboard
          </a>
          <a
            className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-900"
            href="/dashboard"
          >
            View jobs
          </a>
        </div>
      </main>
    </div>
  );
}
