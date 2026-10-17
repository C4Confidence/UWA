import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Create your UWA account and find everyday favourites with a little more character.",
  robots: { index: false, follow: true },
};

export default function SignUpPage() {
  return (
    <div className="auth-layout page-wrap">
      <aside className="auth-story">
        <p className="eyebrow">Your world. Your way.</p>
        <h2 className="auth-heading">
          Good
          <br />
          things
          <br />
          <em>ahead.</em>
        </h2>
        <div className="auth-story-bottom">
          <p>
            A fresh perspective.
            <br />
            An everyday kind of joy.
          </p>
          <Link className="text-link" href="/products">
            Meet the collection <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </aside>
      <section className="auth-panel" aria-label="Create an account">
        <AuthForm mode="signup" />
      </section>
    </div>
  );
}
