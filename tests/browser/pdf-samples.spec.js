import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "playwright/test";
import {
  createFortyStudentState,
  createState,
  replaceState,
  seedState
} from "./test-data.js";

const OUTPUT_DIRECTORY = path.resolve("output/pdf");

function scenario(fileName, description, state, expectedPages, grid) {
  return { fileName, description, state, expectedPages, grid };
}

function formatState(groups, layout, options) {
  const state = createState(groups, options);
  state.plans[0].layout = { minRows: state.minRows, ...layout };
  state.plans[0].groups.forEach((group, index) => {
    group.day = index % 2 ? "Mittwoch" : "Montag";
    group.time = index < 2 ? "15:30 – 16:00 Uhr" : "16:15 – 16:45 Uhr";
  });
  return state;
}

const scenarios = [
  scenario("gruppen-0-ohne-schuljahr", "0 Gruppen, ohne Schuljahr", createState(0, { term: "" }), 1, "2x2"),
  scenario("gruppen-1", "1 Gruppe", createState(1), 1, "2x2"),
  scenario("gruppen-2", "2 Gruppen", createState(2), 1, "2x2"),
  scenario("gruppen-3-ohne-schuljahr", "3 Gruppen, ohne Schuljahr", createState(3, { term: "" }), 1, "2x2"),
  scenario("gruppen-4-mit-schuljahr", "4 Gruppen, mit Schuljahr", createState(4), 1, "2x2"),
  scenario("gruppen-5", "5 Gruppen", createState(5), 1, "2x3"),
  scenario("gruppen-6", "6 Gruppen", createState(6), 1, "2x3"),
  scenario("gruppen-7", "7 Gruppen", createState(7), 2, "2x3"),
  scenario("gruppen-12", "12 Gruppen", createState(12), 2, "2x3"),
  scenario("gruppe-40-schueler", "1 Gruppe mit 40 Teilnehmenden", createFortyStudentState(), 2, "2x2"),
  scenario(
    "sechs-gruppen-mindestzeilen",
    "6 Gruppen mit je 6 Teilnehmenden bei 6 Mindestzeilen",
    createState(6, { studentsPerGroup: 6, minRows: 6 }),
    1,
    "2x3"
  ),
  scenario(
    "lange-inhalte",
    "Lange Gruppen-, Teilnehmende- und Metadaten",
    createState(5, { longContent: true, studentsPerGroup: 6, minRows: 6 }),
    1,
    "2x3"
  ),
  scenario("gruppen-quer", "Gruppenplan im Querformat",
    formatState(4, { orientation: "landscape" }), 1, "2x2"),
  scenario("wochenuebersicht", "Wochenübersicht im Querformat",
    formatState(4, { orientation: "landscape", output: "week" }), 1, "week"),
  scenario("anwesenheit-sw", "Anwesenheitsliste mit Notizspalte und S/W-Druck",
    formatState(1, { output: "attendance", attendanceColumns: 12, showNotes: true, monochrome: true }, { minRows: 15 }),
    1, "attendance")
];

test("@pdf erzeugt alle repräsentativen A4-Beispiele", async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await seedState(page, scenarios[0].state);
  await page.goto("/");
  await page.emulateMedia({ media: "print" });
  const manifest = [];

  for (const [index, item] of scenarios.entries()) {
    if (index > 0) {
      await replaceState(page, item.state);
    }
    await page.evaluate(async () => {
      const { setPrintPresentation } = await import("/js/render.js");
      setPrintPresentation("proof", true);
    });
    await expect(page.locator(".page")).toHaveCount(item.expectedPages);
    expect(await page.locator(".page").evaluateAll((pages) => (
      pages.every((pageElement) => pageElement.dataset.grid === pages[0].dataset.grid)
    ))).toBe(true);
    await expect(page.locator(".page").first()).toHaveAttribute("data-grid", item.grid);

    const outputPath = path.join(OUTPUT_DIRECTORY, item.fileName + ".pdf");
    await page.pdf({
      path: outputPath,
      preferCSSPageSize: true,
      printBackground: true,
      tagged: true,
      outline: true
    });
    const layout = item.state.plans[0].layout;
    manifest.push({
      file: item.fileName + ".pdf",
      description: item.description,
      expectedPages: item.expectedPages,
      grid: item.grid,
      orientation: layout?.orientation || "portrait"
    });
  }

  await writeFile(
    path.join(OUTPUT_DIRECTORY, "manifest.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), samples: manifest }, null, 2) + "\n",
    "utf8"
  );
});
