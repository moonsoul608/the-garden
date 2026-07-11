/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = process.env.BASE_URL || "http://localhost:3001";
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const defaultRoutes = [
  "/", "/garden", "/forest", "/lake", "/ruins", "/greenhouse", "/index", "/search",
  "/garden/building-the-garden", "/garden/exploring-ai-tools",
  "/forest/why-exploratory-websites-invite-more-clicks", "/forest/does-ai-help-thinking-or-organize-answers",
  "/lake/reverse-1999", "/lake/jung-and-mandala",
  "/ruins/first-version-of-home", "/ruins/portfolio-never-built",
];
const routes = process.env.AUDIT_ROUTES ? process.env.AUDIT_ROUTES.split(",") : defaultRoutes;
const viewports = process.env.AUDIT_WIDTHS ? process.env.AUDIT_WIDTHS.split(",").map(Number) : [320, 390, 500, 768, 1024, 1440];

class CdpPipe {
  constructor() {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.buffer = "";
    this.chrome = spawn(chromePath, [
      "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      "--remote-debugging-pipe", `--user-data-dir=${join(process.cwd(), ".chrome-cdp-audit")}`,
    ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], windowsHide: true });
    this.chrome.stdio[4].setEncoding("utf8");
    this.chrome.stdio[4].on("data", (chunk) => this.consume(chunk));
    this.chrome.on("exit", (code) => {
      for (const { reject } of this.pending.values()) reject(new Error(`Chrome exited with ${code}`));
    });
  }

  consume(chunk) {
    this.buffer += chunk;
    let boundary;
    while ((boundary = this.buffer.indexOf("\0")) >= 0) {
      const raw = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 1);
      if (!raw) continue;
      const message = JSON.parse(raw);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      } else if (message.method) {
        const key = `${message.sessionId || "root"}:${message.method}`;
        const callbacks = this.listeners.get(key) || [];
        this.listeners.delete(key);
        callbacks.forEach((resolve) => resolve(message.params));
      }
    }
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const message = { id, method, params, ...(sessionId ? { sessionId } : {}) };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.chrome.stdio[3].write(`${JSON.stringify(message)}\0`);
    });
  }

  once(method, sessionId) {
    const key = `${sessionId || "root"}:${method}`;
    return new Promise((resolve) => this.listeners.set(key, [...(this.listeners.get(key) || []), resolve]));
  }

  close() { this.chrome.kill(); }
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function navigate(cdp, sessionId, url) {
  const loaded = cdp.once("Page.loadEventFired", sessionId);
  await cdp.send("Page.navigate", { url }, sessionId);
  await loaded;
  await new Promise((resolve) => setTimeout(resolve, 200));
}

async function press(cdp, sessionId, key, modifiers = 0) {
  const code = key === " " ? "Space" : key;
  const text = key === " " ? " " : "";
  const virtualKeyCode = { " ": 32, Enter: 13, Escape: 27, Tab: 9 }[key] || 0;
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, text, modifiers, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode }, sessionId);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode }, sessionId);
  await new Promise((resolve) => setTimeout(resolve, 50));
}

(async () => {
  const cdp = new CdpPipe();
  let failures = 0;
  try {
    await cdp.send("Browser.getVersion");
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);

    for (const width of viewports) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width, height: 900, deviceScaleFactor: 1, mobile: width < 500,
        screenWidth: width, screenHeight: 900,
      }, sessionId);
      for (const route of routes) {
        await navigate(cdp, sessionId, `${baseUrl}${route}`);
        const audit = await evaluate(cdp, sessionId, `(() => {
          const viewport = document.documentElement.clientWidth;
          const overflows = [...document.querySelectorAll("body *")].filter((element) => {
            if (element.closest('[aria-hidden="true"]')) return false;
            const style = getComputedStyle(element);
            if (style.position === "fixed" && style.transform !== "none") return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.left < -1 || rect.right > viewport + 1);
          }).slice(0, 8).map((element) => ({ tag: element.tagName, className: element.className, rect: element.getBoundingClientRect().toJSON() }));
          return {
            viewport,
            scrollWidth: document.documentElement.scrollWidth,
            overflows,
            h1: document.querySelectorAll("h1").length,
            mains: document.querySelectorAll("main").length,
            mainTarget: Boolean(document.querySelector("main#main-content")),
            skipTarget: document.querySelector(".skip-link")?.getAttribute("href"),
          };
        })()`);
        const failed = audit.scrollWidth > audit.viewport + 1 || audit.overflows.length || audit.h1 !== 1 || audit.mains !== 1 || !audit.mainTarget || audit.skipTarget !== "#main-content";
        if (failed) failures++;
        console.log(`${failed ? "FAIL" : "PASS"} ${width}px ${route} ${JSON.stringify(audit)}`);
      }
    }

    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 900 }, sessionId);
    for (const route of routes) {
      await navigate(cdp, sessionId, `${baseUrl}${route}`);
      await evaluate(cdp, sessionId, axeSource);
      const axe = await evaluate(cdp, sessionId, "axe.run(document, { resultTypes: ['violations'] }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, html: n.html })) })))");
      if (axe.length) failures++;
      console.log(`${axe.length ? "FAIL" : "PASS"} axe ${route} ${JSON.stringify(axe)}`);
    }

    await navigate(cdp, sessionId, `${baseUrl}/`);

    const firstTab = await (async () => {
      await evaluate(cdp, sessionId, "document.body.focus()");
      await press(cdp, sessionId, "Tab");
      return evaluate(cdp, sessionId, "({ text: document.activeElement.textContent.trim(), href: document.activeElement.getAttribute('href') })");
    })();
    const firstTabPass = firstTab.href === "#main-content";
    if (!firstTabPass) failures++;
    console.log(`${firstTabPass ? "PASS" : "FAIL"} first Tab ${JSON.stringify(firstTab)}`);
    await press(cdp, sessionId, "Tab");
    await press(cdp, sessionId, "Tab", 8);
    const reverseTab = await evaluate(cdp, sessionId, "({ tag: document.activeElement.tagName, text: document.activeElement.textContent.trim() })");
    const reverseTabPass = reverseTab.tag === "A" && reverseTab.text === "Skip to main content";
    if (!reverseTabPass) failures++;
    console.log(`${reverseTabPass ? "PASS" : "FAIL"} Shift+Tab ${JSON.stringify(reverseTab)}`);

    await evaluate(cdp, sessionId, "document.querySelector('#garden-guide-toggle').focus()");
    await press(cdp, sessionId, " ");
    const opened = await evaluate(cdp, sessionId, "({ open: document.querySelector('#garden-guide').open, expanded: document.querySelector('#garden-guide-toggle').getAttribute('aria-expanded'), focus: document.activeElement.getAttribute('aria-label') })");
    const openPass = opened.open && opened.expanded === "true" && opened.focus === "Close Garden Guide";
    if (!openPass) failures++;
    console.log(`${openPass ? "PASS" : "FAIL"} Guide Space ${JSON.stringify(opened)}`);
    await press(cdp, sessionId, "Escape");
    const closed = await evaluate(cdp, sessionId, "({ open: document.querySelector('#garden-guide').open, expanded: document.querySelector('#garden-guide-toggle').getAttribute('aria-expanded'), focus: document.activeElement.id })");
    const closePass = !closed.open && closed.expanded === "false" && closed.focus === "garden-guide-toggle";
    if (!closePass) failures++;
    console.log(`${closePass ? "PASS" : "FAIL"} Guide Escape ${JSON.stringify(closed)}`);

    const keyboardChecks = [
      ["/garden", ".bed-filter:nth-child(2)"],
      ["/forest", ".trail-filter:nth-child(2)"],
      ["/lake", ".ripple-filter:nth-child(2)"],
      ["/index", ".filter-row button:nth-child(2)"],
    ];
    for (const [route, selector] of keyboardChecks) {
      await navigate(cdp, sessionId, `${baseUrl}${route}`);
      await evaluate(cdp, sessionId, `document.querySelector(${JSON.stringify(selector)}).focus()`);
      await press(cdp, sessionId, " ");
      const state = await evaluate(cdp, sessionId, `({ pressed: document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-pressed'), outline: getComputedStyle(document.querySelector(${JSON.stringify(selector)})).outlineStyle })`);
      const pass = state.pressed === "true" && state.outline !== "none";
      if (!pass) failures++;
      console.log(`${pass ? "PASS" : "FAIL"} keyboard filter ${route} ${JSON.stringify(state)}`);
    }

    for (const [route, inputSelector, clearLabel] of [
      ["/garden", ".garden-search input", "Clear Garden search"],
      ["/index", ".discovery-search-field input", "Clear index search"],
      ["/search", ".search-call-field input", "Clear garden search"],
    ]) {
      await navigate(cdp, sessionId, `${baseUrl}${route}`);
      await evaluate(cdp, sessionId, `document.querySelector(${JSON.stringify(inputSelector)}).focus()`);
      await cdp.send("Input.insertText", { text: "garden" }, sessionId);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await evaluate(cdp, sessionId, `document.querySelector('[aria-label=${JSON.stringify(clearLabel)}]').focus()`);
      await press(cdp, sessionId, " ");
      const value = await evaluate(cdp, sessionId, `document.querySelector(${JSON.stringify(inputSelector)}).value`);
      const pass = value === "";
      if (!pass) failures++;
      console.log(`${pass ? "PASS" : "FAIL"} keyboard search clear ${route}`);
    }

    await cdp.send("Browser.grantPermissions", { origin: baseUrl, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] });
    await navigate(cdp, sessionId, `${baseUrl}/greenhouse?idea=${encodeURIComponent("Why do memories change?")}`);
    const prefill = await evaluate(cdp, sessionId, "({ value: document.querySelector('#greenhouse-idea').value, loading: document.querySelector('form button[type=submit]').getAttribute('aria-disabled') })");
    const prefillPass = prefill.value === "Why do memories change?" && prefill.loading === "false";
    if (!prefillPass) failures++;
    console.log(`${prefillPass ? "PASS" : "FAIL"} Greenhouse prefill ${JSON.stringify(prefill)}`);
    await evaluate(cdp, sessionId, "window.fetch = async () => { throw new Error('test failure') }; document.querySelector('form button[type=submit]').focus()");
    await press(cdp, sessionId, " ");
    await new Promise((resolve) => setTimeout(resolve, 100));
    const errorState = await evaluate(cdp, sessionId, "Boolean(document.querySelector('[role=alert]'))");
    if (!errorState) failures++;
    console.log(`${errorState ? "PASS" : "FAIL"} Greenhouse error alert`);
    await evaluate(cdp, sessionId, `window.fetch = async () => new Response(JSON.stringify({ ok: true, seed: { seedName: "Memory paths", coreQuestion: "Why do memories change?", suggestedRegion: "Forest", growthStage: "Seed", pathsToExplore: ["Recall", "Meaning", "Time"], firstStep: "Write down one changed memory today." } }), { status: 200, headers: { "Content-Type": "application/json" } }); document.querySelector('[role=alert] button').focus()`);
    await press(cdp, sessionId, " ");
    await new Promise((resolve) => setTimeout(resolve, 150));
    const success = await evaluate(cdp, sessionId, "Boolean(document.querySelector('.seed-card'))");
    if (!success) failures++;
    console.log(`${success ? "PASS" : "FAIL"} Greenhouse retry success`);
    await evaluate(cdp, sessionId, "[...document.querySelectorAll('.result-actions button')].find(b => b.textContent.includes('Copy this Seed')).focus()");
    await press(cdp, sessionId, " ");
    const copyStatus = await evaluate(cdp, sessionId, "document.querySelector('.sr-status').textContent");
    const copyPass = copyStatus === "Seed copied.";
    if (!copyPass) failures++;
    console.log(`${copyPass ? "PASS" : "FAIL"} Greenhouse copy announcement ${copyStatus}`);
    await evaluate(cdp, sessionId, "[...document.querySelectorAll('.result-actions button')].find(b => b.textContent.includes('Grow it again')).focus()");
    await press(cdp, sessionId, " ");
    await new Promise((resolve) => setTimeout(resolve, 150));
    const regrown = await evaluate(cdp, sessionId, "Boolean(document.querySelector('.seed-card'))");
    if (!regrown) failures++;
    console.log(`${regrown ? "PASS" : "FAIL"} Greenhouse grow again`);
    await evaluate(cdp, sessionId, "[...document.querySelectorAll('.result-actions button')].find(b => b.textContent.includes('Edit the idea')).focus()");
    await press(cdp, sessionId, " ");
    const editFocus = await evaluate(cdp, sessionId, "document.activeElement.id");
    if (editFocus !== "greenhouse-idea") failures++;
    console.log(`${editFocus === "greenhouse-idea" ? "PASS" : "FAIL"} Greenhouse edit focus ${editFocus}`);
    await evaluate(cdp, sessionId, "document.querySelector('form button[type=submit]').focus()");
    await press(cdp, sessionId, " ");
    await new Promise((resolve) => setTimeout(resolve, 150));
    await evaluate(cdp, sessionId, "[...document.querySelectorAll('.result-actions button')].find(b => b.textContent.includes('Plant another idea')).focus()");
    await press(cdp, sessionId, " ");
    const resetState = await evaluate(cdp, sessionId, "({ value: document.querySelector('#greenhouse-idea').value, focus: document.activeElement.id })");
    const resetPass = resetState.value === "" && resetState.focus === "greenhouse-idea";
    if (!resetPass) failures++;
    console.log(`${resetPass ? "PASS" : "FAIL"} Greenhouse reset focus ${JSON.stringify(resetState)}`);

    await navigate(cdp, sessionId, `${baseUrl}/garden/building-the-garden`);
    await evaluate(cdp, sessionId, "document.querySelector('.detail-back').focus()");
    await press(cdp, sessionId, "Tab");
    const related = await evaluate(cdp, sessionId, "(() => { const link = document.activeElement; return { tag: link.tagName, href: link.getAttribute('href'), outline: getComputedStyle(link).outlineStyle }; })()");
    const relatedPass = related.tag === "A" && related.href && related.outline !== "none";
    if (!relatedPass) failures++;
    console.log(`${relatedPass ? "PASS" : "FAIL"} related path keyboard ${JSON.stringify(related)}`);
    await press(cdp, sessionId, "Enter");
    await new Promise((resolve) => setTimeout(resolve, 250));
    const relatedNavigation = await evaluate(cdp, sessionId, "window.location.pathname");
    const relatedNavigationPass = relatedNavigation === related.href;
    if (!relatedNavigationPass) failures++;
    console.log(`${relatedNavigationPass ? "PASS" : "FAIL"} related path Enter ${relatedNavigation}`);

    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
    for (const route of ["/", "/garden", "/forest", "/lake", "/ruins", "/greenhouse"]) {
      await navigate(cdp, sessionId, `${baseUrl}${route}`);
      const motion = await evaluate(cdp, sessionId, "({ scroll: getComputedStyle(document.documentElement).scrollBehavior, infinite: [...document.querySelectorAll('*')].filter(e => getComputedStyle(e).animationIterationCount === 'infinite').length })");
      const pass = motion.scroll === "auto" && motion.infinite === 0;
      if (!pass) failures++;
      console.log(`${pass ? "PASS" : "FAIL"} reduced motion ${route} ${JSON.stringify(motion)}`);
    }

    console.log(`Phase 5 browser audit failures: ${failures}`);
    process.exitCode = failures ? 1 : 0;
  } finally {
    cdp.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
