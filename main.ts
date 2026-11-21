// Platinum Audit — The Leonida 55 · make.fun entrypoint
//
// Copies the finished guide (app/ and screenshots/) into the output
// directory and writes dossier.json there, built by the kit's own
// buildDossier library so the dossier matches the gate's rebuild
// byte for byte. buildDossier takes the directory holding app/ and
// screenshots/ plus the competition's caps, exactly as RULES.txt
// states them (48 MiB app, 160 KiB dossier text, 1.5 MiB dossier).
//
// Runs on Node 22 with the standard library only, offline:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(fileURLToPath(import.meta.url));
const outputDirectory = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// The gate's caps for this competition, as stated in RULES.txt.
const COMPETITION_CAPS = {
  text_max_bytes: 163840,
  app_max_files: 993,
  app_max_bytes: 48 * 1024 * 1024,
  app_file_max_bytes: 25 * 1024 * 1024,
  index_max_bytes: 1024 * 1024,
  path_max_bytes: 1000,
  screenshots_max_files: 4,
  screenshot_max_bytes: 256 * 1024,
  screenshot_long_side_max: 1280,
  screenshot_short_side_min: 480,
  dossier_max_bytes: 1536 * 1024,
  trophies_max_bytes: 2 * 1024 * 1024
};

function copyGuideFilesIntoOutputDirectory() {
  mkdirSync(outputDirectory, { recursive: true });
  for (const entryName of ["app", "screenshots"]) {
    const sourcePath = join(repositoryRoot, entryName);
    const targetPath = join(outputDirectory, entryName);
    if (!existsSync(sourcePath)) {
      throw new Error("Platinum Audit: expected " + entryName + "/ to exist beside main.ts");
    }
    cpSync(sourcePath, targetPath, { recursive: true });
  }
}

async function writeDossierIntoOutputDirectory() {
  const kitLibrary = await import("./vendor/makefun-frontend.ts");
  if (typeof kitLibrary.buildDossier !== "function") {
    throw new Error("Platinum Audit: vendor/makefun-frontend.ts does not export buildDossier");
  }
  const dossier = await kitLibrary.buildDossier(outputDirectory, COMPETITION_CAPS);
  const dossierText = typeof dossier === "string" ? dossier : Buffer.from(dossier).toString("utf8");
  JSON.parse(dossierText);
  writeFileSync(join(outputDirectory, "dossier.json"), dossierText);
  return dossierText;
}

async function main() {
  copyGuideFilesIntoOutputDirectory();
  const dossierText = await writeDossierIntoOutputDirectory();
  const outputEntries = readdirSync(outputDirectory).sort();
  console.log("Platinum Audit: wrote " + outputEntries.join(", ") + " to " + outputDirectory);
  console.log("Platinum Audit: dossier.json is " + Buffer.byteLength(dossierText) + " bytes");
}

await main();
