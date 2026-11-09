import { expect, test } from "playwright/test";
import { createState, seedState } from "./test-data.js";

test("wählt Wochenübersicht, Querformat und Anwesenheitsliste pro Plan", async ({ page }) => {
  const state = createState(2);
  state.plans[0].groups[0].time = "15:30 – 16:00 Uhr";
  await seedState(page, state);
  await page.goto("/");
  await page.locator('[aria-labelledby="appearance-title"] > summary').click();
  await page.locator("#orientation").selectOption("landscape");
  await page.locator("#outputFormat").selectOption("week");
  await expect(page.locator(".timeslot")).toHaveCount(2);
  await page.locator("#proofBtn").click();
  await expect(page.locator(".landscape-page .week-table")).toBeVisible();
  await expect(page.locator(".week-card")).toHaveCount(2);
  await page.locator("#outputFormat").selectOption("attendance");
  await page.locator("#attendanceColumns").fill("12");
  await page.locator("#attendanceColumns").press("Tab");
  await page.locator('[data-layout-field="showNotes"]').check();
  await expect(page.locator(".attendance-table").first().locator(".attendance-date")).toHaveCount(12);
  await expect(page.locator(".attendance-table").first().getByRole("columnheader", { name: "Notiz" })).toBeVisible();
  await page.locator('[data-layout-field="showUpdatedAt"]').uncheck();
  await expect(page.locator(".page-footer").first()).not.toContainText("Stand:");
});

test("der Stand stammt bei Altplänen aus dem gespeicherten Änderungsdatum", async ({ page }) => {
  await seedState(page, createState(1));
  await page.goto("/");
  await expect(page.locator(".page-footer")).toContainText("Stand: 04.09.2026");
});

test("die genaue Vorschau verwendet auch auf dem Handy die Druckmaße", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await seedState(page, createState(4));
  await page.goto("/");
  await page.locator("#proofBtn").click();
  const layout = () => page.evaluate(() => {
    const style = (selector) => getComputedStyle(document.querySelector(selector));
    const tracks = (value) => value.split(" ").map((width) => parseFloat(width));
    return {
      paper: parseFloat(style(".page").width),
      title: parseFloat(style(".preview-document-title").fontSize),
      meta: tracks(style(".info-grid").gridTemplateColumns),
      columns: tracks(style(".slot-row").gridTemplateColumns),
      row: parseFloat(style(".student-table td").height),
      padding: parseFloat(style(".page").paddingLeft)
    };
  });
  await expect(page.locator(".preview-document-title")).toHaveCSS("font-size", "28px");
  const screen = await layout();
  await page.emulateMedia({ media: "print" });
  const printed = await layout();
  expect(screen.meta).toHaveLength(3);
  expect(screen.columns).toHaveLength(2);
  for (const key of ["paper", "title", "row", "padding"]) {
    expect(Math.abs(screen[key] - printed[key]), key).toBeLessThanOrEqual(1);
  }
  for (const key of ["meta", "columns"]) {
    screen[key].forEach((width, index) => expect(Math.abs(width - printed[key][index]), key).toBeLessThanOrEqual(1));
  }
});
