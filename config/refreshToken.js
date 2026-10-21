const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const generateRefreshToken = (id) => {
    return jwt.sign({ id: String(id), type: "refresh" }, process.env.JWT_SECRET, {
        expiresIn: "3d", algorithm: "HS256", jwtid: crypto.randomBytes(16).toString("hex"),
    });
};

module.exports = { generateRefreshToken };
