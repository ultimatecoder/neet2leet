"use strict";

// Injects an "Open on LeetCode" button next to the problem title on
// neetcode.io/problems/<slug>/... pages. Neetcode is an SPA, so the script runs
// on every neetcode.io page and reacts to route changes and re-renders.

const BTN_CLASS = "n2l-btn";
const STATE_CLASSES = ["n2l-loading", "n2l-found", "n2l-notfound", "n2l-error"];

// Current problem: { ncSlug, title, status, url, message }
let current = null;
let syncQueued = false;

function problemSlugFromPath() {
  return location.pathname.match(/^\/problems\/([^/]+)/)?.[1] ?? null;
}

function render(btn) {
  btn.classList.remove(...STATE_CLASSES);
  btn.removeAttribute("href");
  btn.removeAttribute("title");
  btn.removeAttribute("aria-disabled");
  switch (current.status) {
    case "loading":
      btn.classList.add("n2l-loading");
      btn.textContent = "Finding on LeetCode…";
      btn.setAttribute("aria-disabled", "true");
      break;
    case "found":
      btn.classList.add("n2l-found");
      btn.textContent = "Open on LeetCode ↗";
      btn.href = current.url;
      btn.title = current.url;
      break;
    case "notfound":
      btn.classList.add("n2l-notfound");
      btn.textContent = "No LeetCode match";
      btn.title = `No LeetCode problem found for "${current.title}"`;
      btn.setAttribute("aria-disabled", "true");
      break;
    case "error":
      btn.classList.add("n2l-error");
      btn.textContent = "LeetCode lookup failed — retry";
      btn.title = current.message || "Lookup failed";
      break;
  }
}

function createButton() {
  const btn = document.createElement("a");
  btn.className = BTN_CLASS;
  btn.target = "_blank";
  btn.rel = "noopener noreferrer";
  btn.addEventListener("click", (event) => {
    if (!current || current.status === "found") return; // native link opens new tab
    event.preventDefault();
    if (current.status === "error") startResolve();
  });
  return btn;
}

async function startResolve() {
  const request = current;
  request.status = "loading";
  const btn = document.querySelector(`.${BTN_CLASS}`);
  if (btn) render(btn);

  let response;
  try {
    response = await browser.runtime.sendMessage({
      type: "resolve",
      ncSlug: request.ncSlug,
      title: request.title,
    });
  } catch (err) {
    response = { status: "error", message: String(err?.message ?? err) };
  }
  if (current !== request) return; // user navigated to another problem meanwhile
  Object.assign(request, {
    status: response?.status ?? "error",
    url: response?.url,
    message: response?.message,
  });
  const liveBtn = document.querySelector(`.${BTN_CLASS}`);
  if (liveBtn) render(liveBtn);
}

function sync() {
  syncQueued = false;
  const ncSlug = problemSlugFromPath();
  const existing = document.querySelector(`.${BTN_CLASS}`);

  if (!ncSlug) {
    existing?.remove();
    current = null;
    return;
  }

  const h1 = document.querySelector("h1.problem-title");
  const title = h1?.textContent.replace(/\s+/g, " ").trim();
  if (!h1 || !title) return;

  if (!current || current.ncSlug !== ncSlug) {
    // During problem-to-problem SPA navigation the old title can linger briefly;
    // wait for the new one so we never resolve the new slug with the old title.
    if (current && title === current.title) return;
    current = { ncSlug, title, status: "loading" };
    startResolve();
  }

  // (Re)attach the button right after the title if Angular re-rendered it away.
  let btn = existing;
  if (!btn || btn.previousElementSibling !== h1) {
    btn?.remove();
    btn = createButton();
    h1.insertAdjacentElement("afterend", btn);
    render(btn);
  }
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  setTimeout(sync, 150);
}

new MutationObserver(queueSync).observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
});
queueSync();
