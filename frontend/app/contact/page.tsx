import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageSquare } from "lucide-react";

export const metadata: Metadata = {
  title: "Shopping information",
  description:
    "Find answers about your UWA bag, account, product information, and checkout availability.",
  alternates: { canonical: "/contact" },
};
export default function ContactPage() {
  return (
    <div className="page-wrap help-page">
      <div className="page-heading">
        <p className="eyebrow">A little clarity</p>
        <h1>
          Here to help<span>.</span>
        </h1>
        <p>Good questions deserve straightforward answers.</p>
      </div>
      <div className="help-layout">
        <aside>
          <MessageSquare size={36} strokeWidth={1.3} />
          <h2>
            Let’s make
            <br />
            things clear.
          </h2>
          <p>
            Before you shop, here’s what you need to know about the UWA
            experience.
          </p>
          <Link href="/products" className="text-link">
            Back to the collection <ArrowRight size={16} />
          </Link>
        </aside>
        <div className="faq-list">
          <details open>
            <summary>Can I place an order?</summary>
            <p>
              You can browse available products and keep your favorites in your
              bag. Online ordering and payment are not available yet. No payment
              details are collected, and adding an item to your bag does not
              place or reserve an order.
            </p>
          </details>
          <details>
            <summary>Where is my bag saved?</summary>
            <p>
              Your bag is stored in this browser on this device. Signing in does
              not sync it to other devices. Clearing browser data will remove
              saved items. Prices and availability are checked again on the
              checkout review page.
            </p>
          </details>
          <details>
            <summary>What about delivery and returns?</summary>
            <p>
              Delivery options, shipping charges, return terms, and taxes have
              not been published yet. These details will need to be confirmed
              before ordering becomes available.
            </p>
          </details>
          <details>
            <summary>How do I manage my account?</summary>
            <p>
              Sign in with your existing email and password, or create an
              account. Your account page shows the profile information returned
              at sign-in. Password recovery and profile editing are not
              available online yet.
            </p>
            <Link href="/signin" className="text-link">
              Sign in to your account <ArrowRight size={15} />
            </Link>
          </details>
          <details>
            <summary>How can I contact UWA?</summary>
            <p>
              A verified customer support channel has not been published on this
              site yet. Please use the UWA contact channel you already know. We
              don’t collect messages through an unconnected form.
            </p>
          </details>
          <details>
            <summary>Why isn’t a product showing?</summary>
            <p>
              The collection only shows products currently provided by UWA’s
              catalog. If a search has no results, try clearing your filters.
              Editorial images are inspiration and don’t guarantee product
              availability.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
