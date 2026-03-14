// Proto Studio Chrome Extension — Background Service Worker (MV3)
// Maintains connection state and relays between popup and content script.

import { getOverlayScript } from "../client/overlay.js";

const DEFAULT_PORT = 3700;
const STORAGE_KEY = "proto-studio-config";

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "proto-annotate",
    title: "Proto Studio: Add Task",
    contexts: ["all"],
    documentUrlPatterns: ["http://*/*", "https://*/*"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "proto-annotate" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "proto-context-menu",
      x: 0,
      y: 0,
    });
  }
});

// Message handling between popup and content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "get-config") {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      sendResponse(result[STORAGE_KEY] || { port: DEFAULT_PORT, enabled: true });
    });
    return true;
  }

  if (msg.type === "set-config") {
    chrome.storage.local.set({ [STORAGE_KEY]: msg.config }, () => {
      // Notify all tabs of config change
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs
              .sendMessage(tab.id, { type: "proto-config-updated", config: msg.config })
              .catch(() => {});
          }
        }
      });
      sendResponse({ success: true });
    });
    return true;
  }

  /**
   * Inject the overlay into the page using chrome.scripting.executeScript with
   * world: "MAIN".  This runs the code in the page's own JS context rather than
   * the extension's isolated world, and — critically — completely bypasses the
   * page's Content-Security-Policy.  Without this, Next.js / Vite apps that set
   * a strict CSP silently block the inline <script> tag injection.
   */
  if (msg.type === "inject-overlay") {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ success: false, reason: "no-tab" }); return true; }

    const overlayCode = getOverlayScript(msg.port as number);
    chrome.scripting
      .executeScript({
        target: { tabId },
        world: "MAIN",
        // Indirect eval runs in global scope — extension-injected scripts are
        // not subject to the page's script-src CSP directive.
        func: (code: string) => { (0, eval)(code); },
        args: [overlayCode],
      })
      .then(() => sendResponse({ success: true }))
      .catch((err: Error) => sendResponse({ success: false, reason: err.message }));
    return true; // async response
  }

  if (msg.type === "capture-screenshot") {
    chrome.tabs.captureVisibleTab(null as unknown as number, { format: "png" }, (dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true; // async response
  }
});

// MV3 keepalive: prevent service worker from going idle during active sessions
const KEEPALIVE_ALARM = "ps-keepalive";
chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== KEEPALIVE_ALARM) return;
  chrome.runtime.getPlatformInfo().catch(() => {});
});
