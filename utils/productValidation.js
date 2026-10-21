const slugify = require("slugify");

const PRODUCT_FIELDS = new Set(["title", "slug", "description", "price", "category", "brand", "color", "quantity", "images"]);
const STRING_LIMITS = { title: 200, slug: 200, description: 20000, category: 120, brand: 120, color: 120 };
const SORT_FIELDS = new Set(["title", "price", "quantity", "createdAt", "updatedAt", "_id"]);
const PUBLIC_FIELDS = new Set(["_id", "title", "slug", "description", "price", "category", "brand", "quantity", "sold", "images", "color", "ratings", "createdAt", "updatedAt"]);

function requestError(message, status = 400, fields) {
    const error = new Error(message);
    error.status = status;
    if (fields) error.fields = fields;
    return error;
}

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value)
        && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function safeImageReference(value) {
    if (typeof value !== "string" || !value || value.length > 2048 || value !== value.trim() || /[\u0000-\u001f\u007f\\]/.test(value)) return false;
    if (value.startsWith("/")) {
        if (value.startsWith("//")) return false;
        let decoded = value.split(/[?#]/, 1)[0];
        try {
            for (let i = 0; i < 2; i++) decoded = decodeURIComponent(decoded);
        } catch { return false; }
        if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.split("/").some(part => part === "." || part === "..")) return false;
        if (/^\/(api|_next|admin)(\/|$)/i.test(decoded)) return false;
        return true;
    }
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
    } catch { return false; }
}

function safeMetadata(value, depth = 0) {
    if (depth > 4) return false;
    if (value === null || typeof value === "boolean") return true;
    if (typeof value === "string") return value.length <= 4096;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.length <= 32 && value.every(item => safeMetadata(item, depth + 1));
    if (!isPlainObject(value)) return false;
    const keys = Object.keys(value);
    return keys.length <= 20 && keys.every(key => !key.startsWith("$") && !key.includes(".") && !["__proto__", "constructor", "prototype"].includes(key) && safeMetadata(value[key], depth + 1));
}

function validateImages(images) {
    if (!Array.isArray(images) || images.length > 32) throw requestError("Images must be an array with at most 32 image references.", 400, { images: "Use at most 32 images." });
    for (const image of images) {
        const reference = typeof image === "string" ? image : isPlainObject(image) ? image.url : null;
        if (!safeImageReference(reference) || (typeof image !== "string" && (!safeMetadata(image) || JSON.stringify(image).length > 8192))) {
            throw requestError("Each image must be a safe root-relative path or HTTPS URL, or a compatible object with a valid url.", 400, { images: "Use a root-relative image path or a valid HTTPS URL." });
        }
    }
    return images;
}

function validateProductInput(body, { partial = false } = {}) {
    if (!isPlainObject(body)) throw requestError("A product JSON object is required.");
    const keys = Object.keys(body);
    if (!keys.length) throw requestError("Provide at least one product field.");
    if (keys.some(key => !PRODUCT_FIELDS.has(key))) throw requestError("The product contains unsupported fields. Only catalog fields may be changed.");
    const result = {};
    const fields = {};
    for (const [name, max] of Object.entries(STRING_LIMITS)) {
        if (!Object.prototype.hasOwnProperty.call(body, name)) {
            if (!partial && name !== "slug") fields[name] = `${name} is required.`;
            continue;
        }
        if (typeof body[name] !== "string" || !body[name].trim() || body[name].trim().length > max) {
            fields[name] = `Provide ${name} as text between 1 and ${max} characters.`;
            continue;
        }
        result[name] = body[name].trim();
    }
    if (result.slug) {
        result.slug = slugify(result.slug, { lower: true, strict: true, trim: true });
        if (!result.slug || result.slug.length > STRING_LIMITS.slug) fields.slug = "Provide a slug containing letters or numbers.";
    } else if (!partial && !Object.prototype.hasOwnProperty.call(body, "slug") && result.title) {
        result.slug = slugify(result.title, { lower: true, strict: true, trim: true });
        if (!result.slug || result.slug.length > STRING_LIMITS.slug) fields.slug = "Provide a slug containing letters or numbers, up to 200 characters.";
    }
    for (const name of ["price", "quantity"]) {
        if (!Object.prototype.hasOwnProperty.call(body, name)) {
            if (!partial) fields[name] = `${name} is required.`;
            continue;
        }
        const value = body[name];
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || (name === "quantity" && !Number.isSafeInteger(value))) {
            fields[name] = name === "quantity" ? "Stock quantity must be a non-negative safe integer." : "Price must be a finite non-negative number within the supported range.";
        } else result[name] = value;
    }
    if (Object.keys(fields).length) throw requestError("Please correct the product fields: " + Object.keys(fields).join(", ") + ".", 400, fields);
    if (Object.prototype.hasOwnProperty.call(body, "images")) result.images = validateImages(body.images);
    return result;
}

function stringQuery(value, name, maximum = 120) {
    if (typeof value !== "string" || value.length > maximum) throw requestError(`${name} must be text of at most ${maximum} characters.`);
    return value.trim();
}

function paginationInteger(value, name, defaultValue, maximum) {
    if (value === undefined) return defaultValue;
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) throw requestError(`${name} must be a positive integer.`);
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number > maximum) throw requestError(`${name} must be between 1 and ${maximum}.`);
    return number;
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function parseProductQuery(query, { admin = false } = {}) {
    const allowed = new Set(["q", "category", "brand", "color", "stock", "page", "limit", "sort"]);
    if (!admin) for (const name of ["title", "slug", "price", "quantity", "_id", "fields"]) allowed.add(name);
    if (Object.keys(query).some(key => !allowed.has(key))) throw requestError("The product query contains unsupported filters.");
    const page = paginationInteger(query.page, "page", 1, 100000);
    const limit = paginationInteger(query.limit, "limit", admin ? 12 : 10, 100);
    const filter = {};
    for (const key of ["category", "brand", "color", "title", "slug", "_id"]) {
        if (query[key] === undefined) continue;
        filter[key] = stringQuery(query[key], key, key === "title" ? 200 : 120);
        if (key === "_id" && !/^[a-f\d]{24}$/i.test(filter[key])) throw requestError("Provide a valid product identifier.");
    }
    if (query.q !== undefined) {
        const search = stringQuery(query.q, "q");
        if (search) filter.$or = ["title", "slug", "category", "brand"].map(field => ({ [field]: { $regex: escapeRegex(search), $options: "i" } }));
    }
    if (query.stock !== undefined) {
        const stock = stringQuery(query.stock, "stock", 20);
        if (stock === "in-stock") filter.quantity = { $gt: 0 };
        else if (stock === "low-stock") filter.quantity = { $gt: 0, $lte: 5 };
        else if (stock === "out-of-stock") filter.quantity = 0;
        else throw requestError("stock must be in-stock, low-stock, or out-of-stock.");
    }
    if (!admin) {
        for (const name of ["price", "quantity"]) {
            if (query[name] === undefined) continue;
            if (name === "quantity" && query.stock !== undefined) throw requestError("Use either quantity or stock, not both.");
            const value = query[name];
            const numeric = item => {
                if (typeof item !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(item)) throw requestError(`${name} must be non-negative numeric text.`);
                const number = Number(item);
                if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER) throw requestError(`${name} is outside the supported range.`);
                return number;
            };
            if (typeof value === "string") filter[name] = numeric(value);
            else if (isPlainObject(value) && Object.keys(value).length && Object.keys(value).every(key => ["gte", "gt", "lte", "lt"].includes(key))) {
                filter[name] = Object.fromEntries(Object.entries(value).map(([key, item]) => [`$${key}`, numeric(item)]));
            } else throw requestError(`Unsupported ${name} filter.`);
        }
    }
    const sort = {};
    const requestedSort = query.sort === undefined ? "-createdAt" : stringQuery(query.sort, "sort", 160);
    const sortParts = requestedSort.split(",");
    if (!requestedSort || sortParts.length > SORT_FIELDS.size) throw requestError("Provide a supported sort order.");
    for (const part of sortParts) {
        const field = part.startsWith("-") ? part.slice(1) : part;
        if (!SORT_FIELDS.has(field)) throw requestError("Unsupported product sort field.");
        sort[field] = part.startsWith("-") ? -1 : 1;
    }
    if (!Object.prototype.hasOwnProperty.call(sort, "_id")) sort._id = 1;
    let fields = "-__v";
    if (!admin && query.fields !== undefined) {
        const selected = stringQuery(query.fields, "fields", 240).split(",");
        if (!selected.length || selected.some(field => !PUBLIC_FIELDS.has(field))) throw requestError("Unsupported product projection.");
        fields = selected.join(" ");
    }
    return { filter, sort, page, limit, fields };
}

function requireProductId(id) {
    if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id)) throw requestError("Provide a valid product identifier.");
}

module.exports = { validateProductInput, validateImages, safeImageReference, parseProductQuery, requireProductId, requestError };
