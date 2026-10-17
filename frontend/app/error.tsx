"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-wrap empty-state">
      <p className="eyebrow">A little interruption</p>
      <h1>Something didn’t go to plan.</h1>
      <p>Please try again in a moment.</p>
      <button onClick={reset} className="button button-dark">
        Try again
      </button>
      <Link href="/" className="text-link">
        Back to UWA
      </Link>
    </div>
  );
}
