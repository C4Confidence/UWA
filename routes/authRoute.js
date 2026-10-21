const express = require("express");
const { rateLimit } = require("express-rate-limit");
const {
    createUser,
    loginUserCtrl,
    currentUser,
    getallUser,
    getaUser,
    deleteaUser,
    updatedUser,
    blockUser,
    unblockUser,
    handleRefreshToken,
    logout,
    updatePassword,
} = require("../controller/userCtrl");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const router = express.Router();
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { message: "Too many sign-in attempts. Please try again later." },
});
const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many account creation attempts. Please try again later." },
});
router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});
router.post("/register", registrationLimiter, createUser);
router.put("/password", authMiddleware, updatePassword);
router.post("/login", loginLimiter, loginUserCtrl);
router.get("/me", authMiddleware, currentUser);
router.get("/all-Users", authMiddleware, isAdmin, getallUser);
router.get("/refresh", loginLimiter, handleRefreshToken);
router.get("/logout", logout);
router.post("/logout", logout);
router.get("/:id", authMiddleware, isAdmin, getaUser);
router.delete("/:id", authMiddleware, isAdmin, deleteaUser);
router.put("/edit-user", authMiddleware, updatedUser);
router.put("/block-user/:id", authMiddleware, isAdmin, blockUser);
router.put("/unblock-user/:id", authMiddleware, isAdmin, unblockUser);



module.exports = router;
