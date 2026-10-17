import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export default function NotFound() {
  return (
    <div className="page-wrap empty-state not-found">
      <p className="eyebrow">404 / A little off track</p>
      <h1>
        Good finds.
        <br />
        Wrong turn.
      </h1>
      <p>This page isn’t here. Let’s get you back to something good.</p>
      <Link href="/products" className="button button-dark">
        Explore the collection <ArrowUpRight size={18} />
      </Link>
    </div>
  );
}
