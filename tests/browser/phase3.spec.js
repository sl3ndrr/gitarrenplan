import { expect, test } from "playwright/test";

const STORAGE_KEY = "gitarrenunterricht_state_v3";

function createState(groupCount = 2) {
  const longName = "Sehr langer Schülername mit mehreren Bestandteilen und zusätzlicher Bezeichnung";
  const groups = Array.from({ length: groupCount }, (_, groupIndex) => ({
    id: "group-" + (groupIndex + 1),
    day: groupIndex % 2 ? "Dienstag" : "Montag",
    time: 15 + groupIndex + ":00 Uhr – fortlaufender Kurs",
    students: [
      { id: "student-" + groupIndex + "-1", name: longName, className: "Klasse 2 b" },
      { id: "student-" + groupIndex + "-2", name: "Ada Beispiel", className: "Klasse 3 a" }
    ]
  }));

  return {
    version: 3,
    revision: 7,
    updatedAt: "2026-09-04T08:00:00.000Z",
    activePlanId: "plan-1",
    minRows: 3,
    plans: [{
      id: "plan-1",
      name: "Responsiver Testplan",
      meta: {
        title: "Gitarrenunterricht mit einem langen Titel",
        teacher: "Lehrkraft mit langem Namen",
        location: "Musikraum im zweiten Obergeschoss",
        term: "Schuljahr 2026/2027"
      },
      groups
    }]
  };
}

async function seedState(page, state) {
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: state });
}

for (const width of [320, 375, 768, 1024]) {
  test(`kein horizontaler Overflow bei ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedState(page, createState(4));
    await page.goto("/");

    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

    if (width === 320) {
      const undersizedTargets = await page.locator("button").evaluateAll((buttons) => (
        buttons.flatMap((button) => {
          const rect = button.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) {
            return [];
          }
          return rect.width < 43.5 || rect.height < 43.5
            ? [{ label: button.getAttribute("aria-label") || button.textContent, width: rect.width, height: rect.height }]
            : [];
        })
      ));
      expect(undersizedTargets).toEqual([]);
    }
  });
}

test("Dialog bleibt per Tastatur geschlossen fokussierbar und gibt Fokus zurück", async ({ page }) => {
  await page.goto("/");
  const newPlan = page.getByRole("button", { name: "Neuer Plan" });
  await newPlan.focus();
  await newPlan.press("Enter");

  const dialog = page.getByRole("dialog");
  const input = dialog.getByRole("textbox");
  const cancel = dialog.getByRole("button", { name: "Abbrechen" });
  const confirm = dialog.getByRole("button", { name: "Erstellen" });
  await expect(input).toBeFocused();
  await expect(page.locator("#app-shell")).toHaveAttribute("inert", "");

  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("#app-shell")).not.toHaveAttribute("inert", "");
  await expect(newPlan).toBeFocused();
});

test("Inline-Bearbeitung lässt sich mit Escape verwerfen und mit Enter bestätigen", async ({ page }) => {
  await seedState(page, createState(1));
  await page.goto("/");
  const nameInput = page.locator('[data-inline-type="student"][data-student-id="student-0-1"][data-field="name"]');

  await nameInput.focus();
  await nameInput.fill("Verworfener Name");
  await nameInput.press("Escape");
  await expect(page.locator('[data-inline-type="student"][data-student-id="student-0-1"][data-field="name"]'))
    .toHaveValue("Sehr langer Schülername mit mehreren Bestandteilen und zusätzlicher Bezeichnung");

  const restoredInput = page.locator('[data-inline-type="student"][data-student-id="student-0-1"][data-field="name"]');
  await restoredInput.focus();
  await restoredInput.fill("Bestätigter Name");
  await restoredInput.press("Enter");
  await expect(page.locator('.student-name .print-only').first()).toHaveText("Bestätigter Name");
});

test("Empty State führt zur Gruppenerstellung und sperrt den Schülerworkflow", async ({ page }) => {
  await seedState(page, createState(0));
  await page.goto("/");

  await expect(page.locator("#studentForm")).toHaveAttribute("disabled", "");
  await expect(page.locator("#groupSelect")).toBeDisabled();
  await expect(page.locator("#addStudentBtn")).toBeDisabled();

  const cta = page.getByRole("button", { name: "Erste Gruppe anlegen" });
  await cta.focus();
  await cta.press("Enter");
  await expect(page.locator("#newGroupTime")).toBeFocused();
});

test("reduzierte Bewegung deaktiviert Animationen und Transformationen", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedState(page, createState(1));
  await page.goto("/");

  await page.locator("#newGroupTime").fill("18:00 Uhr");
  await page.getByRole("button", { name: "Gruppe hinzufügen" }).click();
  const toast = page.locator(".toast").last();
  await expect(toast).toBeVisible();

  const styles = await page.evaluate(() => ({
    toastAnimation: getComputedStyle(document.querySelector(".toast")).animationName,
    buttonTransition: getComputedStyle(document.querySelector(".button")).transitionDuration,
    decorationTransform: getComputedStyle(document.querySelector(".guitar-bg")).transform
  }));
  expect(styles.toastAnimation).toBe("none");
  expect(parseFloat(styles.buttonTransition)).toBeLessThanOrEqual(0.001);
  expect(styles.decorationTransform).toBe("none");
});

test("Druckansicht behält das zweispaltige A4-Raster für bis zu vier Gruppen", async ({ page }) => {
  await seedState(page, createState(4));
  await page.goto("/");
  await page.emulateMedia({ media: "print" });

  const layout = await page.evaluate(() => {
    const pageElement = document.querySelector(".page");
    const slots = document.querySelector(".slots");
    const inlineInput = document.querySelector(".inline-editor");
    return {
      pageWidth: parseFloat(getComputedStyle(pageElement).width),
      pageHeight: parseFloat(getComputedStyle(pageElement).height),
      pagePadding: parseFloat(getComputedStyle(pageElement).paddingTop),
      columns: getComputedStyle(slots).gridTemplateColumns.split(" ").filter(Boolean).length,
      compact: pageElement.classList.contains("compact-first-page"),
      editorDisplay: getComputedStyle(document.querySelector(".editor-panel")).display,
      inputDisplay: getComputedStyle(inlineInput).display
    };
  });

  expect(layout.pageWidth).toBeCloseTo(210 * 96 / 25.4, 0);
  expect(layout.pageHeight).toBeCloseTo(297 * 96 / 25.4, 0);
  expect(layout.pagePadding).toBeCloseTo(10 * 96 / 25.4, 0);
  expect(layout.columns).toBe(2);
  expect(layout.compact).toBe(false);
  expect(layout.editorDisplay).toBe("none");
  expect(layout.inputDisplay).toBe("none");
});

test("Empty State wird nicht gedruckt", async ({ page }) => {
  await seedState(page, createState(0));
  await page.goto("/");
  await page.emulateMedia({ media: "print" });

  await expect(page.locator(".empty-state")).toHaveCSS("display", "none");
});
