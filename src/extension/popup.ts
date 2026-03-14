// Proto Studio — Extension Popup Script
const portInput = document.getElementById("port") as HTMLInputElement;
const toggle = document.getElementById("toggle") as HTMLDivElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

interface ExtConfig {
  port: number;
  enabled: boolean;
}

function loadConfig() {
  chrome.runtime.sendMessage({ type: "get-config" }, (config: ExtConfig) => {
    if (!config) return;
    portInput.value = String(config.port);
    toggle.classList.toggle("on", config.enabled);
    checkServer(config.port);
  });
}

function saveConfig() {
  const config: ExtConfig = {
    port: parseInt(portInput.value, 10) || 3700,
    enabled: toggle.classList.contains("on"),
  };
  chrome.runtime.sendMessage({ type: "set-config", config });
  checkServer(config.port);
}

async function checkServer(port: number) {
  try {
    const res = await fetch(`http://localhost:${port}/api/tasks`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      statusEl.textContent = "Connected";
      statusEl.className = "status connected";
    } else {
      throw new Error("not ok");
    }
  } catch {
    statusEl.textContent = "Server not running";
    statusEl.className = "status disconnected";
  }
}

portInput.addEventListener("change", saveConfig);
toggle.addEventListener("click", () => {
  toggle.classList.toggle("on");
  saveConfig();
});

loadConfig();
