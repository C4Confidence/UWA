import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const response = await fetch(
      `${process.env.API_ORIGIN || "http://127.0.0.1:4000"}/api/product/${id}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (response.ok) {
      const product = await response.json();
      if (product?.title && typeof product.title === "string")
        return {
          title: product.title,
          description:
            typeof product.description === "string"
              ? product.description.slice(0, 160)
              : "Discover this find in the UWA collection.",
          alternates: { canonical: `/products/${id}` },
        };
    }
  } catch {
    /* The customer-facing page provides a retry state. */
  }
  return { title: "Product details", robots: { index: false, follow: true } };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  return <ProductDetail id={id} />;
}
