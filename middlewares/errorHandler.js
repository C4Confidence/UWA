const notFound = (req, res, next) => {
    const error = new Error("The requested resource was not found.");
    error.status = 404;
    next(error);
};
const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);
    const declaredStatus = Number(err.status || err.statusCode);
    let status = declaredStatus >= 400 && declaredStatus <= 599 ? declaredStatus : 500;
    let message = status < 500 ? err.message : "Something went wrong. Please try again later.";
    let fields;
    if (err.name === "ValidationError") {
        status = 400;
        message = "Please check the highlighted fields.";
        fields = Object.fromEntries(Object.entries(err.errors || {}).map(([field, issue]) => [
            field, issue.kind === "required" ? "This field is required." : "Please enter a valid value.",
        ]));
    } else if (err.code === 11000) {
        status = 409;
        message = err.keyPattern?.slug ? "A product with this slug already exists. Choose a different slug." : "A record already uses these details.";
    } else if (err.name === "CastError") {
        status = 400;
        message = "Please provide a valid resource identifier or field value.";
    } else if (err.type === "entity.parse.failed") {
        status = 400;
        message = "The request body must contain valid JSON.";
    } else if (err.type === "entity.too.large" || err.code === "LIMIT_FILE_SIZE") {
        status = 413;
        message = "The submitted content exceeds the allowed size.";
    } else if (err.name === "MulterError") {
        status = 400;
        message = "The image upload is invalid. Check the number of files and the upload field.";
    } else if (err.code === "ENOENT") {
        status = 404;
        message = "The requested resource was not found.";
    } else if (err.code === "EACCES") {
        status = 403;
        message = "Access to this resource is not allowed.";
    } else if (status === 400 && err.fields && typeof err.fields === "object" && !Array.isArray(err.fields)) {
        fields = Object.fromEntries(Object.entries(err.fields)
            .filter(([key, value]) => /^[a-z][a-z\d_.-]{0,59}$/i.test(key) && typeof value === "string")
            .slice(0, 30).map(([key, value]) => [key, value.slice(0, 240)]));
    }
    if (status >= 500 && req.app.get("request logging")) {
        // Never log cookies, authorization, bodies, database details, or stack traces.
        console.error(`API request failed (${status}).`);
    }
    res.status(status).json({ message, ...(fields ? { fields } : {}) });
};
module.exports = { errorHandler, notFound };
