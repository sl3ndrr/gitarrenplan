import { expect, test } from "playwright/test";
import { createState, seedState } from "./test-data.js";

test("legt direkt in der Gruppe an und setzt den Fokus für den nächsten Namen", async ({ page }) => {
  await seedState(page, createState(1, { minRows: 6 }));
  await page.goto("/");
  const name = page.getByRole("textbox", { name: "Name hinzufügen", exact: true });
  await name.fill("Ada Beispiel");
  await name.press("Tab");
  const groupClass = page.locator('[data-add-field="className"]');
  await expect(groupClass).toBeFocused();
  await groupClass.fill("5a");
  await groupClass.press("Enter");
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("");
  await expect(page.locator('.student-name .print-only').last()).toHaveText("Ada Beispiel");
});

test("Sammelerfassung ist ein einzelner Undo- und Redo-Schritt", async ({ page }) => {
  await seedState(page, createState(1));
  await page.goto("/");
  await page.locator("#bulkStudentsBtn").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Ada; 5a\nBen\t6b");
  await expect(dialog).toContainText("2 Zeile(n) erkannt");
  await dialog.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(page.locator('.student-name .print-only')).toHaveCount(4);
  await page.locator("#undoBtn").click();
  await expect(page.locator('.student-name .print-only')).toHaveCount(2);
  await page.locator("#redoBtn").click();
  await expect(page.locator('.student-name .print-only')).toHaveCount(4);
});

test("auf kleinen Bildschirmen wechseln Bearbeiten und Vorschau einander ab", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await seedState(page, createState(1));
  await page.goto("/");
  await expect(page.locator(".editor-panel")).toBeHidden();
  await expect(page.locator("#printBtn")).toBeVisible();
  await page.locator("#editViewBtn").click();
  await expect(page.locator("#studentName")).toBeVisible();
  await expect(page.locator("#pages")).toBeHidden();
  await page.locator("#previewViewBtn").click();
  await expect(page.locator("#pages")).toBeVisible();
});

test("entfernt Teilnehmende sofort und stellt sie über den Toast wieder her", async ({ page }) => {
  await seedState(page, createState(1));
  await page.goto("/");
  const student = page.locator("tr[data-student-id]").last();
  await student.locator("summary").click();
  await student.getByRole("button", { name: /entfernen/i }).click();
  await expect(page.locator("tr[data-student-id]")).toHaveCount(1);
  await page.locator(".undo-toast").getByRole("button", { name: "Rückgängig" }).click();
  await expect(page.locator("tr[data-student-id]")).toHaveCount(2);
});
