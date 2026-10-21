const mongoose = require("mongoose");
const dbConnect = async (uri = process.env.MONGODB_URL) => {
    if (typeof uri !== "string" || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
        throw new Error("Configure a valid MONGODB_URL before starting the API.");
    }
    return mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
};
module.exports = dbConnect;
