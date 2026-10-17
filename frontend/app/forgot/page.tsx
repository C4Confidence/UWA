import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, LockKeyhole } from "lucide-react";

export const metadata: Metadata = {
  title: "Password help",
  description: "Get help signing in to your UWA account.",
  robots: { index: false, follow: true },
};

export default function PasswordHelpPage() {
  return (
    <div className="auth-layout page-wrap">
      <aside className="auth-story">
        <p className="eyebrow">A little help along the way</p>
        <h2 className="auth-heading">
          Let’s
          <br />
          find your
          <br />
          <em>way.</em>
        </h2>
        <div className="auth-story-bottom">
          <p>
            Your next favourite
            <br />
            will be here.
          </p>
          <Link className="text-link" href="/products">
            Keep exploring <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </aside>
      <section className="auth-panel" aria-label="Password help">
        <LockKeyhole size={38} strokeWidth={1.3} aria-hidden="true" />
        <div className="auth-panel-heading">
          <p className="eyebrow">Password help</p>
          <h1>Need a fresh start?</h1>
          <p className="muted">
            Password reset isn’t available online yet. You can try signing in
            again if you remember your password.
          </p>
        </div>
        <div className="notice-box">
          <p>
            We can’t send a reset email at the moment. No reset request has been
            submitted.
          </p>
        </div>
        <Link href="/signin" className="button button-dark">
          <ArrowLeft size={18} aria-hidden="true" /> Back to sign in
        </Link>
        <Link href="/products" className="text-link">
          Continue browsing <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
