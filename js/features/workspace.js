import { safeGetItem, safeSetItem } from "../persistence.js";

/** Screen scaling never changes the page's physical CSS dimensions. */
export function initialiseWorkspace() {
  const pages = document.getElementById("pages");
  const workspace = document.querySelector(".preview-workspace");
  if (!workspace || !pages) {
    return () => {};
  }

  const sectionsKey = "gitarrenunterricht_editor_bereiche";
  const sections = [...document.querySelectorAll(".editor-grid > details, .danger-zone")];
  let openSections = {};
  try {
    openSections = JSON.parse(safeGetItem(sectionsKey)) || {};
  } catch {
    // Use the defaults when a device preference is invalid.
  }
  const keyFor = (section) => section.getAttribute("aria-labelledby") || "danger";
  const rememberSections = () => {
    safeSetItem(sectionsKey, JSON.stringify(Object.fromEntries(sections.map((section) => [keyFor(section), section.open]))));
  };
  sections.forEach((section) => {
    section.open = openSections[keyFor(section)] ?? section.open;
    section.addEventListener("toggle", rememberSections);
  });

  const shell = document.getElementById("app-shell");
  const editButton = document.getElementById("editViewBtn");
  const previewButton = document.getElementById("previewViewBtn");
  const setView = (view) => {
    shell.dataset.smallView = view;
    editButton?.setAttribute("aria-pressed", String(view === "edit"));
    previewButton?.setAttribute("aria-pressed", String(view === "preview"));
    resize();
  };
  const edit = () => setView("edit");
  const preview = () => setView("preview");
  editButton?.addEventListener("click", edit);
  previewButton?.addEventListener("click", preview);

  const resize = () => {
    const firstPage = pages.querySelector(".page");
    if (!firstPage || !pages.clientWidth || !firstPage.offsetWidth) {
      return;
    }
    const scale = window.innerWidth > 900
      ? Math.min(1, pages.clientWidth / firstPage.offsetWidth)
      : 1;
    pages.style.setProperty("--preview-scale", String(scale));
    pages.querySelectorAll(".page-frame").forEach((frame) => {
      const page = frame.firstElementChild;
      frame.style.width = page.offsetWidth * scale + "px";
      frame.style.height = page.offsetHeight * scale + "px";
    });
  };
  const observer = typeof window.ResizeObserver === "function" ? new window.ResizeObserver(resize) : null;
  const observePages = () => {
    observer?.disconnect();
    observer?.observe(pages);
    pages.querySelectorAll(".page").forEach((page) => observer?.observe(page));
    resize();
  };
  const mutations = new window.MutationObserver(observePages);
  mutations.observe(pages, { childList: true });
  window.addEventListener("resize", resize);
  preview();
  observePages();

  return () => {
    sections.forEach((section) => section.removeEventListener("toggle", rememberSections));
    editButton?.removeEventListener("click", edit);
    previewButton?.removeEventListener("click", preview);
    observer?.disconnect();
    mutations.disconnect();
    window.removeEventListener("resize", resize);
  };
}
