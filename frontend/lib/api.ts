import type { Product } from "./types";

export function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p._id === "string" &&
    /^[a-f\d]{24}$/i.test(p._id) &&
    typeof p.title === "string" &&
    typeof p.price === "number" &&
    Number.isFinite(p.price) &&
    p.price >= 0 &&
    typeof p.quantity === "number" &&
    Number.isInteger(p.quantity) &&
    p.quantity >= 0 &&
    Array.isArray(p.images) &&
    typeof p.description === "string" &&
    typeof p.category === "string" &&
    typeof p.brand === "string" &&
    (p.color === undefined || typeof p.color === "string")
  );
}

function metadataLabel(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

/** Adapt identifiers and optional display metadata, then validate commercial data. */
export function normalizeProduct(value: unknown): Product | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const product = value as Record<string, unknown>;
  // Existing _id values stay authoritative; id is the backend's JSON alias.
  const normalized = {
    ...product,
    _id: product._id ?? product.id,
    category: metadataLabel(product.category, "Uncategorized"),
    brand: metadataLabel(product.brand, "Unknown brand"),
  };
  return isProduct(normalized) ? normalized : null;
}

function normalizeProducts(value: unknown[]): Product[] {
  const products: Product[] = [];
  for (const entry of value) {
    const product = normalizeProduct(entry);
    if (product) products.push(product);
  }
  return products;
}

async function request(url: string, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20000);
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      controller.signal.aborted
        ? "The store is taking a little longer than expected. Please try again."
        : "We couldn’t connect to the store. Please try again.",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export async function getCatalog(signal?: AbortSignal): Promise<Product[]> {
  const products: Product[] = [];
  const seen = new Set<string>();
  let receivedRecords = false;
  const finish = () => {
    if (receivedRecords && !products.length)
      throw new Error(
        "Some product information is unavailable. Please try again later.",
      );
    return products;
  };
  for (let page = 1; page <= 100; page++) {
    const query = new URLSearchParams({ limit: "100", sort: "_id" });
    if (page > 1) query.set("page", String(page));
    const response = await request(`/api/product?${query}`, signal);
    // The original API returns 404 for an out-of-range page.
    if (response.status === 404 && page > 1) return finish();
    if (!response.ok)
      throw new Error("We couldn’t load the collection. Please try again.");
    const data = await response.json();
    const entries: unknown = data?.data?.products;
    if (!Array.isArray(entries))
      throw new Error("The collection is temporarily unavailable.");
    receivedRecords ||= entries.length > 0;
    for (const product of normalizeProducts(entries)) {
      if (!seen.has(product._id)) {
        seen.add(product._id);
        products.push(product);
      }
    }
    if (entries.length < 100) return finish();
  }
  throw new Error(
    "The collection is too large to load right now. Please try again later.",
  );
}

export async function getFeatured(signal?: AbortSignal): Promise<Product[]> {
  const response = await request("/api/product?limit=4&sort=-_id", signal);
  if (!response.ok)
    throw new Error("We couldn’t load the collection. Please try again.");
  const data = await response.json();
  const entries: unknown = data?.data?.products;
  if (!Array.isArray(entries))
    throw new Error("The collection is temporarily unavailable.");
  const products = normalizeProducts(entries);
  if (entries.length > 0 && !products.length)
    throw new Error("The collection is temporarily unavailable.");
  return products;
}

export async function getProduct(
  id: string,
  signal?: AbortSignal,
): Promise<Product | null> {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  const response = await request(`/api/product/${id}`, signal);
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error("We couldn’t load this product. Please try again.");
  const data: unknown = await response.json();
  if (data === null) return null;
  const product = normalizeProduct(data);
  if (!product)
    throw new Error("This product’s information is temporarily unavailable.");
  return product;
}

export function productImage(product: Product): string | null {
  for (const value of product.images ?? []) {
    const candidate =
      typeof value === "string"
        ? value
        : value && typeof value === "object" && "url" in value
          ? (value as { url: unknown }).url
          : null;
    if (typeof candidate !== "string") continue;
    if (
      candidate.startsWith("/") &&
      !candidate.startsWith("//") &&
      !candidate.includes("\\")
    )
      return candidate;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:") return candidate;
    } catch {
      /* Unsupported image source. */
    }
  }
  return null;
}

export function money(amount: number) {
  const currency = process.env.NEXT_PUBLIC_STORE_CURRENCY || "USD";
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(
      amount,
    );
  } catch {
    return amount.toFixed(2);
  }
}
