// Proto Studio Chrome Extension — Content Script
// Injects the overlay into the current page, connecting to the CLI server.
// Skips injection if the server-injected overlay is already present.
// The overlay script is shared with the CLI server (getOverlayScript).

import { getOverlayScript } from "../client/overlay.js";

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

  // Don't inject if server overlay already present
  if (document.getElementById("proto-studio-root")) return;

  injectOverlay(config.port);
  listenForScreenshotRequests();
}

function injectOverlay(port: number) {
  const script = document.createElement("script");
  script.setAttribute("data-proto-overlay", "extension");
  script.textContent = getOverlayScript(port);
  document.body.appendChild(script);
}

/**
 * Relay screenshot capture requests from the injected overlay to the background
 * service worker, then dispatch the result back as a custom event.
 * The injected overlay fires 'proto-capture-request' and listens for
 * 'proto-capture-response'. Content scripts can call chrome.runtime.sendMessage
 * while injected page scripts cannot.
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
