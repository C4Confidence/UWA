const express = require("express");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const { getAdminProducts, getaProduct, createProduct, updateProduct, deleteProduct } = require("../controller/productCtrl");

const router = express.Router();
router.use(authMiddleware, isAdmin);
router.get("/", getAdminProducts);
router.get("/:id", getaProduct);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.patch("/:id", updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;
