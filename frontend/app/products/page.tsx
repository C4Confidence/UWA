import type { Metadata } from "next";
import { Suspense } from "react";
import { Catalog, ProductSkeletons } from "@/components/catalog";

export const metadata: Metadata = {
  title: "The collection",
  description:
    "Find your kind of everyday. Browse the UWA collection, explore categories, and discover your next favorite.",
  alternates: { canonical: "/products" },
};
export default function ProductsPage() {
  return (
    <div className="page-wrap catalog-page">
      <div className="page-heading">
        <p className="eyebrow">Your everyday starts here</p>
        <h1>
          The collection<span>.</span>
        </h1>
        <p>Good things. Your kind of things.</p>
      </div>
      <Suspense fallback={<ProductSkeletons count={8} />}>
        <Catalog />
      </Suspense>
    </div>
  );
}
