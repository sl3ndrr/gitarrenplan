import { expect, test } from "playwright/test";
import { createState, seedState } from "./test-data.js";

test("CSP erlaubt die App und CSSOM, während eingegebene Inhalte Text bleiben", async ({ page }) => {
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (entry) => {
    if (entry.type() === "error" && entry.text().includes("Content Security Policy")) problems.push(entry.text());
  });
  const state = createState(1);
  const scriptText = '<img src=x onerror="window.guitars=1">';
  state.plans[0].groups[0].students[0].name = scriptText;
  await seedState(page, state);
  await page.goto("/");
  await expect(page.locator("meta[http-equiv='Content-Security-Policy']")).toHaveAttribute("content", /script-src 'self'/);
  await expect(page.locator(".student-name .print-only").first()).toHaveText(scriptText);
  await expect(page.locator("#pages img")).toHaveCount(0);
  await page.locator("#zoomSelect").selectOption("1.25");
  await expect(page.locator("#zoomValue")).toHaveText("125 %");
  await page.locator("#proofBtn").click();
  await expect(page.locator(".student-name .print-only").first()).toBeVisible();
  expect(problems).toEqual([]);
});
