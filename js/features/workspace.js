import { setPrintPresentation } from "../render.js";
import { safeGetItem, safeSetItem } from "../persistence.js";
import { motionAllowed } from "../ui/motion.js";
import { showModal } from "../ui/feedback.js";
import { initialiseOverview } from "./overview.js";
import { printPlan } from "./lifecycle.js";

const VIEW_KEY = "gitarrenunterricht_vorschau";
const SECTIONS_KEY = "gitarrenunterricht_editor_bereiche";
const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5];
const PAGE_GAP = 24;

function readPreference(key) {
  try {
    return JSON.parse(safeGetItem(key)) || {};
  } catch {
    return {};
  }
}

function initialiseSections() {
  const sections = [...document.querySelectorAll(".editor-grid > details, .danger-zone")];
  const openSections = readPreference(SECTIONS_KEY);
  const keyFor = (section) => section.getAttribute("aria-labelledby") || "danger";
  const rememberSections = () => {
    safeSetItem(SECTIONS_KEY, JSON.stringify(Object.fromEntries(sections.map((section) => [keyFor(section), section.open]))));
  };
  sections.forEach((section) => {
    section.open = openSections[keyFor(section)] ?? section.open;
    section.addEventListener("toggle", rememberSections);
  });
  return () => sections.forEach((section) => section.removeEventListener("toggle", rememberSections));
}

function inputFocused(event) {
  return event.target?.isContentEditable || Boolean(event.target?.closest?.("input, textarea, select"));
}

function focusEditorField(id) {
  document.getElementById("editViewBtn")?.click();
  const field = document.getElementById(id);
  const section = field?.closest("details");
  if (section) section.open = true;
  field?.focus();
}

function help() {
  showModal({
    title: "Tastenkürzel",
    message: "N öffnet Neue Gruppe. S springt zur Namenseingabe. Strg/Cmd+Z macht rückgängig, Umschalt+Strg/Cmd+Z wiederholt. Strg/Cmd+P druckt. Über der Vorschau zoomst du mit Strg/Cmd und Mausrad oder mit Plus und Minus.",
    type: "alert"
  });
}

export function initialiseWorkspace() {
  const get = (id) => document.getElementById(id);
  const pages = get("pages");
  const shell = get("app-shell");
  const stylesheet = get("printLayoutStyles");
  const workspace = document.querySelector(".preview-workspace");
  if (!workspace || !pages || !stylesheet) return () => {};

  const cleanups = [initialiseSections(), initialiseOverview(pages)];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };
  const select = get("zoomSelect");
  const navigation = get("pageNav");
  const zoomValue = get("zoomValue");
  const preference = readPreference(VIEW_KEY);
  let zoom = ZOOM_LEVELS.includes(preference.zoom) ? preference.zoom : "fit";
  let spread = typeof preference.spread === "boolean" ? preference.spread : null;
  let proof = false;
  let scale = 1;
  let current = 0;
  let navigationUntil = 0;
  let frames = [];
  const save = () => safeSetItem(VIEW_KEY, JSON.stringify({ zoom, spread }));

  function updateNavigator(index) {
    if (!frames.length) return;
    current = Math.max(0, Math.min(index, frames.length - 1));
    navigation.value = String(current);
    navigation.setAttribute("aria-label", "Seite wählen, aktuell Seite " + (current + 1));
    get("pageCount").textContent = "von " + frames.length;
  }

  function resize() {
    if (!frames.length || !pages.clientWidth) return;
    const fluid = window.innerWidth <= 900 && !proof && zoom === "fit";
    pages.classList.toggle("fluid-page", fluid);
    const paper = frames[0].firstElementChild;
    const available = Math.max(1, pages.clientWidth - 2 * PAGE_GAP);
    const width = fluid ? available : paper.offsetWidth;
    if (!width) return;
    const automaticSpread = zoom === "fit" && window.innerWidth >= 1900 && available >= width * 1.44 + PAGE_GAP;
    const columns = frames.length > 1 && window.innerWidth >= 1180 && (spread ?? automaticSpread) ? 2 : 1;
    const fit = (available - (columns - 1) * PAGE_GAP) / (columns * width);
    scale = fluid ? 1 : zoom === "fit" ? Math.max(0.3, Math.min(1.5, fit)) : zoom;
    pages.style.setProperty("--preview-scale", String(scale));
    pages.style.setProperty("--page-columns", String(columns));
    pages.style.setProperty("--fluid-width", width + "px");
    frames.forEach((frame) => {
      const page = frame.firstElementChild;
      frame.style.width = width * scale + "px";
      frame.style.height = page.offsetHeight * scale + "px";
    });
    select.value = String(zoom);
    zoomValue.textContent = Math.round(scale * 100) + " %";
    get("spreadBtn").setAttribute("aria-pressed", String(columns === 2));
    get("spreadBtn").disabled = frames.length < 2 || window.innerWidth < 1180;
  }

  const visible = new Map();
  const intersection = typeof window.IntersectionObserver === "function" ? new window.IntersectionObserver((entries) => {
    entries.forEach((entry) => visible.set(entry.target, entry.intersectionRatio));
    if (Date.now() < navigationUntil) return;
    const maximum = Math.max(0, ...visible.values());
    if (!maximum || visible.get(frames[current]) === maximum) return;
    updateNavigator(frames.findIndex((frame) => visible.get(frame) === maximum));
  }, { threshold: [0, 0.15, 0.3, 0.5, 0.65, 0.8, 1] }) : null;
  const sizeObserver = typeof window.ResizeObserver === "function" ? new window.ResizeObserver(resize) : null;

  function refresh() {
    frames = [...pages.children];
    navigation.replaceChildren(...frames.map((frame, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = String(index + 1);
      frame.dataset.pageIndex = String(index);
      return option;
    }));
    navigation.disabled = frames.length < 2;
    intersection?.disconnect();
    sizeObserver?.disconnect();
    sizeObserver?.observe(workspace);
    visible.clear();
    frames.forEach((frame) => {
      intersection?.observe(frame);
      sizeObserver?.observe(frame.firstElementChild);
    });
    updateNavigator(current);
    resize();
  }

  function switchView(view) {
    shell.dataset.smallView = view;
    get("editViewBtn").setAttribute("aria-pressed", String(view === "edit"));
    get("previewViewBtn").setAttribute("aria-pressed", String(view === "preview"));
    resize();
  }

  function animateZoom() {
    if (motionAllowed()) pages.animate([{ opacity: 0.82 }, { opacity: 1 }], {
      duration: 160, easing: "ease-out"
    });
  }

  function changeZoom(direction) {
    const level = direction > 0 ? ZOOM_LEVELS.find((value) => value > scale + 0.005)
      : ZOOM_LEVELS.findLast((value) => value < scale - 0.005);
    if (!level) return;
    zoom = level;
    save();
    resize();
    animateZoom();
  }

  const mutations = new window.MutationObserver(refresh);
  mutations.observe(pages, { childList: true });
  listen(window, "resize", resize);
  listen(get("editViewBtn"), "click", () => switchView("edit"));
  listen(get("previewViewBtn"), "click", () => switchView("preview"));
  listen(get("shortcutHelp"), "click", help);
  listen(get("proofBtn"), "click", () => {
    proof = !proof;
    stylesheet.media = proof ? "all" : "print";
    shell.classList.toggle("print-proof", proof);
    get("proofBtn").setAttribute("aria-pressed", String(proof));
    setPrintPresentation("proof", proof);
    switchView("preview");
  });
  listen(get("spreadBtn"), "click", () => {
    spread = get("spreadBtn").getAttribute("aria-pressed") !== "true";
    save();
    resize();
    animateZoom();
  });
  listen(select, "change", () => {
    zoom = select.value === "fit" ? "fit" : Number(select.value);
    if (zoom === "fit") spread = null;
    save();
    resize();
    animateZoom();
  });
  listen(get("zoomOut"), "click", () => changeZoom(-1));
  listen(get("zoomIn"), "click", () => changeZoom(1));
  listen(navigation, "change", () => {
    navigationUntil = Date.now() + 600;
    updateNavigator(Number(navigation.value));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    frames[current]?.scrollIntoView({ block: "start", inline: "nearest", behavior: reduce ? "instant" : "smooth" });
  });
  listen(pages, "wheel", (event) => {
    if (!(event.ctrlKey || event.metaKey) || inputFocused(event)) return;
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  listen(document, "keydown", (event) => {
    if (inputFocused(event) || event.altKey || shell.hasAttribute("inert") || event.defaultPrevented) return;
    const modified = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (modified && key === "p") {
      event.preventDefault();
      printPlan();
    } else if (modified && pages.contains(event.target) && ["+", "=", "-"].includes(key)) {
      event.preventDefault();
      changeZoom(key === "-" ? -1 : 1);
    } else if (!modified && key === "n") {
      event.preventDefault();
      focusEditorField("newGroupStart");
    } else if (!modified && key === "s") {
      event.preventDefault();
      focusEditorField("studentName");
    } else if (!modified && key === "?") {
      event.preventDefault();
      help();
    }
  });
  switchView("preview");
  refresh();

  return () => {
    cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
    stylesheet.media = "print";
    shell.classList.remove("print-proof");
    if (proof) setPrintPresentation("proof", false);
    sizeObserver?.disconnect();
    intersection?.disconnect();
    mutations.disconnect();
  };
}
