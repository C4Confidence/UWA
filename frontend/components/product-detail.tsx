"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Minus,
  Plus,
  ShoppingBag,
  Star,
} from "lucide-react";
import type { Product } from "@/lib/types";
import { getProduct, money, productImage } from "@/lib/api";
import { ProductImage } from "./product-image";
import { useStore } from "./store-provider";

export function ProductDetail({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState(0);
  const [added, setAdded] = useState(false);
  const { addToCart, ready } = useStore();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getProduct(id, controller.signal)
      .then(setProduct)
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, attempt]);
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 2500);
    return () => clearTimeout(timer);
  }, [added]);
  if (loading)
    return (
      <div
        className="page-wrap detail-layout"
        role="status"
        aria-label="Loading product"
      >
        <div className="skeleton detail-image-skeleton" />
        <div>
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      </div>
    );
  if (error || !product)
    return (
      <div className="page-wrap">
        <div className="empty-state">
          <p className="eyebrow">A little detour</p>
          <h1>{error ? "Let’s try that again." : "This find isn’t here."}</h1>
          <p>
            {error ||
              "This product may no longer be available. There’s more to discover in the collection."}
          </p>
          {error && (
            <button
              className="button button-dark"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again <ArrowRight size={16} />
            </button>
          )}
          <Link href="/products" className="text-link">
            Back to the collection <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  const available = product.quantity > 0;
  const images = (product.images || []).filter((image) =>
    productImage({ ...product, images: [image] }),
  );
  const ratings = (
    Array.isArray(product.ratings) ? product.ratings : []
  ).filter(
    (rating) =>
      rating &&
      Number.isFinite(rating.star) &&
      rating.star >= 1 &&
      rating.star <= 5,
  );
  const average = ratings.length
    ? ratings.reduce((sum, item) => sum + item.star, 0) / ratings.length
    : 0;
  return (
    <div className="page-wrap product-detail-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/products">The collection</Link>
        <ChevronRight size={13} />
        <span aria-current="page">{product.title}</span>
      </nav>
      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="detail-main-image">
            <ProductImage
              product={{
                ...product,
                images: images.length ? [images[selected] || images[0]] : [],
              }}
              priority
              sizes="(max-width: 800px) 95vw, 48vw"
            />
            {!available && (
              <span className="product-badge sold-out">Sold out</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="detail-thumbnails" aria-label="Product images">
              {images.map((image, index) => (
                <button
                  key={index}
                  className={selected === index ? "selected" : ""}
                  onClick={() => setSelected(index)}
                  aria-label={`View image ${index + 1} of ${product.title}`}
                  aria-pressed={selected === index}
                >
                  <ProductImage
                    product={{ ...product, images: [image] }}
                    sizes="80px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-info">
          <p className="eyebrow">{product.brand || "The UWA collection"}</p>
          <h1>{product.title}</h1>
          <div className="detail-price-row">
            <span className="detail-price">{money(product.price)}</span>
            {ratings.length > 0 && (
              <span className="product-rating">
                <Star size={15} fill="currentColor" /> {average.toFixed(1)}{" "}
                <span>({ratings.length})</span>
              </span>
            )}
          </div>
          <p className="product-description">
            {product.description || "Explore the product details below."}
          </p>
          <p className={`stock-label ${!available ? "out-of-stock" : ""}`}>
            <span />
            {available ? "In stock" : "Currently unavailable"}
          </p>
          <div className="detail-purchase">
            <div className="quantity-stepper">
              <button
                aria-label="Decrease quantity"
                disabled={quantity <= 1 || !available}
                onClick={() => setQuantity((value) => value - 1)}
              >
                <Minus size={16} />
              </button>
              <output aria-label="Quantity">{quantity}</output>
              <button
                aria-label="Increase quantity"
                disabled={!available || quantity >= product.quantity}
                onClick={() => setQuantity((value) => value + 1)}
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              className="button button-dark add-to-bag"
              disabled={!available || !ready}
              onClick={() => {
                setAdded(addToCart(product, quantity));
              }}
            >
              {added ? <Check size={18} /> : <ShoppingBag size={18} />}
              {added
                ? "Added to your bag"
                : available
                  ? "Add to bag"
                  : "Sold out"}
            </button>
          </div>
          <p className="detail-checkout-note">
            Keep your favorites together. Online checkout is not available yet.
          </p>
          <div className="detail-accordions">
            <details open>
              <summary>In the details</summary>
              <dl>
                {product.category && (
                  <div>
                    <dt>Collection</dt>
                    <dd>{product.category}</dd>
                  </div>
                )}
                {product.brand && (
                  <div>
                    <dt>Brand</dt>
                    <dd>{product.brand}</dd>
                  </div>
                )}
                {product.color && (
                  <div>
                    <dt>Color</dt>
                    <dd>{product.color}</dd>
                  </div>
                )}
              </dl>
            </details>
            <details>
              <summary>Delivery & checkout</summary>
              <p>
                Online ordering and payment are not available yet. Your bag is
                saved in this browser. Delivery charges, taxes, and final
                availability will need to be confirmed when checkout becomes
                available.
              </p>
              <Link href="/contact" className="text-link">
                Shopping information <ArrowRight size={14} />
              </Link>
            </details>
          </div>
          <Link href="/products" className="text-link detail-back">
            <ArrowLeft size={15} /> Keep discovering
          </Link>
        </div>
      </div>
    </div>
  );
}
