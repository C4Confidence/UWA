"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  PackageOpen,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Product } from "@/lib/types";
import { getCatalog, getFeatured, money } from "@/lib/api";
import { useStore } from "./store-provider";
import { ProductImage } from "./product-image";

function useCatalog(featured = false) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (featured ? getFeatured(controller.signal) : getCatalog(controller.signal))
      .then(setProducts)
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt, featured]);
  return {
    products,
    loading,
    error,
    retry: () => setAttempt((value) => value + 1),
  };
}

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, ready } = useStore();
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1800);
    return () => clearTimeout(timer);
  }, [added]);
  const inStock = product.quantity > 0;
  return (
    <article className="product-card">
      <div className="product-card-media">
        <Link
          href={`/products/${product._id}`}
          aria-label={`View ${product.title}`}
        >
          <ProductImage product={product} />
        </Link>
        <span className={`product-badge ${!inStock ? "sold-out" : ""}`}>
          {inStock ? product.category || "The collection" : "Sold out"}
        </span>
        <button
          className={`quick-add ${added ? "is-added" : ""}`}
          disabled={!inStock || !ready}
          aria-label={
            added
              ? `${product.title} added to bag`
              : `Add ${product.title} to bag`
          }
          onClick={() => {
            setAdded(addToCart(product));
          }}
        >
          {added ? <Check size={20} /> : <Plus size={20} />}
        </button>
      </div>
      <div className="product-card-details">
        <div>
          <p className="product-brand">{product.brand || "UWA collection"}</p>
          <h3>
            <Link href={`/products/${product._id}`}>{product.title}</Link>
          </h3>
        </div>
        <span className="product-price">{money(product.price)}</span>
      </div>
    </article>
  );
}

export function ProductSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="product-grid" role="status" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <div className="product-skeleton" key={i}>
          <div className="skeleton skeleton-image" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

export function CatalogState({
  error,
  retry,
  filtered = false,
  reset,
}: {
  error?: string;
  retry?: () => void;
  filtered?: boolean;
  reset?: () => void;
}) {
  return (
    <div className={`empty-state ${error ? "error-state" : ""}`}>
      <div className="empty-icon">
        <PackageOpen size={32} strokeWidth={1.2} />
      </div>
      <p className="eyebrow">
        {error
          ? "A little interruption"
          : filtered
            ? "A fresh start"
            : "Room for what’s next"}
      </p>
      <h3>
        {error
          ? "Let’s try that again."
          : filtered
            ? "No finds this time."
            : "The collection is taking shape."}
      </h3>
      <p>
        {error ||
          (filtered
            ? "Try a different search or clear your filters to see the full collection."
            : "There are no products in the collection right now. Come back for a fresh look soon.")}
      </p>
      {error ? (
        <button onClick={retry} className="button button-dark">
          Try again <ArrowRight size={16} />
        </button>
      ) : filtered ? (
        <button onClick={reset} className="button button-dark">
          Clear filters <X size={16} />
        </button>
      ) : (
        <Link href="/about" className="text-link">
          Get to know UWA <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}

export function FeaturedCollection() {
  const { products, loading, error, retry } = useCatalog(true);
  const featured = [...products]
    .sort((a, b) => b._id.localeCompare(a._id))
    .slice(0, 4);
  return (
    <section className="section-wrap featured-section" id="the-collection">
      <div className="section-heading">
        <div>
          <p className="eyebrow">A fresh perspective</p>
          <h2>
            Meet your next favorites<span>.</span>
          </h2>
        </div>
        <Link href="/products" className="text-link">
          Shop the collection <ArrowUpRight size={17} />
        </Link>
      </div>
      {loading ? (
        <ProductSkeletons />
      ) : error || !products.length ? (
        <CatalogState error={error} retry={retry} />
      ) : (
        <div className="product-grid">
          {featured.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}

export function Catalog() {
  const { products, loading, error, retry } = useCatalog();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const q = params.get("q") || "";
  const category = params.get("category") || "";
  const sort = params.get("sort") || "newest";
  const stock = params.get("stock") === "available";
  const min = params.get("min") || "";
  const max = params.get("max") || "";
  const [search, setSearch] = useState(q);
  const [filters, setFilters] = useState(false);
  useEffect(() => setSearch(q), [q]);
  function update(entries: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(entries)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`${path}${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  const categories = [
    ...new Set(products.map((product) => product.category).filter(Boolean)),
  ].sort();
  const filtered = useMemo(() => {
    const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return products
      .filter((product) =>
        terms.every((term) =>
          `${product.title} ${product.brand} ${product.category} ${product.description}`
            .toLowerCase()
            .includes(term),
        ),
      )
      .filter((product) => !category || product.category === category)
      .filter((product) => !stock || product.quantity > 0)
      .filter((product) => !min || product.price >= Number(min))
      .filter((product) => !max || product.price <= Number(max))
      .sort((a, b) =>
        sort === "price-asc"
          ? a.price - b.price
          : sort === "price-desc"
            ? b.price - a.price
            : sort === "name"
              ? a.title.localeCompare(b.title)
              : b._id.localeCompare(a._id),
      );
  }, [products, q, category, stock, min, max, sort]);
  const activeFilters = !!(q || category || stock || min || max);
  return (
    <div className="catalog-content">
      <form
        className="catalog-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: search.trim() });
        }}
      >
        <Search size={20} />
        <label className="sr-only" htmlFor="collection-search">
          Search products
        </label>
        <input
          id="collection-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find something that feels like you…"
          maxLength={150}
        />
        <button className="button button-dark" type="submit">
          Search <ArrowRight size={16} />
        </button>
      </form>
      <div className="catalog-toolbar">
        <div
          className="category-tabs"
          role="group"
          aria-label="Filter by collection"
        >
          <button
            className={!category ? "active" : ""}
            aria-pressed={!category}
            onClick={() => update({ category: "" })}
          >
            All finds
          </button>
          {categories.map((value) => (
            <button
              key={value}
              className={category === value ? "active" : ""}
              aria-pressed={category === value}
              onClick={() => update({ category: value })}
            >
              {value}
            </button>
          ))}
        </div>
        <button
          className={`filter-button ${filters ? "active" : ""}`}
          aria-expanded={filters}
          aria-controls="catalog-filters"
          onClick={() => setFilters(!filters)}
        >
          <SlidersHorizontal size={16} /> Filters{" "}
          {activeFilters && <span className="filter-dot" />}
        </button>
      </div>
      {filters && (
        <div id="catalog-filters" className="filter-panel">
          <div className="field">
            <label htmlFor="price-min">Minimum price</label>
            <input
              id="price-min"
              type="number"
              min="0"
              value={min}
              placeholder="Any"
              onChange={(event) => update({ min: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="price-max">Maximum price</label>
            <input
              id="price-max"
              type="number"
              min="0"
              value={max}
              placeholder="Any"
              onChange={(event) => update({ max: event.target.value })}
            />
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={stock}
              onChange={(event) =>
                update({ stock: event.target.checked ? "available" : "" })
              }
            />{" "}
            In stock only
          </label>
          <button
            className="text-link"
            onClick={() => router.replace(path, { scroll: false })}
          >
            Reset all <X size={14} />
          </button>
        </div>
      )}
      <div className="catalog-results">
        <p aria-live="polite">
          {loading
            ? "Finding your next favorite…"
            : `${filtered.length} ${filtered.length === 1 ? "find" : "finds"}${q ? ` for “${q}”` : ""}`}
        </p>
        <div className="sort-field">
          <label htmlFor="sort-products">Sort by</label>
          <select
            id="sort-products"
            value={sort}
            onChange={(event) => update({ sort: event.target.value })}
          >
            <option value="newest">Newest first</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name: A–Z</option>
          </select>
        </div>
      </div>
      {loading ? (
        <ProductSkeletons count={8} />
      ) : error ? (
        <CatalogState error={error} retry={retry} />
      ) : !filtered.length ? (
        <CatalogState
          filtered={activeFilters}
          reset={() => router.replace(path, { scroll: false })}
        />
      ) : (
        <div className="product-grid">
          {filtered.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
