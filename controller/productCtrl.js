const { query } = require("express");
const Product = require("../models/productModel");
const asyncHandler = require("express-async-handler");
const slugify = require("slugify");

const createProduct = asyncHandler(async (req, res) => {
    try {
        if(req.body.title) {
            req.body.slug = slugify(req.body.title);
        }
        const newProduct = await Product.create(req.body);
        res.json(newProduct);

    } catch (error) {
        throw new Error(error);
    }
    
});

const updateProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        if (req.body.title) {
            req.body.slug = slugify(req.body.title);
        }
        const updateProduct = await Product.findByIdAndUpdate(id, req.body, {
            new: true,
        });
        res.json(updateProduct);

    } catch (error) {
        throw new Error(error);
    }
});

const deleteProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
        const deleteProduct = await Product.findByIdAndDelete(id);
        res.json(deleteProduct);

    } catch (error) {
        throw new Error(error);
    }
});

const getaProduct = asyncHandler (async (req, res) => {
    const { id } = req.params;
    try {
        const findProduct = await Product.findById(id);
        res.json(findProduct);

    }
    catch (error) {
        throw new Error(error);
    }
});

const getAllProduct = asyncHandler(async (req, res) => {
    try {
        // Filtering
        const queryObj = { ...req.query };
        const excludeFields = ["page", "sort", "limit", "fields"];
        excludeFields.forEach((el) => delete queryObj[el]);

        // Convert to MongoDB-friendly query string
        let queryStr = JSON.stringify(queryObj);
        queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
        let query = Product.find(JSON.parse(queryStr));

        // Sorting
        if (req.query.sort) {
            const sortBy = req.query.sort.split(",").join(" ");
            query = query.sort(sortBy);
        } else {
            query = query.sort("-createdAt");
        }

        // Limiting Fields
        if (req.query.fields) {
            const fields = req.query.fields.split(",").join(" ");
            query = query.select(fields);
        } else {
            query = query.select("-__v");
        }

        // Pagination with defaults
        const page = req.query.page * 1 || 1; // Default to page 1
        const limit = req.query.limit * 1 || 10; // Default to 10 items per page
        const skip = (page - 1) * limit;

        query = query.skip(skip).limit(limit);

        // Check for invalid page numbers
        if (req.query.page) {
            const productCount = await Product.countDocuments();
            if (skip >= productCount) {
                return res.status(404).json({ message: "This Page does not exist" });
            }
        }

        // Execute query
        const products = await query;
        res.status(200).json({
            status: "success",
            results: products.length,
            data: {
                products
            }
        });

    } catch (error) {
        console.error("Error fetching products:", error);
        return res.status(500).json({ message: "Server Error", error: error.message });
    }
});

module.exports = { 
    createProduct, 
    getaProduct, 
    getAllProduct, 
    updateProduct, 
    deleteProduct,
 }
