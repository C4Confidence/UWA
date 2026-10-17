import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";

export const metadata: Metadata = {
  title: "Your shopping bag",
  description: "Review the products in your UWA shopping bag.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartView />;
}
