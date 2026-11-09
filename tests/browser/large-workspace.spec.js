import { mkdirSync } from "node:fs";
import { expect, test } from "playwright/test";
import { createState, seedState } from "./test-data.js";

const evidence = "output/evidence";

function example() {
  const state = createState(4, { minRows: 6 });
  const plan = state.plans[0];
  plan.name = "Gitarrenunterricht Montag / Mittwoch";
  plan.meta = { title: "Gitarrenunterricht", teacher: "Musterlehrkraft", location: "Musikraum", term: "2026/2027" };
  const first = ["Ada Beispiel", "Dana Probe", "Ada Beispiel", "Dana Probe"];
  const second = ["Ben Muster", "Emil Muster", "Ben Muster", "Emil Muster"];
  plan.groups.forEach((group, i) => {
    group.day = i < 2 ? "Montag" : "Mittwoch";
    group.time = i % 2 ? "16:15 – 16:45 Uhr" : "15:30 – 16:00 Uhr";
    group.students[0].name = first[i];
    group.students[1].name = second[i];
    group.students.forEach((student) => { student.className = i % 2 ? "Klasse 6a" : "Klasse 5a"; });
  });
  plan.groups[0].students.push({ id: "clara", name: "Clara Test", className: "Klasse 5b" });
  return state;
}

test.beforeAll(() => mkdirSync(evidence, { recursive: true }));

for (const width of [375, 768, 1024, 1280, 1440, 1600, 1920, 2560, 3440]) {
  test("Bildschirmbelege bei " + width + " px", async ({ page }) => {
    await page.setViewportSize({ width, height: width >= 1920 ? 1440 : 1000 });
    await seedState(page, example());
    await page.goto("/");
    await expect(page.locator(".timeslot")).toHaveCount(4);
    if (width < 1180) {
      await page.locator("#editViewBtn").click();
      await page.screenshot({ path: evidence + "/" + width + "-editor.png" });
      await page.locator("#previewViewBtn").click();
      await page.screenshot({ path: evidence + "/" + width + "-vorschau.png" });
    } else {
      if (width >= 1920) await page.locator("#zoomSelect").selectOption("1");
      await page.screenshot({ path: evidence + "/" + width + "-editor.png" });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await page.locator("#proofBtn").click();
    await expect(page.locator(".inline-editor").first()).toBeHidden();
    await expect(page.locator(".day-heading").first()).toBeVisible();
    await page.screenshot({ path: evidence + "/" + width + "-druckmodus.png" });
  });
}

for (const width of [1920, 2560, 3440]) {
  test("Doppelseite und Navigator bei " + width + " px", async ({ page }) => {
    await page.setViewportSize({ width, height: 1440 });
    const state = createState(10, { studentsPerGroup: 4, minRows: 6 });
    await seedState(page, state);
    await page.goto("/");
    const frames = page.locator(".page-frame");
    await expect(frames).toHaveCount(2);
    expect(Math.abs((await frames.nth(0).boundingBox()).y - (await frames.nth(1).boundingBox()).y)).toBeLessThan(1);
    await page.screenshot({ path: evidence + "/" + width + "-doppelseite.png" });
    await page.locator("#spreadBtn").click();
    await page.locator("#pageNav").selectOption({ value: "2" });
    await expect(page.locator("#pageNav")).toHaveValue("2");
    await expect(frames.nth(1)).toBeInViewport({ ratio: 0.4 });
    await page.locator("#zoomSelect").selectOption("1.25");
    await expect(page.locator("#zoomValue")).toHaveText("125 %");
    const target = page.locator(".timeslot summary").first();
    expect((await target.boundingBox()).height).toBeGreaterThanOrEqual(43.5);
    await page.reload();
    await expect(page.locator("#zoomValue")).toHaveText("125 %");
  });
}

test("die Übersicht verlinkt doppelte Namen und Zeitüberschneidungen zur Gruppe", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  const state = example();
  state.plans[0].groups[1].time = "15:45 – 16:30 Uhr";
  await seedState(page, state);
  await page.goto("/");
  await expect(page.locator("#overviewWarnings")).toContainText("doppelte Namen");
  await expect(page.locator("#overviewWarnings")).toContainText("zeitliche Überschneidung");
  await page.locator("#overviewOccupancy button").first().click();
  await expect(page.locator(".timeslot").first()).toBeFocused();
});
