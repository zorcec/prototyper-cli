// Proto Studio Chrome Extension — Content Script
// Injects the overlay into the current page by asking the background service
// worker to run it in the MAIN world via chrome.scripting.executeScript.
// This bypasses the page's Content-Security-Policy so it works on Next.js,
// Vite, and any other dev server that sets a strict script-src CSP.

const DEFAULT_PORT = 3700;
const STORAGE_KEY = "proto-studio-config";

interface ProtoExtConfig {
  port: number;
  enabled: boolean;
}

function getConfig(): Promise<ProtoExtConfig> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "get-config" }, (response) => {
      resolve(response || { port: DEFAULT_PORT, enabled: true });
    });
  });
}

async function init() {
  const config = await getConfig();
  if (!config.enabled) return;

  // Skip if already injected (e.g. server-side injection or duplicate run)
  if (document.getElementById("proto-studio-root")) return;

  // Ask the background service worker to inject the overlay via
  // chrome.scripting.executeScript (world: MAIN) so it bypasses page CSP.
  chrome.runtime.sendMessage(
    { type: "inject-overlay", port: config.port },
    (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        console.warn(
          "[Proto Studio] scripting injection failed:",
          chrome.runtime.lastError?.message ?? response?.reason,
          "— check that the extension has host permissions for this origin.",
        );
      }
    },
  );

  // Screenshot relay: the overlay (running in MAIN world) dispatches
  // 'proto-capture-request' on the shared DOM; we forward it to background
  // which has captureVisibleTab access, and relay the result back.
  listenForScreenshotRequests();
}

/**
 * Relay screenshot capture requests from the injected overlay to the background
 * service worker, then dispatch the result back as a custom event.
 * Content scripts share the DOM event bus with MAIN world scripts.
 */
function listenForScreenshotRequests() {
  document.addEventListener("proto-capture-request", () => {
    chrome.runtime.sendMessage({ type: "capture-screenshot" }, (response) => {
      if (!response?.dataUrl) return;
      document.dispatchEvent(
        new CustomEvent("proto-capture-response", {
          detail: { dataUrl: response.dataUrl },
        }),
      );
    });
  });
}

// Reload the page when config changes (new port requires new WS connection)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "proto-config-updated") {
    window.location.reload();
  }
});

init();
