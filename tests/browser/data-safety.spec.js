import { expect, test } from "playwright/test";
import { createState, seedState, STORAGE_KEY } from "./test-data.js";

test("sichert beschädigte Einträge und merkt sich das Schließen des Hinweises", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: { ...createState(1), plans: [{ groups: [{ students: ["Ada", null] }] }] } });
  await page.reload();
  const notice = page.locator("#recoveryNotice");
  await expect(notice).toContainText("Eine Kopie wurde gesichert");
  await expect(notice).toContainText("1 Teilnehmende");
  const download = page.waitForEvent("download");
  await notice.getByRole("button", { name: "Kopie herunterladen" }).click();
  expect((await download).suggestedFilename()).toBe("gitarrenplan-rohdaten.json");
  await notice.getByRole("button", { name: "Hinweis schließen" }).click();
  await page.reload();
  await expect(notice).toBeHidden();
});

test("zeigt die Importzahlen und stellt einen ersetzten Plan per Undo wieder her", async ({ page }) => {
  await seedState(page, createState(1));
  await page.goto("/");
  await page.locator("#importFile").setInputFiles({
    name: "sicherung.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ groups: [{ time: "Probe", students: ["Ada"] }] }))
  });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("1 Plan, 1 Gruppe, 1 Teilnehmende");
  await dialog.getByRole("button", { name: "Alles ersetzen" }).click();
  await expect(page.locator("#planSelect option")).toHaveText(["Importierter Plan"]);
  await page.locator("#undoBtn").click();
  await expect(page.locator("#planSelect option")).toHaveText(["Responsiver Testplan"]);
});

test("bietet vor dem Drucken eine Wahl an, wenn der Slot tatsächlich überläuft", async ({ page }) => {
  const state = createState(1, { studentsPerGroup: 8 });
  state.plans[0].groups[0].students[0].name = "W".repeat(80);
  state.plans[0].groups[0].students[0].className = "W".repeat(160);
  await seedState(page, state);
  await page.goto("/");
  await page.locator(".timeslot").evaluateAll((slots) => slots.forEach((slot) => {
    slot.style.setProperty("max-height", "45px");
  }));
  await page.evaluate(() => {
    window.print = () => { document.body.dataset.printed = "yes"; };
  });
  await page.locator("#printBtn").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Montag");
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.locator("body")).not.toHaveAttribute("data-printed");
  await page.locator("#printBtn").click();
  await dialog.getByRole("button", { name: "Trotzdem drucken" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");
});
