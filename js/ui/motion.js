const MOTION_NODES = "[data-motion-key]";
const MAX_MOTION_ROWS = 1000;
const MAX_VISIBLE_NODES = 150;

export function motionAllowed() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: no-preference)").matches)
    && !window.matchMedia?.("print").matches;
}

function visibleNodes(container) {
  const nodes = new Map();
  for (const node of container.querySelectorAll(MOTION_NODES)) {
    const rect = node.getBoundingClientRect();
    if (rect.width && rect.height && rect.bottom > 0 && rect.top < window.innerHeight
      && rect.right > 0 && rect.left < window.innerWidth) {
      nodes.set(node.dataset.motionKey, { node, rect });
      if (nodes.size >= MAX_VISIBLE_NODES) break;
    }
  }
  return nodes;
}

export function capturePageMotion(container, plan, type) {
  if (!type || !motionAllowed() || container.closest(".print-proof")
    || plan.groups.reduce((count, group) => count + group.students.length, 0) > MAX_MOTION_ROWS) {
    return null;
  }
  return type === "plan/select" ? { type } : { type, before: visibleNodes(container) };
}

function options(kind) {
  const styles = getComputedStyle(document.documentElement);
  return {
    duration: parseFloat(styles.getPropertyValue(kind === "exit" ? "--motion-fast" : "--motion-standard")) || 200,
    easing: styles.getPropertyValue(kind === "exit" ? "--motion-out" : "--motion-enter").trim() || "ease-out"
  };
}

function animate(node, kind, keyframes, timing, onDone) {
  if (typeof node.animate !== "function") return;
  node.dataset.motion = kind;
  const motion = node.animate(keyframes, timing);
  motion.finished.catch(() => {}).finally(() => {
    if (node.dataset.motion === kind) delete node.dataset.motion;
    onDone?.();
  });
}

function exitGhost({ node, rect }, timing, scale) {
  const wrapper = document.createElement("div");
  wrapper.className = "motion-ghost no-print";
  wrapper.inert = true;
  wrapper.setAttribute("aria-hidden", "true");
  Object.assign(wrapper.style, {
    left: rect.left + "px",
    top: rect.top + "px",
    width: rect.width + "px",
    height: rect.height + "px"
  });
  const clone = node.cloneNode(true);
  clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  const child = node.tagName === "TR" ? document.createElement("table") : clone;
  if (child !== clone) {
    child.className = "student-table";
    child.createTBody().append(clone);
  }
  child.style.zoom = String(scale);
  child.style.width = rect.width / scale + "px";
  wrapper.append(child);
  document.body.append(wrapper);
  animate(wrapper, "leaving", [
    { opacity: 1, transform: "scaleY(1)" },
    { opacity: 0, transform: "scaleY(.75) translateY(-6px)" }
  ], timing, () => wrapper.remove());
}

export function playPageMotion(container, snapshot) {
  if (!snapshot) return;
  const timing = options("enter");
  if (snapshot.type === "plan/select") {
    animate(container, "plan", [{ opacity: 0.45 }, { opacity: 1 }], timing);
    return;
  }

  const { before, type } = snapshot;
  const after = visibleNodes(container);
  const scale = Number(container.style.getPropertyValue("--preview-scale")) || 1;
  after.forEach(({ node, rect }, key) => {
    const previous = before.get(key)?.rect;
    if (!previous) {
      if (type.endsWith("/add") || type === "student/addMany") {
        animate(node, "entering", [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], timing);
      }
      return;
    }
    const x = (previous.left - rect.left) / scale;
    const y = (previous.top - rect.top) / scale;
    if (Math.abs(x) + Math.abs(y) >= 1 && !(node.tagName === "TR" && node.closest(".timeslot")?.dataset.motion === "moving")) {
      animate(node, "moving", [
        { transform: "translate(" + x + "px, " + y + "px)" },
        { transform: "translate(0, 0)" }
      ], timing);
    }
  });

  if (type.endsWith("/remove")) {
    const exit = options("exit");
    before.forEach((entry, key) => {
      if (!after.has(key) && (type === "group/remove" ? entry.node.tagName !== "TR" : entry.node.tagName === "TR")) {
        exitGhost(entry, exit, scale);
      }
    });
  }
}
