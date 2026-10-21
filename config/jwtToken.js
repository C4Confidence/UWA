const jwt = require("jsonwebtoken");

const generateToken = (id) => {
    return jwt.sign({ id: String(id), type: "access" }, process.env.JWT_SECRET, {
        expiresIn: "1d", algorithm: "HS256",
    });
};

module.exports = { generateToken };
