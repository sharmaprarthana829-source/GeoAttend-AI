import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100 px-4 py-10">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-800/70 bg-surface-900/95 p-10 shadow-2xl text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">404 • Not Found</p>
        <h1 className="mt-6 text-4xl font-semibold text-white">You are not authorized to view this page.</h1>
        <p className="mt-4 text-slate-400">Please use the sidebar to navigate to an area of the dashboard you have access to.</p>
        <Link href="/dashboard" className="mt-8 inline-flex rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400">
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
