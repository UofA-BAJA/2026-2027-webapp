// Minimal Chrome DevTools Protocol client (Node 22+, no dependencies) for capture.mjs and build.mjs.
// Start headless Chrome first, for example:
//   flatpak run com.google.Chrome --headless=new --remote-debugging-port=9333 --remote-allow-origins='*' --user-data-dir=/tmp/tv2-headless about:blank
// (or any chrome/chromium binary with the same flags).
import { writeFileSync } from "node:fs";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connect(port = 9333) {
  const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    const w = waiting.get(msg.id);
    if (!w) return;
    waiting.delete(msg.id);
    msg.error ? w.fail(new Error(`${w.method}: ${msg.error.message}`)) : w.ok(msg.result);
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((ok, fail) => {
      const n = ++id;
      waiting.set(n, { ok, fail, method });
      ws.send(JSON.stringify({ id: n, method, params, sessionId }));
    });

  // one page with its own session
  async function page({ width = 1440, height = 900, scale = 2 } = {}) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const s = (method, params) => send(method, params, sessionId);
    await s("Page.enable");
    await s("Runtime.enable");
    const size = async (w, h) => s("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: scale, mobile: false });
    await size(width, height);
    const evaluate = async (expression) => {
      const r = await s("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    };
    return {
      send: s,
      size,
      evaluate,
      beforeLoad: (source) => s("Page.addScriptToEvaluateOnNewDocument", { source }),
      async goto(url, wait = 2500) {
        await s("Page.navigate", { url });
        await sleep(wait);
      },
      mouse: (type, x, y, buttons = 0) => s("Input.dispatchMouseEvent", { type, x, y, button: buttons ? "left" : "none", buttons, clickCount: type === "mouseMoved" ? 0 : 1 }),
      key: (key) => s("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: { ArrowRight: 39, ArrowLeft: 37, Escape: 27 }[key] ?? 0 }).then(() => s("Input.dispatchKeyEvent", { type: "keyUp", key, code: key })),
      // PNG of the viewport, or of a CSS-pixel rect { x, y, width, height }
      async shot(file, clip) {
        const r = await s("Page.captureScreenshot", { format: "png", ...(clip && { clip: { ...clip, scale: 1 } }), captureBeyondViewport: !!clip });
        writeFileSync(file, Buffer.from(r.data, "base64"));
      },
      async pdf(file, opts) {
        const r = await s("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, ...opts });
        writeFileSync(file, Buffer.from(r.data, "base64"));
      },
      close: () => send("Target.closeTarget", { targetId }),
    };
  }
  return { page, close: () => ws.close() };
}
