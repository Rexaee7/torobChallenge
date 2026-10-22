// Extracts torob-dataset.zip into data/raw/ (uses the system `unzip` or PowerShell).
import { execSync } from "node:child_process";
import fs from "node:fs";

const zip = process.argv[2] ?? "torob-dataset.zip";
if (!fs.existsSync(zip)) {
  console.error(`Dataset zip not found: ${zip}`);
  process.exit(1);
}
fs.mkdirSync("data/raw", { recursive: true });
try {
  execSync(`unzip -o -q "${zip}" "torob-dataset/*" -d data/raw`, { stdio: "inherit" });
} catch {
  execSync(`powershell -NoProfile -Command "Expand-Archive -Force '${zip}' 'data/raw'"`, { stdio: "inherit" });
}
console.log("extracted to data/raw/torob-dataset");
