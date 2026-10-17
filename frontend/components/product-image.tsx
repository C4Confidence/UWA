"use client";

import Image from "next/image";
import { Package } from "lucide-react";
import { useEffect, useState } from "react";
import { productImage } from "@/lib/api";
import type { Product } from "@/lib/types";

export function ProductImage({
  product,
  sizes = "(max-width: 600px) 45vw, (max-width: 1000px) 30vw, 24vw",
  priority = false,
}: {
  product: Product;
  sizes?: string;
  priority?: boolean;
}) {
  const src = productImage(product);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (!src || failed)
    return (
      <div
        className="image-placeholder"
        role="img"
        aria-label={`Image unavailable for ${product.title}`}
      >
        <Package size={32} strokeWidth={1} />
        <span>Image unavailable</span>
      </div>
    );
  // Only explicitly trusted remote hosts are fetched by the server-side optimizer.
  const optimizedHosts = (
    process.env.NEXT_PUBLIC_OPTIMIZED_IMAGE_HOSTS || ""
  ).split(",");
  const direct =
    src.startsWith("https://") &&
    !optimizedHosts.includes(new URL(src).hostname);
  return (
    <Image
      src={src}
      alt={product.title}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={direct}
      onError={() => setFailed(true)}
      style={{ objectFit: "contain" }}
    />
  );
}
