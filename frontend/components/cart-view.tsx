"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { money } from "@/lib/api";
import { ProductImage } from "@/components/product-image";
import { useStore } from "@/components/store-provider";

export function CartView() {
  const { cart, ready, updateQuantity, removeFromCart } = useStore();
  const [announcement, setAnnouncement] = useState("");
  const itemCount = cart.reduce((count, item) => count + item.quantity, 0);
  const subtotal = cart.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );

  function remove(id: string, title: string) {
    removeFromCart(id);
    setAnnouncement(`${title} removed from your bag.`);
  }

  return (
    <div className="page-wrap cart-page">
      <Link className="text-link back-link" href="/products">
        <ArrowLeft size={16} aria-hidden="true" /> Continue shopping
      </Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR NEXT EVERYDAY FAVORITES</p>
          <h1>
            Your shopping bag<span className="heading-dot">.</span>
          </h1>
        </div>
        {ready && cart.length > 0 && (
          <p className="muted">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {!ready ? (
        <div
          className="cart-layout"
          role="status"
          aria-label="Loading your shopping bag"
        >
          <div className="cart-items">
            <div className="skeleton cart-skeleton" />
            <div className="skeleton cart-skeleton" />
          </div>
          <div className="skeleton summary-skeleton" />
        </div>
      ) : cart.length === 0 ? (
        <div className="empty-state">
          <ShoppingBag size={42} strokeWidth={1.3} aria-hidden="true" />
          <p className="eyebrow">ROOM FOR SOMETHING GOOD</p>
          <h2>Your bag is waiting.</h2>
          <p className="muted">
            Discover the collection and find something that feels like you.
          </p>
          <Link className="button button-dark" href="/products">
            Explore the collection <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div>
            <ul
              className="cart-items"
              aria-label="Products in your shopping bag"
            >
              {cart.map(({ product, quantity }) => (
                <li className="cart-item" key={product._id}>
                  <Link
                    className="cart-item-image"
                    href={`/products/${product._id}`}
                    aria-label={`View ${product.title}`}
                  >
                    <ProductImage
                      product={product}
                      sizes="(max-width: 600px) 96px, 148px"
                    />
                  </Link>
                  <div className="cart-item-info">
                    {(product.category || product.brand) && (
                      <p className="eyebrow">
                        {product.category || product.brand}
                      </p>
                    )}
                    <h2>
                      <Link href={`/products/${product._id}`}>
                        {product.title}
                      </Link>
                    </h2>
                    {product.color && (
                      <p className="muted cart-item-meta">
                        Color: {product.color}
                      </p>
                    )}
                    <p className="cart-unit-price">
                      {money(product.price)} <span className="muted">each</span>
                    </p>
                    <div className="cart-actions">
                      <div
                        className="quantity-stepper"
                        aria-label={`Quantity for ${product.title}`}
                      >
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${product.title}`}
                          disabled={quantity <= 1}
                          onClick={() =>
                            updateQuantity(product._id, quantity - 1)
                          }
                        >
                          <Minus size={14} aria-hidden="true" />
                        </button>
                        <span
                          aria-live="polite"
                          aria-label={`Quantity: ${quantity}`}
                        >
                          {quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${product.title}`}
                          disabled={quantity >= Math.floor(product.quantity)}
                          onClick={() =>
                            updateQuantity(product._id, quantity + 1)
                          }
                        >
                          <Plus size={14} aria-hidden="true" />
                        </button>
                      </div>
                      <button
                        className="remove-item"
                        type="button"
                        aria-label={`Remove ${product.title} from bag`}
                        onClick={() => remove(product._id, product.title)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                  <p className="cart-line-price">
                    {money(product.price * quantity)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="muted cart-storage-note">
              Your bag is saved in this browser. Prices and availability are
              checked again when you review checkout.
            </p>
          </div>
          <aside
            className="order-summary"
            aria-labelledby="cart-summary-heading"
          >
            <p className="eyebrow">THE GOOD STUFF, TOGETHER</p>
            <h2 id="cart-summary-heading">Bag summary</h2>
            <dl>
              <div className="summary-row">
                <dt>Merchandise subtotal</dt>
                <dd>{money(subtotal)}</dd>
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
                <dt>Estimated subtotal</dt>
                <dd>{money(subtotal)}</dd>
              </div>
            </dl>
            <Link className="button button-yellow" href="/checkout">
              Review checkout <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <p className="muted summary-note">
              Online ordering and payment are not available yet. Review your bag
              for the latest product information.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
