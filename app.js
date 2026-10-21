const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const authRouter = require("./routes/authRoute");
const productRouter = require("./routes/productRoute");
const adminProductRouter = require("./routes/adminProductRoute");
const uploadRouter = require("./routes/uploadRoute");
const { getUploadDirectory, createFilesystemStorage } = require("./services/imageStorage");
const { notFound, errorHandler } = require("./middlewares/errorHandler");

// Importing the app never loads .env, connects to a database, or opens a port.
// Tests connect to an explicitly isolated database before constructing an app.
function createApp({ uploadDirectory, logging = process.env.NODE_ENV !== "test", trustProxy = false } = {}) {
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", trustProxy);
    app.set("request logging", logging);
    app.use((req, res, next) => {
        res.set("X-Content-Type-Options", "nosniff");
        res.set("Referrer-Policy", "strict-origin-when-cross-origin");
        next();
    });
    if (logging) app.use(morgan(":method :status :response-time ms"));
    app.use(express.json({ limit: "128kb" }));
    app.use(express.urlencoded({ extended: false, limit: "128kb", parameterLimit: 50 }));
    app.use(cookieParser());
    app.use("/uploads", express.static(uploadDirectory || getUploadDirectory(), {
        dotfiles: "deny",
        index: false,
        fallthrough: false,
        maxAge: "1y",
        immutable: true,
        setHeaders(res) {
            res.set("X-Content-Type-Options", "nosniff");
            res.set("Content-Security-Policy", "default-src 'none'; sandbox");
        },
    }));
    app.use("/api/user", authRouter);
    app.use("/api/product", productRouter);
    app.use("/api/admin", (req, res, next) => {
        res.set("Cache-Control", "no-store");
        next();
    });
    app.use("/api/admin/products", adminProductRouter);
    app.use("/api/admin/uploads", uploadDirectory
        ? uploadRouter.createUploadRouter({ storage: createFilesystemStorage(uploadDirectory) })
        : uploadRouter);
    app.use(notFound);
    app.use(errorHandler);
    return app;
}

module.exports = { createApp };
