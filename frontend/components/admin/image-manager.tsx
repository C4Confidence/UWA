"use client";

/* Uploaded previews use blob URLs; existing catalog images may use arbitrary supported HTTPS hosts. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ImagePlus, ImageOff, LoaderCircle, Plus, Star, Trash2, Upload, X } from "lucide-react";
import { uploadAdminImages, validImageReference } from "@/lib/admin-api";
import { useAdmin } from "./admin-shell";

interface PendingImage {
  id: number;
  file: File;
  preview: string;
}

function ImagePreview({ source, alt }: { source: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  return (
    <div className="adm-image-preview">
      {failed ? <div className="adm-image-unavailable"><ImageOff size={24} aria-hidden="true" /><span>Image unavailable</span></div> : <img src={source} alt={alt} loading="lazy" onError={() => setFailed(true)} />}
    </div>
  );
}

export function ImageManager({
  images,
  onChange,
  disabled = false,
  onPendingChange,
  onBusyChange,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
  onPendingChange: (pending: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { token, handleError } = useAdmin();
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const previews = useRef(new Set<string>());
  const serial = useRef(0);
  const uploadLock = useRef(false);
  const locked = disabled || uploading;

  useEffect(() => {
    onPendingChange(pending.length > 0);
  }, [pending.length, onPendingChange]);
  useEffect(() => {
    const urls = previews.current;
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  function selectFiles(files: FileList | null) {
    if (!files || locked) return;
    setError("");
    setNotice("");
    const selected = Array.from(files);
    if (selected.length + pending.length > 8) {
      setError("Choose up to 8 images per upload. Upload or remove the selected images first.");
      if (input.current) input.current.value = "";
      return;
    }
    if (selected.length + pending.length + images.length > 32) {
      setError("A product can have up to 32 image references. Remove an image before adding more.");
      if (input.current) input.current.value = "";
      return;
    }
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024)) {
      setError("Choose JPEG, PNG or WebP images, each no larger than 5 MB. Empty files aren’t supported.");
      if (input.current) input.current.value = "";
      return;
    }
    const additions = selected.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { id: serial.current++, file, preview };
    });
    setPending((current) => [...current, ...additions]);
    if (input.current) input.current.value = "";
  }

  function removePending(id: number) {
    setPending((current) => current.filter((item) => {
      if (item.id !== id) return true;
      URL.revokeObjectURL(item.preview);
      previews.current.delete(item.preview);
      return false;
    }));
  }

  async function upload() {
    if (locked || uploadLock.current || !pending.length) return;
    uploadLock.current = true;
    setUploading(true);
    onBusyChange(true);
    setError("");
    setNotice("");
    try {
      const uploaded = await uploadAdminImages(pending.map((item) => item.file), token);
      onChange([...images, ...uploaded]);
      pending.forEach((item) => { URL.revokeObjectURL(item.preview); previews.current.delete(item.preview); });
      setPending([]);
      setNotice(`${uploaded.length === 1 ? "Image uploaded" : `${uploaded.length} images uploaded`}. Save the product to publish these image references.`);
    } catch (cause) {
      if (!handleError(cause)) setError(cause instanceof Error ? cause.message : "We couldn’t upload these images. Please try again.");
    } finally {
      uploadLock.current = false;
      setUploading(false);
      onBusyChange(false);
    }
  }

  function addPath() {
    if (locked) return;
    const value = path.trim();
    setError("");
    setNotice("");
    if (!validImageReference(value)) {
      setError("Enter a local image path beginning with /, or a complete HTTPS image URL without embedded credentials.");
      return;
    }
    if (images.includes(value)) {
      setError("This image is already in the product gallery.");
      return;
    }
    if (images.length + pending.length >= 32) {
      setError("A product can have up to 32 image references.");
      return;
    }
    onChange([...images, value]);
    setPath("");
    setNotice("Image reference added to this draft. Save the product to publish it.");
  }

  function move(index: number, destination: number) {
    const next = [...images];
    const [image] = next.splice(index, 1);
    next.splice(destination, 0, image);
    onChange(next);
  }

  return (
    <section className="adm-panel" aria-labelledby="product-images-heading">
      <div className="adm-panel-heading"><div><h2 id="product-images-heading">Product images</h2><p className="adm-muted">Let the details do the talking. The first image leads your storefront listing.</p></div><span className="adm-count-tag">{images.length} / 32</span></div>
      <div className="adm-panel-body">
        {images.length > 0 ? <ol className="adm-image-grid" aria-label="Product image order">
          {images.map((image, index) => <li className="adm-image-card" key={`${index}-${image}`}>
            <ImagePreview source={image} alt={`Product image ${index + 1}`} />
            <span className="adm-image-badge">{index === 0 ? <><Star size={12} aria-hidden="true" /> Primary</> : `Image ${index + 1}`}</span>
            <p className="adm-image-source" title={image}>{image}</p>
            <div className="adm-image-actions">
              <button type="button" className="adm-icon-button" aria-label={`Make image ${index + 1} primary`} title="Make primary" disabled={locked || index === 0} onClick={() => move(index, 0)}><Star size={15} aria-hidden="true" /></button>
              <button type="button" className="adm-icon-button" aria-label={`Move image ${index + 1} earlier`} title="Move earlier" disabled={locked || index === 0} onClick={() => move(index, index - 1)}><ArrowUp size={15} aria-hidden="true" /></button>
              <button type="button" className="adm-icon-button" aria-label={`Move image ${index + 1} later`} title="Move later" disabled={locked || index === images.length - 1} onClick={() => move(index, index + 1)}><ArrowDown size={15} aria-hidden="true" /></button>
              <button type="button" className="adm-icon-button adm-icon-danger" aria-label={`Remove image ${index + 1} reference`} title="Remove reference" disabled={locked} onClick={() => onChange(images.filter((_, current) => current !== index))}><Trash2 size={15} aria-hidden="true" /></button>
            </div>
          </li>)}
        </ol> : <div className="adm-images-empty"><ImagePlus size={30} strokeWidth={1.4} aria-hidden="true" /><p>No images yet</p><span className="adm-muted">Add considered visuals to bring this product to life.</span></div>}

        <div className="adm-upload-zone">
          <div className="adm-upload-icon"><Upload size={23} aria-hidden="true" /></div>
          <div><h3>Add images from your device</h3><p className="adm-muted">JPEG, PNG or WebP. Up to 8 files per upload, 5 MB each.</p></div>
          <input ref={input} id="product-image-files" className="adm-visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={locked} onChange={(event) => selectFiles(event.target.files)} />
          <button type="button" className="adm-button adm-button-secondary" onClick={() => input.current?.click()} disabled={locked}><Plus size={16} aria-hidden="true" />Choose images</button>
        </div>

        {pending.length > 0 && <div className="adm-upload-pending" aria-label="Selected images awaiting upload">
          <div className="adm-section-line"><div><h3>Ready to upload</h3><p className="adm-muted">Preview your selection before sending files.</p></div><span className="adm-count-tag">{pending.length} selected</span></div>
          <ul className="adm-image-grid">
            {pending.map((item) => <li className="adm-image-card" key={item.id}>
              <ImagePreview source={item.preview} alt={`Selected file ${item.file.name}`} />
              <span className="adm-image-badge adm-image-badge-pending">Not uploaded</span>
              <p className="adm-image-source" title={item.file.name}>{item.file.name}</p>
              <button className="adm-icon-button adm-pending-remove" type="button" disabled={locked} onClick={() => removePending(item.id)} aria-label={`Remove selected file ${item.file.name}`}><X size={16} aria-hidden="true" /></button>
            </li>)}
          </ul>
          <button type="button" className="adm-button adm-button-primary" onClick={upload} disabled={locked}>{uploading ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <Upload size={17} aria-hidden="true" />}{uploading ? "Uploading images…" : `Upload ${pending.length === 1 ? "image" : `${pending.length} images`}`}</button>
        </div>}

        <div className="adm-image-path-field">
          <label htmlFor="existing-image-path">Or add an existing image</label>
          <div className="adm-image-path-row"><input id="existing-image-path" type="text" value={path} onChange={(event) => setPath(event.target.value)} placeholder="/redmi.jpg or https://…" autoCapitalize="none" spellCheck={false} maxLength={2048} disabled={locked} /><button className="adm-button adm-button-secondary" type="button" onClick={addPath} disabled={locked || !path.trim()}><Plus size={16} aria-hidden="true" />Add image</button></div>
          <p className="adm-field-help">Use a path served by UWA or a publicly accessible HTTPS image. Removing a reference does not delete the original file.</p>
        </div>
        {error && <p className="adm-notice adm-notice-error" role="alert">{error}</p>}
        {notice && <p className="adm-notice adm-notice-success" role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
      </div>
    </section>
  );
}
