"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Info,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getProduct, money } from "@/lib/api";
import type { Product } from "@/lib/types";
import { ProductImage } from "@/components/product-image";
import { useStore } from "@/components/store-provider";

interface ProductReview {
  id: string;
  product: Product | null;
  failed: boolean;
}

export function CheckoutView() {
  const { cart, ready, updateQuantity, removeFromCart } = useStore();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [checking, setChecking] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setChecking(true);
    setReviews([]);
    Promise.all(
      cart.map(async ({ product }): Promise<ProductReview> => {
        try {
          const current = await getProduct(product._id, controller.signal);
          return { id: product._id, product: current, failed: false };
        } catch {
          return { id: product._id, product: null, failed: true };
        }
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      setReviews(results);
      setChecking(false);
    });
    return () => controller.abort();
  }, [cart, ready, refresh]);

  const complete =
    !checking &&
    reviews.length === cart.length &&
    reviews.every((review) => review.product && !review.failed);
  const subtotal = cart.reduce((total, item) => {
    const current = reviews.find(
      (review) => review.id === item.product._id,
    )?.product;
    return total + (current ? current.price * item.quantity : 0);
  }, 0);
  const hasIssues =
    !checking &&
    cart.some((item) => {
      const review = reviews.find((value) => value.id === item.product._id);
      return (
        !review?.product ||
        review.failed ||
        review.product.quantity < item.quantity ||
        review.product.price !== item.product.price
      );
    });

  return (
    <div className="page-wrap checkout-page">
      <Link className="text-link back-link" href="/cart">
        <ArrowLeft size={16} aria-hidden="true" /> Back to your bag
      </Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">A CLOSER LOOK</p>
          <h1>
            Review your bag<span className="heading-dot">.</span>
          </h1>
        </div>
      </div>
      <div className="notice-box checkout-notice">
        <Info size={23} aria-hidden="true" />
        <div>
          <h2>Online checkout is not available yet.</h2>
          <p>
            You can explore products and save a bag on this browser. Orders and
            payments cannot be placed here yet.
          </p>
        </div>
      </div>

      {!ready ? (
        <div
          className="cart-layout"
          role="status"
          aria-label="Loading your shopping bag"
        >
          <div className="skeleton cart-skeleton" />
          <div className="skeleton summary-skeleton" />
        </div>
      ) : cart.length === 0 ? (
        <div className="empty-state">
          <ShoppingBag size={42} strokeWidth={1.3} aria-hidden="true" />
          <h2>Your next find is out there.</h2>
          <p className="muted">
            Add a product to your bag to review its price and availability.
          </p>
          <Link className="button button-dark" href="/products">
            Explore the collection <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="checkout-layout">
          <div>
            <div className="checkout-review-heading">
              <h2>Your selection</h2>
              <button
                className="text-link"
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
                disabled={checking}
              >
                <RefreshCw
                  size={15}
                  className={checking ? "spin" : ""}
                  aria-hidden="true"
                />
                {checking ? "Checking…" : "Refresh availability"}
              </button>
            </div>
            <p
              className="muted checkout-status"
              role="status"
              aria-live="polite"
            >
              {checking
                ? "Checking current prices and stock with the store…"
                : hasIssues
                  ? "Your bag has updates. Review the details below."
                  : "Prices and stock have been checked. Items are not reserved."}
            </p>
            <ul
              className="cart-items"
              aria-label="Current product prices and availability"
              aria-busy={checking}
            >
              {cart.map(({ product: saved, quantity }) => {
                const review = reviews.find((value) => value.id === saved._id);
                const product = review?.product;
                const stock = product
                  ? Math.max(0, Math.floor(product.quantity))
                  : 0;
                return (
                  <li className="checkout-item" key={saved._id}>
                    <Link
                      className="cart-item-image"
                      href={`/products/${saved._id}`}
                      aria-label={`View ${product?.title || saved.title}`}
                    >
                      <ProductImage
                        product={product || saved}
                        sizes="(max-width: 600px) 80px, 104px"
                      />
                    </Link>
                    <div className="cart-item-info">
                      <p className="eyebrow">Quantity: {quantity}</p>
                      <h3>
                        <Link href={`/products/${saved._id}`}>
                          {product?.title || saved.title}
                        </Link>
                      </h3>
                      {checking ? (
                        <p className="muted">Checking product information…</p>
                      ) : review?.failed ? (
                        <div className="checkout-item-issue">
                          <AlertCircle size={15} aria-hidden="true" />
                          <p>
                            We couldn’t check this product. Refresh availability
                            to try again.
                          </p>
                        </div>
                      ) : !product ? (
                        <div className="checkout-item-issue">
                          <AlertCircle size={15} aria-hidden="true" />
                          <p>This product is no longer available.</p>
                        </div>
                      ) : (
                        <>
                          <p className="cart-unit-price">
                            {money(product.price)}{" "}
                            <span className="muted">each</span>
                          </p>
                          {product.price !== saved.price && (
                            <p className="checkout-price-update">
                              Price updated from {money(saved.price)} to{" "}
                              {money(product.price)} per item.
                            </p>
                          )}
                          {stock === 0 ? (
                            <div className="checkout-item-issue">
                              <AlertCircle size={15} aria-hidden="true" />
                              <p>This product is currently out of stock.</p>
                            </div>
                          ) : quantity > stock ? (
                            <div className="checkout-item-issue">
                              <AlertCircle size={15} aria-hidden="true" />
                              <div>
                                <p>
                                  Only {stock}{" "}
                                  {stock === 1 ? "item is" : "items are"}{" "}
                                  currently available.
                                </p>
                                <button
                                  className="text-link"
                                  type="button"
                                  onClick={() =>
                                    updateQuantity(saved._id, stock)
                                  }
                                >
                                  Update quantity to {stock}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="muted">
                              Available at the time of this check
                            </p>
                          )}
                        </>
                      )}
                      <button
                        className="text-link checkout-remove"
                        type="button"
                        onClick={() => removeFromCart(saved._id)}
                        aria-label={`Remove ${saved.title} from bag`}
                      >
                        Remove from bag
                      </button>
                    </div>
                    <p className="cart-line-price">
                      {checking
                        ? "…"
                        : product
                          ? money(product.price * quantity)
                          : "—"}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
          <aside
            className="order-summary"
            aria-labelledby="checkout-summary-heading"
          >
            <p className="eyebrow">CURRENT PRODUCT PRICES</p>
            <h2 id="checkout-summary-heading">Bag review</h2>
            <dl>
              <div className="summary-row">
                <dt>Merchandise subtotal</dt>
                <dd>
                  {checking
                    ? "Checking…"
                    : complete
                      ? money(subtotal)
                      : "Unavailable"}
                </dd>
              </div>
              <div className="summary-row muted">
                <dt>Shipping</dt>
                <dd>Not calculated</dd>
              </div>
              <div className="summary-row muted">
                <dt>Taxes</dt>
                <dd>Not calculated</dd>
              </div>
              <div className="summary-row summary-total">
                <dt>Current subtotal</dt>
                <dd>{checking ? "…" : complete ? money(subtotal) : "—"}</dd>
              </div>
            </dl>
            {!checking && !complete && (
              <p className="summary-note">
                A full subtotal is unavailable until all products can be
                checked. Remove unavailable products or retry the check.
              </p>
            )}
            {!checking && complete && hasIssues && (
              <p className="summary-note">
                This subtotal uses current prices and your selected quantities.
                Product updates and availability issues are listed beside each
                item.
              </p>
            )}
            <Link className="button button-dark" href="/cart">
              Return to your bag <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <p className="muted summary-note">
              This is a product review, not an order. No payment or personal
              details are collected.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
