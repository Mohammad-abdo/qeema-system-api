"use strict";

const fs = require("fs");
const path = require("path");

const contractsDir = path.join(__dirname, "..", "packages", "contracts", "openapi");
const files = ["projects-v1.yaml", "tasks-v1.yaml"];

let failed = false;
for (const file of files) {
  const filePath = path.join(contractsDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing contract file: ${filePath}`);
    failed = true;
    continue;
  }
  const content = fs.readFileSync(filePath, "utf8");
  if (!content.includes("openapi:") || !content.includes("paths:")) {
    console.error(`Invalid OpenAPI structure in ${file}: must contain 'openapi:' and 'paths:'`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("Contract files OK:", files.join(", "));
