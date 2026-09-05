/** Screen scaling never changes the page's physical CSS dimensions. */
export function initialiseWorkspace() {
  const pages = document.getElementById("pages");
  const workspace = document.querySelector(".preview-workspace");
  if (!workspace || !pages) {
    return () => {};
  }

  if (window.innerWidth >= 1180) {
    document.querySelectorAll(".editor-grid > details").forEach((section) => {
      section.open = section.getAttribute("aria-labelledby") === "plan-management-title"
        || section.getAttribute("aria-labelledby") === "new-group-title";
    });
  }

  const resize = () => {
    const firstPage = pages.querySelector(".page");
    if (!firstPage) {
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
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  const observePages = () => {
    observer?.disconnect();
    observer?.observe(pages);
    pages.querySelectorAll(".page").forEach((page) => observer?.observe(page));
    resize();
  };
  const mutations = new MutationObserver(observePages);
  mutations.observe(pages, { childList: true });
  window.addEventListener("resize", resize);
  observePages();

  return () => {
    observer?.disconnect();
    mutations.disconnect();
    window.removeEventListener("resize", resize);
  };
}
