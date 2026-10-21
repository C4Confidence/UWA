const path = require("node:path");
const fs = require("node:fs/promises");
const { randomUUID } = require("node:crypto");
const { requestError } = require("../utils/productValidation");

function getUploadDirectory() {
    return path.resolve(process.env.UPLOAD_DIR || "var/uploads");
}

function getPublicBaseUrl() {
    const base = process.env.UPLOAD_PUBLIC_BASE_URL;
    if (!base) return "/uploads";
    try {
        const url = new URL(base);
        if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Invalid upload origin");
        return url.href.replace(/\/+$/, "");
    } catch {
        throw requestError("Image storage is not configured correctly. Contact the administrator.", 503);
    }
}

/**
 * Storage adapter: writeBatch accepts verified, re-encoded WebP buffers and returns
 * [{url}]. A production object-storage integration can implement this same boundary.
 * Removing a product reference deliberately never deletes a shared stored asset.
 */
function createFilesystemStorage(directory, { publicBaseUrl = "/uploads" } = {}) {
    const root = path.resolve(directory);
    return {
        async writeBatch(buffers) {
            if (!Array.isArray(buffers) || !buffers.length || buffers.some(buffer => !Buffer.isBuffer(buffer))) throw new TypeError("Verified image buffers are required.");
            const files = buffers.map(buffer => {
                const name = `${randomUUID()}.webp`;
                return { buffer, name, temporary: path.join(root, `.${name}.tmp`), target: path.join(root, name) };
            });
            const ownedPaths = new Set();
            try {
                await fs.mkdir(root, { recursive: true, mode: 0o755 });
                // Validate the complete request before entering this adapter, then stage
                // every file before publication. Roll back the batch on any I/O failure.
                for (const file of files) {
                    const handle = await fs.open(file.temporary, "wx", 0o644);
                    ownedPaths.add(file.temporary);
                    try { await handle.writeFile(file.buffer); }
                    finally { await handle.close(); }
                }
                for (const file of files) {
                    // An exclusive hard link publishes the complete staged file without
                    // ever replacing an existing asset, even in the event of a collision.
                    await fs.link(file.temporary, file.target);
                    ownedPaths.add(file.target);
                    await fs.unlink(file.temporary);
                    ownedPaths.delete(file.temporary);
                }
                return files.map(file => ({ url: `${publicBaseUrl.replace(/\/+$/, "")}/${file.name}` }));
            } catch {
                await Promise.allSettled([...ownedPaths].map(file => fs.unlink(file)));
                throw requestError("Image storage is temporarily unavailable. Please try again.", 503);
            }
        },
    };
}

function getImageStorage() {
    if (process.env.UPLOAD_STORAGE && process.env.UPLOAD_STORAGE !== "filesystem") {
        throw requestError("Image storage is not configured correctly. Contact the administrator.", 503);
    }
    if (process.env.NODE_ENV === "production" && (process.env.UPLOAD_STORAGE !== "filesystem" || !process.env.UPLOAD_DIR || !path.isAbsolute(process.env.UPLOAD_DIR))) {
        // An explicit absolute directory must be backed by a persistent mounted volume.
        // There is no silent production fallback to ephemeral local application storage.
        throw requestError("Persistent image storage is required before production uploads can be enabled.", 503);
    }
    return createFilesystemStorage(getUploadDirectory(), { publicBaseUrl: getPublicBaseUrl() });
}

module.exports = { getUploadDirectory, createFilesystemStorage, getImageStorage };
