const Product = require("../models/productModel");
const asyncHandler = require("express-async-handler");
const { validateProductInput, parseProductQuery, requireProductId, requestError } = require("../utils/productValidation");

const createProduct = asyncHandler(async (req, res) => {
    const input = validateProductInput(req.body);
    const product = await Product.create(input);
    res.status(201).json(product);
});

const updateProduct = asyncHandler(async (req, res) => {
    requireProductId(req.params.id);
    const input = validateProductInput(req.body, { partial: true });
    // Validate only explicitly edited paths so older metadata is never silently replaced.
    const product = await Product.findByIdAndUpdate(req.params.id, { $set: input }, { new: true, runValidators: true });
    if (!product) throw requestError("Product not found.", 404);
    res.json(product);
});

const deleteProduct = asyncHandler(async (req, res) => {
    requireProductId(req.params.id);
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw requestError("Product not found.", 404);
    // References may be shared by other products; removing a product never deletes image files.
    res.json(product);
});

const getaProduct = asyncHandler(async (req, res) => {
    requireProductId(req.params.id);
    const product = await Product.findById(req.params.id).select("-__v");
    if (!product) throw requestError("Product not found.", 404);
    res.json(product);
});

const getAllProduct = asyncHandler(async (req, res) => {
    const { filter, sort, page, limit, fields } = parseProductQuery(req.query);
    const products = await Product.find(filter).sort(sort).select(fields).skip((page - 1) * limit).limit(limit);
    // Preserve the storefront's public response envelope, including empty catalogs.
    res.json({ status: "success", results: products.length, data: { products } });
});

const getAdminProducts = asyncHandler(async (req, res) => {
    const { filter, sort, page, limit } = parseProductQuery(req.query, { admin: true });
    const [products, total, aggregate] = await Promise.all([
        Product.find(filter).sort(sort).select("-__v").skip((page - 1) * limit).limit(limit),
        Product.countDocuments(filter),
        Product.aggregate([{ $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            inStock: { $sum: { $cond: [{ $gt: ["$quantity", 0] }, 1, 0] } },
            lowStock: { $sum: { $cond: [{ $and: [{ $gt: ["$quantity", 0] }, { $lte: ["$quantity", 5] }] }, 1, 0] } },
            outOfStock: { $sum: { $cond: [{ $eq: ["$quantity", 0] }, 1, 0] } },
            totalUnits: { $sum: "$quantity" },
            categories: { $addToSet: "$category" },
        } }]),
    ]);
    const summary = aggregate.length ? { ...aggregate[0] } : { totalProducts: 0, inStock: 0, lowStock: 0, outOfStock: 0, totalUnits: 0 };
    const categories = (summary.categories || []).filter(category => typeof category === "string" && category.trim()).sort((a, b) => a.localeCompare(b));
    delete summary._id;
    delete summary.categories;
    res.json({ products, page, limit, total, totalPages: Math.ceil(total / limit), summary, categories });
});

module.exports = { createProduct, getaProduct, getAllProduct, updateProduct, deleteProduct, getAdminProducts };
