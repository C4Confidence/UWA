const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");

function unauthorized() {
    const error = new Error("Please sign in again to continue.");
    error.status = 401;
    return error;
}

const authMiddleware = asyncHandler(async (req, res, next) => {
    const authorization = req.get("authorization");
    const match = typeof authorization === "string" ? authorization.match(/^Bearer ([^\s]+)$/i) : null;
    if (!match || match[1].length > 4096) throw unauthorized();
    let decoded;
    try {
        decoded = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
        throw unauthorized();
    }
    if (!decoded || typeof decoded !== "object" || typeof decoded.id !== "string" ||
        !/^[a-f\d]{24}$/i.test(decoded.id) || (decoded.type !== undefined && decoded.type !== "access")) {
        throw unauthorized();
    }
    // Privileges always come from the current database record, never a JWT role claim.
    const user = await User.findById(decoded.id).select(
        "firstname lastname email mobile role isBlocked passwordChangedAt createdAt updatedAt",
    );
    if (!user) throw unauthorized();
    if (user.passwordChangedAt && (!decoded.iat || decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000))) {
        throw unauthorized();
    }
    if (user.isBlocked) {
        const error = new Error("This account is blocked. Please contact the store administrator.");
        error.status = 403;
        throw error;
    }
    req.user = user;
    next();
});

const isAdmin = (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role !== "admin") {
        const error = new Error("Administrator access is required.");
        error.status = 403;
        return next(error);
    }
    next();
};
module.exports = { authMiddleware, isAdmin };
