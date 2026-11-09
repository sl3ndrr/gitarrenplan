import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { createState, seedState } from "./test-data.js";

test("Umsortieren gleitet und räumt Animationszustände auf", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await seedState(page, createState(2));
  await page.goto("/");
  await page.evaluate(() => {
    const observer = new window.MutationObserver(() => {
      if (document.querySelector('[data-motion="moving"]')) document.body.dataset.motionObserved = "yes";
    });
    observer.observe(document.getElementById("pages"), { subtree: true, attributes: true, childList: true });
  });
  await page.locator(".timeslot summary").first().click();
  await page.getByRole("button", { name: "Gruppe nach unten verschieben", exact: true }).first().click();
  await expect(page.locator("body")).toHaveAttribute("data-motion-observed", "yes");
  await expect(page.locator("[data-motion]")).toHaveCount(0);
  await expect(page.locator(".timeslot").first()).toHaveAttribute("data-group-id", "group-2");
});

test("Grenzplan mit 100 Gruppen und 5000 Teilnehmenden lässt sich bearbeiten", async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await seedState(page, createState(100, { studentsPerGroup: 50 }));
  const started = Date.now();
  await page.goto("/");
  await expect(page.locator("tr[data-student-id]")).toHaveCount(5000, { timeout: 45000 });
  const loadMilliseconds = Date.now() - started;
  const result = await page.evaluate(async () => {
    const [{ dispatch }, { flushRender }] = await Promise.all([import("/js/state.js"), import("/js/render.js")]);
    const start = window.performance.now();
    const moved = dispatch({ type: "group/move", payload: { groupId: "group-1", toIndex: 1 } });
    flushRender();
    const duration = window.performance.now() - start;
    return { ok: moved.ok, duration, animated: Boolean(document.querySelector("[data-motion]")) };
  });
  expect(result.ok).toBe(true);
  expect(result.animated).toBe(false);
  expect(result.duration).toBeLessThan(5000);
  mkdirSync("output/evidence", { recursive: true });
  writeFileSync("output/evidence/grenzplan-performance.json", JSON.stringify({ loadMilliseconds, ...result }, null, 2));
});
