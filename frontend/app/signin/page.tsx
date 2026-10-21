import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your UWA account and discover your next favourite.",
  robots: { index: false, follow: true },
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const redirectTo = typeof next === "string" && (next === "/admin" || next.startsWith("/admin/")) && !/[\\\r\n]/.test(next) ? next : "/account";
  return (
    <div className="auth-layout page-wrap">
      <aside className="auth-story">
        <p className="eyebrow">Good things. Great energy.</p>
        <h2 className="auth-heading">
          A little
          <br />
          more
          <br />
          <em>you.</em>
        </h2>
        <div className="auth-story-bottom">
          <p>
            Everyday favourites.
            <br />
            Extraordinary possibilities.
          </p>
          <Link className="text-link" href="/products">
            Explore UWA <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </aside>
      <section className="auth-panel" aria-label="Sign in">
        <AuthForm mode="signin" redirectTo={redirectTo} />
      </section>
    </div>
  );
}
