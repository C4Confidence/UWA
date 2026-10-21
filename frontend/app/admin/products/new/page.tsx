import type { Metadata } from "next";
import { ProductEditor } from "@/components/admin/product-editor";

export const metadata: Metadata = { title: "Add product · Admin", robots: { index: false, follow: false } };

export default function NewProductPage() {
  return <ProductEditor />;
}
