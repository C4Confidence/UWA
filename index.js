const dotenv = require("dotenv");
const mongoose = require("mongoose");
const dbConnect = require("./config/dbConnect");

function configuredProxy(value) {
  if (!value || value === "false" || value === "0") return false;
  if (/^[1-9]\d?$/.test(value)) return Number(value);
  if (value === "true") throw new Error("Configure explicit trusted proxy hops or addresses.");
  return value;
}

async function start() {
  dotenv.config();
  const { createApp } = require("./app");
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32 || secret.startsWith("replace-with-")) {
    throw new Error("Configure a strong private JWT_SECRET of at least 32 bytes before starting the API.");
  }
  const port = Number(process.env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Configure a valid PORT between 1 and 65535.");
  await dbConnect();
  const app = createApp({ trustProxy: configuredProxy(process.env.TRUST_PROXY) });
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, () => resolve(listener));
    listener.once("error", reject);
  });
  console.log(`UWA API ready on port ${port}.`);
  return server;
}

if (require.main === module) {
  start().catch(async () => {
    // Database connection errors can contain credentials or connection strings.
    console.error("UWA API could not start. Check private environment configuration and database availability.");
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}

module.exports = { start };
