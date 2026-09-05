import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

const outputDirectory = path.resolve("output/pdf");
const renderedDirectory = path.join(outputDirectory, "rendered");
const manifest = JSON.parse(readFileSync(path.join(outputDirectory, "manifest.json"), "utf8"));
const results = [];

mkdirSync(renderedDirectory, { recursive: true });

for (const sample of manifest.samples) {
  const pdfPath = path.join(outputDirectory, sample.file);
  const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const pageCount = Number.parseInt(info.match(/^Pages:\s+(\d+)$/m)?.[1] || "0", 10);
  const sizeMatch = info.match(/^Page size:\s+([\d.]+) x ([\d.]+) pts/m);

  if (pageCount !== sample.expectedPages) {
    throw new Error(sample.file + ": erwartet " + sample.expectedPages + " Seiten, erhalten " + pageCount);
  }
  if (!sizeMatch) {
    throw new Error(sample.file + ": Seitengröße konnte nicht gelesen werden.");
  }

  const width = Number.parseFloat(sizeMatch[1]);
  const height = Number.parseFloat(sizeMatch[2]);
  if (Math.abs(width - 595.28) > 1 || Math.abs(height - 841.89) > 1) {
    throw new Error(sample.file + ": Ausgabe ist nicht A4-Porträt (" + width + " x " + height + ").");
  }

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const pageText = execFileSync("pdftotext", [
      "-f",
      String(pageNumber),
      "-l",
      String(pageNumber),
      pdfPath,
      "-"
    ], { encoding: "utf8" });
    if (!pageText.includes("Gitarrenunterricht") || !pageText.includes("Stand:")) {
      throw new Error(sample.file + ": Seite " + pageNumber + " enthält nicht alle Pflichttexte.");
    }
    if (pageCount > 1 && !pageText.includes("Seite " + pageNumber + " von " + pageCount)) {
      throw new Error(sample.file + ": Seitenzähler auf Seite " + pageNumber + " fehlt.");
    }
  }

  if (sample.file === "gruppe-40-schueler.pdf") {
    const text = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
    if (!text.includes("Fortsetzung") || !text.includes("Schüler 40")) {
      throw new Error(sample.file + ": Fortsetzung oder letzter Schüler fehlt.");
    }
  }

  const outputPrefix = path.join(renderedDirectory, path.basename(sample.file, ".pdf") + "-page");
  execFileSync("pdftoppm", ["-png", "-r", "110", pdfPath, outputPrefix]);
  const renderedPages = readdirSync(renderedDirectory).filter((file) => (
    file.startsWith(path.basename(outputPrefix) + "-") && file.endsWith(".png")
  )).length;
  if (renderedPages !== pageCount) {
    throw new Error(sample.file + ": erwartet " + pageCount + " PNG-Seiten, erhalten " + renderedPages);
  }

  results.push({
    file: sample.file,
    pages: pageCount,
    pageSizePoints: { width, height },
    renderedPages,
    verified: true
  });
}

const summary = {
  verifiedAt: new Date().toISOString(),
  samples: results
};
writeFileSync(
  path.join(outputDirectory, "verification.json"),
  JSON.stringify(summary, null, 2) + "\n",
  "utf8"
);
console.log("PDF-Prüfung erfolgreich: " + results.length + " Dateien, "
  + results.reduce((sum, item) => sum + item.pages, 0) + " A4-Seiten.");
