import { expect, test } from "playwright/test";
import {
  createFortyStudentState,
  createState,
  replaceState,
  seedState
} from "./test-data.js";

async function printLayout(page) {
  return page.evaluate(() => {
    const pages = [...document.querySelectorAll(".page")];
    return pages.map((pageElement) => {
      const slots = pageElement.querySelector(".slots");
      const slotRects = [...pageElement.querySelectorAll(".timeslot")].map((slot) => {
        const rect = slot.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          scrollWidth: slot.scrollWidth,
          scrollHeight: slot.scrollHeight,
          clientWidth: slot.clientWidth,
          clientHeight: slot.clientHeight
        };
      });
      const pageRect = pageElement.getBoundingClientRect();
      const footerRect = pageElement.querySelector(".page-footer").getBoundingClientRect();
      const styles = getComputedStyle(slots);
      return {
        grid: pageElement.dataset.grid,
        pageRect: {
          width: pageRect.width,
          height: pageRect.height,
          left: pageRect.left,
          right: pageRect.right,
          bottom: pageRect.bottom
        },
        columns: styles.gridTemplateColumns.split(" ").filter(Boolean).length,
        rows: styles.gridTemplateRows.split(" ").filter(Boolean).length,
        footerTop: footerRect.top,
        slotRects
      };
    });
  });
}

function expectNoOverflow(layout) {
  for (const pageData of layout) {
    for (const slot of pageData.slotRects) {
      expect(slot.scrollWidth).toBeLessThanOrEqual(slot.clientWidth + 2);
      expect(slot.scrollHeight).toBeLessThanOrEqual(slot.clientHeight + 2);
      expect(slot.left).toBeGreaterThanOrEqual(pageData.pageRect.left - 1);
      expect(slot.right).toBeLessThanOrEqual(pageData.pageRect.right + 1);
      expect(slot.bottom).toBeLessThanOrEqual(pageData.footerTop - 1);
    }
  }
}

test("ein bis vier Gruppen behalten identische 2x2-Slot-Abmessungen", async ({ page }) => {
  await seedState(page, createState(1));
  await page.goto("/");
  await page.emulateMedia({ media: "print" });
  let reference = null;

  for (let count = 1; count <= 4; count += 1) {
    if (count > 1) {
      await replaceState(page, createState(count));
    }
    const [layout] = await printLayout(page);
    expect(layout.grid).toBe("2x2");
    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(2);
    expect(layout.slotRects).toHaveLength(count);

    const dimensions = layout.slotRects.map(({ width, height }) => ({ width, height }));
    for (const item of dimensions) {
      expect(item.width).toBeCloseTo(dimensions[0].width, 0);
      expect(item.height).toBeCloseTo(dimensions[0].height, 0);
      if (reference) {
        expect(item.width).toBeCloseTo(reference.width, 0);
        expect(item.height).toBeCloseTo(reference.height, 0);
      }
    }
    reference ||= dimensions[0];
    expectNoOverflow([layout]);
  }
});

test("fünf und sechs Gruppen verwenden gleich große 2x3-Slots ohne Vollbreite", async ({ page }) => {
  await seedState(page, createState(5));
  await page.goto("/");
  await page.emulateMedia({ media: "print" });

  for (const count of [5, 6]) {
    if (count === 6) {
      await replaceState(page, createState(6));
    }
    const [layout] = await printLayout(page);
    expect(layout.grid).toBe("2x3");
    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(3);
    expect(layout.slotRects).toHaveLength(count);

    const first = layout.slotRects[0];
    for (const slot of layout.slotRects) {
      expect(slot.width).toBeCloseTo(first.width, 0);
      expect(slot.height).toBeCloseTo(first.height, 0);
      expect(slot.width).toBeLessThan(layout.pageRect.width * 0.5);
    }
    expectNoOverflow([layout]);
  }
});

test("sieben und zwölf Gruppen werden mit höchstens sechs 2x3-Slots paginiert", async ({ page }) => {
  await seedState(page, createState(7));
  await page.goto("/");
  await page.emulateMedia({ media: "print" });

  for (const [count, expectedSlots] of [[7, [6, 1]], [12, [6, 6]]]) {
    if (count === 12) {
      await replaceState(page, createState(12));
    }
    const layout = await printLayout(page);
    expect(layout.map((item) => item.slotRects.length)).toEqual(expectedSlots);
    expect(layout.every((item) => item.grid === "2x3" && item.rows === 3)).toBe(true);
    expectNoOverflow(layout);
  }
});

test("40 Schüler bleiben vollständig und erhalten Fortsetzungssegmente", async ({ page }) => {
  await seedState(page, createFortyStudentState());
  await page.goto("/");
  await page.emulateMedia({ media: "print" });

  await expect(page.locator(".page")).toHaveCount(2);
  await expect(page.locator(".timeslot")).toHaveCount(5);
  await expect(page.locator(".continuation-marker")).toHaveCount(4);
  await expect(page.locator(".student-table tbody tr:not(.empty-row)")).toHaveCount(40);
  expectNoOverflow(await printLayout(page));
});

test("lange Inhalte umbrechen ohne Slot- oder Footer-Overflow", async ({ page }) => {
  await seedState(page, createState(5, {
    longContent: true,
    studentsPerGroup: 6,
    minRows: 6
  }));
  await page.goto("/");
  await page.emulateMedia({ media: "print" });

  const layout = await printLayout(page);
  expect(layout.every((item) => item.grid === "2x3")).toBe(true);
  expectNoOverflow(layout);
  const typography = await page.evaluate(() => ({
    student: parseFloat(getComputedStyle(document.querySelector(".student-table td")).fontSize),
    group: parseFloat(getComputedStyle(document.querySelector(".time-text.print-only")).fontSize),
    badge: parseFloat(getComputedStyle(document.querySelector(".class-badge.print-only")).fontSize),
    title: parseFloat(getComputedStyle(document.querySelector(".preview-document-title")).fontSize),
    actions: getComputedStyle(document.querySelector(".student-actions")).display,
    headerRadius: parseFloat(getComputedStyle(document.querySelector(".header-inner")).borderTopLeftRadius),
    headerShadow: getComputedStyle(document.querySelector(".header-inner")).boxShadow
  }));
  expect(typography.student).toBeGreaterThanOrEqual(12.6);
  expect(typography.group).toBeGreaterThanOrEqual(14);
  expect(typography.badge).toBeGreaterThanOrEqual(12);
  expect(typography.title).toBeGreaterThanOrEqual(22);
  expect(typography.actions).toBe("none");
  expect(typography.headerRadius).toBeGreaterThanOrEqual(7);
  expect(typography.headerRadius).toBeLessThanOrEqual(12);
  expect(typography.headerShadow).toBe("none");
});

test("Drucken speichert und rendert offene Eingaben synchron", async ({ page }) => {
  await seedState(page, createState(1));
  await page.goto("/");
  await page.evaluate(() => {
    Object.defineProperty(window, "print", { configurable: true, value: () => {
      const stored = JSON.parse(localStorage.getItem("gitarrenunterricht_state_v3"));
      window.__printSnapshot = {
        renderedTitle: document.querySelector(".preview-document-title")?.textContent,
        storedTitle: stored?.plans?.[0]?.meta?.title
      };
    } });
  });

  await page.locator('[aria-labelledby="general-information-title"] > summary').click();
  await page.locator("#metaTitle").focus();
  await page.locator("#metaTitle").fill("Synchron vor dem PDF");
  await page.locator("#printBtn").click();

  expect(await page.evaluate(() => window.__printSnapshot)).toEqual({
    renderedTitle: "Synchron vor dem PDF",
    storedTitle: "Synchron vor dem PDF"
  });
});
