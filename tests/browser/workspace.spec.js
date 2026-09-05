import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { createFortyStudentState, createState, seedState } from "./test-data.js";

const BASELINE = "d6898a34478e0402eb14844ca6427e2c12979468";
const EVIDENCE = "output/evidence";

function evidenceState() {
  const state = createState(6, { minRows: 6, studentsPerGroup: 3 });
  state.plans[0].meta = { title: "Gitarrenunterricht", teacher: "Musterlehrkraft", location: "Musikraum", term: "2026/2027" };
  state.plans[0].groups.forEach((group, index) => {
    group.day = ["Montag", "Mittwoch", "Freitag"][Math.floor(index / 2)];
    group.time = index % 2 ? "16:15 – 16:45 Uhr" : "15:30 – 16:00 Uhr";
    if (![0, 2].includes(index)) group.students.pop();
    group.students.forEach((student, studentIndex) => {
      student.name = ["Ada Beispiel", "Ben Muster", "Clara Test"][studentIndex];
      student.className = "Klasse 5a";
    });
  });
  return state;
}

test.beforeAll(() => { mkdirSync(EVIDENCE, { recursive: true }); });

test("Ausgangsrevision belegt die beiden CSS-Bugs mit Screenshots", async ({ page }) => {
  const directory = EVIDENCE + "/baseline";
  const files = execFileSync("git", ["ls-tree", "-r", "--name-only", BASELINE], { encoding: "utf8" })
    .trim().split("\n").filter((file) => file === "index.html" || /^(css|js)\//.test(file));
  for (const file of files) {
    const target = directory + "/" + file;
    mkdirSync(target.slice(0, target.lastIndexOf("/")), { recursive: true });
    writeFileSync(target, execFileSync("git", ["show", BASELINE + ":" + file]));
  }
  await page.setViewportSize({ width: 768, height: 1000 });
  await seedState(page, evidenceState());
  await page.goto("/" + directory + "/index.html");
  const slot = page.locator(".timeslot").first();
  await expect(slot.locator(".day-badge.print-only")).toBeVisible();
  await expect(slot.locator(".class-badge.print-only").first()).toBeVisible();
  const gap = await slot.locator(".remove-group-button").evaluate((button) => {
    const [icon, label] = button.children;
    return label.getBoundingClientRect().left - icon.getBoundingClientRect().right;
  });
  expect(gap).toBeLessThan(1);
  await slot.screenshot({ path: EVIDENCE + "/01-vorher-badges.png" });
  await slot.locator(".remove-group-button").screenshot({ path: EVIDENCE + "/02-vorher-entfernen.png" });
});

test("alle print-only-Komponenten bleiben verborgen; Icon und Label haben Abstand", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1000 });
  await seedState(page, evidenceState());
  await page.goto("/");
  await page.addStyleTag({ content: ".print-only { display: flex; }" });
  expect(await page.locator(".print-only").evaluateAll((elements) => (
    elements.every((element) => getComputedStyle(element).display === "none")
  ))).toBe(true);
  const slot = page.locator(".timeslot").first();
  await slot.screenshot({ path: EVIDENCE + "/03-nachher-badges.png" });
  await slot.locator(".timeslot-header summary").click();
  const remove = slot.getByRole("button", { name: "Gruppe entfernen", exact: true });
  const gap = await remove.evaluate((button) => {
    const [icon, label] = button.children;
    return label.getBoundingClientRect().left - icon.getBoundingClientRect().right;
  });
  expect(gap).toBeGreaterThanOrEqual(4);
  expect(gap).toBeLessThanOrEqual(6.5);
  await remove.screenshot({ path: EVIDENCE + "/04-nachher-entfernen.png" });
  await remove.press("Escape");
  await expect(slot.locator(".timeslot-header summary")).toBeFocused();
  await expect(slot.locator(".timeslot-header details")).not.toHaveAttribute("open", "");
});

for (const width of [320, 375, 768, 900, 1024, 1180, 1280, 1440]) {
  test(`Arbeitsbereich, Menüs und 44px-Ziele bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await seedState(page, evidenceState());
    await page.goto("/");
    await expect.poll(() => page.locator(".page-frame").first().getAttribute("style")).toContain("height");
    const layout = await page.evaluate(() => {
      const editor = document.querySelector(".editor-panel").getBoundingClientRect();
      const preview = document.querySelector(".preview-workspace").getBoundingClientRect();
      const paper = document.querySelector(".page");
      return {
        client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
        sideBySide: editor.right <= preview.left, stacked: editor.bottom <= preview.top,
        paperWidth: parseFloat(getComputedStyle(paper).width),
        scale: parseFloat(getComputedStyle(document.querySelector("#pages")).getPropertyValue("--preview-scale"))
      };
    });
    expect(layout.scroll).toBeLessThanOrEqual(layout.client + 1);
    expect(width >= 1180 ? layout.sideBySide : layout.stacked).toBe(true);
    if (width > 900) expect(layout.paperWidth).toBeCloseTo(210 * 96 / 25.4, 0);
    if (width === 1180) expect(layout.scale).toBeLessThan(1);

    const slot = page.locator(".timeslot").first();
    for (const summary of [slot.locator(".timeslot-header summary"), slot.locator(".student-actions summary").first()]) {
      await summary.click();
      const smallTargets = await page.locator("button, summary").evaluateAll((elements) => elements.flatMap((element) => {
        if (!element.checkVisibility()) return [];
        const rect = element.getBoundingClientRect();
        return rect.width < 43.5 || rect.height < 43.5 ? [{ text: element.textContent, width: rect.width, height: rect.height }] : [];
      }));
      expect(smallTargets).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overflow).toBe(false);
      await summary.press("Escape");
    }
    if (width === 1440) {
      await page.locator(".app-header").scrollIntoViewIfNeeded();
      await page.screenshot({ path: EVIDENCE + "/05-desktop.png" });
      await page.evaluate(() => window.scrollTo(0, 600));
      const sticky = await page.locator(".editor-panel").evaluate((element) => ({
        position: getComputedStyle(element).position,
        top: element.getBoundingClientRect().top,
        bottom: element.getBoundingClientRect().bottom
      }));
      expect(sticky.position).toBe("sticky");
      expect(sticky.top).toBeGreaterThanOrEqual(0);
      expect(sticky.top).toBeLessThanOrEqual(16);
      expect(sticky.bottom).toBeLessThanOrEqual(1000);
    }
    if (width === 375) await slot.screenshot({ path: EVIDENCE + "/06-mobil.png" });
  });
}

test("Druck aus skalierter Vorschau bleibt A4 mit gemeinsamen Tagesköpfen", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 1000 });
  await seedState(page, evidenceState());
  await page.goto("/");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".day-heading")).toHaveText(["Montag", "Mittwoch", "Freitag"]);
  await expect(page.locator(".document-summary")).toHaveText("6 Gruppen · 14 Schüler:innen gesamt");
  await expect(page.locator(".group-occupancy").first()).toHaveText("3 / 6 Plätze");
  const layout = await page.locator(".page").first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const row = element.querySelector(".slot-row");
    const heading = row.querySelector(".day-heading").getBoundingClientRect();
    const [left, right] = [...row.querySelectorAll(".timeslot")].map((slot) => slot.getBoundingClientRect());
    const occupied = element.querySelector("tr:not(.empty-row) td").getBoundingClientRect();
    const empty = element.querySelector(".empty-row td").getBoundingClientRect();
    return { width: rect.width, height: rect.height, transform: getComputedStyle(element).transform,
      sharedWidth: heading.width, pairWidth: right.right - left.left,
      occupied: occupied.height, empty: empty.height };
  });
  expect(layout.width).toBeCloseTo(210 * 96 / 25.4, 0);
  expect(layout.height).toBeCloseTo(297 * 96 / 25.4, 0);
  expect(layout.transform).toBe("none");
  expect(layout.sharedWidth).toBeCloseTo(layout.pairWidth, 0);
  expect(layout.empty).toBeLessThan(layout.occupied);
  await page.locator(".page").screenshot({ path: EVIDENCE + "/07-druckansicht.png" });
  await page.pdf({ path: EVIDENCE + "/gitarrenplan-beispiel.pdf", preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: "screen" });
  expect(await page.locator(".print-only").evaluateAll((elements) => elements.every((element) => getComputedStyle(element).display === "none"))).toBe(true);
});

test("Menüaktionen bleiben ausführbar und Strg+Z stellt die Reihenfolge wieder her", async ({ page }) => {
  await seedState(page, evidenceState());
  await page.goto("/");
  const summary = page.locator('.timeslot[data-group-id="group-1"] .timeslot-header summary');
  await summary.click();
  await page.getByRole("button", { name: "Gruppe nach unten verschieben", exact: true }).click();
  await expect(page.locator(".timeslot").first()).toHaveAttribute("data-group-id", "group-2");
  await expect(page.locator('.timeslot[data-group-id="group-1"] .timeslot-header summary')).toBeFocused();
  await page.keyboard.press("Control+z");
  await expect(page.locator(".timeslot").first()).toHaveAttribute("data-group-id", "group-1");
});

test("Fortsetzungen zählen keine zusätzlichen Gruppen oder Plätze", async ({ page }) => {
  await seedState(page, createFortyStudentState());
  await page.goto("/");
  await expect(page.locator(".page")).toHaveCount(2);
  await expect(page.locator(".document-summary")).toHaveText(["1 Gruppe · 40 Schüler:innen gesamt", "1 Gruppe · 40 Schüler:innen gesamt"]);
  expect(await page.locator(".group-occupancy").allTextContents()).toEqual(Array(5).fill("40 / 40 Plätze"));
});
