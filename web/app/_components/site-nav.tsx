import Link from "next/link";

const GITHUB = "https://github.com/rahmanef63/models-rahmanef-com";

// Landing header — brand + wayfinding + the one persistent CTA. Shared by / and /roadmap so
// "roadmap & changelog live in the header" is one source of truth. `home` link shows off the
// landing page. Nav owns source/roadmap/changelog; the hero no longer repeats them.
export function SiteNav({ home = false }: { home?: boolean }) {
  return (
    <nav className="nav reveal">
      <Link className="brand" href="/">models<b>.</b></Link>
      <div className="nav-links">
        {home && <Link href="/">home</Link>}
        <Link href="/roadmap">roadmap</Link>
        <Link href="/roadmap#changelog">changelog</Link>
        <a href={GITHUB} target="_blank" rel="noreferrer">source</a>
        <Link className="btn accent" href="/app">Open dashboard →</Link>
      </div>
    </nav>
  );
}
