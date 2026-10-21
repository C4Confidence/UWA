const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const asyncHandler = require("express-async-handler");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const { requestError } = require("../utils/productValidation");
const { getImageStorage } = require("../services/imageStorage");

const MAX_FILES = 8;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_INPUT_DIMENSION = 12_000;
const MAX_OUTPUT_DIMENSION = 2048;
const MIME_FORMAT = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };

const receiveImages = multer({
    storage: multer.memoryStorage(),
    limits: { files: MAX_FILES, fileSize: MAX_FILE_BYTES, fields: 0, parts: MAX_FILES + 2, fieldNameSize: 100, headerPairs: 100 },
    fileFilter(req, file, callback) {
        if (!Object.prototype.hasOwnProperty.call(MIME_FORMAT, file.mimetype)) return callback(requestError("Upload JPEG, PNG, or WebP images only.", 415));
        callback(null, true);
    },
}).array("images", MAX_FILES);

function imageSignature(buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
    if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
    return null;
}

async function normalizeImage(file) {
    const expected = MIME_FORMAT[file.mimetype];
    if (!expected || imageSignature(file.buffer) !== expected) throw requestError("The image contents do not match a supported JPEG, PNG, or WebP file.", 415);
    try {
        const image = sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "warning", animated: false });
        const metadata = await image.metadata();
        if (metadata.format !== expected || !metadata.width || !metadata.height || metadata.width > MAX_INPUT_DIMENSION || metadata.height > MAX_INPUT_DIMENSION || metadata.width * metadata.height > MAX_INPUT_PIXELS || (metadata.pages || 1) !== 1) {
            throw requestError("Use a static image no larger than 12,000 pixels per side and 40 megapixels.", 400);
        }
        // Full decoding catches malformed/truncated content. Re-encoding removes original
        // metadata and prevents serving uploaded executable or embedded source bytes.
        return await image.rotate().resize({ width: MAX_OUTPUT_DIMENSION, height: MAX_OUTPUT_DIMENSION, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch (error) {
        if (error.status) throw error;
        throw requestError("This image could not be decoded safely. Use a valid static JPEG, PNG, or WebP image under the size and pixel limits.", 400);
    }
}

function createUploadRouter({ storage } = {}) {
    const router = express.Router();
    let activeUploads = 0;
    // Authorization runs before multipart parsing or image decoding.
    router.use(authMiddleware, isAdmin);
    router.post("/", asyncHandler(async (req, res) => {
        if (activeUploads >= 2) throw requestError("The image uploader is busy. Please try again shortly.", 429);
        activeUploads++;
        try {
            await new Promise((resolve, reject) => receiveImages(req, res, error => error ? reject(error) : resolve()));
            if (!req.files?.length) throw requestError("Choose at least one image to upload.");
            const images = [];
            // Keep decoding bounded; the complete batch is verified before any file is saved.
            for (const file of req.files) images.push(await normalizeImage(file));
            if (req.aborted || res.destroyed) return;
            const uploaded = await (storage || getImageStorage()).writeBatch(images);
            res.status(201).json({ images: uploaded });
        } finally {
            activeUploads--;
        }
    }));
    return router;
}

module.exports = createUploadRouter();
module.exports.createUploadRouter = createUploadRouter;
