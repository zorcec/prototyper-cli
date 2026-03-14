// Proto Studio Chrome Extension — Background Service Worker (MV3)
// Maintains connection state and relays between popup and content script.

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
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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
