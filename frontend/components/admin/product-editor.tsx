"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, Check, CheckCircle2, CircleHelp, ImagePlus, LoaderCircle, Package, RotateCcw, Save } from "lucide-react";
import { AdminApiError, getAdminProduct, saveAdminProduct, validImageReference, type AdminImageEntry, type AdminProduct, type AdminProductIssue, type ProductInput } from "@/lib/admin-api";
import { money } from "@/lib/api";
import { useAdmin } from "./admin-shell";
import { ImageManager } from "./image-manager";

interface FormValues {
  title: string;
  slug: string;
  description: string;
  price: string;
  category: string;
  brand: string;
  color: string;
  quantity: string;
  images: string[];
}

const emptyForm: FormValues = { title: "", slug: "", description: "", price: "", category: "", brand: "", color: "", quantity: "0", images: [] };
const textFields = ["title", "slug", "description", "category", "brand", "color"] as const;

function formFor(product: AdminProduct): FormValues {
  return { title: product.title, slug: product.slug, description: product.description, price: product.price === null ? "" : String(product.price), category: product.category, brand: product.brand, color: product.color || "", quantity: product.quantity === null ? "" : String(product.quantity), images: [...product.images] };
}

function draftSlug(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200);
}

function buildInput(form: FormValues, original: FormValues | null): Partial<ProductInput> {
  const input: Partial<ProductInput> = {};
  for (const key of textFields) {
    if (!original || form[key] !== original[key]) input[key] = form[key].trim();
  }
  if (!original || form.price !== original.price) input.price = form.price.trim() ? Number(form.price) : NaN;
  if (!original || form.quantity !== original.quantity) input.quantity = form.quantity.trim() ? Number(form.quantity) : NaN;
  if (!original || JSON.stringify(form.images) !== JSON.stringify(original.images)) input.images = [...form.images];
  return input;
}

export function ProductEditor({ productId }: { productId?: string }) {
  const editing = !!productId;
  const { token, handleError, notify, refreshCatalog } = useAdmin();
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [original, setOriginal] = useState<FormValues | null>(null);
  const [originalImageEntries, setOriginalImageEntries] = useState<AdminImageEntry[]>([]);
  const [issues, setIssues] = useState<AdminProductIssue[]>([]);
  const [galleryReplacementReviewed, setGalleryReplacementReviewed] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [slugEdited, setSlugEdited] = useState(editing);
  const [pendingImages, setPendingImages] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [created, setCreated] = useState<AdminProduct | null>(null);
  const [saved, setSaved] = useState(false);
  const submissionLock = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError("");
    getAdminProduct(productId, token, controller.signal).then((product) => {
      if (!active) return;
      const values = formFor(product);
      setForm(values);
      setOriginal(values);
      setOriginalImageEntries([...product.imageEntries]);
      setIssues(product.issues);
      setGalleryReplacementReviewed(false);
      setFieldErrors({});
      setSaved(false);
    }).catch((cause: unknown) => {
      if (!active || controller.signal.aborted) return;
      if (!handleError(cause)) setLoadError(cause instanceof Error ? cause.message : "We couldn’t load this product. Please try again.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [productId, token, retry, handleError]);

  const galleryNeedsReview = issues.some(issue => issue.field === "images");
  const input = useMemo(() => {
    const payload = buildInput(form, original);
    if (galleryNeedsReview && galleryReplacementReviewed) payload.images = [...form.images];
    return payload;
  }, [form, original, galleryNeedsReview, galleryReplacementReviewed]);
  const changed = !editing || Object.keys(input).length > 0;
  const setImages = useCallback((images: string[]) => {
    setForm((current) => ({ ...current, images }));
    setFieldErrors((current) => { const next = { ...current }; delete next.images; return next; });
    setSaved(false);
    setGalleryReplacementReviewed(false);
  }, []);
  const disabled = saving || uploading;

  function setField(key: Exclude<keyof FormValues, "images">, value: string) {
    setSaved(false);
    setFieldErrors((current) => { const next = { ...current }; delete next[key]; return next; });
    setForm((current) => ({ ...current, [key]: value, ...(key === "title" && !editing && !slugEdited ? { slug: draftSlug(value) } : {}) }));
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const key of textFields) {
      if (!editing || form[key] !== original?.[key]) {
        const maximum = key === "description" ? 20000 : key === "title" || key === "slug" ? 200 : 120;
        if (!form[key].trim()) errors[key] = `Please enter ${key === "description" ? "a description" : key === "title" ? "a product title" : `a ${key}`}.`;
        else if (form[key].trim().length > maximum) errors[key] = `Use no more than ${maximum.toLocaleString()} characters.`;
      }
    }
    if ((!editing || form.price !== original?.price) && (!form.price.trim() || !Number.isFinite(Number(form.price)) || Number(form.price) < 0 || Number(form.price) > Number.MAX_SAFE_INTEGER)) errors.price = "Enter a valid price of zero or more.";
    if ((!editing || form.quantity !== original?.quantity) && (!form.quantity.trim() || !Number.isSafeInteger(Number(form.quantity)) || Number(form.quantity) < 0)) errors.quantity = "Enter a whole stock quantity of zero or more.";
    if (input.images && (input.images.length > 32 || !input.images.every(validImageReference))) errors.images = "Use up to 32 supported local image paths or HTTPS URLs.";
    if (input.images && galleryNeedsReview && !galleryReplacementReviewed) errors.images = "Review and confirm replacement of the stored gallery before saving image changes.";
    return errors;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current || disabled || pendingImages) return;
    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setError("A few details need your attention before this product can be saved.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (editing && !Object.keys(input).length) return;
    submissionLock.current = true;
    setSaving(true);
    setError("");
    setSaved(false);
    setFieldErrors({});
    try {
      const product = await saveAdminProduct(input, token, productId, originalImageEntries);
      setOriginalImageEntries([...product.imageEntries]);
      setIssues(product.issues);
      setGalleryReplacementReviewed(false);
      refreshCatalog();
      notify(editing ? "Product changes saved to the catalog." : "Product created in the catalog.");
      if (!editing) setCreated(product);
      else {
        const values = formFor(product);
        setForm(values);
        setOriginal(values);
        setSaved(true);
      }
    } catch (cause) {
      if (!handleError(cause)) {
        if (cause instanceof AdminApiError && cause.fields) setFieldErrors(cause.fields);
        setError(cause instanceof Error ? cause.message : "We couldn’t save this product. Your changes are still here. Please try again.");
        requestAnimationFrame(() => errorRef.current?.focus());
      }
    } finally {
      submissionLock.current = false;
      setSaving(false);
    }
  }

  const help = (key: string) => {
    const issue = issues.find(entry => entry.field === key);
    return <>{fieldErrors[key] && <p className="adm-field-error" id={`${key}-error`}>{fieldErrors[key]}</p>}{issue && <div className="adm-stored-issue" id={`${key}-stored-issue`}><p>{issue.message}</p><p><strong>Stored value:</strong> <code>{issue.storedValue}</code></p></div>}</>;
  };
  const describedBy = (key: string, base?: string) => [fieldErrors[key] ? `${key}-error` : "", issues.some(issue => issue.field === key) ? `${key}-stored-issue` : "", base || ""].filter(Boolean).join(" ") || undefined;
  const stockQuantity = form.quantity.trim() && Number.isSafeInteger(Number(form.quantity)) && Number(form.quantity) >= 0 ? Number(form.quantity) : null;

  if (loading) return <div className="adm-editor-loading" role="status"><LoaderCircle size={28} className="spin" aria-hidden="true" /><h2>Getting the details ready.</h2><p className="adm-muted">Loading this product from your catalog.</p></div>;
  if (loadError) return <div className="adm-panel adm-error-state" role="alert"><Package size={36} strokeWidth={1.4} aria-hidden="true" /><h1>We couldn’t open this product.</h1><p className="adm-muted">{loadError}</p><div className="adm-inline-actions"><button type="button" className="adm-button adm-button-primary" onClick={() => setRetry((value) => value + 1)}><RotateCcw size={16} aria-hidden="true" />Try again</button><Link href="/admin/products" className="adm-button adm-button-secondary">Back to products</Link></div></div>;
  if (created) return <div className="adm-created-state"><div className="adm-created-icon"><CheckCircle2 size={38} strokeWidth={1.5} aria-hidden="true" /></div><p className="adm-page-eyebrow">A new addition</p><h1>Your product is in.</h1><p className="adm-muted"><strong>{created.title}</strong> has been saved to the catalog. It is now available to the storefront.</p><div className="adm-inline-actions"><Link href={`/admin/products/${created._id}/edit`} className="adm-button adm-button-primary">Edit product<ArrowUpRight size={17} aria-hidden="true" /></Link><Link href="/admin/products" className="adm-button adm-button-secondary">View all products</Link></div><Link href={`/products/${created._id}`} className="adm-text-link">Preview in storefront<ArrowUpRight size={15} aria-hidden="true" /></Link></div>;

  return (
    <div>
      <div className="adm-page-heading adm-editor-heading">
        <div><Link href="/admin/products" className="adm-back-link"><ArrowLeft size={15} aria-hidden="true" />All products</Link><p className="adm-page-eyebrow">{editing ? "Refine the details" : "Make room for something good"}</p><h1>{editing ? "Edit product" : "Add a product"}<span className="adm-heading-dot">.</span></h1><p className="adm-muted">{editing ? "A thoughtful update. A better shopping experience." : "Bring a new favourite to your UWA collection."}</p></div>
        {editing && <Link href={`/products/${productId}`} className="adm-button adm-button-secondary">View storefront<ArrowUpRight size={16} aria-hidden="true" /></Link>}
      </div>
      {editing && <p className="adm-record-id">Product ID: <code>{productId}</code></p>}
      {issues.length > 0 && <div className="adm-notice adm-notice-warning"><CircleHelp size={18} aria-hidden="true" /><div><strong>A little catalog housekeeping</strong><p>This stored record needs review: {[...new Set(issues.map(issue => issue.field))].join(", ")}. Original values appear beside their fields. You can repair selected details or leave them untouched while saving other changes. No fallback values are saved automatically.</p></div></div>}
      {saved && <div className="adm-notice adm-notice-success" role="status"><CheckCircle2 size={18} aria-hidden="true" /><div><strong>Changes saved.</strong> Your changed fields were saved.{issues.length > 0 && " This record still has stored details to review."}</div></div>}
      <form onSubmit={submit} className="adm-editor-grid" noValidate aria-busy={saving}>
        <div className="adm-editor-main">
          {error && <div className="adm-notice adm-notice-error" role="alert" ref={errorRef} tabIndex={-1}><div><strong>Let’s check that again.</strong><p>{error}</p></div></div>}
          <section className="adm-panel" aria-labelledby="product-details-heading">
            <div className="adm-panel-heading"><div><h2 id="product-details-heading">The essentials</h2><p className="adm-muted">Clear details help good products find their people.</p></div><span className="adm-panel-step">01</span></div>
            <div className="adm-panel-body adm-form-grid">
              <div className="adm-field"><label htmlFor="title">Product title <span aria-hidden="true">*</span></label><input id="title" name="title" value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="Give this product a clear, memorable name" maxLength={200} required disabled={disabled} aria-invalid={!!fieldErrors.title} aria-describedby={describedBy("title")} />{help("title")}</div>
              <div className="adm-field"><label htmlFor="slug">Product slug <span aria-hidden="true">*</span></label><input id="slug" name="slug" value={form.slug} onChange={(event) => { setSlugEdited(true); setField("slug", event.target.value); }} placeholder="your-product-name" maxLength={200} required={!editing} disabled={disabled} autoCapitalize="none" spellCheck={false} aria-invalid={!!fieldErrors.slug} aria-describedby={describedBy("slug", "slug-help")} /><p className="adm-field-help" id="slug-help">A unique catalog identifier. Use lowercase words separated by hyphens. Existing product links keep their original ID.</p>{help("slug")}</div>
              <div className="adm-field"><label htmlFor="description">Description <span aria-hidden="true">*</span></label><textarea id="description" name="description" value={form.description} onChange={(event) => setField("description", event.target.value)} rows={7} placeholder="What makes it special? Include useful details, materials and features." maxLength={20000} required={!editing} disabled={disabled} aria-invalid={!!fieldErrors.description} aria-describedby={describedBy("description", "description-help")} /><div className="adm-field-meta"><p className="adm-field-help" id="description-help">Plain text. Keep it helpful, honest and easy to read.</p><span>{form.description.length.toLocaleString()} / 20,000</span></div>{help("description")}</div>
            </div>
          </section>
          <section className="adm-panel" aria-labelledby="product-attributes-heading">
            <div className="adm-panel-heading"><div><h2 id="product-attributes-heading">Details that define it</h2><p className="adm-muted">Make browsing and discovery feel effortless.</p></div><span className="adm-panel-step">02</span></div>
            <div className="adm-panel-body adm-form-grid">
              <div className="adm-form-row">
                <div className="adm-field"><label htmlFor="brand">Brand {!editing && <span aria-hidden="true">*</span>}</label><input id="brand" name="brand" value={form.brand} onChange={(event) => setField("brand", event.target.value)} placeholder={editing && !original?.brand ? "Not set — older record" : "e.g. brand name"} maxLength={120} required={!editing} disabled={disabled} aria-invalid={!!fieldErrors.brand} aria-describedby={describedBy("brand")} />{help("brand")}</div>
                <div className="adm-field"><label htmlFor="category">Category {!editing && <span aria-hidden="true">*</span>}</label><input id="category" name="category" value={form.category} onChange={(event) => setField("category", event.target.value)} placeholder={editing && !original?.category ? "Not set — older record" : "e.g. Electronics"} maxLength={120} required={!editing} disabled={disabled} aria-invalid={!!fieldErrors.category} aria-describedby={describedBy("category")} />{help("category")}</div>
              </div>
              <div className="adm-field"><label htmlFor="color">Color {!editing && <span aria-hidden="true">*</span>}</label><input id="color" name="color" value={form.color} onChange={(event) => setField("color", event.target.value)} placeholder={editing && !original?.color ? "Not set — older record" : "e.g. Black, warm white, or assorted"} maxLength={120} required={!editing} disabled={disabled} aria-invalid={!!fieldErrors.color} aria-describedby={describedBy("color")} />{help("color")}</div>
            </div>
          </section>
          <ImageManager images={form.images} onChange={setImages} disabled={saving} onPendingChange={setPendingImages} onBusyChange={setUploading} />
          <div aria-live="polite">{help("images")}</div>
          {galleryNeedsReview && <div className="adm-gallery-review"><input id="confirm-gallery-replacement" type="checkbox" checked={galleryReplacementReviewed} onChange={event => { setGalleryReplacementReviewed(event.target.checked); setFieldErrors(current => { const next = { ...current }; delete next.images; return next; }); }} disabled={disabled} aria-describedby="gallery-review-help" /><div><label htmlFor="confirm-gallery-replacement">I reviewed the safe image references and want to replace the stored gallery.</label><p className="adm-field-help" id="gallery-review-help">Some original entries cannot be previewed. Saving these gallery changes removes unsupported entries. Unrelated product edits keep the stored gallery untouched.</p></div></div>}
          <div className="adm-editor-bottom"><Link href="/admin/products" className="adm-button adm-button-secondary">Back to products</Link><button type="submit" className="adm-button adm-button-primary" disabled={disabled || pendingImages || !changed}>{saving ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}{saving ? "Saving product…" : editing ? "Save changes" : "Create product"}</button></div>
        </div>
        <aside className="adm-editor-sidebar" aria-label="Pricing, stock and save controls">
          <section className="adm-panel" aria-labelledby="product-pricing-heading">
            <div className="adm-panel-heading"><div><h2 id="product-pricing-heading">Price & inventory</h2><p className="adm-muted">Ready for the shelf.</p></div></div>
            <div className="adm-panel-body adm-form-grid">
              <div className="adm-field"><label htmlFor="price">Price <span aria-hidden="true">*</span></label><input id="price" name="price" type="number" inputMode="decimal" min="0" max={Number.MAX_SAFE_INTEGER} step="any" value={form.price} onChange={(event) => setField("price", event.target.value)} placeholder="0.00" required disabled={disabled} aria-invalid={!!fieldErrors.price} aria-describedby={describedBy("price", "price-help")} /><p className="adm-field-help" id="price-help">Store currency: {money(0).replace(/[\d\s.,]/g, "") || "configured store currency"}. Enter the full selling price.</p>{help("price")}</div>
              <div className="adm-field"><label htmlFor="quantity">Stock quantity <span aria-hidden="true">*</span></label><input id="quantity" name="quantity" type="number" inputMode="numeric" min="0" max={Number.MAX_SAFE_INTEGER} step="1" value={form.quantity} onChange={(event) => setField("quantity", event.target.value)} required disabled={disabled} aria-invalid={!!fieldErrors.quantity} aria-describedby={describedBy("quantity", "quantity-help")} /><p className="adm-field-help" id="quantity-help">Use a whole number. Zero marks this product as out of stock.</p>{help("quantity")}</div>
              <div className={`adm-stock-indicator ${stockQuantity === null ? "adm-stock-unavailable" : stockQuantity === 0 ? "adm-stock-out" : stockQuantity <= 5 ? "adm-stock-low" : "adm-stock-in"}`}><span aria-hidden="true" />{stockQuantity === null ? editing ? "Stock unavailable" : "Set stock quantity" : stockQuantity === 0 ? "Out of stock" : stockQuantity <= 5 ? "Low stock" : "In stock"}</div>
            </div>
          </section>
          <section className="adm-panel adm-save-panel" aria-labelledby="product-save-heading">
            <div className="adm-panel-body"><p className="adm-page-eyebrow">Your next good addition</p><h2 id="product-save-heading">{editing ? "Make it count." : "Ready when you are."}</h2><dl className="adm-summary-list"><div><dt>Images</dt><dd>{form.images.length ? `${form.images.length} in gallery` : "Not added yet"}</dd></div><div><dt>Price</dt><dd>{form.price.trim() && Number.isFinite(Number(form.price)) && Number(form.price) >= 0 ? money(Number(form.price)) : "Not set"}</dd></div><div><dt>Changes</dt><dd>{editing ? changed ? "Unsaved changes" : "Up to date" : "New product draft"}</dd></div></dl><button className="adm-button adm-button-primary" type="submit" disabled={disabled || pendingImages || !changed}>{saving ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : saved && !changed ? <Check size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}{saving ? "Saving product…" : editing ? "Save changes" : "Create product"}</button>{pendingImages && <p className="adm-field-help">Upload or remove selected files before saving.</p>}<p className="adm-field-help">{editing ? "Only your changed fields are saved. Existing catalog information stays untouched." : "This product will be visible in the storefront after it is saved."}</p></div>
          </section>
          <div className="adm-editor-tip"><ImagePlus size={20} strokeWidth={1.5} aria-hidden="true" /><h3>A strong first impression</h3><p className="adm-muted">Choose a clear primary image. A consistent background helps your collection feel considered.</p></div>
        </aside>
      </form>
    </div>
  );
}
