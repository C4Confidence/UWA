const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : file.endsWith(".js") ? [file] : [];
  });
}

const files = ["index.js", "app.js", ...[
  "config", "controller", "middlewares", "models", "routes", "services", "utils", "scripts", "tests",
].flatMap(sourceFiles)];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax checked ${files.length} backend and test files.`);
